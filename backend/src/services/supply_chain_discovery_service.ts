import { query } from '../db/client';
import { StreamImporter } from '../ingest/stream_importer';

/**
 * Supply Chain Discovery Service
 * 
 * Manages phased depth expansion for recursive supply chain traversal.
 * Discovers and fetches sellers.json files from INTERMEDIARY seller_domain references.
 */
export class SupplyChainDiscoveryService {
  private readonly MAX_DEPTH: number;
  private readonly BATCH_SIZE = 50;

  constructor(maxDepth: number = 2) {
    this.MAX_DEPTH = maxDepth;
  }

  /**
   * Phase 1: Discover new domains from INTERMEDIARY entries
   * 
   * Scans sellers_catalog for INTERMEDIARY entries whose seller_domain
   * hasn't been fetched yet, and adds them to the discovery queue.
   * 
   * @param targetDepth - The depth level to discover (0=direct SSPs, 1=depth2, 2=depth3...)
   * @returns Number of new domains added to queue
   */
  async discoverIntermediaryDomains(targetDepth: number): Promise<number> {
    if (targetDepth < 0 || targetDepth > this.MAX_DEPTH) {
      throw new Error(`Target depth ${targetDepth} out of range [0, ${this.MAX_DEPTH}]`);
    }

    // For depth=0: Discover from all INTERMEDIARY entries in sellers_catalog
    // For depth>0: Discover from sellers added at previous depth
    const depthFilter = targetDepth === 0
      ? '1=1' // All existing INTERMEDIARY entries
      : `sc.domain IN (
          SELECT domain FROM supply_chain_discovery_queue
          WHERE depth = ${targetDepth - 1} AND status = 'fetched'
        )`;

    const discoverSql = `
      INSERT INTO supply_chain_discovery_queue (domain, discovered_from, depth, status)
      SELECT DISTINCT
        sc.seller_domain AS domain,
        sc.domain AS discovered_from,
        $1::integer AS depth,
        'pending' AS status
      FROM sellers_catalog sc
      WHERE sc.seller_type = 'INTERMEDIARY'
        AND sc.seller_domain IS NOT NULL
        AND sc.seller_domain != ''
        AND ${depthFilter}
        AND NOT EXISTS (
          SELECT 1 FROM raw_sellers_files rsf
          WHERE rsf.domain = sc.seller_domain
        )
        AND NOT EXISTS (
          SELECT 1 FROM supply_chain_discovery_queue scdq
          WHERE scdq.domain = sc.seller_domain
        )
      ON CONFLICT (domain) DO NOTHING
      RETURNING domain;
    `;

    const result = await query(discoverSql, [targetDepth]);
    const discoveredCount = result.rowCount ?? 0;

    console.log(`[SupplyChainDiscovery] Discovered ${discoveredCount} new domains at depth=${targetDepth}`);
    return discoveredCount;
  }

  /**
   * Phase 2: Process pending domains in the queue
   * 
   * Fetches sellers.json for pending domains in batches, respecting depth order.
   * Lower depth (closer to publisher) is prioritized.
   * 
   * @param batchSize - Number of domains to process in this run (default: 50)
   * @returns Object with counts: { processed, succeeded, failed }
   */
  async processQueue(batchSize: number = this.BATCH_SIZE): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    // Select pending domains, prioritizing lower depth
    const selectSql = `
      SELECT domain, depth, discovered_from
      FROM supply_chain_discovery_queue
      WHERE status = 'pending' AND depth <= $1
      ORDER BY depth ASC, queued_at ASC
      LIMIT $2
    `;

    const pendingRes = await query(selectSql, [this.MAX_DEPTH, batchSize]);
    const pending = pendingRes.rows;

    if (pending.length === 0) {
      console.log('[SupplyChainDiscovery] No pending domains to process');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log(`[SupplyChainDiscovery] Processing ${pending.length} domains from queue`);

    let succeeded = 0;
    let failed = 0;

    const importer = new StreamImporter();

    for (const item of pending) {
      const { domain, depth } = item;
      const url = `https://${domain}/sellers.json`;

      try {
        console.log(`[SupplyChainDiscovery] Fetching depth=${depth} domain=${domain}`);
        await importer.importSellersJson({ domain, url });

        // Mark as fetched
        await query(
          `UPDATE supply_chain_discovery_queue
           SET status = 'fetched', fetched_at = NOW()
           WHERE domain = $1`,
          [domain],
        );

        succeeded++;
      } catch (error: any) {
        console.error(`[SupplyChainDiscovery] Failed to fetch ${domain}:`, error.message);

        // Mark as failed with error message
        await query(
          `UPDATE supply_chain_discovery_queue
           SET status = 'failed', 
               error_message = $1,
               retry_count = retry_count + 1,
               last_retry_at = NOW()
           WHERE domain = $2`,
          [error.message || 'Unknown error', domain],
        );

        failed++;
      }
    }

    await importer.close();

    console.log(
      `[SupplyChainDiscovery] Batch complete: ${succeeded} succeeded, ${failed} failed out of ${pending.length}`,
    );

    return {
      processed: pending.length,
      succeeded,
      failed,
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byDepth: Record<number, number>;
  }> {
    const totalRes = await query('SELECT COUNT(*) as count FROM supply_chain_discovery_queue', []);
    const total = parseInt(totalRes.rows[0]?.count || '0');

    const byStatusRes = await query(
      'SELECT status, COUNT(*) as count FROM supply_chain_discovery_queue GROUP BY status',
      [],
    );
    const byStatus: Record<string, number> = {};
    for (const row of byStatusRes.rows) {
      byStatus[row.status] = parseInt(row.count);
    }

    const byDepthRes = await query(
      'SELECT depth, COUNT(*) as count FROM supply_chain_discovery_queue GROUP BY depth ORDER BY depth',
      [],
    );
    const byDepth: Record<number, number> = {};
    for (const row of byDepthRes.rows) {
      byDepth[row.depth] = parseInt(row.count);
    }

    return { total, byStatus, byDepth };
  }
}
