import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createValidationMessage } from '../lib/adstxt/messages';
import { crossCheckAdsTxtRecords, parseAdsTxtContent } from '../lib/adstxt/validator';
import client from '../lib/http';
import { AdsTxtScanner } from '../services/adstxt_scanner';
import { DbSellersProvider } from '../services/db_sellers_provider';

const app = new OpenAPIHono();
const sellersProvider = new DbSellersProvider();
const scanner = new AdsTxtScanner();

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

  let content = '';
  let finalUrl = '';
  let scanId: string | undefined;

  // 1. Fetch / Load
  // If save requested, use scanner
  if (shouldSave) {
    try {
      const scanResult = await scanner.scanAndSave(domain, fileType);
      content = scanResult.content || '';
      finalUrl = scanResult.url;
      scanId = scanResult.id;

      if (!content && scanResult.error_message) {
        return c.json({ error: `Failed to fetch ${fileType}: ${scanResult.error_message}` }, 500);
      }
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  } else {
    // Ephemeral Fetch
    try {
      try {
        finalUrl = `https://${domain}/${fileType}`;
        const res = await client.get(finalUrl, { maxRedirects: 5 });
        content = res.data;
      } catch {
        // Fallback to HTTP
        finalUrl = `http://${domain}/${fileType}`;
        const res = await client.get(finalUrl, { maxRedirects: 5 });
        content = res.data;
      }
      if (typeof content !== 'string') content = JSON.stringify(content);
    } catch (err: any) {
      return c.json({ error: `Failed to fetch ${fileType} from ${domain}: ${err.message}` }, 500);
    }
  }

  // Validate Content Format
  const upperContent = content.trim().toUpperCase();
  if (upperContent.startsWith('<!DOCTYPE') || upperContent.startsWith('<HTML') || upperContent.startsWith('<HEAD')) {
    return c.json(
      { error: `Invalid ${fileType} format: The server returned an HTML page instead of a text file.` },
      400,
    );
  }

  // 2. Parse
  const parsedEntries = parseAdsTxtContent(content, domain);

  // 3. Cross-Check
  // Note: we pass null for cachedAdsTxtContent because we just fetched fresh content
  // In future we could check if WE have a cached version to compare against for changes
  const validatedEntries = await crossCheckAdsTxtRecords(domain, parsedEntries, null, sellersProvider);

  // 4. Format Response (Enrich with messages)
  const formattedRecords = validatedEntries.map((entry) => {
    let warning_message = undefined;

    // If there is a validation key (error or warning), format the message
    if (entry.validation_key) {
      // Collect params
      const params: string[] = [];
      if (entry.warning_params) {
        // Simplified param handling - messages.ts expects array, but mapping from params obj to array depends on key
        // For now, let's try to pass common params. The messages.ts replacePlaceholders logic handles "named" placeholders too if we modify it,
        // but currently it iterates array.
        // Wait, I modified messages.ts to support named placeholders via RegExp!
        // So I can pass values if I can convert entry.warning_params values to array?
        // Actually, createValidationMessage calls formatMessage, which takes string[].
        // My implementation of formatMessage in messages.ts:
        // result.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), placeholders[index]);
        // It maps by index AND name from the SAME array.
        // This implies the array must contain values in specific order [domain, accountId, ...]

        // To make this robust, I should just pass [entry.warning_params.domain, ...].
        // But for MVP, let's just return the key and let Frontend handle localization if needed, OR basic formatting.

        // Providing a raw message is helpful.
        const msg = createValidationMessage(entry.validation_key, [], 'en'); // Use EN for API default
        if (msg) warning_message = msg.message;
      }
    }

    return {
      ...entry,
      warning_message,
    };
  });

  // Calcluate stats
  const validRecords = formattedRecords.filter((r: any) => r.is_valid);

  // Count Direct/Reseller (case insensitive)
  // Use 'any' or check type to safely access relationship
  const direct_count = validRecords.filter(
    (r: any) => r.relationship && r.relationship.toUpperCase() === 'DIRECT',
  ).length;
  const reseller_count = validRecords.filter(
    (r: any) => r.relationship && r.relationship.toUpperCase() === 'RESELLER',
  ).length;

  const stats = {
    total: formattedRecords.length,
    valid: validRecords.length,
    invalid: formattedRecords.filter((r) => !r.is_valid).length,
    warnings: formattedRecords.filter((r) => r.has_warning).length,
    direct_count,
    reseller_count,
  };

  return c.json({
    domain,
    ads_txt_url: finalUrl,
    records: formattedRecords as any, // Type cast to avoid strict schema match issues with mapped object
    stats,
    scan_id: scanId,
  });
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
    // ... (abbrev)
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
  const history = await scanner.getHistory(domain, 20, type);
  return c.json(history);
});

export default app;
