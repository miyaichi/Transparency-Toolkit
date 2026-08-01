import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { pool, query } from '../db/client';
import { generateCandidates } from './candidate_generator';
import { probePending } from './prober';
import { enroll, resetLanguageRejections, requeueAdsTxtHolders } from './enroller';

/**
 * Publisher discovery runner.
 *
 *   ts-node src/discovery/runner.ts refresh
 *   ts-node src/discovery/runner.ts probe   [--limit 2000] [--concurrency 20]
 *   ts-node src/discovery/runner.ts enroll  [--max 1000] [--wave1]
 *   ts-node src/discovery/runner.ts reset-language-rejections
 *   ts-node src/discovery/runner.ts stats
 *
 * Recommended first wave (report-safe, ~10% of current base):
 *   refresh -> probe --limit 20000 -> enroll --max 1000 --wave1
 */

function flag(name: string, def: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : def;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function printStats() {
  const s = await query(
    `SELECT status, count(*) n,
            count(*) FILTER (WHERE is_japanese) jp,
            count(*) FILTER (WHERE is_japanese AND ads_txt_valid) jp_valid
     FROM publisher_discovery GROUP BY status ORDER BY status`,
  );
  console.table(s.rows);
  const src = await query(
    `SELECT source, count(*) n FROM monitored_domains WHERE file_type='ads.txt' GROUP BY source ORDER BY n DESC`,
  );
  console.log('monitored_domains(ads.txt) by source:');
  console.table(src.rows);
}

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'refresh': {
      console.time('refresh');
      const r = await generateCandidates();
      console.timeEnd('refresh');
      console.log(`Candidates: scanned ${r.scanned} distinct domains, inserted ${r.inserted} new pending rows.`);
      break;
    }
    case 'probe': {
      const limit = flag('limit', 2000);
      const concurrency = flag('concurrency', 20);
      console.time('probe');
      const r = await probePending(limit, concurrency);
      console.timeEnd('probe');
      console.log(`Probed ${r.probed} (JP & valid: ${r.jpValid}), failed/unreachable: ${r.failed}.`);
      break;
    }
    case 'enroll': {
      const max = flag('max', 1000);
      const wave1 = has('wave1');
      const r = await enroll({ max, highConfidenceOnly: wave1 });
      console.log(`Enrolled ${r.enrolled} domain(s) into monitored_domains (source=discovery). Rejected ${r.rejected}.`);
      break;
    }
    case 'reset-language-rejections': {
      const r = await resetLanguageRejections();
      console.log(`Re-queued ${r.requeued} candidate(s) rejected under the previous language detector.`);
      break;
    }
    case 'requeue-adstxt-holders': {
      const r = await requeueAdsTxtHolders();
      console.log(`Re-queued ${r.requeued} candidate(s) that serve an ads.txt but failed the old SSP-match gate.`);
      break;
    }
    case 'stats':
      await printStats();
      break;
    default:
      console.error('Usage: runner.ts <refresh|probe|enroll|reset-language-rejections|requeue-adstxt-holders|stats> [options]');
      process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error('discovery runner failed:', e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
