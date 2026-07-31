import cron from 'node-cron';
import { query } from '../db/client';
import { StreamImporter } from '../ingest/stream_importer';
import { parseAdsTxtContent } from '../lib/adstxt/validator';
import { AdsTxtScanner } from '../services/adstxt_scanner';
import { LanguageDetector } from '../services/language_detector';
import { MonitoredDomainsService } from '../services/monitored_domains';

import { runCleanup } from './cleanup';
import { mapPool } from '../lib/concurrency';

const monitoredDomainsService = new MonitoredDomainsService();
const scanner = new AdsTxtScanner();

// Scan throughput. The previous sequential loop managed ~50 domains per run at ~6s each
// (a 1s politeness sleep plus two HTTP fetches), which could not keep a growing monitored
// set inside its 14-day cycle. Distinct hosts are fetched concurrently instead; the
// politeness sleep is dropped because consecutive items are different domains.
const SCAN_BATCH_SIZE = Number(process.env.SCAN_BATCH_SIZE ?? 200);
const SCAN_CONCURRENCY = Number(process.env.SCAN_CONCURRENCY ?? 8);
const languageDetector = new LanguageDetector();

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

    // 3. Supply Chain Discovery removed (2026-04-04)
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
  const dueDomains = await monitoredDomainsService.getDueDomains(SCAN_BATCH_SIZE);
  console.log(`Found ${dueDomains.length} domains due for ads.txt scan.`);

  const importer = new StreamImporter();

  // ads.txt/app-ads.txt fetches are independent hosts, so they run concurrently.
  // sellers.json stays sequential: those files are frequently hundreds of MB and
  // streaming several at once would blow up memory.
  const fileScans = dueDomains.filter(
    (d): d is typeof d & { file_type: 'ads.txt' | 'app-ads.txt' } => d.file_type !== 'sellers.json',
  );
  const sellersScans = dueDomains.filter((d) => d.file_type === 'sellers.json');

  const started = Date.now();

  await mapPool(fileScans, SCAN_CONCURRENCY, async (item) => {
    try {
      const result = await scanner.scanAndSave(item.domain, item.file_type);
      console.log(`Scan completed for ${item.domain} (${item.file_type}, ID: ${result.id})`);

      // Piggyback content-language detection on the scan (no-op if a fresh result exists)
      const lang = await languageDetector.detectIfDue(item.domain);
      if (lang) {
        console.log(
          `Language detected for ${item.domain}: ${lang.content_lang ?? 'unknown'} (${lang.lang_source ?? 'n/a'})`,
        );
      }
      await monitoredDomainsService.updateLastScanned(item.domain, item.file_type);
    } catch (e: any) {
      console.error(`Failed to scan ${item.domain} (${item.file_type}): ${e.message}`);
      // Still reschedule, so one bad domain cannot block the queue forever.
      await monitoredDomainsService.updateLastScanned(item.domain, item.file_type);
    }
  });

  for (const item of sellersScans) {
    console.log(`Scanning ${item.file_type} for monitored domain: ${item.domain}`);
    try {
      let url = `https://${item.domain}/sellers.json`;
      if (item.domain in SPECIAL_DOMAINS) {
        url = SPECIAL_DOMAINS[item.domain];
      }

      await importer.importSellersJson({ domain: item.domain, url });
      console.log(`Sellers.json import completed for ${item.domain}`);

      await monitoredDomainsService.updateLastScanned(item.domain, item.file_type);

      // Wait a bit
      await new Promise((r) => setTimeout(r, 1000));
    } catch (e: any) {
      console.error(`Failed to scan ${item.domain} (${item.file_type}): ${e.message}`);
      await monitoredDomainsService.updateLastScanned(item.domain, item.file_type);
    }
  }

  console.log(
    `Scanned ${fileScans.length} file(s) + ${sellersScans.length} sellers.json in ${Math.round((Date.now() - started) / 1000)}s`,
  );

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

  if (supplyDomains.size === 0) return;

  // 2. Single set-based query to find supply domains due for a (re-)fetch.
  //    "Due" means: never fetched, OR next_fetch_at has passed (jitter-based),
  //    OR next_fetch_at is NULL with fetched_at older than 6h (pre-migration rows).
  const MAX_PROCESS_LIMIT = 50;

  const dueDomainRes = await query(
    `WITH latest_fetches AS (
       SELECT DISTINCT ON (domain)
         domain,
         fetched_at,
         next_fetch_at
       FROM raw_sellers_files
       WHERE domain = ANY($1::text[])
       ORDER BY domain, fetched_at DESC
     )
     SELECT candidate.domain
     FROM unnest($1::text[]) AS candidate(domain)
     LEFT JOIN latest_fetches lf ON lf.domain = candidate.domain
     WHERE
       lf.domain IS NULL
       OR lf.next_fetch_at <= NOW()
       OR (lf.next_fetch_at IS NULL AND lf.fetched_at < NOW() - INTERVAL '6 hours')
     LIMIT $2`,
    [Array.from(supplyDomains), MAX_PROCESS_LIMIT],
  );

  const domainsDue: string[] = dueDomainRes.rows.map((r: { domain: string }) => r.domain);

  console.log(`${domainsDue.length} supply domains due for sellers.json fetch`);

  const importer = new StreamImporter();

  try {
    for (const supplyDomain of domainsDue) {
      console.log(`Fetching sellers.json for domain: ${supplyDomain}`);
      try {
        let url = `https://${supplyDomain}/sellers.json`;

        // Use special URL if defined
        if (supplyDomain in SPECIAL_DOMAINS) {
          url = SPECIAL_DOMAINS[supplyDomain];
          console.log(`Using special URL for ${supplyDomain}: ${url}`);
        }

        await importer.importSellersJson({ domain: supplyDomain, url });
        console.log(`Successfully imported ${supplyDomain}`);

        // Wait between requests to avoid rate limiting
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err: any) {
        console.error(`Failed to import ${supplyDomain}: ${err.message}`);
      }
    }
  } finally {
    await importer.close();
  }
}
