import { query } from '../db/client';
import {
  BatchSellersResult,
  CacheInfo,
  SellerResult,
  SellersJsonMetadata,
  SellersJsonProvider,
} from '../lib/adstxt/types';

export class DbSellersProvider implements SellersJsonProvider {
  async batchGetSellers(domain: string, sellerIds: string[]): Promise<BatchSellersResult> {
    const domainLower = domain.toLowerCase();

    // Check if we have data for this domain (get the latest snapshot ID)
    const lastFetchRes = await query(
      `SELECT id, fetched_at FROM raw_sellers_files WHERE domain = $1 ORDER BY fetched_at DESC LIMIT 1`,
      [domainLower],
    );

    if (lastFetchRes.rows.length === 0) {
      return {
        domain,
        requested_count: sellerIds.length,
        found_count: 0,
        results: sellerIds.map((id) => ({
          sellerId: id,
          seller: null,
          found: false,
          source: 'fresh',
        })),
        metadata: {},
        cache: { is_cached: false, status: 'error' },
      };
    }

    const rawFileId = lastFetchRes.rows[0].id;
    const fetchedAt = lastFetchRes.rows[0].fetched_at;

    // Fetch sellers matching the IDs from the LATEST snapshot
    const sellersRes = await query(
      `SELECT seller_id, name, seller_type, is_confidential, domain 
         FROM sellers_catalog 
         WHERE raw_file_id = $1 AND seller_id = ANY($2)`,
      [rawFileId, sellerIds],
    );

    const foundSellersMap = new Map();
    sellersRes.rows.forEach((row) => {
      // Normalize boolean for is_confidential
      row.is_confidential = row.is_confidential === true;
      foundSellersMap.set(row.seller_id, row);
    });

    const results: SellerResult[] = sellerIds.map((id) => {
      const seller = foundSellersMap.get(id);
      return {
        sellerId: id,
        seller: seller || null,
        found: !!seller,
        source: 'cache',
      };
    });

    return {
      domain,
      requested_count: sellerIds.length,
      found_count: sellersRes.rows.length,
      results,
      metadata: {}, // Metadata support to be added
      cache: {
        is_cached: true,
        last_updated: fetchedAt,
        status: 'success',
      },
    };
  }

  async getMetadata(domain: string): Promise<SellersJsonMetadata> {
    // Currently we don't store metadata in raw_sellers_files (only content which is not parsed)
    // For now returning empty. In future, expand stream_importer to save metadata.
    return {};
  }

  async hasSellerJson(domain: string): Promise<boolean> {
    const res = await query(`SELECT 1 FROM raw_sellers_files WHERE domain = $1 LIMIT 1`, [domain.toLowerCase()]);
    return res.rowCount !== null && res.rowCount > 0;
  }

  async getCacheInfo(domain: string): Promise<CacheInfo> {
    const res = await query(
      `SELECT fetched_at FROM raw_sellers_files WHERE domain = $1 ORDER BY fetched_at DESC LIMIT 1`,
      [domain.toLowerCase()],
    );

    if (res.rowCount === 0) {
      return { is_cached: false, status: 'error' };
    }

    return {
      is_cached: true,
      last_updated: res.rows[0].fetched_at,
      status: 'success',
    };
  }

  async getRecentFiles(limit = 100) {
    const res = await query(
      `SELECT id, domain, fetched_at, http_status, etag 
       FROM raw_sellers_files 
       ORDER BY fetched_at DESC 
       LIMIT $1`,
      [limit],
    );
    return res.rows;
  }
}
