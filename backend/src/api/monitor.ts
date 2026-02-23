import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AdsTxtScanner } from '../services/adstxt_scanner';
import { MonitoredDomainsService } from '../services/monitored_domains';

const app = new OpenAPIHono();
const service = new MonitoredDomainsService();
const scanner = new AdsTxtScanner();

// Schemas
const MonitoredDomainSchema = z.object({
  id: z.string(),
  domain: z.string(),
  file_type: z.enum(['ads.txt', 'app-ads.txt', 'sellers.json']),
  is_active: z.boolean(),
  last_scanned_at: z.string().nullable(),
  scan_interval_minutes: z.number(),
});

const AddMonitorRequest = z.object({
  domain: z.string().min(1),
  file_type: z.enum(['ads.txt', 'app-ads.txt', 'sellers.json']).optional(),
});

// Routes
const listRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(MonitoredDomainSchema),
        },
      },
      description: 'List monitored domains',
    },
  },
});

const addRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: AddMonitorRequest,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MonitoredDomainSchema,
        },
      },
      description: 'Added domain',
    },
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/',
  request: {
    query: z.object({ domain: z.string(), file_type: z.enum(['ads.txt', 'app-ads.txt', 'sellers.json']).optional() }),
  },
  responses: {
    200: { description: 'Deleted' },
  },
});

app.openapi(listRoute, async (c) => {
  const list = await service.listDomains();
  return c.json(list as any); // Cast to any to avoid strict type mismatch with nullable vs optional
});

app.openapi(addRoute, async (c) => {
  const { domain, file_type } = c.req.valid('json');
  const res = await service.addDomain(domain, file_type || 'ads.txt');
  return c.json(res as any);
});

app.openapi(deleteRoute, async (c) => {
  const { domain, file_type } = c.req.valid('query');
  await service.removeDomain(domain, file_type || 'ads.txt');
  return c.json({ success: true });
});

// Bulk Import Route
const bulkAddRoute = createRoute({
  method: 'post',
  path: '/bulk',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            domains: z.array(z.string()).min(1).max(50000),
            file_type: z.enum(['ads.txt', 'app-ads.txt']).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            added: z.number(),
            total: z.number(),
          }),
        },
      },
      description: 'Bulk import result',
    },
  },
});

app.openapi(bulkAddRoute, async (c) => {
  const { domains, file_type } = c.req.valid('json');
  const result = await service.bulkAddDomains(domains, file_type || 'ads.txt');
  return c.json(result);
});

// Stats Route
const statsRoute = createRoute({
  method: 'get',
  path: '/stats',
  request: {
    query: z.object({
      file_type: z.enum(['ads.txt', 'app-ads.txt', 'sellers.json']).optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            total: z.string(),
            active: z.string(),
            unscanned: z.string(),
            scanned: z.string(),
          }),
        },
      },
      description: 'Monitor stats',
    },
  },
});

app.openapi(statsRoute, async (c) => {
  const { file_type } = c.req.valid('query');
  const stats = await service.getStats(file_type);
  return c.json(stats as any);
});

// Bulk Scan Route - Process unscanned domains immediately
const bulkScanRoute = createRoute({
  method: 'post',
  path: '/bulk-scan',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            file_type: z.enum(['ads.txt', 'app-ads.txt']).optional(),
            batch_size: z.number().min(1).max(500).optional(),
            delay_ms: z.number().min(100).max(10000).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            processed: z.number(),
            succeeded: z.number(),
            failed: z.number(),
            remaining: z.number(),
          }),
        },
      },
      description: 'Bulk scan result',
    },
  },
});

app.openapi(bulkScanRoute, async (c) => {
  const { file_type, batch_size, delay_ms } = c.req.valid('json');
  const fileType = file_type || 'ads.txt';
  const limit = batch_size || 100;
  const delay = delay_ms || 1000;

  // Get unscanned domains filtered by file_type at the DB level
  const dueDomains = await service.getDueDomains(limit, fileType);

  let succeeded = 0;
  let failed = 0;

  for (const item of dueDomains) {
    try {
      const result = await scanner.scanAndSave(item.domain, fileType as 'ads.txt' | 'app-ads.txt');
      if (result.status_code === 0 && result.error_message?.includes('ENOTFOUND')) {
        console.log(`Removing ${item.domain} (${fileType}): DNS resolution failed`);
        await service.removeDomain(item.domain, fileType);
        failed++;
      } else {
        await service.updateLastScanned(item.domain, fileType);
        succeeded++;
      }
    } catch (e: any) {
      console.error(`Bulk scan failed for ${item.domain}: ${e.message}`);
      await service.updateLastScanned(item.domain, fileType);
      failed++;
    }

    // Rate limit
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }

  // Get remaining count
  const stats = await service.getStats(fileType);

  return c.json({
    processed: dueDomains.length,
    succeeded,
    failed,
    remaining: parseInt(stats.unscanned) || 0,
  });
});

export default app;
