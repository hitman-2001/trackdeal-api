'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { authorize } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { AgreementController } = require('./agreement.controller');

const controller = new AgreementController();

async function agreementRoutes(fastify, opts) {
  fastify.addHook('preValidation', authenticate);

  // Templates
  fastify.get('/templates', {
    preHandler: [authorize(PERMISSIONS.AGREEMENTS_VIEW)],
    schema: {
      tags: ['Agreement Templates'],
      summary: 'List agreement templates',
    },
  }, controller.listTemplates);

  fastify.post('/templates', {
    preHandler: [authorize(PERMISSIONS.AGREEMENTS_CREATE)],
    schema: {
      tags: ['Agreement Templates'],
      summary: 'Create a new agreement template',
    },
  }, controller.createTemplate);

  // Agreements
  fastify.get('/', {
    preHandler: [authorize(PERMISSIONS.AGREEMENTS_VIEW)],
    schema: {
      tags: ['Agreements'],
      summary: 'List generated agreements',
    },
  }, controller.list);

  fastify.get('/:id', {
    preHandler: [authorize(PERMISSIONS.AGREEMENTS_VIEW)],
    schema: {
      tags: ['Agreements'],
      summary: 'Get agreement by ID',
    },
  }, controller.getById);

  fastify.post('/generate', {
    preHandler: [authorize(PERMISSIONS.AGREEMENTS_CREATE)],
    schema: {
      tags: ['Agreements'],
      summary: 'Generate an agreement from template & deal context',
    },
  }, controller.generate);

  fastify.post('/:id/sign', {
    preHandler: [authorize(PERMISSIONS.AGREEMENTS_CREATE)],
    schema: {
      tags: ['Agreements'],
      summary: 'Sign agreement contract',
    },
  }, controller.sign);

  fastify.post('/:id/void', {
    preHandler: [authorize(PERMISSIONS.AGREEMENTS_CREATE)],
    schema: {
      tags: ['Agreements'],
      summary: 'Void agreement contract',
    },
  }, controller.void);
}

module.exports = agreementRoutes;
