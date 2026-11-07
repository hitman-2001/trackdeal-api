'use strict';

const fp = require('fastify-plugin');
const cookie = require('@fastify/cookie');

async function cookiePlugin(fastify) {
  await fastify.register(cookie);
}

module.exports = fp(cookiePlugin, { name: 'cookie-plugin' });
