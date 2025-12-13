
import { pool } from '../db/client';

async function migrate() {
  console.log('Running migration: Update monitored_domains for file_type...');

  try {
    // 1. Add file_type column
    // Check if column exists first
    const checkRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='monitored_domains' AND column_name='file_type';
    `);

    if (checkRes.rowCount === 0) {
      // Add column with default 'ads.txt' for existing records
      await pool.query(`
        ALTER TABLE monitored_domains 
        ADD COLUMN file_type TEXT DEFAULT 'ads.txt';
      `);
      console.log('Added file_type column.');

      // 2. Drop existing Primary Key
      await pool.query(`
        ALTER TABLE monitored_domains DROP CONSTRAINT monitored_domains_pkey;
      `);
      console.log('Dropped old PK.');

      // 3. Create new Composite Primary Key
      await pool.query(`
        ALTER TABLE monitored_domains ADD PRIMARY KEY (domain, file_type);
      `);
      console.log('Created new Composite PK (domain, file_type).');
    } else {
      console.log('Migration already applied (file_type exists).');
    }

  } catch (err: any) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
