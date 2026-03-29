#!/usr/bin/env ts-node

/**
 * Test Hop Calculation for a Single Domain
 * 
 * Usage: ts-node test_single_domain_hops.ts <domain>
 */

import { HopCalculatorServiceV3 } from '../services/hop_calculator_service_v3';
import { query } from '../db/client';

async function testSingleDomain(domain: string) {
  console.log(`=== Testing Hop Calculation for: ${domain} ===\n`);

  const calculator = new HopCalculatorServiceV3();

  // Get ads.txt content
  const scanSql = `
    SELECT content, records_count
    FROM ads_txt_scans
    WHERE domain = $1
      AND status_code = 200
      AND content IS NOT NULL
    ORDER BY scanned_at DESC
    LIMIT 1
  `;

  const scanRes = await query(scanSql, [domain]);
  if (scanRes.rows.length === 0) {
    console.error(`No valid ads.txt scan found for ${domain}`);
    process.exit(1);
  }

  const { content, records_count } = scanRes.rows[0];
  console.log(`Found ads.txt with ${records_count} records\n`);

  // Parse and calculate
  const lines = content.split('\n');
  let processed = 0;
  let resolved = 0;
  let unresolved = 0;
  const hopCounts: number[] = [];
  const samples: any[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(',').map((p: string) => p.trim());
    if (parts.length < 3) continue;

    const [sspDomain, accountId, relationship] = parts;
    if (!['DIRECT', 'RESELLER'].includes(relationship.toUpperCase())) continue;

    processed++;

    const result = await calculator['calculateHopForEntry'](
      domain,
      sspDomain.toLowerCase(),
      accountId,
      'ads.txt'
    );

    if (result.is_resolved) {
      resolved++;
      hopCounts.push(result.hop_count!);

      // Collect samples
      if (samples.length < 20 || result.hop_count! >= 3) {
        samples.push({
          ssp: sspDomain,
          accountId,
          relationship,
          hopCount: result.hop_count,
          chainPath: result.chain_path,
        });
      }
    } else {
      unresolved++;
    }

    if (processed % 50 === 0) {
      console.log(`Progress: ${processed} entries (${resolved} resolved, ${unresolved} unresolved)`);
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Total entries: ${processed}`);
  console.log(`Resolved: ${resolved} (${((resolved / processed) * 100).toFixed(1)}%)`);
  console.log(`Unresolved: ${unresolved} (${((unresolved / processed) * 100).toFixed(1)}%)`);

  if (hopCounts.length > 0) {
    const maxHop = Math.max(...hopCounts);
    const avgHop = hopCounts.reduce((a, b) => a + b, 0) / hopCounts.length;

    console.log(`\n=== Hop Statistics ===`);
    console.log(`Max hop: ${maxHop}`);
    console.log(`Avg hop: ${avgHop.toFixed(2)}`);

    const hopDist = new Map<number, number>();
    hopCounts.forEach(h => hopDist.set(h, (hopDist.get(h) || 0) + 1));

    console.log(`\nHop Distribution:`);
    Array.from(hopDist.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([hop, count]) => {
        const pct = ((count / hopCounts.length) * 100).toFixed(1);
        console.log(`  ${hop} hops: ${count} (${pct}%)`);
      });
  }

  console.log(`\n=== Sample Entries (up to 20) ===`);
  samples.slice(0, 20).forEach((sample, idx) => {
    console.log(`\n${idx + 1}. ${sample.ssp}, ${sample.accountId}, ${sample.relationship}`);
    console.log(`   Hops: ${sample.hopCount}`);
    console.log(`   Chain: ${sample.chainPath.join(' → ')}`);
  });

  process.exit(0);
}

const domain = process.argv[2];
if (!domain) {
  console.error('Usage: ts-node test_single_domain_hops.ts <domain>');
  process.exit(1);
}

testSingleDomain(domain).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
