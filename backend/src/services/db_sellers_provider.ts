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
    // CRITICAL: Normalize domain - trim whitespace and ensure lowercase
    const domainLower = domain.toLowerCase().trim();

    // Optimized Query: Use DOMAIN (Primary Key) instead of raw_file_id
    // This allows using the Primary Key Index (domain, seller_id) which is much faster
    // than scanning for raw_file_id (which is unindexed).
    // FIX: Use LOWER() for case-insensitive comparison to handle PostgreSQL collation
    const sellersRes = await query(
      `SELECT seller_id, name, seller_type, is_confidential, seller_domain as domain 
         FROM sellers_catalog 
         WHERE LOWER(domain) = LOWER($1) AND seller_id = ANY($2)`,
      [domainLower, sellerIds],
    );

    const foundSellersMap = new Map();
    sellersRes.rows.forEach((row) => {
      // Normalize boolean for is_confidential to 0/1 as expected by package types
      row.is_confidential = row.is_confidential === true || row.is_confidential === 1 ? 1 : 0;
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
        is_cached: sellersRes.rows.length > 0,
        last_updated: new Date().toISOString(), // Approximate since we skipped the raw file lookup for performance
        status: sellersRes.rows.length > 0 ? 'success' : 'error',
      },
    };
  }

  async getMetadata(domain: string): Promise<SellersJsonMetadata> {
    // Currently we don't store metadata in raw_sellers_files (only content which is not parsed)
    // For now returning empty. In future, expand stream_importer to save metadata.
    return {};
  }

  async hasSellerJson(domain: string): Promise<boolean> {
    // Check if we have actual seller data in the catalog.
    // Checking raw_sellers_files is insufficient because processing might have failed or yielded 0 records,
    // leaving us with a "processed" file but no data to validate against.
    // FIX: Use LOWER() for case-insensitive comparison to handle PostgreSQL collation
    const res = await query(`SELECT 1 FROM sellers_catalog WHERE LOWER(domain) = LOWER($1) LIMIT 1`, [domain.toLowerCase()]);
    return res.rowCount !== null && res.rowCount > 0;
  }

  async getCacheInfo(domain: string): Promise<CacheInfo> {
    const res = await query(
      `SELECT fetched_at, http_status, processed_at FROM raw_sellers_files WHERE LOWER(domain) = LOWER($1) ORDER BY fetched_at DESC LIMIT 1`,
      [domain.toLowerCase()],
    );

    if (res.rowCount === 0) {
      return { is_cached: false, status: 'error' };
    }

    const row = res.rows[0];
    const isSuccess = row.http_status === 200 && row.processed_at != null;

    return {
      is_cached: isSuccess,
      last_updated: row.fetched_at,
      status: isSuccess ? 'success' : 'error',
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
