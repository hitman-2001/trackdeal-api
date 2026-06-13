'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { requirePermission } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { BranchController } = require('./branch.controller');
const {
  branchIdParamSchema,
  createBranchSchema,
  updateBranchSchema,
} = require('./branch.validation');

/**
 * Branch Routes Plugin
 * Base Prefix: /branches
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} opts
 */
async function branchRoutes(fastify, opts) {
  const controller = new BranchController();

  // All branch routes require authentication
  fastify.addHook('preValidation', authenticate);

  // GET /branches (List all branches)
  fastify.get('/', {
    preHandler: [requirePermission(PERMISSIONS.BRANCHES_READ)],
    schema: {
      tags: ['Branches'],
      summary: 'List all organization branches',
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

  // GET /branches/:id (Get branch by ID)
  fastify.get('/:id', {
    preHandler: [requirePermission(PERMISSIONS.BRANCHES_READ)],
    schema: {
      tags: ['Branches'],
      summary: 'Get branch details by ID',
      params: branchIdParamSchema,
    },
    handler: controller.getById,
  });

  // POST /branches (Create branch)
  fastify.post('/', {
    preHandler: [requirePermission(PERMISSIONS.BRANCHES_CREATE)],
    schema: {
      tags: ['Branches'],
      summary: 'Create a new branch in organization',
      body: createBranchSchema,
    },
    handler: controller.create,
  });

  // PUT /branches/:id (Update branch)
  fastify.put('/:id', {
    preHandler: [requirePermission(PERMISSIONS.BRANCHES_UPDATE)],
    schema: {
      tags: ['Branches'],
      summary: 'Update branch properties or assign branch manager',
      params: branchIdParamSchema,
      body: updateBranchSchema,
    },
    handler: controller.update,
  });

  // DELETE /branches/:id (Soft-delete branch)
  fastify.delete('/:id', {
    preHandler: [requirePermission(PERMISSIONS.BRANCHES_DELETE)],
    schema: {
      tags: ['Branches'],
      summary: 'Soft-delete a branch',
      params: branchIdParamSchema,
    },
    handler: controller.delete,
  });

  // POST /branches/:id/activate (Activate branch)
  fastify.post('/:id/activate', {
    preHandler: [requirePermission(PERMISSIONS.BRANCHES_UPDATE)],
    schema: {
      tags: ['Branches'],
      summary: 'Activate a deactivated branch',
      params: branchIdParamSchema,
    },
    handler: controller.activate,
  });

  // POST /branches/:id/deactivate (Deactivate branch)
  fastify.post('/:id/deactivate', {
    preHandler: [requirePermission(PERMISSIONS.BRANCHES_UPDATE)],
    schema: {
      tags: ['Branches'],
      summary: 'Deactivate an active branch',
      params: branchIdParamSchema,
    },
    handler: controller.deactivate,
  });
}

module.exports = branchRoutes;
