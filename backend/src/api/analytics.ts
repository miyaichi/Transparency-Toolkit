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
  adstxt_lines: z.number().nullable(), // Legacy field (repurposed for avg_ads_to_content_ratio)
  app_adstxt_lines: z.number().nullable(), // Legacy field (always null)
  direct_ratio: z.number().nullable(), // Legacy field (repurposed for id_absorption_rate)
  reseller_ratio: z.number().nullable(), // Legacy field (repurposed for reseller presence flag)
  avg_ads_in_view: z.number().nullable().optional(),
  avg_page_weight: z.number().nullable().optional(),
  avg_cpu: z.number().nullable().optional(),
  total_supply_paths: z.number().nullable().optional(),
  avg_ads_to_content_ratio: z.number().nullable().optional(),
  avg_ad_refresh: z.number().nullable().optional(),
  total_unique_gpids: z.number().nullable().optional(),
  reseller_count: z.number().nullable().optional(),
  id_absorption_rate: z.number().nullable().optional(),
  updated_at: z.string().optional(),
  similar_publishers: z.array(z.number()).optional(),
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
      domain: z
        .string()
        .optional()
        .openapi({
          param: { name: 'domain', in: 'query' },
          example: 'nytimes.com',
        }),
      id: z
        .string()
        .optional()
        .openapi({
          param: { name: 'id', in: 'query' },
          example: '123',
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
      description: 'Retrieve analytics data for a domain or ID',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Bad Request',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Publisher not found',
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

// Simple in-memory cache
const analyticsCache = new Map<string, { timestamp: number; data: any }>();

// Implementation
app.openapi(getAnalyticsRoute, async (c) => {
  const { domain, id } = c.req.valid('query');
  const apiKey = process.env.OPENSINCERA_API_KEY;

  if (!domain && !id) {
    return c.json({ error: 'Either domain or id must be provided' }, 400);
  }

  console.log(`[Analytics] Received request for ${domain ? `domain: ${domain}` : `id: ${id}`}`);

  if (!apiKey) {
    console.error('[Analytics] OpenSincera API Key is missing');
    return c.json({ error: 'OpenSincera API Key is not configured' }, 500);
  }

  const cacheKey = domain ? `analytics:domain:${domain}` : `analytics:id:${id}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 3600 * 1000) {
    console.log(`[Analytics] Serving from cache: ${cacheKey}`);
    return c.json(cached.data, 200);
  }

  // Construct URL based on available parameter
  let url = 'https://open.sincera.io/api/publishers';
  if (id) {
    url += `?id=${id}`;
  } else {
    url += `?domain=${domain}`;
  }

  console.log(`[Analytics] Fetching from: ${url}`);

  const fetchWithRetry = async (url: string, retries: number = 2, timeout: number = 5000) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(id);

        if (!response.ok && response.status >= 500 && i < retries) {
          console.warn(`[Analytics] Request failed with ${response.status}, retrying... (${i + 1}/${retries})`);
          await new Promise((res) => setTimeout(res, 1000 * Math.pow(2, i)));
          continue;
        }
        return response;
      } catch (err: any) {
        if (i < retries) {
          console.warn(`[Analytics] Network error: ${err.message}, retrying... (${i + 1}/${retries})`);
          await new Promise((res) => setTimeout(res, 1000 * Math.pow(2, i)));
          continue;
        }
        throw err;
      }
    }
    throw new Error('Max retries exceeded');
  };

  try {
    const response = await fetchWithRetry(url);

    console.log(`[Analytics] OpenSincera Response Status: ${response.status}`);

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[Analytics] Not found: ${domain || id}`);
        return c.json({ error: 'Publisher not found in OpenSincera database' }, 404);
      }
      const errorText = await response.text();
      console.error(`[Analytics] OpenSincera API Error: ${response.status} - ${errorText}`);
      throw new Error(`OpenSincera API responded with ${response.status}`);
    }

    const data = await response.json();
    console.log('[Analytics] Successfully received data');

    // Map OpenSincera response to our schema
    const result = {
      domain: data.domain || domain || '',
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
      updated_at: data.updated_at || new Date().toISOString(),
      similar_publishers: data.similar_publishers?.content || [],
    };

    // Update Cache
    analyticsCache.set(cacheKey, { timestamp: Date.now(), data: result });

    return c.json(result, 200);
  } catch (error: any) {
    console.error('[Analytics] Handler Error:', error);
    return c.json({ error: 'Failed to fetch analytics data' }, 500);
  }
});

export default app;
