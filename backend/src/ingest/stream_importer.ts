import { Pool, PoolClient } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { Transform } from 'stream';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { pipeline } from 'stream/promises';
import httpClient from '../lib/http';

interface ImportOptions {
  domain: string;
  url: string;
}

export class StreamImporter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 2, // Limit connections for background jobs
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  async importSellersJson(options: ImportOptions) {
    const client = await this.pool.connect();
    console.log(`Starting import for ${options.domain} from ${options.url}`);

    try {
      // 2. HTTP Stream取得
      const response = await httpClient({
        method: 'get',
        url: options.url,
        responseType: 'stream',
        validateStatus: () => true, // Allow all status codes to handle 404/500 manually
      });

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
              is_confidential, 
              raw_file_id
            ) FROM STDIN
          `),
        );

        // 4. Build pipeline
        await pipeline(
          response.data,
          parser(),
          pick({ filter: 'sellers' }),
          streamArray(),
          new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
              const seller = chunk.value;
              const sellerId = (seller.seller_id || '').toString().trim();
              const sellerType = (seller.seller_type || '').toString().trim();
              const name = (seller.name || '').toString().replace(/\t/g, ' ').replace(/\n/g, ' ').trim();
              const isConfidential =
                seller.is_confidential === 1 || seller.is_confidential === true || seller.is_confidential === '1';

              const row = `${sellerId}\t${options.domain}\t${sellerType}\t${name}\t${isConfidential}\t${rawFileId}\n`;
              callback(null, row);
            },
          }),
          ingestStream,
        );

        await client.query('COMMIT');
        console.log(`Import completed for ${options.domain}`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw err;
      }
    } catch (err: any) {
      console.error(`Error importing ${options.domain}:`, err.message);
      // In case of network error (axios throws), try to record failure
      // We might need a new client connection if the previous one is in error state or stream failed?
      // Actually creating record deals with DB. If axios fails before response (e.g. DNS error), we want to log it.
      // For simplicity, we are not recording "Network Error" in DB currently unless we reorganize code to create record first with 'pending' then update.
      // But user asked to consider "sellers.json itself does not exist" which is 404. Above httpStatus handling covers it.
      // If domain resolution fails, axios throws. We could try to insert a record with status 0 or similar if critical.
      // Let's keep it simple for now, standard 404/403/500 are handled.
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
    await this.pool.end();
  }
}
