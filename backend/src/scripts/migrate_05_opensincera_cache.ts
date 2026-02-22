import { pool } from '../db/client';

async function migrate() {
  const sql = `
    CREATE TABLE IF NOT EXISTS opensincera_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      domain TEXT,
      publisher_id TEXT,
      status TEXT NOT NULL,
      raw_response JSONB,
      normalized_metadata JSONB,
      http_status INT,
      error_message TEXT,
      source_url TEXT,
      fetched_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT opensincera_cache_domain_or_id CHECK (domain IS NOT NULL OR publisher_id IS NOT NULL),
      CONSTRAINT opensincera_cache_valid_status CHECK (status IN ('success', 'not_found', 'error'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS opensincera_cache_domain_unique ON opensincera_cache (domain) WHERE domain IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS opensincera_cache_publisher_id_unique ON opensincera_cache (publisher_id) WHERE publisher_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS opensincera_cache_expires_at_idx ON opensincera_cache (expires_at);
    CREATE INDEX IF NOT EXISTS opensincera_cache_status_idx ON opensincera_cache (status);
  `;

  try {
    console.log('Running OpenSincera cache migration...');
    await pool.query(sql);
    console.log('OpenSincera cache migration completed');
  } catch (err: any) {
    console.error('OpenSincera cache migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
