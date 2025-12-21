// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Case mismatch between package (JSONStream) and types (jsonstream)
// eslint-disable-next-line @typescript-eslint/no-require-imports
import JSONStream = require('JSONStream');
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
      let usedUrl = options.url;
      const maxRetries = 1;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          response = await httpClient({
            method: 'get',
            url: usedUrl,
            responseType: 'stream',
            validateStatus: () => true,
            'axios-retry': { retries: 0 },
          } as any);

          if (response.status === 404 && !options.domain.startsWith('www.') && attempt === 0) {
            console.warn(`404 for ${usedUrl}, retrying with www.${options.domain}`);
            usedUrl = `https://www.${options.domain}/sellers.json`;
            continue;
          }

          if (response.status === 429 && attempt === 0) {
            console.warn(`429 for ${usedUrl}, waiting 2s and retrying...`);
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }

          break;
        } catch (netErr: any) {
          if (attempt === maxRetries) {
            console.warn(`Network error fetching sellers.json for ${options.domain}:`, netErr.message);
            await this.createRawFileRecord(client, options.domain, 0, null);
            return;
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (!response) return;

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

        // DELETE existing entries
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
              raw_file_id,
              certification_authority_id
            ) FROM STDIN
          `),
        );

        // 4. Build pipeline
        const seenSellerIds = new Set<string>();
        let certAuthorityId: string | null = null;

        // Create parser and attach listeners to capture 'identifiers' from header or footer
        const parser = JSONStream.parse('sellers.*');

        const extractCertId = (data: any) => {
          if (data && data.identifiers && Array.isArray(data.identifiers)) {
            const tag = data.identifiers.find((i: any) => i.name === 'TAG-ID');
            if (tag && tag.value) {
              certAuthorityId = tag.value;
            }
          }
        };

        parser.on('header', extractCertId);
        parser.on('footer', extractCertId);

        await pipeline(
          response.data,
          parser,
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

                // Certification Authority ID (if found in header)
                const certIdStr = certAuthorityId ? certAuthorityId : '\\N';

                const row = `${sellerId}\t${options.domain}\t${sellerType}\t${name}\t${sellerDomain}\t${identifiersStr}\t${isConfidential}\t${rawFileId}\t${certIdStr}\n`;
                callback(null, row);
              } catch (e) {
                // Skip malformed record but continue stream
                callback();
              }
            },
          }),
          ingestStream,
        );

        // Post-processing: If certAuthorityId was found (e.g. in footer) and not applied to some rows
        if (certAuthorityId) {
          await client.query(
            'UPDATE sellers_catalog SET certification_authority_id = $1 WHERE domain = $2 AND certification_authority_id IS NULL',
            [certAuthorityId, options.domain],
          );
        }

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
