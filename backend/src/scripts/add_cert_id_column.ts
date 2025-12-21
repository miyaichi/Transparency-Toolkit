import { pool, query } from '../db/client';

async function migrate() {
  try {
    console.log('Starting migration: Add certification_authority_id to sellers_catalog...');

    // 1. Add Column
    await query(`
      ALTER TABLE sellers_catalog 
      ADD COLUMN IF NOT EXISTS certification_authority_id TEXT;
    `);

    // 2. Create index for performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_sellers_catalog_cert_auth 
      ON sellers_catalog(domain, certification_authority_id);
    `);

    console.log('Column and Index added successfully.');
    console.log('Migration completed.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

migrate();
