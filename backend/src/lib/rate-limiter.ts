import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

interface RateLimitConfig {
  windowMs: number;
  limit: number;
  message?: string;
  statusCode?: number;
  keyGenerator?: (c: Context) => string;
}

/**
 * Simple In-Memory Rate Limiter for Hono
 * Note: This limits requests per-instance. In a distributed environment like Cloud Run,
 * specific IPs might be able to exceed the global limit if requests are routed to different instances.
 * For strict global rate limiting, a Redis-backed store would be required.
 */
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

export const rateLimiter = (options: RateLimitConfig) => {
  const store = new MemoryStore();

  const {
    windowMs,
    limit,
    message = 'Too many requests, please try again later.',
    statusCode = 429,
    keyGenerator = (c) => {
      // Get Client IP
      // In Cloud Run / Proxies, the real IP is in X-Forwarded-For
      const xForwardedFor = c.req.header('x-forwarded-for');
      if (xForwardedFor) {
        return xForwardedFor.split(',')[0].trim();
      }
      // Fallback or dev environment
      return 'unknown-ip';
    },
  } = options;

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);

    // Whitelist internal service calls if necessary (e.g. from Cloud Scheduler)
    // Cloud Scheduler usually has user-agent: Google-Cloud-Scheduler
    const userAgent = c.req.header('user-agent');
    if (userAgent && userAgent.includes('Google-Cloud-Scheduler')) {
      await next();
      return;
    }

    const record = store.increment(key, windowMs);

    // Set standard RateLimit headers
    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, limit - record.count).toString());
    c.header('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());

    if (record.count > limit) {
      throw new HTTPException(statusCode as any, { message });
    }

    await next();
  };
};
