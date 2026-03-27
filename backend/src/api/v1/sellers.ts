import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { query } from '../../db/client';

const app = new OpenAPIHono();

// Schemas
const LookupRequestSchema = z.object({
  domain: z.string().openapi({ example: 'google.com', description: 'The SSP domain to look up in sellers.json catalog' }),
  seller_id: z.string().openapi({ example: 'pub-1234567890', description: 'The seller ID to look up' }),
});

const SellerDetailSchema = z.object({
  seller_id: z.string().openapi({ example: 'pub-1234567890' }),
  domain: z.string().openapi({ example: 'google.com' }),
  seller_domain: z.string().nullable().openapi({ example: 'publisher.com' }),
  seller_type: z.string().nullable().openapi({ example: 'PUBLISHER' }),
  name: z.string().nullable().openapi({ example: 'Example Publisher' }),
  is_confidential: z.boolean().nullable().openapi({ example: false }),
  updated_at: z.string().openapi({ example: '2025-01-01T00:00:00Z' }),
});

const LookupResponseSchema = z.object({
  domain: z.string().openapi({ example: 'google.com' }),
  seller_id: z.string().openapi({ example: 'pub-1234567890' }),
  found: z.boolean().openapi({ example: true }),
  seller: SellerDetailSchema.nullable(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});

// Route
const lookupRoute = createRoute({
  method: 'get',
  path: '/lookup',
  request: {
    query: LookupRequestSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: LookupResponseSchema,
        },
      },
      description: 'Seller lookup result',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad Request',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Server Error',
    },
  },
});

app.openapi(lookupRoute, async (c) => {
  const { domain, seller_id } = c.req.valid('query');

  if (!domain || !seller_id) {
    return c.json(
      {
        error: 'invalid_params',
        message: 'Both domain and seller_id are required.',
      },
      400,
    );
  }

  // Basic domain validation
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
  if (!domainRegex.test(domain)) {
    return c.json(
      {
        error: 'invalid_params',
        message: 'Invalid domain format.',
      },
      400,
    );
  }

  try {
    const result = await query(
      `SELECT seller_id, domain, seller_domain, seller_type, name, is_confidential, updated_at
       FROM sellers_catalog
       WHERE domain = $1 AND seller_id = $2`,
      [domain, seller_id],
    );

    if (result.rows.length === 0) {
      return c.json({ domain, seller_id, found: false, seller: null } as any);
    }

    const row = result.rows[0];
    return c.json({
      domain,
      seller_id,
      found: true,
      seller: {
        seller_id: row.seller_id,
        domain: row.domain,
        seller_domain: row.seller_domain ?? null,
        seller_type: row.seller_type ?? null,
        name: row.name ?? null,
        is_confidential: row.is_confidential ?? null,
        updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      },
    } as any);
  } catch (err: any) {
    console.error('Sellers lookup error:', err.message);
    return c.json(
      {
        error: 'internal_error',
        message: 'Failed to query sellers catalog.',
      },
      500,
    );
  }
});

export default app;
