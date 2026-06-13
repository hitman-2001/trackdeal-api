'use strict';

const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// Request Logger Hook (onRequest)
// Assigns a unique request ID to every incoming request.
// Logs request start and completion with timing.
// ---------------------------------------------------------------------------

/**
 * Fastify onRequest hook — assigns X-Request-ID and starts timer.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply}   reply
 */
async function requestLoggerHook(request, reply) {
  // Assign or propagate request ID
  const requestId = request.headers['x-request-id'] || uuidv4();
  request.requestId = requestId;
  reply.header('X-Request-ID', requestId);

  // Create child logger bound to this request
  request.log = request.server.log.child({
    requestId,
    method: request.method,
    url: request.url,
    ip: request.ip,
  });

  request.log.info('Request received');
}

/**
 * Fastify onResponse hook — logs completion with timing.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply}   reply
 */
async function responseLoggerHook(request, reply) {
  request.log.info(
    {
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime.toFixed(2),
    },
    'Request completed',
  );
}

module.exports = { requestLoggerHook, responseLoggerHook };
