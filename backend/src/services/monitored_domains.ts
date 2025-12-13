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
    const res = await query(`SELECT * FROM monitored_domains ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [
      limit,
      offset,
    ]);
    return res.rows;
  }

  async removeDomain(domain: string, fileType: 'ads.txt' | 'app-ads.txt' | 'sellers.json' = 'ads.txt') {
    await query(`DELETE FROM monitored_domains WHERE domain = $1 AND file_type = $2`, [domain, fileType]);
  }

  async getDueDomains() {
    // Find domains where last_scanned_at is null OR older than interval
    // Interval is in minutes.
    const res = await query(
      `SELECT domain, file_type, scan_interval_minutes 
       FROM monitored_domains 
       WHERE is_active = true 
       AND (
         last_scanned_at IS NULL 
         OR 
         last_scanned_at < NOW() - (scan_interval_minutes || ' minutes')::interval
       )
       LIMIT 50`, // Process in batches
    );
    return res.rows as { domain: string; file_type: 'ads.txt' | 'app-ads.txt' | 'sellers.json'; scan_interval_minutes: number }[];
  }

  async updateLastScanned(domain: string, fileType: 'ads.txt' | 'app-ads.txt' | 'sellers.json') {
    await query(
      `UPDATE monitored_domains SET last_scanned_at = NOW(), updated_at = NOW() WHERE domain = $1 AND file_type = $2`,
      [domain, fileType],
    );
  }
}
