'use strict';

const fp = require('fastify-plugin');
const helmet = require('@fastify/helmet');

/**
 * Security Headers Plugin
 * Adds production-safe HTTP security headers.
 * @param {import('fastify').FastifyInstance} fastify
 */
async function helmetPlugin(fastify) {
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Managed separately if needed for docs UI
    crossOriginEmbedderPolicy: false,
  });
}

module.exports = fp(helmetPlugin, { name: 'helmet-plugin' });
