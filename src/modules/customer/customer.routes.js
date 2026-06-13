'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { authorize } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { CustomerController } = require('./customer.controller');

const controller = new CustomerController();

async function customerRoutes(fastify, opts) {
  fastify.addHook('preValidation', authenticate);

  fastify.get('/', { preHandler: [authorize(PERMISSIONS.CUSTOMERS_VIEW)], schema: { tags: ['Customers'], summary: 'List customers' } }, controller.list);
  fastify.get('/:id', { preHandler: [authorize(PERMISSIONS.CUSTOMERS_VIEW)], schema: { tags: ['Customers'], summary: 'Get customer by ID' } }, controller.getById);
  fastify.post('/', { preHandler: [authorize(PERMISSIONS.CUSTOMERS_CREATE)], schema: { tags: ['Customers'], summary: 'Create customer' } }, controller.create);
  fastify.put('/:id', { preHandler: [authorize(PERMISSIONS.CUSTOMERS_UPDATE)], schema: { tags: ['Customers'], summary: 'Update customer' } }, controller.update);
  fastify.delete('/:id', { preHandler: [authorize(PERMISSIONS.CUSTOMERS_DELETE)], schema: { tags: ['Customers'], summary: 'Delete customer' } }, controller.remove);
}

module.exports = customerRoutes;
