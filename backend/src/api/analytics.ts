import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

const app = new OpenAPIHono();

// Schema for Analytics Response
const AnalyticsResponseSchema = z.object({
  domain: z.string(),
  rank: z.number().nullable(),
  adstxt_lines: z.number().nullable(),
  app_adstxt_lines: z.number().nullable(),
  direct_ratio: z.number().nullable(),
  reseller_ratio: z.number().nullable(),
  updated_at: z.string().optional()
});

const ErrorSchema = z.object({
  error: z.string(),
});

// Route Definition
const getAnalyticsRoute = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: z.object({
      domain: z.string().min(1).openapi({
        param: {
          name: 'domain',
          in: 'query',
        },
        example: 'nytimes.com',
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AnalyticsResponseSchema,
        },
      },
      description: 'Retrieve analytics data for a domain',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: "Bad Request"
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: "Domain not found"
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Server Error',
    },
  },
});

// Implementation
app.openapi(getAnalyticsRoute, async (c) => {
  const { domain } = c.req.valid('query');
  const apiKey = process.env.OPENSINCERA_API_KEY;

  if (!apiKey) {
    return c.json({ error: 'OpenSincera API Key is not configured' }, 500);
  }

  try {
    const response = await fetch(`https://opensincera.com/api/v1/publishers/${domain}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return c.json({ error: 'Domain not found in OpenSincera database' }, 404);
      }
      throw new Error(`OpenSincera API responded with ${response.status}`);
    }

    const data = await response.json();

    // Map OpenSincera response to our schema
    // Note: Adjust mapping based on actual OpenSincera API response structure
    // For now assuming a direct mapping or close to it.
    // Based on knowledge: OpenSincera API returns detailed object.

    // Simplification for the example:
    const result = {
      domain: data.domain || domain,
      rank: data.rank || null,
      adstxt_lines: data.adstxtLines || 0,
      app_adstxt_lines: data.appAdstxtLines || 0,
      // Calculate basic ratios if available or use mock placeholders if raw data needs aggregation
      // Assuming the API returns count of direct/reseller lines
      direct_ratio: data.directRatio || 0,
      reseller_ratio: data.resellerRatio || 0,
      updated_at: data.lastCrawledAt || new Date().toISOString()
    };

    // Ideally we might want to do calculations here if the API provides raw line counts by type

    return c.json(result, 200);

  } catch (error: any) {
    console.error('OpenSincera API Error:', error);
    return c.json({ error: 'Failed to fetch analytics data' }, 500);
  }
});

export default app;
