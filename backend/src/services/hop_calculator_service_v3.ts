import { query } from '../db/client';

/**
 * Supply Chain Hop Calculator Service (V3)
 * 
 * Correct approach: Start from publisher ads.txt entries and trace
 * through the INTERMEDIARY/BOTH chain to calculate actual hop counts.
 */
export class HopCalculatorServiceV3 {
  private readonly MAX_DEPTH = 10;

  /**
   * Calculate hops for a sample of monitored domains
   * 
   * @param sampleSize - Number of domains to process (default: 100 for testing)
   */
  async calculateSampleHops(sampleSize: number = 100): Promise<{
    processed: number;
    resolved: number;
    unresolved: number;
  }> {
    console.log(`[HopCalculatorV3] Starting hop calculation for ${sampleSize} sample domains...`);

    // Get sample monitored domains with recent scans
    const domainsSql = `
      SELECT DISTINCT md.domain
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

    const domainsRes = await query(domainsSql, [sampleSize]);
    const domains = domainsRes.rows;

    console.log(`[HopCalculatorV3] Found ${domains.length} domains with valid ads.txt scans`);

    let totalProcessed = 0;
    let totalResolved = 0;
    let totalUnresolved = 0;

    for (const domainRow of domains) {
      const publisherDomain = domainRow.domain;
      
      // Parse ads.txt content and calculate hops for each entry
      const result = await this.calculateHopsForPublisher(publisherDomain);
      
      totalProcessed += result.processed;
      totalResolved += result.resolved;
      totalUnresolved += result.unresolved;

      console.log(
        `[HopCalculatorV3] ${publisherDomain}: ` +
        `${result.processed} entries (${result.resolved} resolved, ${result.unresolved} unresolved)`
      );
    }

    console.log(
      `\n[HopCalculatorV3] Total: ${totalProcessed} entries, ` +
      `${totalResolved} resolved, ${totalUnresolved} unresolved`
    );

    return {
      processed: totalProcessed,
      resolved: totalResolved,
      unresolved: totalUnresolved,
    };
  }

  /**
   * Calculate hops for all entries in a publisher's ads.txt
   */
  private async calculateHopsForPublisher(publisherDomain: string): Promise<{
    processed: number;
    resolved: number;
    unresolved: number;
  }> {
    // Get the latest ads.txt scan
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
    if (scanRes.rows.length === 0) {
      return { processed: 0, resolved: 0, unresolved: 0 };
    }

    const content = scanRes.rows[0].content;
    const lines = content.split('\n');

    let processed = 0;
    let resolved = 0;
    let unresolved = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse ads.txt line: domain, account_id, relationship, [cert_id]
      const parts = trimmed.split(',').map((p: string) => p.trim());
      if (parts.length < 3) continue;

      const [sspDomain, accountId, relationship] = parts;

      // Only process DIRECT and RESELLER entries
      if (!['DIRECT', 'RESELLER'].includes(relationship.toUpperCase())) continue;

      processed++;

      // Calculate hop for this entry
      const result = await this.calculateHopForEntry(
        publisherDomain,
        sspDomain.toLowerCase(),
        accountId,
        'ads.txt'
      );

      if (result.is_resolved) {
        resolved++;
      } else {
        unresolved++;
      }
    }

    return { processed, resolved, unresolved };
  }

  /**
   * Calculate hop count for a single (publisher, SSP, account_id) entry
   */
  private async calculateHopForEntry(
    publisherDomain: string,
    sspDomain: string,
    accountId: string,
    fileType: string
  ): Promise<{
    hop_count: number | null;
    is_resolved: boolean;
    chain_path: string[];
  }> {
    const chainPath: string[] = [sspDomain];
    const visited = new Set<string>([`${sspDomain}:${accountId}`]);

    let currentDomain = sspDomain;
    let currentAccountId = accountId;
    let depth = 1;

    while (depth <= this.MAX_DEPTH) {
      // Look up the seller in sellers_catalog
      const sellerSql = `
        SELECT seller_type, seller_domain
        FROM sellers_catalog
        WHERE LOWER(domain) = LOWER($1)
          AND seller_id = $2
        LIMIT 1
      `;

      const sellerRes = await query(sellerSql, [currentDomain, currentAccountId]);

      if (sellerRes.rows.length === 0) {
        // Seller not found in catalog -> unresolved (sellers.json not fetched or entry missing)
        await this.saveHop(publisherDomain, sspDomain, accountId, fileType, {
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
      const sellerType = seller.seller_type?.toUpperCase();

      // Terminal types: PUBLISHER, DIRECT, or BOTH (since BOTH can be terminal)
      if (['PUBLISHER', 'DIRECT'].includes(sellerType)) {
        await this.saveHop(publisherDomain, sspDomain, accountId, fileType, {
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

      // BOTH: Can be terminal OR intermediate
      // If it has a seller_domain, treat as INTERMEDIARY; otherwise terminal
      if (sellerType === 'BOTH') {
        if (!seller.seller_domain || seller.seller_domain.trim() === '') {
          // BOTH without seller_domain -> terminal
          await this.saveHop(publisherDomain, sspDomain, accountId, fileType, {
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
        // Otherwise, fall through to INTERMEDIARY logic
      }

      // INTERMEDIARY or BOTH with seller_domain -> follow the chain
      if (['INTERMEDIARY', 'BOTH'].includes(sellerType) && seller.seller_domain) {
        const nextDomain = seller.seller_domain.toLowerCase().trim();
        const key = `${nextDomain}:${currentAccountId}`;

        // Check for circular reference
        if (visited.has(key)) {
          await this.saveHop(publisherDomain, sspDomain, accountId, fileType, {
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
        visited.add(key);
        currentDomain = nextDomain;
        // Keep the same account_id
        depth++;
      } else {
        // Unknown seller_type or INTERMEDIARY without seller_domain -> unresolved
        await this.saveHop(publisherDomain, sspDomain, accountId, fileType, {
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
    await this.saveHop(publisherDomain, sspDomain, accountId, fileType, {
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
   * Get statistics
   */
  async getStatistics(): Promise<{
    total: number;
    resolved: number;
    unresolved: number;
    max_hop: number | null;
    avg_hop: number | null;
    hop_distribution: { hop_count: number; count: number; percentage: number }[];
  }> {
    const statsSql = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_resolved = true) as resolved,
        COUNT(*) FILTER (WHERE is_resolved = false) as unresolved,
        MAX(hop_count) FILTER (WHERE is_resolved = true) as max_hop,
        ROUND(AVG(hop_count) FILTER (WHERE is_resolved = true), 2) as avg_hop
      FROM supply_chain_hops
    `;

    const statsRes = await query(statsSql);
    const stats = statsRes.rows[0];

    const distributionSql = `
      SELECT
        hop_count,
        COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
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
      avg_hop: stats.avg_hop ? parseFloat(stats.avg_hop) : null,
      hop_distribution: distributionRes.rows.map(row => ({
        hop_count: parseInt(row.hop_count),
        count: parseInt(row.count),
        percentage: parseFloat(row.percentage),
      })),
    };
  }

  /**
   * Clear all hop data (for testing/re-calculation)
   */
  async clearAllHops(): Promise<number> {
    const deleteSql = 'DELETE FROM supply_chain_hops';
    const result = await query(deleteSql);
    return result.rowCount ?? 0;
  }
}
