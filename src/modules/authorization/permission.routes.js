'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { requirePermission } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { PermissionController } = require('./permission.controller');

/**
 * Permission Routes Plugin
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} opts
 */
async function permissionRoutes(fastify, opts) {
  const controller = new PermissionController();

  // All permissions routes require authentication and permissions read capability
  fastify.addHook('preValidation', authenticate);
  fastify.addHook('preHandler', requirePermission(PERMISSIONS.ROLES_READ));

  // GET /permissions
  fastify.get('/', {
    schema: {
      tags: ['Permissions'],
      summary: 'List all granular permissions',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
    handler: controller.list,
  });

  // GET /permissions/grouped
  fastify.get('/grouped', {
    schema: {
      tags: ['Permissions'],
      summary: 'Get system permissions grouped by visual module categories',
    },
    handler: controller.grouped,
  });

  // GET /permissions/matrix
  fastify.get('/matrix', {
    schema: {
      tags: ['Permissions'],
      summary: 'Get default role-permissions templates matrix',
    },
    handler: controller.matrix,
  });
}

module.exports = permissionRoutes;
