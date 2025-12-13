
import { pool } from '../db/client';

async function migrate() {
  console.log('Running migration: Add file_type to ads_txt_scans...');

  try {
    // Check if column exists
    const checkRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='ads_txt_scans' AND column_name='file_type';
    `);

    if (checkRes.rowCount === 0) {
      // Add column
      await pool.query(`
        ALTER TABLE ads_txt_scans 
        ADD COLUMN file_type TEXT DEFAULT 'ads.txt';
      `);
      console.log('Successfully added file_type column.');
    } else {
      console.log('Column file_type already exists. Skipping.');
    }

    // Create index to support filtering by type
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ads_txt_scans_type ON ads_txt_scans(file_type);
    `);
    console.log('Index ensured.');

  } catch (err: any) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
