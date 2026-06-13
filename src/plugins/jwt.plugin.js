'use strict';

const fp = require('fastify-plugin');
const fastifyJwt = require('@fastify/jwt');
const { jwtConfig } = require('../config/jwt.config');

/**
 * JWT Plugin
 * Registers @fastify/jwt and exposes request.jwtVerify() and fastify.jwt.sign().
 * @param {import('fastify').FastifyInstance} fastify
 */
async function jwtPlugin(fastify) {
  await fastify.register(fastifyJwt, {
    secret: jwtConfig.access.secret,

    // Allow refresh token verification via a named signer
    // The refresh token uses a different secret
    sign: {
      expiresIn: jwtConfig.access.expiresIn,
    },

    decode: { complete: true },

    messages: {
      badRequestErrorMessage: 'Authorization header is malformed',
      noAuthorizationInHeaderMessage: 'Authorization header is missing',
      authorizationTokenExpiredMessage: 'Access token has expired',
      authorizationTokenInvalid: (err) => `Invalid token: ${err.message}`,
    },
  });

  // Decorate fastify with a refresh token signer
  fastify.decorate('signRefreshToken', function (payload) {
    return fastify.jwt.sign(payload, {
      secret: jwtConfig.refresh.secret,
      expiresIn: jwtConfig.refresh.expiresIn,
    });
  });

  // Decorate fastify with a refresh token verifier
  fastify.decorate('verifyRefreshToken', function (token) {
    return fastify.jwt.verify(token, { secret: jwtConfig.refresh.secret });
  });
}

module.exports = fp(jwtPlugin, { name: 'jwt-plugin' });
