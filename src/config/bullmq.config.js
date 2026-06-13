'use strict';

const { loadEnv } = require('./env.config');

const env = loadEnv();

/**
 * BullMQ / Redis connection configuration.
 * Used by queue manager and worker manager.
 */
const bullmqConfig = {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    db: env.REDIS_DB,
    maxRetriesPerRequest: null, // Required for BullMQ
  },

  // Default job options (can be overridden per-queue)
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

module.exports = { bullmqConfig };
