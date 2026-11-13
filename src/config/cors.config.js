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

    // 3. Validate local development, Capacitor, and TrackDeal subdomains by parsed hostname.
    try {
      const url = new URL(origin);
      const isLocalOrigin =
        ['http:', 'https:', 'capacitor:'].includes(url.protocol) &&
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
      if (isLocalOrigin) return cb(null, true);

      if (
        url.protocol === 'https:' &&
        (url.hostname === 'trackdeal.in' || url.hostname.endsWith('.trackdeal.in'))
      ) return cb(null, true);
    } catch (_) {
      // Invalid origins are rejected below.
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
    'X-Client-Platform',
    'x-client-platform',
  ],
  exposedHeaders: ['X-Request-ID', 'X-Total-Count'],
};

module.exports = { corsConfig };
