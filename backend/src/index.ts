import { serve } from '@hono/node-server';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import dotenv from 'dotenv';
import adstxtParams from './api/adstxt';
import analyticsParams from './api/analytics';
import monitorParams from './api/monitor';
import sellersParams from './api/sellers';

dotenv.config();

const app = new OpenAPIHono();

// Logger middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const end = Date.now();
  console.log(`[${c.req.method}] ${c.req.path} - ${c.res.status} - ${end - start} ms`);
});

// Root
app.get('/', (c) => {
  return c.json({
    message: 'Ads.txt Manager V2 API',
    docs: '/ui',
  });
});

// Routes
app.route('/api/sellers', sellersParams);
app.route('/api/adstxt', adstxtParams);
app.route('/api/monitor', monitorParams);
app.route('/api/analytics', analyticsParams);

// OpenAPI Docs
app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '2.0.0',
    title: 'Ads.txt Manager V2 API',
  },
});

// Swagger UI
app.get('/ui', swaggerUI({ url: '/doc' }));

const port = parseInt(process.env.PORT || '3000');
console.log(`Server is running on port ${port} `);

import { setupCronJobs } from './jobs/scheduler';
setupCronJobs();

serve({
  fetch: app.fetch,
  port,
});
