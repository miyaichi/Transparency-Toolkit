import axios from 'axios';
import { Pool, PoolClient } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { Transform } from 'stream';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { pipeline } from 'stream/promises';

interface ImportOptions {
  domain: string;
  url: string;
}

export class StreamImporter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
    });
  }

  async importSellersJson(options: ImportOptions) {
    const client = await this.pool.connect();
    console.log(`Starting import for ${options.domain} from ${options.url}`);

    try {
      // 1. Raw File Record作成
      const rawFileId = await this.createRawFileRecord(client, options.domain);

      // 2. HTTP Stream取得
      const response = await axios({
        method: 'get',
        url: options.url,
        responseType: 'stream'
      });

      // 3. COPYストリームの準備
      // CSV形式でCOPY (テキストモードの方が扱いやすい場合もあるが、セパレータ等に注意)
      // ここではTEXT形式で、TAB区切りとする
      const ingestStream = client.query(copyFrom(`
        COPY sellers_catalog (
          seller_id, 
          domain, 
          seller_type, 
          name, 
          is_confidential, 
          raw_file_id
        ) FROM STDIN
      `));

      // 4. ストリームパイプラインの構築
      // HTTP Response -> JSON Parser -> Pick 'sellers' -> StreamArray -> Transform to TSV -> DB Copy Stream
      await pipeline(
        response.data,
        parser(),
        pick({ filter: 'sellers' }),
        streamArray(),
        new Transform({
          objectMode: true,
          transform(chunk, encoding, callback) {
            const seller = chunk.value;
            // データ整形
            const sellerId = (seller.seller_id || '').toString().trim();
            const sellerType = (seller.seller_type || '').toString().trim();
            const name = (seller.name || '').toString().replace(/\t/g, ' ').replace(/\n/g, ' ').trim(); // TABや改行を除去
            const isConfidential = seller.is_confidential === 1 || seller.is_confidential === true || seller.is_confidential === '1';

            // TSV行を作成 (NULL等の処理が必要ならここで行う)
            // seller_id, domain, seller_type, name, is_confidential, raw_file_id
            const row = `${sellerId}\t${options.domain}\t${sellerType}\t${name}\t${isConfidential}\t${rawFileId}\n`;

            callback(null, row);
          }
        }),
        ingestStream
      );

      console.log(`Import completed for ${options.domain}`);

    } catch (err) {
      console.error(`Error importing ${options.domain}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  private async createRawFileRecord(client: PoolClient, domain: string): Promise<string> {
    const res = await client.query(`
      INSERT INTO raw_sellers_files (domain, fetched_at)
      VALUES ($1, NOW())
      RETURNING id
    `, [domain]);

    // ON CONFLICT時はRETURNINGが空になる可能性があるので注意（ここでは簡易実装）
    if (res.rows.length > 0) {
      return res.rows[0].id;
    }

    // 既存レコードを取得して返すなどの処理が必要だが、今回は新規前提
    throw new Error('Failed to create raw file record');
  }

  async close() {
    await this.pool.end();
  }
}
