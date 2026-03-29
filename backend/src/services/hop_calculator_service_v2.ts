import { query } from '../db/client';
import { parseAdsTxtContent } from 'adstxt-validator';

/**
 * Supply Chain Hop Calculator Service (V2)
 * 
 * Simplified approach: For each seller entry in sellers_catalog,
 * calculate the hop depth by tracing INTERMEDIARY references.
 */
export class HopCalculatorServiceV2 {
  private readonly MAX_DEPTH = 10;

  /**
   * Calculate hops for all sellers in sellers_catalog
   * 
   * For each (domain, seller_id) in sellers_catalog,
   * traces the INTERMEDIARY chain to determine hop count.
   */
  async calculateAllHops(): Promise<{
    processed: number;
    resolved: number;
    unresolved: number;
  }> {
    console.log('[HopCalculatorV2] Starting hop calculation for all sellers...');

    // Strategy: For each seller in sellers_catalog, calculate how deep it is
    // by following its INTERMEDIARY references

    // Get all DIRECT/PUBLISHER sellers (hop_count = 1)
    const directSql = `
      INSERT INTO supply_chain_hops (
        publisher_domain, ssp_domain, account_id, file_type,
        hop_count, is_resolved, resolved_depth, chain_path, computed_at
      )
      SELECT DISTINCT
        sc.domain AS publisher_domain,
        sc.domain AS ssp_domain,
        sc.seller_id AS account_id,
        'ads.txt' AS file_type,
        1 AS hop_count,
        true AS is_resolved,
        1 AS resolved_depth,
        ARRAY[sc.domain] AS chain_path,
        NOW() AS computed_at
      FROM sellers_catalog sc
      WHERE sc.seller_type IN ('DIRECT', 'PUBLISHER')
        AND NOT EXISTS (
          SELECT 1 FROM supply_chain_hops sch
          WHERE sch.publisher_domain = sc.domain
            AND sch.ssp_domain = sc.domain
            AND sch.account_id = sc.seller_id
        )
      ON CONFLICT (publisher_domain, ssp_domain, account_id, file_type)
      DO UPDATE SET
        hop_count = EXCLUDED.hop_count,
        is_resolved = EXCLUDED.is_resolved,
        resolved_depth = EXCLUDED.resolved_depth,
        chain_path = EXCLUDED.chain_path,
        computed_at = NOW()
    `;

    const directRes = await query(directSql);
    const directCount = directRes.rowCount ?? 0;
    console.log(`[HopCalculatorV2] Inserted ${directCount} direct/publisher hops (hop=1)`);

    // Get all INTERMEDIARY sellers and trace them
    const intermediarySql = `
      SELECT DISTINCT
        sc.domain,
        sc.seller_id,
        sc.seller_domain
      FROM sellers_catalog sc
      WHERE sc.seller_type = 'INTERMEDIARY'
        AND sc.seller_domain IS NOT NULL
        AND sc.seller_domain != ''
    `;

    const intermediaryRes = await query(intermediarySql);
    const intermediaries = intermediaryRes.rows;

    console.log(`[HopCalculatorV2] Found ${intermediaries.length} INTERMEDIARY sellers to trace`);

    let processed = directCount;
    let resolved = directCount;
    let unresolved = 0;

    // Process INTERMEDIARYs in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < intermediaries.length; i += BATCH_SIZE) {
      const batch = intermediaries.slice(i, i + BATCH_SIZE);

      for (const record of batch) {
        const result = await this.traceHop(record.domain, record.seller_id, record.seller_domain);
        processed++;

        if (result.is_resolved) {
          resolved++;
        } else {
          unresolved++;
        }

        if (processed % 100 === 0) {
          console.log(
            `[HopCalculatorV2] Processed ${processed}/${directCount + intermediaries.length} ` +
            `(${resolved} resolved, ${unresolved} unresolved)`
          );
        }
      }
    }

