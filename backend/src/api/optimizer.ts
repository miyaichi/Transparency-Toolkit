import { OpenAPIHono, z } from '@hono/zod-openapi';
import { zValidator } from '@hono/zod-validator';
import client from '../lib/http';

const optimizerApp = new OpenAPIHono();

const optimizerSchema = z.object({
  content: z.string(),
  domain: z.string().optional(),
  ownerDomain: z.string().optional(),
  fileType: z.enum(['ads.txt', 'app-ads.txt']).default('ads.txt'),
  steps: z.object({
    removeErrors: z.boolean().default(false),
    invalidAction: z.enum(['remove', 'comment']).default('remove'),
    duplicateAction: z.enum(['remove', 'comment']).default('remove'),
    normalizeFormat: z.boolean().default(false), // New
    fixOwnerDomain: z.boolean().default(false),
    fixRelationship: z.boolean().default(false), // New
    fixManagerDomain: z.boolean().default(false),
    managerAction: z.enum(['remove', 'comment']).default('remove'),
    verifySellers: z.boolean().default(false),
    sellersAction: z.enum(['remove', 'comment']).default('remove'),
    verifyCertAuthority: z.boolean().default(false), // New Step 6
  }),
});

import { OptimizerService } from '../services/optimizer_service';

const optimizerService = new OptimizerService();

optimizerApp.post('/process', zValidator('json', optimizerSchema), async (c) => {
  const { content, domain, ownerDomain, steps } = c.req.valid('json');

  console.log('Optimizer Process Request:', { domain, steps }); // Debug log

  const result = await optimizerService.process(
    content,
    domain,
    ownerDomain,
    steps as any, // Cast because Zod definition vs Interface might slightly differ on defaults
  );

  return c.json(result);
});

const fetchSchema = z.object({
  domain: z.string(),
  fileType: z.enum(['ads.txt', 'app-ads.txt']).default('ads.txt'),
});

optimizerApp.post('/fetch', zValidator('json', fetchSchema), async (c) => {
  const { domain, fileType } = c.req.valid('json');

  if (!domain) {
    return c.json({ error: 'Domain is required' }, 400);
  }

  try {
    const url = `https://${domain}/${fileType}`;
    // Simple fetch implementation
    // In production, might need retry logic, user-agent rotation, proxy, etc.
    // Use configured client to handle legacy SSL (docomo.ne.jp) and redirects
    const response = await client.get(url, {
      timeout: 10000,
    });

    const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    return c.json({ content: text });
  } catch (error: any) {
    console.error(`Error fetching ${fileType} from ${domain}:`, error);
    return c.json({ error: `Fetch error: ${error.message}` }, 500);
  }
});

export default optimizerApp;
