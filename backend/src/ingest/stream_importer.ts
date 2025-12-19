import { PoolClient } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { Transform } from 'stream';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';
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
      let usedUrl = options.url;
      const maxRetries = 1;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          response = await httpClient({
            method: 'get',
            url: usedUrl,
            responseType: 'stream',
            validateStatus: () => true, // Allow all status codes
            'axios-retry': { retries: 0 },
          } as any);

          if (response.status === 404 && !options.domain.startsWith('www.') && attempt === 0) {
            console.warn(`404 for ${usedUrl}, retrying with www.${options.domain}`);
            usedUrl = `https://www.${options.domain}/sellers.json`;
            continue;
          }

          if (response.status === 429 && attempt === 0) {
            // Simple wait for 429
            console.warn(`429 for ${usedUrl}, waiting 2s and retrying...`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }

          break; // Exit loop if successful or terminal status
        } catch (netErr: any) {
          if (attempt === maxRetries) {
            console.warn(`Network error fetching sellers.json for ${options.domain}:`, netErr.message);
            await this.createRawFileRecord(client, options.domain, 0, null);
            return;
          }
          // Retry network error once if needed
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (!response) {
        // Should have been caught by netErr block, but safety net
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
          parser(),
          pick({ filter: 'sellers' }),
          streamArray(),
          new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
              try {
                const seller = chunk.value;
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

                const sellerType = (seller.seller_type || 'PUBLISHER').toString().toUpperCase().trim(); // Default to PUBLISHER if missing? Or keep empty.
                // Spec says seller_type is required (PUBLISHER, INTERMEDIARY, BOTH). Let's keep raw but trim.

                // Name sanitization: Remove tabs, newlines, null chars to prevent COPY corruption
                let name = (seller.name || '').toString();
                // Replace invalid characters for TSV
                name = name.replace(/[\t\n\r\0]/g, ' ').trim();
                // Truncate if too long (DB limit?) - usually text or varchar(255). Let's start with safe mapping.

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
