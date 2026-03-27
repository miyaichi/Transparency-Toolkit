import { pool } from '../db/client';

async function migrate() {
  const sql = `
    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key_hash VARCHAR(64) NOT NULL UNIQUE,
      key_prefix VARCHAR(8) NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      organization VARCHAR(255),
      rate_limit_day INTEGER DEFAULT 100,
      rate_limit_minute INTEGER DEFAULT 10,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      metadata JSONB
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_api_keys_email ON api_keys(email);

    CREATE TABLE IF NOT EXISTS api_usage_logs (
      id BIGSERIAL PRIMARY KEY,
      api_key_id UUID REFERENCES api_keys(id),
      endpoint VARCHAR(255) NOT NULL,
      method VARCHAR(10) NOT NULL,
      status_code INTEGER NOT NULL,
      response_time_ms INTEGER,
      ip_address INET,
      user_agent TEXT,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_api_usage_logs_api_key_id ON api_usage_logs(api_key_id);
    CREATE INDEX IF NOT EXISTS idx_api_usage_logs_timestamp ON api_usage_logs(timestamp);
  `;

  try {
    console.log('Running API keys migration...');
    await pool.query(sql);
    console.log('API keys migration completed');
  } catch (err: any) {
    console.error('API keys migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
