'use strict';

const EventEmitter2 = require('eventemitter2');
const { Queue, Worker } = require('bullmq');
const { loadEnv } = require('../config/env.config');

// ---------------------------------------------------------------------------
// EventBus — Distributed Domain Event Bus (BullMQ + Redis)
//
// Hybrid Architecture:
//   1. Services publish event → EventBus enqueues in Redis (BullMQ queue).
//   2. BullMQ distributes the job across scaled container instances.
//   3. Whichever container receives the job dispatches it locally via EventEmitter2.
//   4. Local event handlers execute asynchronously on that worker container.
//
// Retain full backward compatibility with local EventEmitter2 syntax (.on, .off).
// ---------------------------------------------------------------------------

class EventBus {
  constructor() {
    const env = loadEnv();
    
    // Connection parameters for Redis
    this._redisConfig = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    };

    // 1. Local Event Dispatcher (EventEmitter2)
    this._localEmitter = new EventEmitter2({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      maxListeners: 50,
      verboseMemoryLeak: true,
    });

    // 2. BullMQ Distributed Queue
    this._queueName = 'domain-events';
    this._queue = new Queue(this._queueName, {
      connection: this._redisConfig,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 1000, // Keep failed jobs in history for debugging
      },
    });

    // 3. BullMQ Distributed Worker (Dispatches Redis jobs to local EventEmitter2 listeners)
    this._worker = new Worker(
      this._queueName,
      async (job) => {
        const { event, payload, timestamp } = job.data;
        // Dispatch event locally inside the worker process
        await this._localEmitter.emit(event, { event, payload, timestamp });
      },
      {
        connection: this._redisConfig,
        concurrency: 5,
      }
    );

    this._worker.on('error', (err) => {
      console.error('[EventBus Worker] Error:', err.message);
    });
  }

  /**
   * Publish a domain event.
   * Pushes the event to the distributed Redis queue.
   *
   * @param {string} event    - Event name (e.g., 'lead.created')
   * @param {object} payload  - Event payload
   */
  async emit(event, payload) {
    const jobData = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    };
    
    // Push the event to the distributed queue (fire and forget / async)
    await this._queue.add(event, jobData);
  }

  /**
   * Subscribe to a domain event locally on this instance.
   */
  on(event, handler) {
    this._localEmitter.on(event, handler);
  }

  /**
   * Subscribe to an event once.
   */
  once(event, handler) {
    this._localEmitter.once(event, handler);
  }

  /**
   * Remove a specific event listener.
   */
  off(event, handler) {
    this._localEmitter.off(event, handler);
  }

  /**
   * Remove all listeners for an event.
   */
  removeAllListeners(event) {
    this._localEmitter.removeAllListeners(event);
  }

  /**
   * Gracefully close Redis connections on shutdown.
   */
  async close() {
    await this._queue.close();
    await this._worker.close();
  }
}

// Singleton distributed instance
const eventBus = new EventBus();

module.exports = { EventBus, eventBus };
