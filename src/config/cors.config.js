'use strict';

const { loadEnv } = require('./env.config');

const env = loadEnv();

const configuredOrigins = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

/**
 * CORS configuration.
 * Supports configured domains, Capacitor mobile webviews, and mobile native clients.
 */
const corsConfig = {
  origin: (origin, cb) => {
    // 1. Requests without Origin (mobile native HTTP, curl, server-to-server)
    if (!origin) return cb(null, true);

    // 2. Explicitly configured origins
    if (configuredOrigins.includes(origin)) return cb(null, true);

    // 3. Capacitor mobile app origins (Android WebView runs at https://localhost or capacitor://localhost)
    if (
      origin === 'https://localhost' ||
      origin === 'http://localhost' ||
      origin.startsWith('capacitor://') ||
      origin.includes('localhost:') ||
      origin.includes('127.0.0.1')
    ) {
      return cb(null, true);
    }

    // 4. Wildcard matching for domain subdomains (e.g. *.trackdeal.in)
    if (origin.endsWith('trackdeal.in')) {
      return cb(null, true);
    }

    return cb(new Error(`Not allowed by CORS: ${origin}`), false);
  },
  credentials: env.CORS_CREDENTIALS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Request-Id',
    'X-Idempotency-Key',
    'Idempotency-Key',
    'idempotency-key',
    'X-Tenant-ID',
    'x-tenant-id',
    'Accept',
    'accept',
    'X-Refresh-Token',
    'x-refresh-token',
  ],
  exposedHeaders: ['X-Request-ID', 'X-Total-Count'],
};

module.exports = { corsConfig };
