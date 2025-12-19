import { serve } from '@hono/node-server';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import dns from 'dns';
import dotenv from 'dotenv';
import adstxtApp from './api/adstxt';
import adviserApp from './api/adviser';
import analyticsApp from './api/analytics';
import monitorApp from './api/monitor';
import optimizerApp from './api/optimizer';
import sellersApp from './api/sellers';

// Prefer IPv4 to avoid connectivity issues in environments with partial IPv6 support (e.g. Cloud Run)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

dotenv.config();

// Critical Environment Variable Check
const requiredEnvVars = ['DATABASE_URL'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`ERROR: Required environment variable ${envVar} is not set`);
    process.exit(1);
  }
}

// Warning for OPENSINCERA_API_KEY (Non-critical but recommended for analytics)
if (process.env.NODE_ENV === 'production' && !process.env.OPENSINCERA_API_KEY) {
  console.warn('WARNING: OPENSINCERA_API_KEY is not set. Analytics features may not work.');
}

import { cors } from 'hono/cors';

const app = new OpenAPIHono();

// CORS Middleware
app.use(
  '/*',
  cors({
    origin: (origin) => {
      // In production, strictly match FRONTEND_URL if set, otherwise allow all (or allow none if preferred security-wise)
      if (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL) {
        return process.env.FRONTEND_URL === origin ? origin : null;
      }
      return origin; // Allow all in dev or if config missing (or return origin to reflect back)
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }),
);

// Global Error Handler
app.onError((err, c) => {
  console.error('[Uncaught Error]', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
      stack: err.stack,
    },
    500,
  );
});

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
app.route('/api/adviser', adviserApp);

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
