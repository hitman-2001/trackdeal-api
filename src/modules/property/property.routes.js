'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { authorize } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { PropertyController } = require('./property.controller');

const controller = new PropertyController();

async function propertyRoutes(fastify, opts) {
  fastify.addHook('preValidation', authenticate);

  fastify.get('/', { preHandler: [authorize(PERMISSIONS.PROPERTIES_VIEW)], schema: { tags: ['Properties'], summary: 'List properties' } }, controller.list);
  fastify.get('/:id', { preHandler: [authorize(PERMISSIONS.PROPERTIES_VIEW)], schema: { tags: ['Properties'], summary: 'Get property by ID' } }, controller.getById);
  fastify.post('/', { preHandler: [authorize(PERMISSIONS.PROPERTIES_CREATE)], schema: { tags: ['Properties'], summary: 'Create property' } }, controller.create);
  fastify.put('/:id', { preHandler: [authorize(PERMISSIONS.PROPERTIES_UPDATE)], schema: { tags: ['Properties'], summary: 'Update property' } }, controller.update);
  fastify.delete('/:id', { preHandler: [authorize(PERMISSIONS.PROPERTIES_DELETE)], schema: { tags: ['Properties'], summary: 'Delete property' } }, controller.remove);
  fastify.post('/:id/sold', { preHandler: [authorize(PERMISSIONS.PROPERTIES_UPDATE)], schema: { tags: ['Properties'], summary: 'Mark property as sold' } }, controller.markSold);
  fastify.post('/:id/reserved', { preHandler: [authorize(PERMISSIONS.PROPERTIES_UPDATE)], schema: { tags: ['Properties'], summary: 'Mark property as reserved' } }, controller.markReserved);
}

module.exports = propertyRoutes;
