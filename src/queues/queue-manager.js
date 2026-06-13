'use strict';

const { Queue } = require('bullmq');
const { bullmqConfig } = require('../config/bullmq.config');
const { QUEUES } = require('../shared/constants/app.constants');

// ---------------------------------------------------------------------------
// Queue Manager
// Central factory for BullMQ queues.
// All queues are created with consistent configuration.
// ---------------------------------------------------------------------------

const _queues = new Map();

/**
 * Get or create a named queue.
 * @param {string} name - Queue name (use QUEUES constants)
 * @param {object} [options] - Override default job options
 * @returns {Queue}
 */
function getQueue(name, options = {}) {
  if (_queues.has(name)) {
    return _queues.get(name);
  }

  const queue = new Queue(name, {
    connection: bullmqConfig.connection,
    defaultJobOptions: {
      ...bullmqConfig.defaultJobOptions,
      ...options,
    },
  });

  _queues.set(name, queue);
  return queue;
}

/**
 * Pre-initialize all queues at startup.
 * @param {import('pino').Logger} logger
 */
async function initializeQueues(logger) {
  logger.info('Initializing BullMQ queues...');

  // Initialize all queues upfront
  for (const queueName of Object.values(QUEUES)) {
    getQueue(queueName);
  }

  logger.info(`✅ ${_queues.size} queues initialized: ${[..._queues.keys()].join(', ')}`);
}

/**
 * Gracefully close all queues.
 * @param {import('pino').Logger} logger
 */
async function closeQueues(logger) {
  logger.info('Closing BullMQ queues...');
  const closePromises = [..._queues.values()].map((q) => q.close());
  await Promise.allSettled(closePromises);
  _queues.clear();
  logger.info('BullMQ queues closed');
}

// Convenience getters for commonly used queues
const notificationQueue = () => getQueue(QUEUES.NOTIFICATION);
const emailQueue = () => getQueue(QUEUES.EMAIL);
const whatsappQueue = () => getQueue(QUEUES.WHATSAPP);
const auditQueue = () => getQueue(QUEUES.AUDIT);
const reportQueue = () => getQueue(QUEUES.REPORT);
const pdfQueue = () => getQueue(QUEUES.PDF_GENERATION);

module.exports = {
  getQueue,
  initializeQueues,
  closeQueues,
  notificationQueue,
  emailQueue,
  whatsappQueue,
  auditQueue,
  reportQueue,
  pdfQueue,
};
