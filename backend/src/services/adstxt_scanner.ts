import psl from 'psl';
import { query } from '../db/client';
import { parseAdsTxtContent } from '../lib/adstxt/validator';
import client from '../lib/http';

export interface ScanResult {
  id: string;
  domain: string;
  url: string;
  content: string;
  scanned_at: Date;
  status_code: number;
  error_message?: string;
  records_count: number;
  valid_count: number;
  warning_count: number;
  file_type?: 'ads.txt' | 'app-ads.txt';
}

export class AdsTxtScanner {
  /**
   * Helper to fetch content (HTTPS fallback to HTTP)
   * Returns content, finalUrl, statusCode.
   * Throws error if both fail, with the last error message.
   */
  private async fetchRawContent(
    domain: string,
    fileType: 'ads.txt' | 'app-ads.txt',
  ): Promise<{ content: string; finalUrl: string; statusCode: number }> {
    const filename = fileType;
    let finalUrl = '';
    let content = '';
    let statusCode = 0;

    try {
      finalUrl = `https://${domain}/${filename}`;
      const res = await client.get(finalUrl, { maxRedirects: 5 });
      if (res.request?.res?.responseUrl) {
        finalUrl = res.request.res.responseUrl;
      }
      content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      statusCode = res.status;
      return { content, finalUrl, statusCode };
    } catch (e: any) {
      // Fallback to HTTP
      try {
        finalUrl = `http://${domain}/${filename}`;
        const res = await client.get(finalUrl, { maxRedirects: 5 });
        if (res.request?.res?.responseUrl) {
          finalUrl = res.request.res.responseUrl;
        }
        content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        statusCode = res.status;
        return { content, finalUrl, statusCode };
      } catch (inner: any) {
        // Return mostly for status code, but rethrow to let caller handle logging/saving
        statusCode = inner.response?.status || 0;
        throw inner;
      }
    }
  }

  /**
   * Fetch, parse (for stats), and save ads.txt or app-ads.txt
   */
  async scanAndSave(domain: string, fileType: 'ads.txt' | 'app-ads.txt' = 'ads.txt'): Promise<ScanResult> {
    let content = '';
    let finalUrl = '';
    let statusCode = 0;
    let errorMessage = '';

    const filename = fileType;

    try {
      // 0. Fetch (Moved before validation to handle redirects)
      try {
        const result = await this.fetchRawContent(domain, fileType);
        content = result.content;
        finalUrl = result.finalUrl;
        statusCode = result.statusCode;
      } catch (inner: any) {
        statusCode = inner.response?.status || 0;
        errorMessage = inner.message;
        throw inner;
      }

      // 1. Subdomain Validation (IAB Tech Lab Spec)
      // Moved here to validate the EFFECTIVE domain (after redirects)
      if (fileType === 'ads.txt') {
        const effectiveDomain = new URL(finalUrl).hostname;
        const parsedDomain = psl.parse(effectiveDomain);

        if (!('error' in parsedDomain) && parsedDomain.subdomain) {
          const rootDomain = parsedDomain.domain;
          if (rootDomain) {
            // IAB Ads.txt Spec 1.1 Section 3.1:
            // "Multiple redirects are valid as long as each redirect location remains within the original root domain."
            //
            // If the scan started at the root domain (domain === rootDomain), and redirected to a subdomain (e.g. www),
            // this is a valid flow where the subdomain is serving the authoritative content for the root.
            // We do NOT need to check for a SUBDOMAIN declaration in this case, because we are not "validating a subdomain" per se,
            // but following a valid redirect chain for the root domain.
            if (domain.toLowerCase() === rootDomain) {
              // Valid redirect from root to its own subdomain. Content is authoritative.
              // Skip SUBDOMAIN validation.
            } else {
              try {
                // Fetch root domain's ads.txt
                const rootRes = await this.fetchRawContent(rootDomain, 'ads.txt');
                const rootRecords = parseAdsTxtContent(rootRes.content, rootDomain);

                const isAuthorized = rootRecords.some(
                  (r) =>
                    r.is_variable &&
                    r.variable_type === 'SUBDOMAIN' &&
                    r.value &&
                    r.value.toLowerCase() === effectiveDomain.toLowerCase(),
                );

                if (!isAuthorized) {
                  throw new Error(
                    `Subdomain ${effectiveDomain} is not authorized by root domain ${rootDomain} (missing subdomain=${effectiveDomain} declaration in ${rootDomain}/ads.txt)`,
                  );
                }
              } catch (e: any) {
                throw e;
              }
            }
          }
        }
      }

      // 2. Simple Parse for stats
      const parsed = parseAdsTxtContent(content, domain);
      const recordsCount = parsed.length;
      const validCount = parsed.filter((r) => r.is_valid).length;

      // 3. Save Success
      const res = await query(
        `INSERT INTO ads_txt_scans 
         (domain, url, content, status_code, records_count, valid_count, warning_count, scanned_at, file_type)
         VALUES ($1, $2, $3, $4, $5, $6, 0, NOW(), $7)
         RETURNING *`,
        [domain, finalUrl, content, statusCode, recordsCount, validCount, fileType],
      );
      return res.rows[0];
    } catch (err: any) {
      // Save failed scan record
      const failRes = await query(
        `INSERT INTO ads_txt_scans 
          (domain, url, content, status_code, error_message, records_count, valid_count, warning_count, scanned_at, file_type)
          VALUES ($1, $2, $3, $4, $5, 0, 0, 0, NOW(), $6)
          RETURNING *`,
        [domain, finalUrl || `http://${domain}/${filename}`, '', statusCode, errorMessage || err.message, fileType],
      );
      return failRes.rows[0];
    }
  }

  async getLatestScan(domain: string, fileType: 'ads.txt' | 'app-ads.txt' = 'ads.txt'): Promise<ScanResult | null> {
    const res = await query(
      `SELECT * FROM ads_txt_scans WHERE domain = $1 AND file_type = $2 ORDER BY scanned_at DESC LIMIT 1`,
      [domain, fileType],
    );
    return res.rows[0] || null;
  }

  async getHistory(domain?: string, limit = 10, fileType?: 'ads.txt' | 'app-ads.txt'): Promise<ScanResult[]> {
    let sql = `SELECT id, domain, url, scanned_at, status_code, error_message, records_count, valid_count, warning_count, file_type
         FROM ads_txt_scans WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (domain) {
      sql += ` AND domain = $${paramIndex++}`;
      params.push(domain);
    }

    if (fileType) {
      sql += ` AND file_type = $${paramIndex++}`;
      params.push(fileType);
    }

    sql += ` ORDER BY scanned_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const res = await query(sql, params);
    return res.rows;
  }
}
