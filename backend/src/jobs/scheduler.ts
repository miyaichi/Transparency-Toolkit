import cron from 'node-cron';
import { query } from '../db/client';
import { StreamImporter } from '../ingest/stream_importer';
import { parseAdsTxtContent } from '../lib/adstxt/validator';
import { AdsTxtScanner } from '../services/adstxt_scanner';
import { MonitoredDomainsService } from '../services/monitored_domains';
import { runCleanup } from './cleanup';

const monitoredDomainsService = new MonitoredDomainsService();
const scanner = new AdsTxtScanner();

// 処理中のロック（簡易版）
let isJobRunning = false;

// 環境変数からDB接続文字列を取得
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5433/adstxt_v2';

const SPECIAL_DOMAINS: Record<string, string> = {
  // Google
  'google.com': 'https://storage.googleapis.com/adx-rtb-dictionaries/sellers.json',
  'doubleclick.net': 'https://storage.googleapis.com/adx-rtb-dictionaries/sellers.json',
  'googlesyndication.com': 'https://storage.googleapis.com/adx-rtb-dictionaries/sellers.json',

  // AOL / Verizon Group
  'advertising.com': 'https://dragon-advertising.com/sellers.json',
};

export async function runScheduledJobs() {
  if (isJobRunning) {
    console.log('Job is already running, skipping...');
    return;
  }
  isJobRunning = true;
  console.log('Starting scheduled jobs...');

  try {
    // 1. Monitored Ads.txt Scans
    await processMonitoredDomains();

    // 2. Sync Sellers.json
    await processMissingSellers();
  } catch (e) {
    console.error('Job failed:', e);
  } finally {
    isJobRunning = false;
    console.log('Scheduled jobs finished');
  }
}

export function setupCronJobs() {
  console.log('Setting up cron jobs...');

  // Production: Every 15 minutes, Development: Every 1 minute
  // Note: In Cloud Run, this cron might not run reliably. We recommend using Cloud Scheduler triggering /api/jobs/scan
  const schedule = process.env.NODE_ENV === 'production' ? '*/15 * * * *' : '*/1 * * * *';

  cron.schedule(schedule, async () => {
    await runScheduledJobs();
  });

  // 毎日深夜 3:00 にクリーンアップを実行
  cron.schedule('0 3 * * *', async () => {
    console.log('Starting daily cleanup job...');
    await runCleanup();
    console.log('Daily cleanup job finished');
  });
}

/**
 * モニタリング対象のドメインのads.txtをスキャンする
 */
export async function processMonitoredDomains() {
  console.log('Checking for monitored domains due for scan...');
  const dueDomains = await monitoredDomainsService.getDueDomains();
  console.log(`Found ${dueDomains.length} domains due for ads.txt scan.`);

  const importer = new StreamImporter();

  for (const item of dueDomains) {
    console.log(`Scanning ${item.file_type} for monitored domain: ${item.domain}`);
    try {
      if (item.file_type === 'sellers.json') {
        let url = `https://${item.domain}/sellers.json`;
        if (item.domain in SPECIAL_DOMAINS) {
          url = SPECIAL_DOMAINS[item.domain];
        }

        await importer.importSellersJson({ domain: item.domain, url });
        console.log(`Sellers.json import completed for ${item.domain}`);

        // Wait a bit
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        // ads.txt or app-ads.txt
        const result = await scanner.scanAndSave(item.domain, item.file_type);
        console.log(`Scan completed for ${item.domain} (${item.file_type}, ID: ${result.id})`);
      }

      await monitoredDomainsService.updateLastScanned(item.domain, item.file_type);

      // Wait to be polite
      if (item.file_type !== 'sellers.json') await new Promise((r) => setTimeout(r, 1000));
    } catch (e: any) {
      console.error(`Failed to scan ${item.domain} (${item.file_type}): ${e.message}`);
      await monitoredDomainsService.updateLastScanned(item.domain, item.file_type);
    }
  }

  // StreamImporter creates a connection pool in its constructor; close it when done.
  await importer.close();
}

/**
 * Ads.txtの履歴から、まだ取り込んでいないSellers.jsonドメインを探して取り込む
 */
export async function processMissingSellers() {
  // 1. ads.txtの履歴からユニークなドメインリスト（Relationship=DIRECT/RESELLER の system domain）を抽出
  //    本来はバリデーション済みの結果を使うべきだが、ここでは簡易的に ads_txt_scans の最新コンテンツをパースする

  // 最近スキャンされたドメインを取得 (直近1時間とかにするのが良いが、まずは全件から最新1件ずつ)
  const scansRes = await query(`
        SELECT DISTINCT ON (domain) domain, content 
        FROM ads_txt_scans 
        WHERE content IS NOT NULL AND content != ''
        ORDER BY domain, scanned_at DESC
    `);

  // 抽出された供給元ドメイン (google.com, rubiconproject.com etc...)
  const supplyDomains = new Set<string>();

  for (const scan of scansRes.rows) {
    const entries = parseAdsTxtContent(scan.content, scan.domain);
    for (const entry of entries) {
      // Ads.txt Recordかつ、domainが有効なもの
      if ('domain' in entry && entry.domain && entry.domain.includes('.')) {
        supplyDomains.add(entry.domain.toLowerCase().trim());
      }
    }
  }

  console.log(`Found ${supplyDomains.size} unique supply domains from scanned ads.txt files`);

  // 2. 既に raw_sellers_files に取り込み済みのドメインを確認し、未取り込みまたは6時間以上経過したものを対象とする

  const MAX_PROCESS_LIMIT = 50;
  let processedCount = 0;

  const importer = new StreamImporter();

  try {
    for (const supplyDomain of supplyDomains) {
      // チェック：最近取り込まれたか？
      const checkRes = await query(
        `
                SELECT fetched_at FROM raw_sellers_files 
                WHERE domain = $1 
                ORDER BY fetched_at DESC LIMIT 1
            `,
        [supplyDomain],
      );

      let needsUpdate = false;
      if (checkRes.rows.length === 0) {
        needsUpdate = true;
      } else {
        const lastFetched = new Date(checkRes.rows[0].fetched_at).getTime();
        const diff = new Date().getTime() - lastFetched;
        // 6 hours
        if (diff > 6 * 60 * 60 * 1000) {
          needsUpdate = true;
          console.log(
            `Re-fetching outdated sellers.json for ${supplyDomain} (Age: ${Math.round(diff / (1000 * 60 * 60))} hours)`,
          );
        }
      }

      if (needsUpdate) {
        // Check limit
        if (processedCount >= MAX_PROCESS_LIMIT) {
          console.log(`Reached process limit on ${MAX_PROCESS_LIMIT} domains. Stopping early to avoid timeout.`);
          break;
        }

        console.log(`Fetching sellers.json for domain: ${supplyDomain}`);
        try {
          let url = `https://${supplyDomain}/sellers.json`;

          // Use special URL if defined
          if (supplyDomain in SPECIAL_DOMAINS) {
            url = SPECIAL_DOMAINS[supplyDomain];
            console.log(`Using special URL for ${supplyDomain}: ${url}`);
          }

          const target = {
            domain: supplyDomain,
            url,
          };

          await importer.importSellersJson(target);
          console.log(`Successfully imported ${supplyDomain}`);
          processedCount++;

          // 連続アクセスでBANされないよう少しWait
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err: any) {
          console.error(`Failed to import ${supplyDomain}: ${err.message}`);
          // 個別の失敗はログに出して次へ進む
        }
      }
    }
  } finally {
    await importer.close();
  }
}
