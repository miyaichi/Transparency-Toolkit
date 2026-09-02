import { query } from '../db/client';
import { StreamImporter } from '../ingest/stream_importer';
import client from '../lib/http';

export interface Seller {
  seller_id: string;
  source_domain: string;
  domain: string; // This maps to seller_domain
  seller_type: string;
  name: string;
  identifiers: any;
  is_confidential: boolean;
  updated_at: string;
}

export interface SellerSearchFilters {
  q?: string;
  domain?: string;
  seller_type?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface FetchResult {
  domain: string;
  sellers_json_url: string;
  version?: string;
  sellers: any[]; // Raw or processed sellers
  fetched_at?: string;
  error?: string;
}

const SPECIAL_DOMAINS: Record<string, string> = {
  // Google
  'google.com': 'https://storage.googleapis.com/adx-rtb-dictionaries/sellers.json',
  'doubleclick.net': 'https://storage.googleapis.com/adx-rtb-dictionaries/sellers.json',
  'googlesyndication.com': 'https://storage.googleapis.com/adx-rtb-dictionaries/sellers.json',

  // AOL / Verizon Group
  'advertising.com': 'https://dragon-advertising.com/sellers.json',
};

export class SellersService {
  async searchSellers(filters: SellerSearchFilters): Promise<PaginatedResult<Seller>> {
    const pageNum = filters.page || 1;
    const limitNum = Math.min(filters.limit || 50, 100);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let pIdx = 1;

    if (filters.domain) {
      whereClause += ` AND domain = $${pIdx++}`;
      params.push(filters.domain);
    }

    if (filters.seller_type) {
      whereClause += ` AND seller_type = $${pIdx++}`;
      params.push(filters.seller_type);
    }

    if (filters.q) {
      whereClause += ` AND (domain ILIKE $${pIdx} OR seller_domain ILIKE $${pIdx} OR seller_id ILIKE $${pIdx} OR name ILIKE $${pIdx})`;
      params.push(`%${filters.q}%`);
      pIdx++;
    }

    // Optimized Count Logic: Use estimate for large tables or simple count for filtered
    let total = 0;

    // If filtering by domain only (or no filter), try fast estimate
    const isSimpleFilter = !filters.q && !filters.seller_type;

    if (isSimpleFilter && filters.domain) {
      // Use efficient count or cap at 10000+ for UI to avoid scan
      // For now, simpler approach: Just LIMIT the count to check existence or use a heuristic
      // Truly solving this for 1M+ rows requires avoiding count(*) unless necessary.
      // Let's rely on a faster count if possible, or an estimate.

      // Fast path: Don't count everything if it's too big.
      // But user wants pagination.
      // Compromise: Count up to 1000, if more, just say "1000+" (UI handles this?)
      // Or, since we have PK on (domain), index-only scan count should be fast IF vacuumed.
      // The issue is likely the ORDER BY updated_at without index.

      // 1. Remove global sort if not needed (default sort by PK is faster usually)
      // 2. Keep count simple.

      const countRes = await query(`SELECT count(*) as total FROM sellers_catalog ${whereClause}`, params);
      total = parseInt(countRes.rows[0]?.total || '0');
    } else {
      // Filtered searches utilize indexes better or result set is smaller
      const countRes = await query(`SELECT count(*) as total FROM sellers_catalog ${whereClause}`, params);
      total = parseInt(countRes.rows[0]?.total || '0');
    }

    // Data Query - Removed ORDER BY updated_at DESC to avoid sort overhead on 1M rows
    // Defaulting to implicit PK order or insert order is much faster
    const dataSql = `
      SELECT 
        seller_id, 
        domain as source_domain, 
        COALESCE(seller_domain, domain) as domain, 
        seller_type, 
        name, 
        identifiers, 
        is_confidential, 
        updated_at 
      FROM sellers_catalog 
      ${whereClause} 
      LIMIT $${pIdx++} OFFSET $${pIdx++}`;

    // Create a new params array for data query including limit/offset
    const dataParams = [...params, limitNum, offset];

    const res = await query(dataSql, dataParams);

    return {
      data: res.rows,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async getRecentFiles(limit: number = 100) {
    const res = await query(
      `SELECT id, domain, fetched_at, http_status, etag 
       FROM raw_sellers_files 
       ORDER BY fetched_at DESC 
       LIMIT $1`,
      [limit],
    );
    return res.rows;
  }

  /**
   * Health of the sellers.json sync.
   *
   * Exists because the sync died on 2026-08-25 and nobody noticed for eight days:
   * ads.txt scanning kept running, so every visible signal looked fine while the
   * catalog quietly aged out and domains were dropped by the retention job. The
   * numbers below are the ones that would have shown it immediately.
   *
   * `status`:
   *   ok       - fetched successfully within the last 24h
   *   warning  - last success is 1-3 days old (a slow backlog, or a partial stall)
   *   critical - no success for over 3 days, or none at all
   */
  async getSyncHealth() {
    const res = await query(`
      SELECT
        (SELECT MAX(fetched_at) FROM raw_sellers_files WHERE http_status = 200) AS last_success_at,
        (SELECT COUNT(*) FROM raw_sellers_files
          WHERE http_status = 200 AND fetched_at > NOW() - INTERVAL '24 hours') AS successes_24h,
        (SELECT COUNT(*) FROM raw_sellers_files
          WHERE fetched_at > NOW() - INTERVAL '24 hours') AS attempts_24h,
        (SELECT COUNT(DISTINCT domain) FROM sellers_catalog) AS catalog_domains,
        (SELECT COUNT(DISTINCT supply_domain) FROM supply_domain_refs) AS supply_domains,
        -- Domains kept past the retention window because nothing newer succeeded.
        -- A rising count means fetching is falling behind.
        (SELECT COUNT(DISTINCT domain) FROM raw_sellers_files
          WHERE fetched_at < NOW() - INTERVAL '30 days') AS stale_domains
    `);

    const row = res.rows[0];
    const lastSuccessAt: Date | null = row.last_success_at;
    const ageHours = lastSuccessAt ? (Date.now() - new Date(lastSuccessAt).getTime()) / 3_600_000 : null;

    let status: 'ok' | 'warning' | 'critical';
    if (ageHours === null || ageHours > 72) {
      status = 'critical';
    } else if (ageHours > 24) {
      status = 'warning';
    } else {
      status = 'ok';
    }

    return {
      status,
      last_success_at: lastSuccessAt ? new Date(lastSuccessAt).toISOString() : null,
      hours_since_success: ageHours === null ? null : Math.round(ageHours * 10) / 10,
      successes_24h: Number(row.successes_24h),
      attempts_24h: Number(row.attempts_24h),
      catalog_domains: Number(row.catalog_domains),
      supply_domains: Number(row.supply_domains),
      stale_domains: Number(row.stale_domains),
    };
  }

  async fetchAndProcessSellers(domain: string, save: boolean): Promise<FetchResult> {
    let url = `https://${domain}/sellers.json`;
    const lowerDomain = domain.toLowerCase().trim();

    if (lowerDomain in SPECIAL_DOMAINS) {
      url = SPECIAL_DOMAINS[lowerDomain];
    }

    if (save) {
      // Check if data already exists to avoid timeout on large files (e.g. google.com)
      // We rely on background cron jobs to keep data up-to-date.
      const checkRes = await query('SELECT 1 FROM sellers_catalog WHERE domain = $1 LIMIT 1', [domain]);
      const exists = (checkRes.rowCount ?? 0) > 0;

      if (!exists) {
        const importer = new StreamImporter();
        try {
          await importer.importSellersJson({ domain, url });
        } finally {
          await importer.close();
        }
      } else {
        console.log(`Skipping import for ${domain} as data already exists. Relying on background updates.`);
      }

      // After import, fetch summary from DB to return
      const countRes = await query('SELECT count(*) as total FROM sellers_catalog WHERE domain = $1', [domain]);
      const total = parseInt(countRes.rows[0]?.total || '0');

      const sellersRes = await query(
        `SELECT seller_id, domain as source_domain, COALESCE(seller_domain, domain) as domain, seller_type, name, identifiers, is_confidential 
         FROM sellers_catalog WHERE domain = $1 LIMIT 50`,
        [domain],
      );

      return {
        domain,
        sellers_json_url: url,
        version: '1.0', // Metadata not currently stored in catalog, using placeholder
        sellers: sellersRes.rows,
        fetched_at: new Date().toISOString(),
        total_sellers: total, // Add total count to response
      } as any;
    } else {
      // Ephemeral Fetch (No DB save)
      const res = await client.get(url, { responseType: 'json' });
      return {
        domain,
        sellers_json_url: url,
        ...res.data,
      };
    }
  }
}
