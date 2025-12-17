import { serve } from '@hono/node-server';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import dotenv from 'dotenv';
import adstxtApp from './api/adstxt';
import analyticsApp from './api/analytics';
import monitorApp from './api/monitor';
import optimizerApp from './api/optimizer';
import sellersApp from './api/sellers';

dotenv.config();

// Critical Environment Variable Check
const requiredEnvVars = ['DATABASE_URL'];
if (process.env.NODE_ENV === 'production') {
  requiredEnvVars.push('OPENSINCERA_API_KEY');
}

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`ERROR: Required environment variable ${envVar} is not set`);
    process.exit(1);
  }
}

import { cors } from 'hono/cors';

const app = new OpenAPIHono();

// CORS Middleware
app.use(
  '/*',
  cors({
    origin: process.env.NODE_ENV === 'production' ? (process.env.FRONTEND_URL as string) : '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }),
);

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
app.route('/api/sellers', sellersApp);
app.route('/api/adstxt', adstxtApp);
app.route('/api/monitor', monitorApp);
app.route('/api/analytics', analyticsApp);
app.route('/api/optimizer', optimizerApp);

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
