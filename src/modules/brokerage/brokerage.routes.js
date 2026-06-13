'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { authorize } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { BrokerageController } = require('./brokerage.controller');

const controller = new BrokerageController();

async function brokerageRoutes(fastify, opts) {
  fastify.addHook('preValidation', authenticate);

  fastify.get('/', {
    preHandler: [authorize(PERMISSIONS.BROKERAGE_VIEW)],
    schema: {
      tags: ['Brokerage'],
      summary: 'List brokerage calculations',
    },
  }, controller.list);

  fastify.get('/:id', {
    preHandler: [authorize(PERMISSIONS.BROKERAGE_VIEW)],
    schema: {
      tags: ['Brokerage'],
      summary: 'Get brokerage calculation by ID',
    },
  }, controller.getById);

  fastify.post('/calculate', {
    preHandler: [authorize(PERMISSIONS.BROKERAGE_CALCULATE)],
    schema: {
      tags: ['Brokerage'],
      summary: 'Trigger brokerage calculation for a Deal',
    },
  }, controller.calculate);

  fastify.post('/:id/adjust', {
    preHandler: [authorize(PERMISSIONS.BROKERAGE_CALCULATE)],
    schema: {
      tags: ['Brokerage'],
      summary: 'Add manual brokerage adjustment',
    },
  }, controller.adjust);

  fastify.post('/:id/approve', {
    preHandler: [authorize(PERMISSIONS.BROKERAGE_SETTLE)],
    schema: {
      tags: ['Brokerage'],
      summary: 'Approve brokerage calculation',
    },
  }, controller.approve);

  fastify.post('/:id/settle', {
    preHandler: [authorize(PERMISSIONS.BROKERAGE_SETTLE)],
    schema: {
      tags: ['Brokerage'],
      summary: 'Settle brokerage commission payment',
    },
  }, controller.settle);
}

module.exports = brokerageRoutes;
