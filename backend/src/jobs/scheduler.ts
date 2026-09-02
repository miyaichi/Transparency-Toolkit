import cron from 'node-cron';
import { query } from '../db/client';
import { StreamImporter } from '../ingest/stream_importer';
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

  // The two phases are isolated. They previously shared one try, so a single
  // connection-pool timeout while scanning ads.txt aborted the run before
  // sellers.json was ever synced. That is how sellers.json fetching stayed dead
  // for over a week in August while ads.txt scanning looked healthy: the logs
  // showed "Job failed: Connection terminated due to connection timeout" every
  // 15 minutes, and phase 2 never ran. A failure in one phase must not starve
  // the other.
  try {
    try {
      // 1. Monitored Ads.txt Scans
      await processMonitoredDomains();
    } catch (e) {
      console.error('Ads.txt scan phase failed:', e);
    }

    try {
      // 2. Sync Sellers.json
      await processMissingSellers();
    } catch (e) {
      console.error('Sellers.json sync phase failed:', e);
    }

    // 3. Supply Chain Discovery removed (2026-04-04)
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
  // 1. Supply domains (google.com, rubiconproject.com, ...) come from
  //    supply_domain_refs, which AdsTxtScanner maintains as each file is scanned.
  //
  //    This used to select the latest content for EVERY scanned domain and parse
  //    it here. At 26,738 domains that meant pulling and parsing 291 MB every 15
  //    minutes, which OOMed the container and left sellers.json fetching dead for
  //    over a week in August 2026. The set is now read as short strings and the
  //    cost no longer grows with the size of the stored corpus.
  const supplyRes = await query(`SELECT DISTINCT supply_domain AS domain FROM supply_domain_refs`);
  const supplyDomains = new Set<string>(supplyRes.rows.map((r: { domain: string }) => r.domain));

  console.log(`Found ${supplyDomains.size} unique supply domains from supply_domain_refs`);

  if (supplyDomains.size === 0) {
    console.warn(
      'supply_domain_refs is empty; run the backfill (scripts/backfill_supply_domain_refs.ts) ' +
        'or wait for ads.txt scans to repopulate it.',
    );
    return;
  }

  // 2. Single set-based query to find supply domains due for a (re-)fetch.
  //    "Due" means: never fetched, OR next_fetch_at has passed (jitter-based),
  //    OR next_fetch_at is NULL with fetched_at older than 6h (pre-migration rows).
  const MAX_PROCESS_LIMIT = 50;
  // Give up on a host after this many consecutive failures. A successful fetch resets
  // the count, so a host that comes back online is picked up again normally.
  const MAX_SELLERS_FETCH_FAILURES = 5;

  const dueDomainRes = await query(
    `WITH latest_fetches AS (
       SELECT DISTINCT ON (domain)
         domain,
         fetched_at,
         next_fetch_at
       FROM raw_sellers_files
       WHERE domain = ANY($1::text[])
       ORDER BY domain, fetched_at DESC
     ),
     -- Consecutive failures since the last successful fetch, per domain.
     fail_counts AS (
       SELECT domain, count(*) FILTER (
                WHERE http_status IS DISTINCT FROM 200
                  AND fetched_at > COALESCE(last_ok, '-infinity'::timestamptz)
              ) AS failures
       FROM (
         SELECT domain, http_status, fetched_at,
                max(fetched_at) FILTER (WHERE http_status = 200)
                  OVER (PARTITION BY domain) AS last_ok
         FROM raw_sellers_files
         WHERE domain = ANY($1::text[])
       ) t
       GROUP BY domain
     )
     -- Never-fetched domains first, then least-recently-attempted.
     --
     -- Without an ORDER BY this query kept returning the same head of the list, and
     -- domains that fail fast become due again immediately, so a handful of permanently
     -- broken hosts monopolised every batch: sonobi.com had been attempted 78 times and
     -- publishers.logicad.jp 75, while only 736 of 16,374 supply domains had ever been
     -- tried once. Ordering by attempt count drains the backlog instead.
     SELECT candidate.domain
     FROM unnest($1::text[]) AS candidate(domain)
     LEFT JOIN latest_fetches lf ON lf.domain = candidate.domain
     LEFT JOIN fail_counts fc ON fc.domain = candidate.domain
     WHERE
       (lf.domain IS NULL
        OR lf.next_fetch_at <= NOW()
        OR (lf.next_fetch_at IS NULL AND lf.fetched_at < NOW() - INTERVAL '6 hours'))
       -- Stop hammering hosts that have refused us many times over. 200s reset the
       -- count, so a host that starts working again is picked up normally.
       AND COALESCE(fc.failures, 0) < $3
     ORDER BY lf.fetched_at ASC NULLS FIRST
     LIMIT $2`,
    [Array.from(supplyDomains), MAX_PROCESS_LIMIT, MAX_SELLERS_FETCH_FAILURES],
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
