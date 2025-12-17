import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { SellersService } from '../services/sellers_service';

const app = new OpenAPIHono();
const service = new SellersService();

// Schemas
const SellerSchema = z.object({
  seller_id: z.string().openapi({ example: 'pub-1234567890' }),
  domain: z.string().openapi({ example: 'google.com' }), // This is the seller's domain (seller_domain)
  source_domain: z.string().optional(),
  seller_type: z.string().nullable().openapi({ example: 'PUBLISHER' }),
  name: z.string().nullable().openapi({ example: 'Example Publisher' }),
  identifiers: z.any().nullable().optional(),
  is_confidential: z.boolean().nullable().openapi({ example: false }),
  updated_at: z.string().openapi({ example: '2025-01-01T00:00:00Z' }),
});

const SearchQuerySchema = z.object({
  q: z.string().optional().openapi({ description: 'Keyword search for domain, seller_id, or name' }),
  domain: z.string().optional().openapi({ description: 'Filter by domain' }),
  seller_type: z.string().optional().openapi({ description: 'Filter by seller type (PUBLISHER, INTERMEDIARY, BOTH)' }),
  page: z.string().optional().default('1').openapi({ description: 'Page number' }),
  limit: z.string().optional().default('50').openapi({ description: 'Items per page (max 100)' }),
});

const SellersResponseSchema = z.object({
  data: z.array(SellerSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    pages: z.number(),
  }),
});

// Route Definition
const getSellersRoute = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: SearchQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SellersResponseSchema,
        },
      },
      description: 'Retrieve sellers list',
    },
  },
});

// Implementation
app.openapi(getSellersRoute, async (c) => {
  const { q, domain, seller_type, page, limit } = c.req.valid('query');

  const result = await service.searchSellers({
    q,
    domain,
    seller_type,
    page: parseInt(page || '1'),
    limit: parseInt(limit || '50'),
  });

  return c.json(result as any); // Cast for strict schema match (identifiers etc)
});

// New Route: List Scanned Files
const SellersFilesResponseSchema = z.array(
  z.object({
    id: z.string(),
    domain: z.string(),
    fetched_at: z.string(),
    http_status: z.number().nullable(),
    etag: z.string().nullable(),
  }),
);

const getFilesRoute = createRoute({
  method: 'get',
  path: '/files',
  responses: {
    200: {
      content: { 'application/json': { schema: SellersFilesResponseSchema } },
      description: 'List of recent sellers.json scan files',
    },
  },
});

app.openapi(getFilesRoute, async (c) => {
  const files = await service.getRecentFiles(100);
  return c.json(files as any);
});

// New Route: Fetch and Import Sellers.json
const fetchRoute = createRoute({
  method: 'get',
  path: '/fetch',
  request: {
    query: z.object({
      domain: z.string().openapi({ description: 'Domain to fetch sellers.json from' }),
      save: z.enum(['true', 'false']).optional().default('false').openapi({ description: 'Save result to DB' }),
    }),
  },
  responses: {
    200: {
      description: 'Parsed sellers.json content',
      content: {
        'application/json': {
          schema: z.object({
            domain: z.string(),
            sellers_json_url: z.string(),
            version: z.string().optional(),
            contact_email: z.string().optional(),
            contact_address: z.string().optional(),
            sellers: z.array(z.any()),
            fetched_at: z.string().optional(),
          }),
        },
      },
    },
    400: { description: 'Bad Request' },
    500: { description: 'Fetch error' },
  },
});

app.openapi(fetchRoute, async (c) => {
  const { domain, save } = c.req.valid('query');

  try {
    const result = await service.fetchAndProcessSellers(domain, save === 'true');
    return c.json(result as any);
  } catch (e: any) {
    console.error('Fetch/Import Error:', e);
    return c.json({ error: e.message || 'Failed to fetch sellers.json' }, 500);
  }
});

export default app;
