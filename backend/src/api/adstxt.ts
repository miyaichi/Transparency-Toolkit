import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AdsTxtService } from '../services/adstxt_service';

const app = new OpenAPIHono();
const service = new AdsTxtService();

// Schemas
const ValidationRequestSchema = z.object({
  domain: z.string().openapi({ example: 'example-publisher.com', description: 'Domain to fetch ads.txt from' }),
  type: z.enum(['ads.txt', 'app-ads.txt']).optional().openapi({ description: 'File type (default: ads.txt)' }),
  save: z.enum(['true', 'false']).optional().openapi({ description: 'Save snapshot to database' }),
});

const ValidationRecordSchema = z.object({
  line_number: z.number(),
  raw_line: z.string(),
  is_valid: z.boolean(),
  domain: z.string().optional(),
  account_id: z.string().optional(),
  account_type: z.string().optional(),
  certification_authority_id: z.string().optional(),
  relationship: z.string().optional(),
  variable_type: z.string().optional(),
  value: z.string().optional(),
  has_warning: z.boolean().optional(),
  validation_key: z.string().optional(),
  warning: z.string().optional(), // Key
  warning_message: z.string().optional(), // Localized message
  severity: z.string().optional(),
  seller_name: z.string().optional(),
  seller_domain: z.string().optional(),
  seller_type: z.string().optional(),
  is_confidential: z.number().optional(),
});

const ValidationResponseSchema = z.object({
  domain: z.string(),
  ads_txt_url: z.string(),
  records: z.array(ValidationRecordSchema),
  stats: z.object({
    total: z.number(),
    valid: z.number(),
    invalid: z.number(),
    warnings: z.number(),
  }),
  scan_id: z.string().optional(),
  progress_id: z.string().optional().openapi({ description: 'ID to track sellers.json fetching progress' }),
  is_processing: z.boolean().optional().openapi({ description: 'Whether sellers.json fetching is in progress' }),
});

// Route
const validateRoute = createRoute({
  method: 'get',
  path: '/validate',
  request: {
    query: ValidationRequestSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ValidationResponseSchema,
        },
      },
      description: 'Validation results',
    },
    400: { description: 'Bad Request' },
    500: { description: 'Server Error or Failed to fetch' },
  },
});

app.openapi(validateRoute, async (c) => {
  const { domain, save, type } = c.req.valid('query');
  const shouldSave = save === 'true';
  const fileType = type || 'ads.txt';

  if (!domain) return c.json({ error: 'Domain is required' }, 400);

  // Strict Domain Validation (Prevent SSRF & Invalid Formats)
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
  if (!domainRegex.test(domain) && domain !== 'localhost') {
    return c.json({ error: 'Invalid domain format.' }, 400);
  }

  if (domain.toLowerCase() === 'localhost' || domain.includes('127.0.0.1') || domain.includes('::1')) {
    return c.json({ error: 'Invalid domain allowed.' }, 400);
  }

  try {
    const result = await service.validateDomain(domain, fileType, shouldSave);
    return c.json(result as any);
  } catch (e: any) {
    // Determine status code based on error message or type if possible, default to 500
    // If it's a fetch error, 500 is appropriate (or 502/504)
    // If it's logic error, maybe 400? For now keep 500 as catch-all for failures.
    const message = e.message || 'Unknown error';
    console.error(e);
    if (message.startsWith('Invalid')) {
      return c.json({ error: message, stack: e.stack }, 400);
    }
    return c.json({ error: message, stack: e.stack }, 500);
  }
});

const historyRoute = createRoute({
  method: 'get',
  path: '/history',
  request: {
    query: z.object({
      domain: z.string().optional(),
      type: z.enum(['ads.txt', 'app-ads.txt']).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Scan history',
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              id: z.string(),
              scanned_at: z.string(),
              records_count: z.number(),
              valid_count: z.number(),
              file_type: z.enum(['ads.txt', 'app-ads.txt']).optional(),
            }),
          ),
        },
      },
    },
  },
});

app.openapi(historyRoute, async (c) => {
  const { domain, type } = c.req.valid('query');
  const history = await service.getHistory(domain, 20, type);
  return c.json(history);
});

// Progress tracking endpoint
import { progressTracker } from '../lib/progress_tracker';

const progressRoute = createRoute({
  method: 'get',
  path: '/progress/:progressId',
  request: {
    params: z.object({
      progressId: z.string().openapi({ description: 'Progress tracking ID from validation result' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            progress_id: z.string(),
            overall_status: z.enum(['processing', 'completed', 'partial']),
            summary: z.object({
              processing: z.number(),
              completed: z.number(),
              failed: z.number(),
            }),
            domains: z.object({
              processing: z.array(z.string()),
              completed: z.array(z.string()),
              failed: z.array(
                z.object({
                  domain: z.string(),
                  error: z.string().optional(),
                }),
              ),
            }),
          }),
        },
      },
      description: 'Progress status for sellers.json fetching',
    },
    404: { description: 'Progress not found' },
  },
});

app.openapi(progressRoute, async (c) => {
  const { progressId } = c.req.valid('param');

  const progress = progressTracker.getProgressSummary(progressId);
  if (!progress) {
    return c.json({ error: 'Progress not found. It may have expired.' }, 404);
  }

  return c.json(progress);
});

export default app;
