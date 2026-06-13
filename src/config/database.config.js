'use strict';

const { loadEnv } = require('./env.config');

const env = loadEnv();

/**
 * Database configuration.
 * Centralises all Mongoose connection options and retry logic settings.
 */
const databaseConfig = {
  uri: env.MONGODB_URI,
  dbName: env.MONGODB_DB_NAME,

  // Mongoose connection options
  options: {
    // Connection pool
    maxPoolSize: env.NODE_ENV === 'production' ? 20 : 5,
    minPoolSize: 2,

    // Timeouts
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,

    // Heartbeat
    heartbeatFrequencyMS: 10000,

    // Auto index — disable in production for manual control
    autoIndex: env.NODE_ENV !== 'production',
  },

  // Retry configuration
  retry: {
    maxAttempts: 5,
    delayMs: 3000,
  },
};

module.exports = { databaseConfig };
