'use strict';

const { loadEnv } = require('./env.config');

const env = loadEnv();

/**
 * JWT configuration for access and refresh tokens.
 */
const jwtConfig = {
  access: {
    secret: env.JWT_ACCESS_SECRET,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  },
  refresh: {
    secret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
};

module.exports = { jwtConfig };
