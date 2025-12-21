import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { OpenSinceraService } from '../lib/opensincera';

const app = new Hono();

// Helper to get service instance
const getService = () => {
  const apiKey = process.env.OPENSINCERA_API_KEY;
  if (!apiKey) {
    throw new Error('OPENSINCERA_API_KEY is not set');
  }
  return new OpenSinceraService({
    baseUrl: process.env.OPENSINCERA_BASE_URL || 'https://open.sincera.io/api',
    apiKey,
    timeout: 10000,
  });
};

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
    const service = getService();
    let result;

    if (domain) {
      result = await service.getPublisherByDomain(domain);
    } else if (publisherId) {
      result = await service.getPublisherById(publisherId);
    }

    if (!result) {
      return c.json({ error: 'Publisher not found' }, 404);
    }

    return c.json(result);
  } catch (error) {
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
