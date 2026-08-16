'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { requirePermission } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { AgentController } = require('./agent.controller');
const {
  agentIdParamSchema,
  createAgentSchema,
  updateAgentSchema,
  updateStatusSchema,
} = require('./agent.validation');

async function agentRoutes(fastify, opts) {
  const controller = new AgentController();
  fastify.addHook('preValidation', authenticate);

  // GET /active — Dropdown active agent master list across CRM
  fastify.get(
    '/active',
    {
      preHandler: [requirePermission(PERMISSIONS.AGENTS_READ)],
      schema: {
        tags: ['Agents'],
        summary: 'Get active agents master list for dropdowns',
      },
    },
    controller.getActive
  );

  // GET / — List agents with pagination and filters
  fastify.get(
    '/',
    {
      preHandler: [requirePermission(PERMISSIONS.AGENTS_READ)],
      schema: {
        tags: ['Agents'],
        summary: 'List agents and channel partners',
      },
    },
    controller.list
  );

  // GET /:id — Get agent details
  fastify.get(
    '/:id',
    {
      preHandler: [requirePermission(PERMISSIONS.AGENTS_READ)],
      schema: {
        tags: ['Agents'],
        summary: 'Get agent by ID',
        params: agentIdParamSchema,
      },
    },
    controller.getById
  );

  // GET /:id/leads — Get leads assigned to agent
  fastify.get(
    '/:id/leads',
    {
      preHandler: [requirePermission(PERMISSIONS.AGENTS_READ)],
      schema: {
        tags: ['Agents'],
        summary: 'Get leads assigned to agent',
        params: agentIdParamSchema,
      },
    },
    controller.getLeads
  );

  // POST / — Create agent
  fastify.post(
    '/',
    {
      preHandler: [requirePermission(PERMISSIONS.AGENTS_CREATE)],
      schema: {
        tags: ['Agents'],
        summary: 'Create new agent or channel partner',
        body: createAgentSchema,
      },
    },
    controller.create
  );

  // PUT /:id — Edit agent
  fastify.put(
    '/:id',
    {
      preHandler: [requirePermission(PERMISSIONS.AGENTS_UPDATE)],
      schema: {
        tags: ['Agents'],
        summary: 'Update agent details',
        params: agentIdParamSchema,
        body: updateAgentSchema,
      },
    },
    controller.update
  );

  // PATCH /:id/status — Activate / Deactivate agent
  fastify.patch(
    '/:id/status',
    {
      preHandler: [requirePermission(PERMISSIONS.AGENTS_UPDATE)],
      schema: {
        tags: ['Agents'],
        summary: 'Activate or deactivate agent',
        params: agentIdParamSchema,
        body: updateStatusSchema,
      },
    },
    controller.updateStatus
  );

  // DELETE /:id — Delete agent
  fastify.delete(
    '/:id',
    {
      preHandler: [requirePermission(PERMISSIONS.AGENTS_DELETE)],
      schema: {
        tags: ['Agents'],
        summary: 'Delete agent',
        params: agentIdParamSchema,
      },
    },
    controller.remove
  );
}

module.exports = agentRoutes;
