import { pool } from '../db/client';

async function runMigration() {
  console.log('Starting migration to add processed_at to raw_sellers_files...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add processed_at column
    await client.query(`
      ALTER TABLE raw_sellers_files 
      ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
