import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AdsTxtService } from '../../services/adstxt_service';

const app = new OpenAPIHono();
const service = new AdsTxtService();

// Schemas
const ValidationRequestSchema = z.object({
  domain: z.string().openapi({ example: 'example-publisher.com', description: 'Domain to fetch ads.txt from' }),
  type: z.enum(['ads.txt', 'app-ads.txt']).optional().openapi({ description: 'File type (default: ads.txt)' }),
  lang: z.enum(['en', 'ja']).optional().openapi({ description: 'Locale for validation messages (default: en)' }),
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
  warning: z.string().optional(),
  warning_message: z.string().optional(),
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
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
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
      description: 'Server Error or Failed to fetch',
    },
  },
});

app.openapi(validateRoute, async (c) => {
  const { domain, type, lang } = c.req.valid('query');
  const fileType = type || 'ads.txt';

  if (!domain) {
    return c.json({ error: 'invalid_domain', message: 'Domain is required.' }, 400);
  }

  // Strict Domain Validation (Prevent SSRF & Invalid Formats)
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
  if (!domainRegex.test(domain)) {
    return c.json({ error: 'invalid_domain', message: 'Invalid domain format.' }, 400);
  }

  if (domain.toLowerCase() === 'localhost' || domain.includes('127.0.0.1') || domain.includes('::1')) {
    return c.json({ error: 'invalid_domain', message: 'Invalid domain.' }, 400);
  }

  try {
    // Always save=false for the public API
    const result = await service.validateDomain(domain, fileType, false, lang || 'en');
    return c.json(result as any);
  } catch (e: any) {
    const message = e.message || 'Unknown error';
    console.error(e);
    if (message.startsWith('Invalid') || message.startsWith('Not found')) {
      return c.json({ error: 'not_found', message }, 400);
    }
    return c.json({ error: 'internal_error', message }, 500);
  }
});

export default app;
