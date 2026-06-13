'use strict';

const fp = require('fastify-plugin');
const cors = require('@fastify/cors');
const { corsConfig } = require('../config/cors.config');

/**
 * CORS Plugin
 * @param {import('fastify').FastifyInstance} fastify
 */
async function corsPlugin(fastify) {
  await fastify.register(cors, corsConfig);
}

module.exports = fp(corsPlugin, { name: 'cors-plugin' });
