
import { pool } from '../db/client';

async function cleanup() {
  console.log('Cleaning up 404 records from raw_sellers_files...');
  try {
    const res = await pool.query(`DELETE FROM raw_sellers_files WHERE http_status = 404`);
    console.log(`Deleted ${res.rowCount} records.`);
  } catch (err: any) {
    console.error('Failed to cleanup:', err.message);
  } finally {
    await pool.end();
  }
}

cleanup();
