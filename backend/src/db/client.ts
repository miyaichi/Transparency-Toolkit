import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/adstxt_v2';

export const pool = new Pool({
  connectionString,
  max: 5, // Reduced for Cloud SQL micro instance compatibility
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased timeout slightly
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
};
