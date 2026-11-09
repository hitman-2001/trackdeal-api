'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { requirePermission, requireRole } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { OrganizationController } = require('./organization.controller');
const {
  orgIdParamSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
} = require('./organization.validation');

/**
 * Organization Routes Plugin
 * Base Prefix: /organizations
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} opts
 */
async function organizationRoutes(fastify, _opts) {
  const controller = new OrganizationController();

  // All organization routes require authentication
  fastify.addHook('preValidation', authenticate);

  // GET /organizations (List all organizations - Super Admin only)
  fastify.get('/', {
    preHandler: [requirePermission(PERMISSIONS.ORGANIZATIONS_READ), requireRole('super_admin')],
    schema: {
      tags: ['Organizations'],
      summary: 'List all platform organizations (Super Admin only)',
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

  // Delegated education administration. These routes intentionally sit outside
  // /admin and are authorized again in the service against the actor's org.
  fastify.get('/education-admin/access', {
    schema: {
      tags: ['Organizations'],
      summary: 'Check delegated Education tenant administration access',
    },
    handler: controller.educationAdminAccess,
  });

  fastify.get('/education-admin/tenants', {
    schema: {
      tags: ['Organizations'],
      summary: 'List Education tenant organizations for a delegated administrator',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string', maxLength: 100 },
          status: { type: 'string', enum: ['active', 'trial', 'inactive', 'suspended'] },
        },
      },
    },
    handler: controller.listEducationTenants,
  });

  fastify.post('/education-admin/tenants/:id/suspend', {
    schema: {
      tags: ['Organizations'],
      summary: 'Disable an Education tenant organization',
      params: orgIdParamSchema,
    },
    handler: controller.suspendEducationTenant,
  });

  fastify.post('/education-admin/tenants/:id/activate', {
    schema: {
      tags: ['Organizations'],
      summary: 'Enable an Education tenant organization',
      params: orgIdParamSchema,
    },
    handler: controller.activateEducationTenant,
  });

  // GET /organizations/:id (Get organization by ID)
  fastify.get('/:id', {
    preHandler: [requirePermission(PERMISSIONS.ORGANIZATIONS_READ)],
    schema: {
      tags: ['Organizations'],
      summary: 'Get organization details by ID',
      params: orgIdParamSchema,
    },
    handler: controller.getById,
  });

  // POST /organizations (Register organization - Super Admin only)
  fastify.post('/', {
    preHandler: [requirePermission(PERMISSIONS.ORGANIZATIONS_CREATE)],
    schema: {
      tags: ['Organizations'],
      summary: 'Register a new tenant organization (Super Admin only)',
      body: createOrganizationSchema,
    },
    handler: controller.create,
  });

  // PUT /organizations/:id (Update organization)
  fastify.put('/:id', {
    preHandler: [requirePermission(PERMISSIONS.ORGANIZATIONS_UPDATE)],
    schema: {
      tags: ['Organizations'],
      summary: 'Update organization subscription, branding, or profile',
      params: orgIdParamSchema,
      body: updateOrganizationSchema,
    },
    handler: controller.update,
  });

  // DELETE /organizations/:id (Archive organization - Super Admin only)
  fastify.delete('/:id', {
    preHandler: [requirePermission(PERMISSIONS.ORGANIZATIONS_DELETE)],
    schema: {
      tags: ['Organizations'],
      summary: 'Soft-delete/Archive an organization and cascade branches/users (Super Admin only)',
      params: orgIdParamSchema,
    },
    handler: controller.delete,
  });

  // POST /organizations/:id/activate (Activate organization - Super Admin only)
  fastify.post('/:id/activate', {
    preHandler: [requirePermission(PERMISSIONS.ORGANIZATIONS_UPDATE)],
    schema: {
      tags: ['Organizations'],
      summary: 'Activate a suspended organization (Super Admin only)',
      params: orgIdParamSchema,
    },
    handler: controller.activate,
  });

  // POST /organizations/:id/suspend (Suspend organization - Super Admin only)
  fastify.post('/:id/suspend', {
    preHandler: [requirePermission(PERMISSIONS.ORGANIZATIONS_UPDATE)],
    schema: {
      tags: ['Organizations'],
      summary: 'Suspend an organization subscription (Super Admin only)',
      params: orgIdParamSchema,
    },
    handler: controller.suspend,
  });
}

module.exports = organizationRoutes;
