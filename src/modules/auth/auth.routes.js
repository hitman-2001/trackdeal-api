'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { AuthController } = require('./auth.controller');

// ---------------------------------------------------------------------------
// Auth Routes
// Base path: /api/v1/auth
// ---------------------------------------------------------------------------

async function authRoutes(fastify, opts) {
  const { TokenService } = require('../../shared/services/token.service');
  const { jwtConfig } = require('../../config/jwt.config');

  const tokenService = new TokenService({
    jwtSigner: {
      signAccess: (payload) => fastify.jwt.sign(payload, { expiresIn: jwtConfig.access.expiresIn }),
      signRefresh: (payload) => fastify.signRefreshToken(payload),
      verifyRefresh: (token) => fastify.verifyRefreshToken(token),
    }
  });

  // Inject tokenService and logger into controller
  const controller = new AuthController({
    service: null, // Will be created by controller using injected deps
    tokenService,
    fastify,
    logger: fastify.log,
  });

  // GET /auth/invitations/validate (Validate invitation token)
  fastify.get('/invitations/validate', {
    schema: {
      tags: ['Auth'],
      summary: 'Validate invitation token',
      security: [],
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', minLength: 10 }
        }
      }
    },
    handler: controller.validateInvitation,
  });

  // POST /auth/invitations/accept (Accept invitation and register password)
  fastify.post('/invitations/accept', {
    schema: {
      tags: ['Auth'],
      summary: 'Accept invitation and register password',
      security: [],
      body: {
        type: 'object',
        required: ['invitationToken', 'password'],
        properties: {
          invitationToken: { type: 'string', minLength: 10 },
          password: { type: 'string', minLength: 8, maxLength: 100 }
        }
      }
    },
    handler: controller.acceptInvitation,
  });


  // POST /auth/login
  fastify.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login with email and password',
      security: [],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: controller.login,
  });

  // POST /auth/refresh
  fastify.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token with rotation',
      security: [],
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
    handler: controller.refresh,
  });

  // POST /auth/logout
  fastify.post('/logout', {
    preHandler: [authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Logout and revoke active session',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
    handler: controller.logout,
  });

  // POST /auth/change-password
  fastify.post('/change-password', {
    preHandler: [authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Change user password',
      body: {
        type: 'object',
        required: ['oldPassword', 'newPassword'],
        properties: {
          oldPassword: { type: 'string', minLength: 1 },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
    handler: controller.changePassword,
  });

  // GET /auth/me
  fastify.get('/me', {
    preHandler: [authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Get current authenticated user',
    },
    handler: controller.me,
  });

  // POST /auth/forgot-password
  fastify.post('/forgot-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Request password reset email',
      security: [],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
    },
    handler: controller.forgotPassword,
  });

  // POST /auth/reset-password
  fastify.post('/reset-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Reset password using token',
      security: [],
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
    handler: controller.resetPassword,
  });
}

module.exports = authRoutes;
