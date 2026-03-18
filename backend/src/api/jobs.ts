import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { runScheduledJobs, processSupplyChainDiscovery } from '../jobs/scheduler';
import { SupplyChainDiscoveryService } from '../services/supply_chain_discovery_service';

const app = new OpenAPIHono();

const triggerRoute = createRoute({
  method: 'post',
  path: '/trigger',
  responses: {
    200: {
      description: 'Triggered background jobs',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
  },
});

app.openapi(triggerRoute, async (c) => {
  // Run in background (don't await completion for the response, or maybe await it?)
  // Cloud Scheduler has a timeout. Typically 10 mins (default) or up to 30 mins.
  // The job might take long.
  // However, Cloud Run requests timeout at 60 mins max.
  // It's safer to await it so Cloud Scheduler knows if it succeeded or failed.
  // If we just return, Cloud Run instance might scale down before the job finishes.

  await runScheduledJobs();

  return c.json({ success: true, message: 'Jobs completed' });
});

// Backward compatible endpoint for Cloud Scheduler (/api/scan)
const scanRoute = createRoute({
  method: 'post',
  path: '/scan',
  responses: {
    200: {
      description: 'Triggered background jobs',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
  },
});

app.openapi(scanRoute, async (c) => {
  await runScheduledJobs();

  return c.json({ success: true, message: 'Jobs completed' });
});

// Supply Chain Discovery endpoints
const supplyChainDiscoveryRoute = createRoute({
  method: 'post',
  path: '/supply-chain-discovery',
  responses: {
    200: {
      description: 'Triggered supply chain discovery job',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
            stats: z.object({
              total: z.number(),
              byStatus: z.record(z.string(), z.number()),
              byDepth: z.record(z.string(), z.number()),
            }).optional(),
          }),
        },
      },
    },
  },
});

app.openapi(supplyChainDiscoveryRoute, async (c) => {
  await processSupplyChainDiscovery();
  
  const MAX_DEPTH = parseInt(process.env.SUPPLY_CHAIN_MAX_DEPTH || '2');
  const discoveryService = new SupplyChainDiscoveryService(MAX_DEPTH);
  const stats = await discoveryService.getQueueStats();

  return c.json({ 
    success: true, 
    message: 'Supply chain discovery job completed',
    stats
  });
});

// Get supply chain discovery stats
const supplyChainStatsRoute = createRoute({
  method: 'get',
  path: '/supply-chain-stats',
  responses: {
    200: {
      description: 'Supply chain discovery queue statistics',
      content: {
        'application/json': {
          schema: z.object({
            total: z.number(),
            byStatus: z.record(z.string(), z.number()),
            byDepth: z.record(z.string(), z.number()),
          }),
        },
      },
    },
  },
});

app.openapi(supplyChainStatsRoute, async (c) => {
  const MAX_DEPTH = parseInt(process.env.SUPPLY_CHAIN_MAX_DEPTH || '2');
  const discoveryService = new SupplyChainDiscoveryService(MAX_DEPTH);
  const stats = await discoveryService.getQueueStats();

  return c.json(stats);
});

export default app;
