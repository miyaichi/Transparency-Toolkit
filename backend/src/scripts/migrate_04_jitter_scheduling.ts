import { pool } from '../db/client';

async function runMigration() {
  console.log('Starting migration: Add jitter-based scheduling columns...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- monitored_domains: next_scan_at ---
    await client.query(`
      ALTER TABLE monitored_domains
        ADD COLUMN IF NOT EXISTS next_scan_at TIMESTAMPTZ
    `);

    await client.query(`
      UPDATE monitored_domains
      SET next_scan_at = CASE
        WHEN last_scanned_at IS NOT NULL THEN
          last_scanned_at
          + ((scan_interval_minutes * (0.5 + random())) || ' minutes')::interval
        ELSE
          NOW()
          + ((scan_interval_minutes * random()) || ' minutes')::interval
        END
      WHERE next_scan_at IS NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_monitored_domains_next_scan_at
        ON monitored_domains (next_scan_at)
        WHERE is_active = true
    `);

    // --- raw_sellers_files: next_fetch_at ---
    await client.query(`
      ALTER TABLE raw_sellers_files
        ADD COLUMN IF NOT EXISTS next_fetch_at TIMESTAMPTZ
    `);

    await client.query(`
      WITH latest AS (
        SELECT DISTINCT ON (domain) id, fetched_at
        FROM raw_sellers_files
        ORDER BY domain, fetched_at DESC
      )
      UPDATE raw_sellers_files rsf
      SET next_fetch_at =
        latest.fetched_at
        + ((360 * (0.5 + random())) || ' minutes')::interval
      FROM latest
      WHERE rsf.id = latest.id
        AND rsf.next_fetch_at IS NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_raw_sellers_files_next_fetch_at
        ON raw_sellers_files (domain, next_fetch_at DESC NULLS FIRST)
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
