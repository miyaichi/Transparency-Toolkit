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

    // Count Query (Direct count, no subquery)
    const countSql = `SELECT count(*) as total FROM sellers_catalog ${whereClause}`;
    const countRes = await query(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || '0');

    // Data Query
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
      ORDER BY updated_at DESC 
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

  async fetchAndProcessSellers(domain: string, save: boolean): Promise<FetchResult> {
    let url = `https://${domain}/sellers.json`;
    const lowerDomain = domain.toLowerCase().trim();

    if (lowerDomain in SPECIAL_DOMAINS) {
      url = SPECIAL_DOMAINS[lowerDomain];
    }

    if (save) {
      const importer = new StreamImporter();
      try {
        await importer.importSellersJson({ domain, url });
      } finally {
        await importer.close();
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
