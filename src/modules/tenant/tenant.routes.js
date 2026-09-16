'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { TenantController } = require('./tenant.controller');
const { isPlatformAdmin, isOrgAdmin } = require('./tenant.constants');
const { ForbiddenError } = require('../../shared/errors');

async function requirePlatformAdmin(request) {
  if (!isPlatformAdmin(request.user?.role)) {
    throw new ForbiddenError('Access restricted to platform Super Administrators.');
  }
}

async function requirePlatformOrOrgAdmin(request) {
  if (!isPlatformAdmin(request.user?.role) && !isOrgAdmin(request.user?.role)) {
    throw new ForbiddenError('Access restricted to Super Administrators and Organization Admins.');
  }
}

async function tenantRoutes(fastify) {
  const controller = new TenantController();

  fastify.addHook('preHandler', authenticate);

  fastify.get('/modules', {
    preHandler: [requirePlatformAdmin],
    schema: {
      tags: ['Tenants'],
      summary: 'List assignable tenant modules for a vertical',
      querystring: {
        type: 'object',
        properties: {
          vertical: { type: 'string', enum: ['realEstate', 'education'] },
          domain: { type: 'string', enum: ['realEstate', 'education'] },
        },
      },
    },
    handler: (req, reply) => controller.listModules(req, reply),
  });

  fastify.get('/', {
    preHandler: [requirePlatformAdmin],
    schema: { tags: ['Tenants'], summary: 'List tenants' },
    handler: (req, reply) => controller.list(req, reply),
  });

  fastify.post('/', {
    preHandler: [requirePlatformAdmin],
    schema: {
      tags: ['Tenants'],
      summary: 'Create a tenant',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 },
          slug: { type: 'string', maxLength: 80 },
          domain: { type: 'string', enum: ['realEstate', 'education'] },
          vertical: { type: 'string', enum: ['realEstate', 'education'] },
          enabledModules: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    handler: (req, reply) => controller.create(req, reply),
  });

  fastify.get('/:id', {
    preHandler: [requirePlatformOrOrgAdmin],
    schema: { tags: ['Tenants'], summary: 'Get tenant by id' },
    handler: (req, reply) => controller.getById(req, reply),
  });

  fastify.put('/:id', {
    preHandler: [requirePlatformAdmin],
    schema: {
      tags: ['Tenants'],
      summary: 'Update tenant name, status, or modules (vertical cannot be changed)',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 },
          status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
          enabledModules: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    handler: (req, reply) => controller.update(req, reply),
  });

  fastify.post('/:id/suspend', {
    preHandler: [requirePlatformOrOrgAdmin],
    schema: { tags: ['Tenants'], summary: 'Suspend a tenant' },
    handler: (req, reply) => controller.suspend(req, reply),
  });

  fastify.post('/:id/activate', {
    preHandler: [requirePlatformAdmin],
    schema: { tags: ['Tenants'], summary: 'Activate a tenant' },
    handler: (req, reply) => controller.activate(req, reply),
  });
}

module.exports = tenantRoutes;
