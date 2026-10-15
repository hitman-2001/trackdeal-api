'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { CustomFieldController } = require('./customField.controller');

const controller = new CustomFieldController();

async function customFieldRoutes(fastify, opts) {
  fastify.addHook('preValidation', authenticate);

  fastify.get('/', { schema: { tags: ['CustomFields'], summary: 'List custom fields for module' } }, controller.list.bind(controller));
  fastify.post('/', { schema: { tags: ['CustomFields'], summary: 'Create new custom field' } }, controller.create.bind(controller));
  fastify.patch('/:id', { schema: { tags: ['CustomFields'], summary: 'Update custom field definition' } }, controller.update.bind(controller));
  fastify.delete('/:id', { schema: { tags: ['CustomFields'], summary: 'Delete custom field definition' } }, controller.remove.bind(controller));
}

module.exports = customFieldRoutes;

