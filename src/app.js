'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const Fastify = require('fastify');

const { loadEnv } = require('./config/env.config');
const { globalMongoosePlugin } = require('./database/mongoose.plugin');
const { globalErrorHandler } = require('./shared/middleware/error-handler.middleware');
const { requestLoggerHook, responseLoggerHook } = require('./shared/middleware/request-logger.middleware');
const { registerRoutes } = require('./routes');
const { registerEventHandlers } = require('./events/event-registry');

// Fastify plugins
const corsPlugin = require('./plugins/cors.plugin');
const helmetPlugin = require('./plugins/helmet.plugin');
const rateLimitPlugin = require('./plugins/rate-limit.plugin');
const jwtPlugin = require('./plugins/jwt.plugin');
const swaggerPlugin = require('./plugins/swagger.plugin');
const multipartPlugin = require('./plugins/multipart.plugin');

// ---------------------------------------------------------------------------
// Application Factory
// Creates and configures the Fastify instance.
// Separated from server.js to enable testing without starting the HTTP server.
// ---------------------------------------------------------------------------

/**
 * Build the Fastify application.
 * @returns {Promise<import('fastify').FastifyInstance>}
 */
async function buildApp() {
  const env = loadEnv();

  // ------------------------------------------------------------------
  // 1. Create Fastify instance
  // ------------------------------------------------------------------
  const fastify = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: env.LOG_PRETTY
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
        : undefined,
    },
    // Request ID generation
    genReqId: (req) => req.headers['x-request-id'] || require('uuid').v4(),
    requestIdLogLabel: 'requestId',

    // Ajv validation options
    ajv: {
      customOptions: {
        removeAdditional: false, // Preserve extra fields for debugging
        useDefaults: true,
        coerceTypes: true,
        allErrors: false,
      },
    },
  });

  // ------------------------------------------------------------------
  // 2. Register global Mongoose plugin
  // ------------------------------------------------------------------
  mongoose.plugin(globalMongoosePlugin);

  // ------------------------------------------------------------------
  // 3. Register Fastify plugins (order matters)
  // ------------------------------------------------------------------
  await fastify.register(helmetPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(swaggerPlugin);
  await fastify.register(multipartPlugin);

  // ------------------------------------------------------------------
  // 4. Register global hooks
  // ------------------------------------------------------------------
  fastify.addHook('onRequest', requestLoggerHook);
  fastify.addHook('onResponse', responseLoggerHook);
  
  const { tenantContextMiddleware } = require('./shared/middleware/tenant-context.middleware');
  fastify.addHook('preHandler', tenantContextMiddleware);

  // ------------------------------------------------------------------
  // 5. Register global error handler
  // ------------------------------------------------------------------
  fastify.setErrorHandler(globalErrorHandler);

  // ------------------------------------------------------------------
  // 6. Register root welcome & basic health check (no prefix)
  // ------------------------------------------------------------------
  fastify.get('/', async (request, reply) => {
    return reply.send({
      success: true,
      message: `Welcome to the ${env.APP_NAME} API`,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      docs: `${request.protocol}://${request.hostname}${env.SWAGGER_PREFIX}`,
    });
  });

  // ------------------------------------------------------------------
  // 7. Register all module routes under /api/v1
  // ------------------------------------------------------------------
  await fastify.register(registerRoutes, { prefix: env.API_PREFIX });

  // ------------------------------------------------------------------
  // 7. Register domain event handlers
  // ------------------------------------------------------------------
  registerEventHandlers(fastify.log);

  // ------------------------------------------------------------------
  // 8. Graceful shutdown handler
  // ------------------------------------------------------------------
  const { disconnectDatabase } = require('./database/connection');
  const { closeQueues } = require('./queues/queue-manager');
  const { stopWorkers } = require('./queues/worker-manager');

  const gracefulShutdown = async (signal) => {
    fastify.log.info(`Received ${signal}. Starting graceful shutdown...`);
    try {
      await fastify.close();
      await stopWorkers(fastify.log);
      await closeQueues(fastify.log);
      await disconnectDatabase(fastify.log);
      fastify.log.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      fastify.log.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return fastify;
}

module.exports = { buildApp };
