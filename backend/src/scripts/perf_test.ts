/**
 * Validation performance profiler
 *
 * Usage:
 *   # 1. Start Cloud SQL Proxy (port 5433)
 *   cloud-sql-proxy apti-ttkit:asia-northeast1:ttkit-db-instance --port 5433
 *
 *   # 2. Run this script
 *   cd backend && npx ts-node src/scripts/perf_test.ts [domain] [domain2] ...
 *
 * Example:
 *   npx ts-node src/scripts/perf_test.ts asahi.com yomiuri.co.jp nikkei.com
 */

import { parseAdsTxtContent } from '../lib/adstxt/validator';
import { crossCheckAdsTxtRecords } from '../lib/adstxt/validator';
import { DbSellersProvider } from '../services/db_sellers_provider';
import { pool } from '../db/client';
import axios from 'axios';

const provider = new DbSellersProvider();

function ms(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

async function fetchAdsTxt(domain: string): Promise<{ content: string; url: string }> {
  const urls = [`https://${domain}/ads.txt`, `http://${domain}/ads.txt`];
  for (const url of urls) {
    try {
      const res = await axios.get(url, { maxRedirects: 5, timeout: 10000 });
      return { content: String(res.data), url };
    } catch {
      continue;
    }
  }
  throw new Error(`Failed to fetch ads.txt from ${domain}`);
}

// Wrap provider to count and time each DB call
function instrumentedProvider(base: DbSellersProvider) {
  const stats = { hasSellerJson: 0, batchGetSellers: 0, hasMs: 0, batchMs: 0 };

  return {
    stats,
    provider: {
      async hasSellerJson(domain: string): Promise<boolean> {
        const t = process.hrtime.bigint();
        const result = await base.hasSellerJson(domain);
        stats.hasMs += ms(t);
        stats.hasSellerJson++;
        return result;
      },
      async batchGetSellers(domain: string, sellerIds: string[]) {
        const t = process.hrtime.bigint();
        const result = await base.batchGetSellers(domain, sellerIds);
        stats.batchMs += ms(t);
        stats.batchGetSellers++;
        return result;
      },
      async getMetadata(domain: string) {
        return base.getMetadata(domain);
      },
    },
  };
}

async function profileDomain(domain: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Domain: ${domain}`);
  console.log('='.repeat(60));

  // Phase 1: Fetch
  let t = process.hrtime.bigint();
  const { content, url } = await fetchAdsTxt(domain);
  const fetchMs = ms(t);
  console.log(`[1] Fetch ads.txt          : ${fetchMs.toFixed(0)} ms  (${url})`);

  // Phase 2: Parse
  t = process.hrtime.bigint();
  const parsedEntries = parseAdsTxtContent(content, domain);
  const parseMs = ms(t);
  const uniqueDomains = new Set(parsedEntries.filter((e: any) => e.domain).map((e: any) => e.domain.toLowerCase()));
  console.log(
    `[2] Parse                  : ${parseMs.toFixed(0)} ms  (${parsedEntries.length} entries, ${uniqueDomains.size} unique SSP domains)`,
  );

  // Phase 3: crossCheckAdsTxtRecords (with instrumented provider)
  const { stats, provider: inst } = instrumentedProvider(provider);
  t = process.hrtime.bigint();
  await crossCheckAdsTxtRecords(domain, parsedEntries, null, inst as any);
  const crossCheckMs = ms(t);

  console.log(`[3] crossCheckAdsTxtRecords: ${crossCheckMs.toFixed(0)} ms`);
  console.log(
    `    hasSellerJson  calls: ${stats.hasSellerJson}  total: ${stats.hasMs.toFixed(0)} ms  avg: ${(stats.hasMs / (stats.hasSellerJson || 1)).toFixed(0)} ms`,
  );
  console.log(
    `    batchGetSellers calls: ${stats.batchGetSellers}  total: ${stats.batchMs.toFixed(0)} ms  avg: ${(stats.batchMs / (stats.batchGetSellers || 1)).toFixed(0)} ms`,
  );

  // Phase 4: Extra batchGetSellers in adstxt_service.ts (duplicated work)
  const accountsByDomain = new Map<string, Set<string>>();
  parsedEntries.forEach((entry: any) => {
    if (entry.domain && entry.account_id) {
      const d = entry.domain.toLowerCase();
      if (!accountsByDomain.has(d)) accountsByDomain.set(d, new Set());
      accountsByDomain.get(d)!.add(entry.account_id);
    }
  });

  const entries = Array.from(accountsByDomain.entries());
  const CHUNK_SIZE = 5;
  let extraBatchMs = 0;
  let extraBatchCalls = 0;
  t = process.hrtime.bigint();
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async ([d, ids]) => {
        const ct = process.hrtime.bigint();
        await provider.batchGetSellers(d, Array.from(ids));
        extraBatchMs += ms(ct);
        extraBatchCalls++;
      }),
    );
  }
  const extraTotalMs = ms(t);
  console.log(
    `[4] Extra batchGetSellers  : ${extraTotalMs.toFixed(0)} ms  (${extraBatchCalls} calls, chunk=${CHUNK_SIZE})`,
  );

  const totalMs = fetchMs + parseMs + crossCheckMs + extraTotalMs;
  console.log(`\n    TOTAL estimated        : ${totalMs.toFixed(0)} ms`);
}

async function main() {
  const domains = process.argv.slice(2);
  if (domains.length === 0) {
    console.log('Usage: npx ts-node src/scripts/perf_test.ts <domain> [domain2] ...');
    process.exit(1);
  }

  // Warm up DB connection
  await pool.query('SELECT 1');
  console.log('DB connection established.');

  for (const domain of domains) {
    try {
      await profileDomain(domain);
    } catch (e: any) {
      console.error(`Error for ${domain}: ${e.message}`);
    }
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
