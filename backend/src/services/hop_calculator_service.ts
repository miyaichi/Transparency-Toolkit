import { query } from '../db/client';

/**
 * Supply Chain Hop Calculator Service
 * 
 * Computes hop counts from publishers to SSPs by traversing
 * INTERMEDIARY seller_domain references in the sellers_catalog.
 * 
 * Example:
 * Publisher -> SSP A (DIRECT) = 1 hop
 * Publisher -> SSP A (INTERMEDIARY: domain B) -> SSP B (DIRECT) = 2 hops
 * Publisher -> SSP A (INTERMEDIARY: domain B) -> SSP B (INTERMEDIARY: domain C) -> SSP C (DIRECT) = 3 hops
 */
export class HopCalculatorService {
  private readonly MAX_DEPTH = 10; // Prevent infinite loops

  /**
   * Calculate hops for all ads.txt records
   * 
   * For each (publisher_domain, ssp_domain, account_id) combination in ads_txt_scans,
   * traces through sellers_catalog to compute the hop count.
   * 
   * @returns Object with counts: { processed, resolved, unresolved }
   */
  async calculateAllHops(): Promise<{
    processed: number;
    resolved: number;
    unresolved: number;
  }> {
    console.log('[HopCalculator] Starting hop calculation for all domains...');

    // Get all unique (publisher_domain, ssp_domain, account_id) combinations from ads_txt_scans
    const recordsSql = `
      SELECT DISTINCT
        ats.publisher_domain,
        ats.system_domain AS ssp_domain,
        ats.account_id,
        ats.file_type
      FROM ads_txt_scans ats
      WHERE ats.relationship IN ('DIRECT', 'RESELLER')
        AND ats.system_domain IS NOT NULL
        AND ats.account_id IS NOT NULL
    `;

    const recordsRes = await query(recordsSql);
    const records = recordsRes.rows;

    console.log(`[HopCalculator] Found ${records.length} unique records to process`);

    let processed = 0;
    let resolved = 0;
    let unresolved = 0;

    // Process in batches to avoid memory issues
    const BATCH_SIZE = 1000;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      for (const record of batch) {
        const result = await this.calculateHop(
          record.publisher_domain,
          record.ssp_domain,
          record.account_id,
          record.file_type
        );

        processed++;
        if (result.is_resolved) {
          resolved++;
        } else {
          unresolved++;
        }

        if (processed % 100 === 0) {
          console.log(`[HopCalculator] Processed ${processed}/${records.length} records (${resolved} resolved, ${unresolved} unresolved)`);
        }
      }
    }

    console.log(`[HopCalculator] Completed: ${processed} total, ${resolved} resolved, ${unresolved} unresolved`);
    return { processed, resolved, unresolved };
  }

  /**
   * Calculate hop count for a single (publisher, SSP, account) combination
   * 
   * @param publisherDomain - The publisher domain (from ads.txt)
   * @param sspDomain - The SSP domain (system_domain from ads.txt)
   * @param accountId - The account ID
   * @param fileType - 'ads.txt' or 'app-ads.txt'
   * @returns Hop calculation result
   */
  async calculateHop(
    publisherDomain: string,
    sspDomain: string,
    accountId: string,
    fileType: string = 'ads.txt'
  ): Promise<{
    hop_count: number | null;
    is_resolved: boolean;
    chain_path: string[];
  }> {
    const chainPath: string[] = [sspDomain];
    const visited = new Set<string>([sspDomain]);

    let currentDomain = sspDomain;
    let currentAccountId = accountId;
    let depth = 1;

    // Traverse the chain
    while (depth <= this.MAX_DEPTH) {
      // Check if this (domain, account_id) is PUBLISHER or DIRECT
      const sellerSql = `
        SELECT seller_type, seller_domain
        FROM sellers_catalog
        WHERE domain = $1 AND seller_id = $2
        LIMIT 1
      `;

      const sellerRes = await query(sellerSql, [currentDomain, currentAccountId]);

      if (sellerRes.rows.length === 0) {
        // No seller record found - chain ends here (unresolved)
        await this.saveHopResult(publisherDomain, sspDomain, accountId, fileType, {
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

      const seller = sellerRes.rows[0];

      // If PUBLISHER or DIRECT -> chain resolved
      if (seller.seller_type === 'PUBLISHER' || seller.seller_type === 'DIRECT') {
        await this.saveHopResult(publisherDomain, sspDomain, accountId, fileType, {
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

      // If INTERMEDIARY -> follow seller_domain
      if (seller.seller_type === 'INTERMEDIARY' && seller.seller_domain) {
        const nextDomain = seller.seller_domain;

        // Check for circular reference
        if (visited.has(nextDomain)) {
          await this.saveHopResult(publisherDomain, sspDomain, accountId, fileType, {
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

        chainPath.push(nextDomain);
        visited.add(nextDomain);
        currentDomain = nextDomain;
        // Keep the same account_id for the next hop
        depth++;
      } else {
        // INTERMEDIARY but no seller_domain -> unresolved
        await this.saveHopResult(publisherDomain, sspDomain, accountId, fileType, {
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
    await this.saveHopResult(publisherDomain, sspDomain, accountId, fileType, {
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
   * Save hop calculation result to supply_chain_hops table
   */
  private async saveHopResult(
    publisherDomain: string,
    sspDomain: string,
    accountId: string,
    fileType: string,
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
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
      fileType,
      result.hop_count,
      result.is_resolved,
      result.resolved_depth,
      result.chain_path,
    ]);
  }

  /**
   * Get hop statistics
   */
  async getStatistics(): Promise<{
    total: number;
    resolved: number;
    unresolved: number;
    hop_distribution: { hop_count: number; count: number }[];
  }> {
    const statsSql = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_resolved = true) as resolved,
        COUNT(*) FILTER (WHERE is_resolved = false) as unresolved
      FROM supply_chain_hops
    `;

    const statsRes = await query(statsSql);
    const stats = statsRes.rows[0];

    const distributionSql = `
      SELECT
        COALESCE(hop_count, -1) as hop_count,
        COUNT(*) as count
      FROM supply_chain_hops
      WHERE is_resolved = true
      GROUP BY hop_count
      ORDER BY hop_count
    `;

    const distributionRes = await query(distributionSql);

    return {
      total: parseInt(stats.total),
      resolved: parseInt(stats.resolved),
      unresolved: parseInt(stats.unresolved),
      hop_distribution: distributionRes.rows.map(row => ({
        hop_count: row.hop_count,
        count: parseInt(row.count),
      })),
    };
  }
}
