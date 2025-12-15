
import fs from 'fs';
import path from 'path';
import { pool, query } from '../src/db/client';

async function runMigration() {
  const migrationFile = path.join(__dirname, '../src/db/migrations/20251216_fix_monitored_domains.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log('Running migration:', migrationFile);
  try {
    await query('BEGIN');
    await query(sql);
    await query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

runMigration();
