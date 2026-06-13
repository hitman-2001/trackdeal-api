'use strict';

const { loadEnv } = require('./env.config');

const env = loadEnv();

/**
 * CORS configuration.
 * Parses comma-separated CORS_ORIGIN env var into an array.
 */
const corsConfig = {
  origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
  credentials: env.CORS_CREDENTIALS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Idempotency-Key', 'X-Tenant-ID', 'x-tenant-id'],
  exposedHeaders: ['X-Request-ID', 'X-Total-Count'],
};

module.exports = { corsConfig };
