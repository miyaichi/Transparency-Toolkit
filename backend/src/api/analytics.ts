import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

const app = new OpenAPIHono();

// Schema for Analytics Response
const AnalyticsResponseSchema = z.object({
  domain: z.string(),
  name: z.string().optional(),
  status: z.string().optional(),
  pub_description: z.string().optional(),
  primary_supply_type: z.string().optional(),
  categories: z.array(z.string()).optional(),
  rank: z.number().nullable(),
  adstxt_lines: z.number().nullable(), // Deprecated
  app_adstxt_lines: z.number().nullable(), // Deprecated
  direct_ratio: z.number().nullable(), // Deprecated
  reseller_ratio: z.number().nullable(), // Deprecated
  avg_ads_in_view: z.number().nullable().optional(),
  avg_page_weight: z.number().nullable().optional(),
  avg_cpu: z.number().nullable().optional(),
  total_supply_paths: z.number().nullable().optional(),
  avg_ads_to_content_ratio: z.number().nullable().optional(),
  avg_ad_refresh: z.number().nullable().optional(),
  total_unique_gpids: z.number().nullable().optional(),
  reseller_count: z.number().nullable().optional(),
  id_absorption_rate: z.number().nullable().optional(),
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

  console.log(`[Analytics] Received request for domain: ${domain}`);

  if (!apiKey) {
    console.error('[Analytics] OpenSincera API Key is missing');
    return c.json({ error: 'OpenSincera API Key is not configured' }, 500);
  }

  const url = `https://open.sincera.io/api/publishers?domain=${domain}`;
  console.log(`[Analytics] Fetching from: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    console.log(`[Analytics] OpenSincera Response Status: ${response.status}`);

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[Analytics] Domain not found: ${domain}`);
        return c.json({ error: 'Domain not found in OpenSincera database' }, 404);
      }
      const errorText = await response.text();
      console.error(`[Analytics] OpenSincera API Error: ${response.status} - ${errorText}`);
      throw new Error(`OpenSincera API responded with ${response.status}`);
    }

    const data = await response.json();
    console.log('[Analytics] Successfully received data');

    // Map OpenSincera response to our schema
    const result = {
      domain: data.domain || domain,
      name: data.name,
      status: data.status,
      pub_description: data.pub_description,
      primary_supply_type: data.primary_supply_type,
      categories: data.categories || [],
      rank: null,
      adstxt_lines: data.avg_ads_to_content_ratio ? Math.round(data.avg_ads_to_content_ratio * 1000) : 0,
      app_adstxt_lines: null,
      direct_ratio: data.id_absorption_rate || 0,
      reseller_ratio: data.reseller_count > 0 ? 1 : 0,
      avg_ads_in_view: data.avg_ads_in_view,
      avg_page_weight: data.avg_page_weight,
      avg_cpu: data.avg_cpu,
      total_supply_paths: data.total_supply_paths,
      avg_ads_to_content_ratio: data.avg_ads_to_content_ratio,
      avg_ad_refresh: data.avg_ad_refresh,
      total_unique_gpids: data.total_unique_gpids,
      reseller_count: data.reseller_count,
      id_absorption_rate: data.id_absorption_rate,
      updated_at: data.updated_at || new Date().toISOString()
    };

    return c.json(result, 200);

  } catch (error: any) {
    console.error('[Analytics] Handler Error:', error);
    return c.json({ error: 'Failed to fetch analytics data' }, 500);
  }
});

export default app;
