import { PoolClient } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { pool } from '../db/client';
import httpClient from '../lib/http';

interface ImportOptions {
  domain: string;
  url: string;
}

export class StreamImporter {
  // Removed internal pool management to use singleton

  async importSellersJson(options: ImportOptions) {
    const client = await pool.connect();
    console.log(`Starting import for ${options.domain} from ${options.url}`);

    try {
      // 2. HTTP Stream取得
      // 2. HTTP Stream取得
      let response;
      try {
        response = await httpClient({
          method: 'get',
          url: options.url,
          responseType: 'stream',
          validateStatus: () => true, // Allow all status codes to handle 404/500 manually
          'axios-retry': { retries: 0 }, // Disable retry for streams to avoid compatibility issues
        } as any);
      } catch (netErr: any) {
        console.warn(`Network error fetching sellers.json for ${options.domain}:`, netErr.message);
        // Create a record with status 0 (Network Error) to indicate attempt failed
        // This helps diagnostics (vs just appearing as 'not found')
        await this.createRawFileRecord(client, options.domain, 0, null);
        return;
      }

      const httpStatus = response.status;
      const etag = response.headers['etag'] || null;

      // 1. Raw File Record作成 (Save metadata even if failed)
      const rawFileId = await this.createRawFileRecord(
        client,
        options.domain,
        httpStatus,
        typeof etag === 'string' ? etag : null,
      );

      if (httpStatus >= 400) {
        console.warn(`Failed to fetch sellers.json for ${options.domain}. Status: ${httpStatus}`);
        return; // Stop processing, but record is saved to indicate attempt
      }

      // 3. Update Catalog safely
      try {
        await client.query('BEGIN');

        // Delete existing entries for this domain to avoid constraints errors
        await client.query('DELETE FROM sellers_catalog WHERE domain = $1', [options.domain]);

        // COPY Stream
        const ingestStream = client.query(
          copyFrom(`
            COPY sellers_catalog (
              seller_id, 
              domain, 
              seller_type, 
              name, 
              seller_domain,
              identifiers,
              is_confidential, 
              raw_file_id
            ) FROM STDIN
          `),
        );

        // 4. Build pipeline
        const seenSellerIds = new Set<string>();

        await pipeline(
          response.data,
          JSONStream.parse('sellers.*'),
          new Transform({
            objectMode: true,
            transform(seller: any, encoding, callback) {
              try {
                if (!seller) {
                  callback();
                  return;
                }

                // Robust sanitization
                const sellerId = (seller.seller_id || '').toString().trim();
                if (!sellerId) {
                  // Skip invalid ID
                  callback();
                  return;
                }

                // Deduplication within the same file (same domain)
                if (seenSellerIds.has(sellerId)) {
                  // Skip duplicate
                  callback();
                  return;
                }
                seenSellerIds.add(sellerId);

                const sellerType = (seller.seller_type || 'PUBLISHER').toString().toUpperCase().trim();

                // Name sanitization: Remove tabs, newlines, null chars
                let name = (seller.name || '').toString();
                // Replace invalid characters for TSV
                name = name.replace(/[\t\n\r\0]/g, ' ').trim();

                // Confidential handling
                let isConfidential = false;
                if (seller.is_confidential === 1 || seller.is_confidential === true || seller.is_confidential === '1') {
                  isConfidential = true;
                }

                // Seller Domain
                let sellerDomain = (seller.domain || '').toString().trim();
                sellerDomain = sellerDomain.replace(/[\t\n\r\0]/g, '').trim();

                // Identifiers (JSON)
                let identifiers = null;
                if (seller.identifiers && Array.isArray(seller.identifiers)) {
                  try {
                    identifiers = JSON.stringify(seller.identifiers);
                    // Escape backslashes for COPY TEXT format
                    identifiers = identifiers.replace(/\\/g, '\\\\');
                  } catch (e) {
                    identifiers = null;
                  }
                }
                const identifiersStr = identifiers ? identifiers : '\\N'; // \N for NULL in COPY

                const row = `${sellerId}\t${options.domain}\t${sellerType}\t${name}\t${sellerDomain}\t${identifiersStr}\t${isConfidential}\t${rawFileId}\n`;
                callback(null, row);
              } catch (e) {
                // Skip malformed record but continue stream
                callback();
              }
            },
          }),
          ingestStream,
        );

        // Mark as processed
        await client.query('UPDATE raw_sellers_files SET processed_at = NOW() WHERE id = $1', [rawFileId]);

        await client.query('COMMIT');
        console.log(`Import completed for ${options.domain}`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`Error importing ${options.domain}:`, err);
        // Update raw record to indicate processing failure
        await client.query('UPDATE raw_sellers_files SET http_status = $1, etag = $2 WHERE id = $3', [
          999, // Custom status for processing failure
          `Error: ${err.message}`.substring(0, 255),
          rawFileId,
        ]);
        throw err;
      }
    } finally {
      client.release();
    }
  }

  private async createRawFileRecord(
    client: PoolClient,
    domain: string,
    httpStatus: number | null,
    etag: string | null,
  ): Promise<string> {
    const res = await client.query(
      `
      INSERT INTO raw_sellers_files (domain, fetched_at, http_status, etag)
      VALUES ($1, NOW(), $2, $3)
      RETURNING id
    `,
      [domain, httpStatus, etag],
    );

    if (res.rows.length > 0) {
      return res.rows[0].id;
    }
    throw new Error('Failed to create raw file record');
  }

  async close() {
    // No-op: Singleton pool is managed globally
  }
}
