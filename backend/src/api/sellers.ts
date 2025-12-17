import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { query } from '../db/client';

const app = new OpenAPIHono();

// Schemas
const SellerSchema = z.object({
  seller_id: z.string().openapi({ example: 'pub-1234567890' }),
  domain: z.string().openapi({ example: 'google.com' }), // This is the seller's domain
  seller_type: z.string().nullable().openapi({ example: 'PUBLISHER' }),
  name: z.string().nullable().openapi({ example: 'Example Publisher' }),
  identifiers: z.array(z.any()).nullable().optional(),
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
  // Note: We select seller_domain as 'domain' for the response to match the spec
  let sql =
    'SELECT seller_id, domain as source_domain, COALESCE(seller_domain, domain) as domain, seller_type, name, identifiers, is_confidential, updated_at FROM sellers_catalog WHERE 1=1';
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
    sql += ` AND (domain ILIKE $${pIdx} OR seller_domain ILIKE $${pIdx} OR seller_id ILIKE $${pIdx} OR name ILIKE $${pIdx})`;
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

import { DbSellersProvider } from '../services/db_sellers_provider';
const provider = new DbSellersProvider();

app.openapi(getFilesRoute, async (c) => {
  const files = await provider.getRecentFiles(100);
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
            sellers: z.array(z.any()), // Use specific schema if needed, but 'any' is flexible for response
            fetched_at: z.string().optional(),
          }),
        },
      },
    },
    400: { description: 'Bad Request' },
    500: { description: 'Fetch error' },
  },
});

import { StreamImporter } from '../ingest/stream_importer';
import client from '../lib/http'; // Axios client

app.openapi(fetchRoute, async (c) => {
  const { domain, save } = c.req.valid('query');
  const url = `https://${domain}/sellers.json`;

  // For MVP, we use StreamImporter if save=true.
  // If save=false (preview), we might just fetch and parse directly without DB.
  // However, StreamImporter is designed for DB Ingest.
  // Let's implement a simple fetch-and-return for preview, and use Importer for background save.

  // BUT frontend calls with save=true ?
  // Frontend code calls: /api/proxy/sellers/fetch?domain=${domain}&save=true

  // If save=true, we should initiate import.
  // However, StreamImporter is void, it imports to DB. It doesn't return the content.
  // Frontend expects the content back to display it instantly.

  // Strategy:
  // 1. Fetch content (buffer or stream).
  // 2. Return content to user.
  // 3. (Async) If save=true, trigger Import? Or do it synchronously?
  // Since StreamImporter fetches again, double fetch is wasteful but safer for separation.
  // Or we modify StreamImporter to accept stream/buffer?

  // For simplicity and robustness (avoiding huge files memory issues):
  // If save=true, run StreamImporter (DB Ingest).
  // THEN query DB to return the data?
  // Querying 10k records from DB to return to frontend is okay with paging, but frontend expects all?
  // Frontend does client-side filtering. 10k records is ~1-2MB JSON. It's acceptable for modern browser.

  try {
    if (save === 'true') {
      const importer = new StreamImporter();
      try {
        await importer.importSellersJson({ domain, url });
      } finally {
        await importer.close();
      }

      // After import, fetch from DB to return
      // We need to return in specific format expected by frontend
      // Reuse getSellers logic but for specific domain and no limit?

      const sellersRes = await query(
        `SELECT seller_id, domain as source_domain, COALESCE(seller_domain, domain) as domain, seller_type, name, identifiers, is_confidential 
                 FROM sellers_catalog WHERE domain = $1`,
        [domain],
      );

      // We also need metadata (version etc.) but we don't store it in sellers_catalog currently!
      // We only store it in raw_sellers_files (maybe?) or we just don't store header meta.
      // StreamImporter implementation parses 'sellers' array but ignores top-level meta like 'version'.
      // TODO: Update Schema to store metadata? Or just return empty meta for now.
      // Storing metadata is better.

      return c.json({
        domain,
        sellers_json_url: url,
        version: '1.0', // Placeholder if not stored
        sellers: sellersRes.rows,
        fetched_at: new Date().toISOString(),
      } as any);
    } else {
      // Ephemeral Fetch (No DB save)
      // Just axios get and return
      const res = await client.get(url, { responseType: 'json' });
      return c.json({
        domain,
        sellers_json_url: url,
        ...res.data,
      });
    }
  } catch (e: any) {
    console.error('Fetch/Import Error:', e);
    return c.json({ error: e.message || 'Failed to fetch sellers.json' }, 500);
  }
});

export default app;
