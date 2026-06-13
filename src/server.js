'use strict';

require('dotenv').config();

const { loadEnv } = require('./config/env.config');
const { buildApp } = require('./app');
const { connectDatabase } = require('./database/connection');
const { initializeQueues } = require('./queues/queue-manager');
const { startWorkers } = require('./queues/worker-manager');

// ---------------------------------------------------------------------------
// Server Entry Point
// Starts the HTTP server, database, and background workers.
// ---------------------------------------------------------------------------

async function start() {
  // 1. Validate and load environment
  const env = loadEnv();

  let fastify;

  try {
    // 2. Build Fastify app
    fastify = await buildApp();

    // 3. Connect to MongoDB
    await connectDatabase(fastify.log);

    // Seed default permissions and system roles
    const { seedDatabase } = require('./database/seeder');
    await seedDatabase(fastify.log);

    // 4. Initialize BullMQ queues
    await initializeQueues(fastify.log);

    // 5. Start BullMQ workers (after models are loaded)
    await startWorkers(fastify.log);

    // 6. Start HTTP listener
    await fastify.listen({ port: env.PORT, host: env.HOST });

    fastify.log.info(`
╔═══════════════════════════════════════════════╗
║           Track Deal API — Ready              ║
║                                               ║
║  URL:  http://${env.HOST}:${env.PORT}${env.API_PREFIX.padEnd(20)}   ║
║  Docs: http://${env.HOST}:${env.PORT}/docs${' '.repeat(22)}  ║
║  Env:  ${env.NODE_ENV.padEnd(37)}  ║
╚═══════════════════════════════════════════════╝
    `);
  } catch (err) {
    if (fastify) {
      fastify.log.error({ err }, 'Failed to start server');
    } else {
      console.error('Failed to start server:', err);
    }
    process.exit(1);
  }
}

start();
