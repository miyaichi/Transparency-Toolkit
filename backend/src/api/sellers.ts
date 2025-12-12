import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { query } from '../db/client';

const app = new OpenAPIHono();

// Schemas
const SellerSchema = z.object({
  seller_id: z.string().openapi({ example: 'pub-1234567890' }),
  domain: z.string().openapi({ example: 'google.com' }),
  seller_type: z.string().nullable().openapi({ example: 'PUBLISHER' }),
  name: z.string().nullable().openapi({ example: 'Example Publisher' }),
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

  const pageNum = parseInt(page || '1');
  const limitNum = Math.min(parseInt(limit || '50'), 100);
  const offset = (pageNum - 1) * limitNum;

  // Build Query
  let sql = 'SELECT seller_id, domain, seller_type, name, is_confidential, updated_at FROM sellers_catalog WHERE 1=1';
  const params: any[] = [];
  let pIdx = 1;

  if (domain) {
    sql += ` AND domain = $${pIdx++}`;
    params.push(domain);
  }

  if (seller_type) {
    sql += ` AND seller_type = $${pIdx++}`;
    params.push(seller_type);
  }

  if (q) {
    sql += ` AND (domain ILIKE $${pIdx} OR seller_id ILIKE $${pIdx} OR name ILIKE $${pIdx})`;
    params.push(`%${q}%`);
    pIdx++;
  }

  // Count Query
  // Note: Full count can be slow on large tables. For MVP, we use exact count.
  // In v2 full release, consider estimated count or separate count query caching.
  const countRes = await query(`SELECT count(*) as total FROM (${sql}) as sub`, params);
  const total = parseInt(countRes.rows[0].total);

  // Data Query
  sql += ` ORDER BY updated_at DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
  params.push(limitNum, offset);

  const res = await query(sql, params);

  return c.json({
    data: res.rows,
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  });
});

// New Route: List Scanned Files
const SellersFilesResponseSchema = z.array(z.object({
  id: z.string(),
  domain: z.string(),
  fetched_at: z.string(),
  http_status: z.number().nullable(),
  etag: z.string().nullable()
}));

const getFilesRoute = createRoute({
  method: 'get',
  path: '/files',
  responses: {
    200: {
      content: { 'application/json': { schema: SellersFilesResponseSchema } },
      description: 'List of recent sellers.json scan files'
    }
  }
});

import { DbSellersProvider } from '../services/db_sellers_provider';
const provider = new DbSellersProvider();

app.openapi(getFilesRoute, async (c) => {
  const files = await provider.getRecentFiles(100);
  return c.json(files as any);
});

export default app;
