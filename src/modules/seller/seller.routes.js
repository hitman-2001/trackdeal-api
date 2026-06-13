'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { authorize } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { SellerController } = require('./seller.controller');

const controller = new SellerController();

async function sellerRoutes(fastify, opts) {
  fastify.addHook('preValidation', authenticate);
  fastify.get('/', { preHandler: [authorize(PERMISSIONS.SELLERS_VIEW)], schema: { tags: ['Sellers'], summary: 'List sellers' } }, controller.list);
  fastify.get('/:id', { preHandler: [authorize(PERMISSIONS.SELLERS_VIEW)], schema: { tags: ['Sellers'], summary: 'Get seller by ID' } }, controller.getById);
  fastify.post('/', { preHandler: [authorize(PERMISSIONS.SELLERS_CREATE)], schema: { tags: ['Sellers'], summary: 'Create seller' } }, controller.create);
  fastify.put('/:id', { preHandler: [authorize(PERMISSIONS.SELLERS_UPDATE)], schema: { tags: ['Sellers'], summary: 'Update seller' } }, controller.update);
  fastify.delete('/:id', { preHandler: [authorize(PERMISSIONS.SELLERS_DELETE)], schema: { tags: ['Sellers'], summary: 'Delete seller' } }, controller.remove);
}

module.exports = sellerRoutes;
