'use strict';

const fp = require('fastify-plugin');
const rateLimit = require('@fastify/rate-limit');
const Redis = require('ioredis');
const { loadEnv } = require('../config/env.config');

/**
 * Rate Limiting Plugin — Configured with Redis for horizontal scaling/distributed tracking.
 * @param {import('fastify').FastifyInstance} fastify
 */
async function rateLimitPlugin(fastify) {
  const env = loadEnv();

  // Create highly optimized Redis connection client dedicated to rate limiting
  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    db: env.REDIS_DB || 0,
    maxRetriesPerRequest: null, // Critical parameter for stability under load
  });

  // Handle potential Redis disconnects gracefully
  redis.on('error', (err) => {
    fastify.log.error({ err }, '[Rate Limit Redis] Connection failed');
  });

  await fastify.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_TIME_WINDOW,

    // Expose Redis connection for synchronized request tracking
    redis,

    // Skip rate limiting for health check
    skipOnError: true, // Don't crash API requests if Redis rate-limiting drops temporarily
    allowList: [],

    // Custom error response
    errorResponseBuilder: (request, context) => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Limit: ${context.max} per ${context.after}. Try again after ${context.after}.`,
      },
    }),
  });

  // Gracefully close Redis client on fastify shutdown
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
}

module.exports = fp(rateLimitPlugin, { name: 'rate-limit-plugin' });
