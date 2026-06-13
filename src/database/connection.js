'use strict';

const mongoose = require('mongoose');
const { databaseConfig } = require('../config/database.config');

// ---------------------------------------------------------------------------
// MongoDB Connection Manager
// Provides a singleton connection with retry logic and lifecycle events.
// ---------------------------------------------------------------------------

let isConnected = false;

/**
 * Connect to MongoDB with retry logic.
 * @param {import('pino').Logger} logger
 */
async function connectDatabase(logger) {
  if (isConnected) {
    logger.info('MongoDB already connected — skipping reconnect');
    return;
  }

  const { uri, options, retry, dbName } = databaseConfig;
  let attempts = 0;

  while (attempts < retry.maxAttempts) {
    try {
      attempts++;
      logger.info(`MongoDB connection attempt ${attempts}/${retry.maxAttempts}...`);

      await mongoose.connect(uri, { ...options, dbName });
      isConnected = true;

      logger.info(`✅ MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
      _registerConnectionEvents(logger);
      return;
    } catch (err) {
      logger.error({ err }, `MongoDB connection failed (attempt ${attempts})`);

      if (attempts >= retry.maxAttempts) {
        logger.error('❌ MongoDB max connection attempts reached. Exiting.');
        process.exit(1);
      }

      logger.info(`Retrying in ${retry.delayMs}ms...`);
      await _sleep(retry.delayMs);
    }
  }
}

/**
 * Gracefully disconnect from MongoDB.
 * @param {import('pino').Logger} logger
 */
async function disconnectDatabase(logger) {
  if (!isConnected) return;

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB disconnected gracefully');
  } catch (err) {
    logger.error({ err }, 'Error during MongoDB disconnect');
  }
}

/**
 * Register Mongoose connection lifecycle event listeners.
 * @param {import('pino').Logger} logger
 */
function _registerConnectionEvents(logger) {
  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    logger.info('MongoDB reconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });
}

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { connectDatabase, disconnectDatabase };
