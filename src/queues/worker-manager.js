'use strict';

const { Worker } = require('bullmq');
const { bullmqConfig } = require('../config/bullmq.config');
const { QUEUES } = require('../shared/constants/app.constants');

// ---------------------------------------------------------------------------
// Worker Manager
// Central registry for BullMQ workers.
// Each worker processes jobs from its named queue.
// ---------------------------------------------------------------------------

const _workers = new Map();

/**
 * Register a worker for a queue.
 * @param {string}   queueName - Queue name (use QUEUES constants)
 * @param {function} processor - Job processor function
 * @param {object}   [options] - Worker options
 * @returns {Worker}
 */
function registerWorker(queueName, processor, options = {}) {
  if (_workers.has(queueName)) {
    throw new Error(`Worker for queue '${queueName}' is already registered`);
  }

  const worker = new Worker(queueName, processor, {
    connection: bullmqConfig.connection,
    concurrency: options.concurrency || 5,
    ...options,
  });

  // Error handlers
  worker.on('failed', (job, err) => {
    console.error(`[Queue:${queueName}] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[Queue:${queueName}] Worker error:`, err.message);
  });

  worker.on('completed', (job) => {
    console.info(`[Queue:${queueName}] Job ${job.id} completed`);
  });

  _workers.set(queueName, worker);
  return worker;
}

/**
 * Start all workers.
 * Called after module initialization at startup.
 * @param {import('pino').Logger} logger
 */
async function startWorkers(logger) {
  logger.info('Starting BullMQ workers...');

  // Import and register workers for each queue
  // These are imported here to ensure models are loaded before workers start
  const { processNotificationJob } = require('./workers/notification.worker');
  const { processEmailJob } = require('./workers/email.worker');
  const { processAuditJob } = require('./workers/audit.worker');
  const { processExportJob } = require('../modules/analytics/workers/export.worker');

  registerWorker(QUEUES.NOTIFICATION, processNotificationJob);
  registerWorker(QUEUES.EMAIL, processEmailJob);
  registerWorker(QUEUES.AUDIT, processAuditJob);
  registerWorker(QUEUES.PDF_GENERATION, processExportJob, { concurrency: 2 });

  logger.info(`✅ ${_workers.size} workers started`);
}

/**
 * Gracefully shut down all workers.
 * @param {import('pino').Logger} logger
 */
async function stopWorkers(logger) {
  logger.info('Stopping BullMQ workers...');
  const closePromises = [..._workers.values()].map((w) => w.close());
  await Promise.allSettled(closePromises);
  _workers.clear();
  logger.info('BullMQ workers stopped');
}

module.exports = { registerWorker, startWorkers, stopWorkers };
