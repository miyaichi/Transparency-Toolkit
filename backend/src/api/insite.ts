import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { OpenSinceraHttpError, OpenSinceraService, PublisherMetadata } from '../lib/opensincera';
import { findOpenSinceraCache, upsertOpenSinceraCache } from '../repositories/opensincera-cache';

const app = new Hono();

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ERROR_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for upstream errors
const MIN_FETCH_INTERVAL_MS = 1000; // throttle upstream calls

let cachedService: OpenSinceraService | null = null;
let lastFetchAt = 0;

// Helper to get service instance
const getService = () => {
  const apiKey = process.env.OPENSINCERA_API_KEY;
  if (!apiKey) {
    throw new Error('OPENSINCERA_API_KEY is not set');
  }
  if (!cachedService) {
    cachedService = new OpenSinceraService({
      baseUrl: process.env.OPENSINCERA_BASE_URL || 'https://open.sincera.io/api',
      apiKey,
      timeout: 10000,
    });
  }
  return cachedService;
};

const waitForThrottle = async () => {
  const now = Date.now();
  const waitMs = lastFetchAt + MIN_FETCH_INTERVAL_MS - now;
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
};

const isCacheValid = (record: { expiresAt: Date }) => record.expiresAt.getTime() > Date.now();

const getSourceUrl = (service: OpenSinceraService, domain?: string, publisherId?: string) =>
  service.buildPublisherUrl({
    publisherDomain: domain,
    publisherId,
  });

const searchSchema = z
  .object({
    domain: z.string().optional(),
    publisherId: z.string().optional(),
  })
  .refine((data) => data.domain || data.publisherId, {
    message: 'Either domain or publisherId must be provided',
  });

app.get('/publisher', zValidator('query', searchSchema), async (c) => {
  const { domain, publisherId } = c.req.valid('query');
  try {
    const cached = await findOpenSinceraCache({ domain, publisherId });
    if (cached && isCacheValid(cached)) {
      console.log(`[Insite] Serving OpenSincera from DB cache: ${domain || publisherId}`);
      if (cached.status === 'success' && cached.normalizedMetadata) {
        return c.json(cached.normalizedMetadata);
      }
      if (cached.status === 'not_found') {
        return c.json({ error: 'Publisher not found' }, 404);
      }
      if (cached.status === 'error') {
        return c.json({ error: cached.errorMessage || 'Failed to fetch publisher data' }, 503);
      }
    }

    await waitForThrottle();
    lastFetchAt = Date.now();
    const service = getService();

    const response = await service.getPublisherMetadata({
      publisherDomain: domain,
      publisherId,
      limit: 1,
    });

    const publisher: PublisherMetadata | undefined = response.publishers[0];

    const sourceUrl = getSourceUrl(service, domain, publisherId || publisher?.publisherId);

    if (!publisher) {
      await upsertOpenSinceraCache({
        domain: domain || null,
        publisherId: publisherId || null,
        status: 'not_found',
        rawResponse: response.rawResponse ?? null,
        normalizedMetadata: null,
        httpStatus: 404,
        errorMessage: 'Publisher not found',
        sourceUrl,
        ttlMs: CACHE_TTL_MS,
      });
      return c.json({ error: 'Publisher not found' }, 404);
    }

    await upsertOpenSinceraCache({
      domain: domain || publisher.domain || null,
      publisherId: publisher.publisherId || publisherId || null,
      status: 'success',
      rawResponse: response.rawResponse ?? null,
      normalizedMetadata: publisher,
      httpStatus: 200,
      errorMessage: null,
      sourceUrl,
      ttlMs: CACHE_TTL_MS,
    });

    return c.json(publisher);
  } catch (error) {
    lastFetchAt = Date.now();
    if (error instanceof OpenSinceraHttpError) {
      const service = cachedService || getService();
      const sourceUrl = getSourceUrl(service, domain, publisherId || undefined);

      if (error.status === 404) {
        await upsertOpenSinceraCache({
          domain: domain || null,
          publisherId: publisherId || null,
          status: 'not_found',
          rawResponse: error.data || null,
          normalizedMetadata: null,
          httpStatus: 404,
          errorMessage: 'Publisher not found',
          sourceUrl,
          ttlMs: CACHE_TTL_MS,
        });
        return c.json({ error: 'Publisher not found' }, 404);
      }

      await upsertOpenSinceraCache({
        domain: domain || null,
        publisherId: publisherId || null,
        status: 'error',
        rawResponse: error.data || null,
        normalizedMetadata: null,
        httpStatus: error.status || null,
        errorMessage: error.message,
        sourceUrl,
        ttlMs: ERROR_CACHE_TTL_MS,
      });

      if (error.message.includes('API key')) {
        return c.json({ error: 'OpenSincera functionality is not configured' }, 503);
      }
      return c.json({ error: 'Failed to fetch publisher data' }, 502);
    }

    if (error instanceof Error && error.message.includes('API key')) {
      return c.json({ error: 'OpenSincera functionality is not configured' }, 503);
    }

    console.error('Insite API Error:', error);
    return c.json({ error: 'Failed to fetch publisher data' }, 500);
  }
});

app.get('/health', async (c) => {
  try {
    const service = getService();
    const isHealthy = await service.healthCheck();
    return c.json({ healthy: isHealthy });
  } catch (error) {
    return c.json({ healthy: false, error: 'Configuration Error' }, 503);
  }
});

export default app;
