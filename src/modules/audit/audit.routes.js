'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { authorize } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { AuditController } = require('./audit.controller');

const controller = new AuditController();

async function auditRoutes(fastify, opts) {
  fastify.addHook('preValidation', authenticate);
  fastify.addHook('preHandler', authorize(PERMISSIONS.AUDIT_VIEW));

  fastify.get('/', {
    schema: {
      tags: ['Audit Logs'],
      summary: 'Query system-wide audit logs with filters',
    },
  }, controller.list);

  fastify.get('/entity/:entity/:entityId', {
    schema: {
      tags: ['Audit Logs'],
      summary: 'Get audit history for a specific entity document',
    },
  }, controller.getEntityHistory);

  fastify.get('/user/:userId', {
    schema: {
      tags: ['Audit Logs'],
      summary: 'Get activity logs for a specific user',
    },
  }, controller.getUserActivity);
}

module.exports = auditRoutes;
