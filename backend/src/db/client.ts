import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/adstxt_v2';

// Pool sizing has to clear the scheduler's scan concurrency (SCAN_CONCURRENCY,
// default 8), because each concurrent scan task issues several sequential
// queries (insert scan, detect language, update last_scanned). At max: 5 the
// tasks queued on connection acquisition and blew past the 5s timeout, logging
// "timeout exceeded when trying to connect" every run and taking the whole job
// down with it. The old cap cited a Cloud SQL micro instance; the instance is
// now db-g1-small with max_connections = 50 and roughly 11 in use, so a pool of
// 15 leaves ample headroom for the API and any concurrent Cloud Run instance.
export const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX ?? 15),
  idleTimeoutMillis: 30000,
  // Acquisition waits behind other tasks' queries, not just the TCP handshake,
  // so this needs slack beyond a connect round-trip.
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 15000),
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
};
