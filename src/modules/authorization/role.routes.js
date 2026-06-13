'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { requirePermission } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { RoleController } = require('./role.controller');
const {
  roleIdParamSchema,
  createRoleSchema,
  updateRoleSchema,
  assignPermissionsSchema,
} = require('./authorization.validation');

/**
 * Role Routes Plugin
 * Base Prefix: /roles
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} opts
 */
async function roleRoutes(fastify, opts) {
  const controller = new RoleController();

  // All role routes require authentication
  fastify.addHook('preValidation', authenticate);

  // GET /roles (List all roles)
  fastify.get('/', {
    preHandler: [requirePermission(PERMISSIONS.ROLES_READ)],
    schema: {
      tags: ['Roles'],
      summary: 'List all custom and system roles',
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

  // GET /roles/:id (Get role by ID)
  fastify.get('/:id', {
    preHandler: [requirePermission(PERMISSIONS.ROLES_READ)],
    schema: {
      tags: ['Roles'],
      summary: 'Get custom or system role by ID',
      params: roleIdParamSchema,
    },
    handler: controller.getById,
  });

  // POST /roles (Create custom role)
  fastify.post('/', {
    preHandler: [requirePermission(PERMISSIONS.ROLES_CREATE)],
    schema: {
      tags: ['Roles'],
      summary: 'Create custom role for organization',
      body: createRoleSchema,
    },
    handler: controller.create,
  });

  // PUT /roles/:id (Update custom role)
  fastify.put('/:id', {
    preHandler: [requirePermission(PERMISSIONS.ROLES_UPDATE)],
    schema: {
      tags: ['Roles'],
      summary: 'Update custom role parameters',
      params: roleIdParamSchema,
      body: updateRoleSchema,
    },
    handler: controller.update,
  });

  // DELETE /roles/:id (Delete custom role)
  fastify.delete('/:id', {
    preHandler: [requirePermission(PERMISSIONS.ROLES_DELETE)],
    schema: {
      tags: ['Roles'],
      summary: 'Soft delete a custom role',
      params: roleIdParamSchema,
    },
    handler: controller.delete,
  });

  // POST /roles/:id/clone (Clone custom or system role)
  fastify.post('/:id/clone', {
    preHandler: [requirePermission(PERMISSIONS.ROLES_CREATE)],
    schema: {
      tags: ['Roles'],
      summary: 'Clone an existing role permissions into a new custom role',
      params: roleIdParamSchema,
      body: {
        type: 'object',
        required: ['name', 'code'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 50 },
          code: { type: 'string', minLength: 2, maxLength: 50, pattern: '^[a-z0-9_]+$' },
          description: { type: 'string', maxLength: 200 },
        },
      },
    },
    handler: controller.clone,
  });

  // POST /roles/:id/activate (Activate role)
  fastify.post('/:id/activate', {
    preHandler: [requirePermission(PERMISSIONS.ROLES_UPDATE)],
    schema: {
      tags: ['Roles'],
      summary: 'Activate a deactivated custom role',
      params: roleIdParamSchema,
    },
    handler: controller.activate,
  });

  // POST /roles/:id/deactivate (Deactivate role)
  fastify.post('/:id/deactivate', {
    preHandler: [requirePermission(PERMISSIONS.ROLES_UPDATE)],
    schema: {
      tags: ['Roles'],
      summary: 'Deactivate a custom role (blocks logins for users under this role)',
      params: roleIdParamSchema,
    },
    handler: controller.deactivate,
  });

  // GET /roles/:id/permissions (Get permissions list of a role)
  fastify.get('/:id/permissions', {
    preHandler: [requirePermission(PERMISSIONS.ROLES_READ)],
    schema: {
      tags: ['Roles'],
      summary: 'Get assigned granular permissions list for a specific role',
      params: roleIdParamSchema,
    },
    handler: controller.getPermissions,
  });

  // POST /roles/:id/permissions (Assign permissions list to a role)
  fastify.post('/:id/permissions', {
    preHandler: [requirePermission(PERMISSIONS.ROLES_ASSIGN_PERMISSIONS)],
    schema: {
      tags: ['Roles'],
      summary: 'Replace assigned permission list of a specific custom role',
      params: roleIdParamSchema,
      body: assignPermissionsSchema,
    },
    handler: controller.assignPermissions,
  });

  // PUT /roles/:id/permissions (Update permissions list to a role - PUT synonym)
  fastify.put('/:id/permissions', {
    preHandler: [requirePermission(PERMISSIONS.ROLES_ASSIGN_PERMISSIONS)],
    schema: {
      tags: ['Roles'],
      summary: 'Replace assigned permission list of a specific custom role (PUT)',
      params: roleIdParamSchema,
      body: assignPermissionsSchema,
    },
    handler: controller.assignPermissions,
  });
}

module.exports = roleRoutes;
