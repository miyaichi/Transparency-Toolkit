import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { rateLimiter } from './rate-limiter';

describe('rateLimiter Middleware', () => {
  let mockNext: jest.Mock;
  let mockContext: any;
  let headers: Record<string, string>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockNext = jest.fn().mockResolvedValue(undefined);
    headers = {};
    mockContext = {
      req: {
        header: jest.fn((name: string) => {
          if (name === 'x-forwarded-for') return '127.0.0.1';
          return undefined;
        }),
      } as any,
      header: jest.fn((key: string, value: string | undefined) => {
        if (value) headers[key] = value;
      }),
    } as any;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow requests within limit', async () => {
    const middleware = rateLimiter({
      windowMs: 1000,
      limit: 2,
    });

    // 1st request
    await middleware(mockContext as Context, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(headers['X-RateLimit-Remaining']).toBe('1');
    expect(headers['X-RateLimit-Limit']).toBe('2');

    // 2nd request
    await middleware(mockContext as Context, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(2);
    expect(headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('should block requests over limit', async () => {
    const middleware = rateLimiter({
      windowMs: 1000,
      limit: 1,
    });

    // 1st request (OK)
    await middleware(mockContext as Context, mockNext);

    // 2nd request (Blocked)
    await expect(middleware(mockContext as Context, mockNext)).rejects.toThrow(HTTPException);

    // Verify it threw 429
    try {
      await middleware(mockContext as Context, mockNext);
    } catch (e: any) {
      expect(e.status).toBe(429);
      expect(e.message).toBe('Too many requests, please try again later.');
    }
  });

  it('should reset after window', async () => {
    const middleware = rateLimiter({
      windowMs: 1000,
      limit: 1,
    });

    // 1st request
    await middleware(mockContext as Context, mockNext);
    expect(headers['X-RateLimit-Remaining']).toBe('0');

    // Advance time
    jest.advanceTimersByTime(1100);

    // 2nd request (Should be OK now)
    await middleware(mockContext as Context, mockNext);
    expect(headers['X-RateLimit-Remaining']).toBe('0'); // Reset to 1, then consumed 1 -> 0
    expect(mockNext).toHaveBeenCalledTimes(2);
  });

  it('should handle comma-separated x-forwarded-for', async () => {
    const middleware = rateLimiter({
      windowMs: 1000,
      limit: 5,
    });

    mockContext.req = {
      header: jest.fn((name: string) => {
        if (name === 'x-forwarded-for') return '10.0.0.1, 10.0.0.2';
        return undefined;
      }),
    } as any;

    await middleware(mockContext as Context, mockNext);
    // Should use 10.0.0.1
    // We can't easily check the internal key, but we ensure it runs without error
    expect(mockNext).toHaveBeenCalled();
  });
});
