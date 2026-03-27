import { createHash } from 'crypto';
import { Context, Next } from 'hono';
import { query } from '../db/client';

type Variables = {
  apiKeyId: string;
  apiKeyHash: string;
};

class MemoryStore {
  private hits = new Map<string, { count: number; resetTime: number }>();

  constructor() {
    // Periodic cleanup to prevent memory leaks
    setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    let record = this.hits.get(key);

    if (!record || record.resetTime <= now) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      this.hits.set(key, record);
    }

    record.count++;
    return record;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.hits.entries()) {
      if (value.resetTime <= now) {
        this.hits.delete(key);
      }
    }
  }
}

// Module-level stores shared across requests
const minuteStore = new MemoryStore();
const dayStore = new MemoryStore();

export const apiKeyAuth = async (c: Context<{ Variables: Variables }>, next: Next) => {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    return c.json(
      {
        error: 'missing_api_key',
        message: 'API key is required. Provide it via the X-API-Key header.',
      },
      401,
    );
  }

  // Hash the key with SHA-256 (deterministic, no salt)
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  // Look up the key in the database
  let row: any;
  try {
    const result = await query(
      `SELECT id, key_hash, name, email, is_active, expires_at, rate_limit_minute, rate_limit_day
       FROM api_keys
       WHERE key_hash = $1`,
      [keyHash],
    );
    row = result.rows[0];
  } catch (err: any) {
    console.error('API key lookup error:', err.message);
    return c.json(
      {
        error: 'internal_error',
        message: 'Failed to validate API key.',
      },
      500,
    );
  }

  if (!row) {
    return c.json(
      {
        error: 'invalid_api_key',
        message: 'The provided API key is invalid.',
      },
      401,
    );
  }

  if (!row.is_active) {
    return c.json(
      {
        error: 'api_key_disabled',
        message: 'This API key has been disabled.',
      },
      403,
    );
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return c.json(
      {
        error: 'api_key_disabled',
        message: 'This API key has expired.',
      },
      403,
    );
  }

  const apiKeyId: string = row.id;
  const rateLimitMinute: number = row.rate_limit_minute ?? 10;
  const rateLimitDay: number = row.rate_limit_day ?? 100;

  // Check per-day rate limit
  const dayRecord = dayStore.increment(`${apiKeyId}:day`, 24 * 60 * 60 * 1000);
  if (dayRecord.count > rateLimitDay) {
    const retryAfter = Math.ceil((dayRecord.resetTime - Date.now()) / 1000);
    c.header('Retry-After', retryAfter.toString());
    return c.json(
      {
        error: 'rate_limit_exceeded',
        message: `Daily rate limit of ${rateLimitDay} requests exceeded.`,
        retry_after: retryAfter,
      },
      429,
    );
  }

  // Check per-minute rate limit
  const minuteRecord = minuteStore.increment(`${apiKeyId}:minute`, 60 * 1000);

  // Set standard RateLimit headers (per-minute limit)
  c.header('X-RateLimit-Limit', rateLimitMinute.toString());
  c.header('X-RateLimit-Remaining', Math.max(0, rateLimitMinute - minuteRecord.count).toString());
  c.header('X-RateLimit-Reset', Math.ceil(minuteRecord.resetTime / 1000).toString());

  if (minuteRecord.count > rateLimitMinute) {
    const retryAfter = Math.ceil((minuteRecord.resetTime - Date.now()) / 1000);
    c.header('Retry-After', retryAfter.toString());
    return c.json(
      {
        error: 'rate_limit_exceeded',
        message: `Per-minute rate limit of ${rateLimitMinute} requests exceeded.`,
        retry_after: retryAfter,
      },
      429,
    );
  }

  // Store key info in context
  c.set('apiKeyId', apiKeyId);
  c.set('apiKeyHash', row.key_hash);

  // Update last_used_at asynchronously (fire-and-forget)
  query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [apiKeyId]).catch((err) => {
    console.error('Failed to update last_used_at:', err.message);
  });

  await next();
};
