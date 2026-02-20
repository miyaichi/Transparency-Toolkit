import { query } from '../db/client';

export class MonitoredDomainsService {
  async addDomain(domain: string, fileType: 'ads.txt' | 'app-ads.txt' | 'sellers.json' = 'ads.txt') {
    const res = await query(
      `INSERT INTO monitored_domains (domain, file_type) 
       VALUES ($1, $2) 
       ON CONFLICT (domain, file_type) DO UPDATE SET is_active = true 
       RETURNING *`,
      [domain, fileType],
    );
    return res.rows[0];
  }

  async listDomains(limit = 100, offset = 0) {
    const res = await query(`SELECT * FROM monitored_domains ORDER BY added_at DESC LIMIT $1 OFFSET $2`, [
      limit,
      offset,
    ]);
    return res.rows;
  }

  async removeDomain(domain: string, fileType: 'ads.txt' | 'app-ads.txt' | 'sellers.json' = 'ads.txt') {
    await query(`DELETE FROM monitored_domains WHERE domain = $1 AND file_type = $2`, [domain, fileType]);
  }

  async getDueDomains(limit = 50, fileType?: 'ads.txt' | 'app-ads.txt' | 'sellers.json') {
    // Find domains where last_scanned_at is null OR older than interval
    // Interval is in minutes.
    const params: (number | string)[] = [limit];
    const ftClause = fileType ? `AND file_type = $${params.push(fileType)}` : '';
    const res = await query(
      `SELECT domain, file_type, scan_interval_minutes
       FROM monitored_domains
       WHERE is_active = true
       ${ftClause}
       AND (
         last_scanned_at IS NULL
         OR
         last_scanned_at < NOW() - (scan_interval_minutes || ' minutes')::interval
       )
       LIMIT $1`,
      params,
    );
    return res.rows as {
      domain: string;
      file_type: 'ads.txt' | 'app-ads.txt' | 'sellers.json';
      scan_interval_minutes: number;
    }[];
  }

  async updateLastScanned(domain: string, fileType: 'ads.txt' | 'app-ads.txt' | 'sellers.json') {
    await query(
      `UPDATE monitored_domains SET last_scanned_at = NOW() WHERE domain = $1 AND file_type = $2`,
      [domain, fileType],
    );
  }

  /**
   * Bulk add domains to monitored_domains.
   * Uses a single INSERT with UNNEST for efficiency.
   * Returns the count of inserted/updated rows.
   */
  async bulkAddDomains(
    domains: string[],
    fileType: 'ads.txt' | 'app-ads.txt' | 'sellers.json' = 'ads.txt',
  ): Promise<{ added: number; total: number }> {
    if (domains.length === 0) return { added: 0, total: 0 };

    // Deduplicate and normalize
    const unique = [...new Set(domains.map((d) => d.trim().toLowerCase()).filter((d) => d.length > 0))];

    // Batch insert using UNNEST for PostgreSQL
    const res = await query(
      `INSERT INTO monitored_domains (domain, file_type)
       SELECT unnest($1::text[]), $2
       ON CONFLICT (domain, file_type) DO UPDATE SET is_active = true
       RETURNING domain`,
      [unique, fileType],
    );

    return { added: res.rows.length, total: unique.length };
  }

  /**
   * Count total and unscanned monitored domains.
   * "unscanned" means either never scanned OR due for re-scan (same criteria as getDueDomains).
   * "scanned" means recently scanned and not yet due for re-scan.
   */
  async getStats(fileType?: 'ads.txt' | 'app-ads.txt' | 'sellers.json') {
    const params: string[] = [];
    const ftClause = fileType ? `AND file_type = $${params.push(fileType)}` : '';
    const res = await query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE is_active = true) AS active,
         COUNT(*) FILTER (WHERE is_active = true AND (
           last_scanned_at IS NULL
           OR last_scanned_at < NOW() - (scan_interval_minutes || ' minutes')::interval
         )) AS unscanned,
         COUNT(*) FILTER (WHERE is_active = true AND
           last_scanned_at IS NOT NULL AND
           last_scanned_at >= NOW() - (scan_interval_minutes || ' minutes')::interval
         ) AS scanned
       FROM monitored_domains
       WHERE 1=1 ${ftClause}`,
      params,
    );
    return res.rows[0];
  }
}
