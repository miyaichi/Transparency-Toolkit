import { serve } from '@hono/node-server';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import dns from 'dns';
import dotenv from 'dotenv';
import adstxtApp from './api/adstxt';
import adviserApp from './api/adviser';
import analyticsApp from './api/analytics';
import insiteApp from './api/insite';
import jobsApp from './api/jobs';
import monitorApp from './api/monitor';
import optimizerApp from './api/optimizer';
import sellersApp from './api/sellers';
import { logger } from './lib/logger';

// Prefer IPv4 to avoid connectivity issues in environments with partial IPv6 support (e.g. Cloud Run)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

dotenv.config();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    nodeProfilingIntegration(),
  ],
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});

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
  Sentry.captureException(err);
  logger.error('Uncaught Error', {
    error: err,
    path: c.req.path,
    method: c.req.method,
  });
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
    },
    500,
  );
});

// Logger middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const end = Date.now();
  const durationMs = end - start;

  // Structured log for request
  logger.info(`Request handled`, {
    httpRequest: {
      requestMethod: c.req.method,
      requestUrl: c.req.path,
      status: c.res.status,
      userAgent: c.req.header('user-agent'),
      remoteIp: c.req.header('x-forwarded-for') || 'unknown',
      latency: `${durationMs / 1000}s`,
    },
    path: c.req.path,
    method: c.req.method,
    statusCode: c.res.status,
    durationMs,
  });
});

import { rateLimiter } from './lib/rate-limiter';

// Rate Limiter (120 req/min/IP)
app.use(
  '*',
  rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    limit: 120, // 120 requests per minute (2 req/sec sustained)
    message: 'Too many requests. Please try again in a minute.',
  }),
);

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
app.route('/api/insite', insiteApp);
app.route('/api/jobs', jobsApp);

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
