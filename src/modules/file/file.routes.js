'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { FileController } = require('./file.controller');

const controller = new FileController();

async function fileRoutes(fastify, opts) {
  fastify.addHook('preValidation', authenticate);

  fastify.post('/upload', {
    schema: {
      tags: ['Files'],
      summary: 'Upload a file attachment (multipart/form-data)',
      description: 'Provide a file field named "file", and text fields "entityType" and "entityId".',
    },
  }, controller.upload);

  fastify.get('/', {
    schema: {
      tags: ['Files'],
      summary: 'Get files associated with an entity',
      querystring: {
        type: 'object',
        properties: {
          entityType: { type: 'string' },
          entityId: { type: 'string' },
        },
        required: ['entityType', 'entityId'],
      },
    },
  }, controller.getByEntity);

  fastify.delete('/:id', {
    schema: {
      tags: ['Files'],
      summary: 'Delete an uploaded file',
    },
  }, controller.delete);
}

module.exports = fileRoutes;
