/**
 * Scheduled Hop Calculation Job
 * 
 * Calculates supply chain hops for monitored domains in batches.
 * Intended to run daily via Cloud Scheduler.
 */

import { query } from '../db/client';
import { HopCalculatorServiceV3 } from '../services/hop_calculator_service_v3';

const BATCH_SIZE = 1000; // Process 1000 domains per day

/**
 * Get the last processed domain from a progress tracking table
 */
async function getLastProcessedDomain(): Promise<string | null> {
  // For now, use a simple approach: check the latest publisher_domain in supply_chain_hops
  const sql = `
    SELECT publisher_domain
    FROM supply_chain_hops
    ORDER BY computed_at DESC
    LIMIT 1
  `;

  const result = await query(sql);
  return result.rows.length > 0 ? result.rows[0].publisher_domain : null;
}

/**
 * Calculate hops for the next batch of domains
 */
export async function runScheduledHopCalculation(): Promise<{
  processed: number;
  resolved: number;
  unresolved: number;
  startDomain: string | null;
  endDomain: string | null;
}> {
  console.log('[ScheduledHopCalc] Starting scheduled hop calculation...');

  const lastProcessed = await getLastProcessedDomain();
  console.log(`[ScheduledHopCalc] Last processed domain: ${lastProcessed ?? 'none'}`);

  // Get the next batch of domains
  const domainsSql = `
    SELECT md.domain
    FROM monitored_domains md
    WHERE EXISTS (
      SELECT 1 FROM ads_txt_scans ats
      WHERE ats.domain = md.domain
        AND ats.status_code = 200
        AND ats.records_count > 0
    )
    ${lastProcessed ? `AND md.domain > $1` : ''}
    ORDER BY md.domain
    LIMIT $${lastProcessed ? '2' : '1'}
  `;

  const params = lastProcessed ? [lastProcessed, BATCH_SIZE] : [BATCH_SIZE];
  const domainsRes = await query(domainsSql, params);
  const domains = domainsRes.rows;

  if (domains.length === 0) {
    console.log('[ScheduledHopCalc] No more domains to process. Resetting to start.');
    // Reset: start from beginning
    const resetSql = `
      SELECT md.domain
      FROM monitored_domains md
      WHERE EXISTS (
        SELECT 1 FROM ads_txt_scans ats
        WHERE ats.domain = md.domain
          AND ats.status_code = 200
          AND ats.records_count > 0
      )
      ORDER BY md.domain
      LIMIT $1
    `;
    const resetRes = await query(resetSql, [BATCH_SIZE]);
    domains.push(...resetRes.rows);
  }

  if (domains.length === 0) {
    console.log('[ScheduledHopCalc] No domains with valid ads.txt scans found.');
    return {
      processed: 0,
      resolved: 0,
      unresolved: 0,
      startDomain: null,
      endDomain: null,
    };
  }

  console.log(`[ScheduledHopCalc] Processing ${domains.length} domains...`);

  const calculator = new HopCalculatorServiceV3();
  let totalProcessed = 0;
  let totalResolved = 0;
  let totalUnresolved = 0;

  const startDomain = domains[0].domain;
  let endDomain = startDomain;

  for (const domainRow of domains) {
    const publisherDomain = domainRow.domain;

    try {
      // Get latest scan
      const scanSql = `
        SELECT content
        FROM ads_txt_scans
        WHERE domain = $1
          AND status_code = 200
          AND content IS NOT NULL
        ORDER BY scanned_at DESC
        LIMIT 1
      `;

      const scanRes = await query(scanSql, [publisherDomain]);
      if (scanRes.rows.length === 0) continue;

      const content = scanRes.rows[0].content;
      const lines = content.split('\n');

      let domainProcessed = 0;
      let domainResolved = 0;
      let domainUnresolved = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const parts = trimmed.split(',').map((p: string) => p.trim());
        if (parts.length < 3) continue;

        const [sspDomain, accountId, relationship] = parts;
        if (!['DIRECT', 'RESELLER'].includes(relationship.toUpperCase())) continue;

        domainProcessed++;

        const result = await calculator['calculateHopForEntry'](
          publisherDomain,
          sspDomain.toLowerCase(),
          accountId,
          'ads.txt'
        );

        if (result.is_resolved) {
          domainResolved++;
        } else {
          domainUnresolved++;
        }
      }

      totalProcessed += domainProcessed;
      totalResolved += domainResolved;
      totalUnresolved += domainUnresolved;

      endDomain = publisherDomain;

      if (totalProcessed % 100 === 0) {
        console.log(
          `[ScheduledHopCalc] Progress: ${totalProcessed} entries ` +
          `(${totalResolved} resolved, ${totalUnresolved} unresolved)`
        );
      }
    } catch (error: any) {
      console.error(`[ScheduledHopCalc] Error processing ${publisherDomain}:`, error.message);
      // Continue with next domain
    }
  }

  console.log(
    `[ScheduledHopCalc] Completed: ${totalProcessed} entries, ` +
    `${totalResolved} resolved, ${totalUnresolved} unresolved`
  );
  console.log(`[ScheduledHopCalc] Range: ${startDomain} → ${endDomain}`);

  return {
    processed: totalProcessed,
    resolved: totalResolved,
    unresolved: totalUnresolved,
    startDomain,
    endDomain,
  };
}

// For manual execution
if (require.main === module) {
  runScheduledHopCalculation()
    .then((result) => {
      console.log('\n=== Summary ===');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}
