import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { runScheduledJobs } from '../jobs/scheduler';

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

export default app;