    console.log(`[HopCalculatorV2] Completed: ${processed} total, ${resolved} resolved, ${unresolved} unresolved`);
    return { processed, resolved, unresolved };
  }

  /**
   * Trace an INTERMEDIARY seller to calculate its hop depth
   */
  private async traceHop(
    originDomain: string,
    sellerId: string,
    sellerDomain: string
  ): Promise<{
    hop_count: number | null;
    is_resolved: boolean;
    chain_path: string[];
  }> {
    const chainPath: string[] = [originDomain];
    const visited = new Set<string>([`${originDomain}:${sellerId}`]);

    let currentDomain = sellerDomain;
    let depth = 2; // Starting from INTERMEDIARY means depth >= 2

    // Traverse the chain
    while (depth <= this.MAX_DEPTH) {
      // Look up the seller_domain in sellers_catalog
      const lookupSql = `
        SELECT seller_type, seller_domain
        FROM sellers_catalog
        WHERE domain = $1 AND seller_id = $2
        LIMIT 1
      `;

      const lookupRes = await query(lookupSql, [currentDomain, sellerId]);

      if (lookupRes.rows.length === 0) {
        // Not found in catalog -> unresolved
        await this.saveHop(originDomain, originDomain, sellerId, {
          hop_count: null,
          is_resolved: false,
          resolved_depth: depth,
          chain_path: chainPath,
        });

        return {
          hop_count: null,
          is_resolved: false,
          chain_path: chainPath,
        };
      }

      const seller = lookupRes.rows[0];
      chainPath.push(currentDomain);

      // If DIRECT or PUBLISHER -> resolved
      if (seller.seller_type === 'DIRECT' || seller.seller_type === 'PUBLISHER') {
        await this.saveHop(originDomain, originDomain, sellerId, {
          hop_count: depth,
          is_resolved: true,
          resolved_depth: depth,
          chain_path: chainPath,
        });

        return {
          hop_count: depth,
          is_resolved: true,
          chain_path: chainPath,
        };
      }

      // If INTERMEDIARY -> follow
      if (seller.seller_type === 'INTERMEDIARY' && seller.seller_domain) {
        const nextDomain = seller.seller_domain;
        const key = `${nextDomain}:${sellerId}`;

        // Detect cycles
        if (visited.has(key)) {
          await this.saveHop(originDomain, originDomain, sellerId, {
            hop_count: null,
            is_resolved: false,
            resolved_depth: depth,
            chain_path: chainPath,
          });

          return {
            hop_count: null,
            is_resolved: false,
            chain_path: chainPath,
          };
        }

        visited.add(key);
        currentDomain = nextDomain;
        depth++;
      } else {
        // INTERMEDIARY but no seller_domain -> unresolved
        await this.saveHop(originDomain, originDomain, sellerId, {
          hop_count: null,
          is_resolved: false,
          resolved_depth: depth,
          chain_path: chainPath,
        });

        return {
          hop_count: null,
          is_resolved: false,
          chain_path: chainPath,
        };
      }
    }

    // Max depth exceeded
    await this.saveHop(originDomain, originDomain, sellerId, {
      hop_count: null,
      is_resolved: false,
      resolved_depth: this.MAX_DEPTH,
      chain_path: chainPath,
    });

    return {
      hop_count: null,
      is_resolved: false,
      chain_path: chainPath,
    };
  }

  /**
   * Save hop result to supply_chain_hops table
   */
  private async saveHop(
    publisherDomain: string,
    sspDomain: string,
    accountId: string,
    result: {
      hop_count: number | null;
      is_resolved: boolean;
      resolved_depth: number;
      chain_path: string[];
    }
  ): Promise<void> {
    const insertSql = `
      INSERT INTO supply_chain_hops (
        publisher_domain, ssp_domain, account_id, file_type,
        hop_count, is_resolved, resolved_depth, chain_path, computed_at
      )
      VALUES ($1, $2, $3, 'ads.txt', $4, $5, $6, $7, NOW())
      ON CONFLICT (publisher_domain, ssp_domain, account_id, file_type)
      DO UPDATE SET
        hop_count = EXCLUDED.hop_count,
        is_resolved = EXCLUDED.is_resolved,
        resolved_depth = EXCLUDED.resolved_depth,
        chain_path = EXCLUDED.chain_path,
        computed_at = NOW()
    `;

    await query(insertSql, [
      publisherDomain,
      sspDomain,
      accountId,
      result.hop_count,
      result.is_resolved,
      result.resolved_depth,
      result.chain_path,
    ]);
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    total: number;
    resolved: number;
    unresolved: number;
    max_hop: number | null;
    hop_distribution: { hop_count: number; count: number }[];
  }> {
    const statsSql = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_resolved = true) as resolved,
        COUNT(*) FILTER (WHERE is_resolved = false) as unresolved,
        MAX(hop_count) FILTER (WHERE is_resolved = true) as max_hop
      FROM supply_chain_hops
    `;

    const statsRes = await query(statsSql);
    const stats = statsRes.rows[0];

    const distributionSql = `
      SELECT
        hop_count,
        COUNT(*) as count
      FROM supply_chain_hops
      WHERE is_resolved = true AND hop_count IS NOT NULL
      GROUP BY hop_count
      ORDER BY hop_count
    `;

    const distributionRes = await query(distributionSql);

    return {
      total: parseInt(stats.total || '0'),
      resolved: parseInt(stats.resolved || '0'),
      unresolved: parseInt(stats.unresolved || '0'),
      max_hop: stats.max_hop ? parseInt(stats.max_hop) : null,
      hop_distribution: distributionRes.rows.map(row => ({
        hop_count: parseInt(row.hop_count),
        count: parseInt(row.count),
      })),
    };
  }
}
