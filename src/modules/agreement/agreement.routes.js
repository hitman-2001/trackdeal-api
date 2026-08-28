'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { authorize } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { AgreementController } = require('./agreement.controller');

const controller = new AgreementController();

async function agreementRoutes(fastify, opts) {
  fastify.addHook('preValidation', authenticate);

  // Template routes
  fastify.get('/templates', {
    schema: { tags: ['Agreement Templates'], summary: 'List available agreement templates' },
  }, controller.listTemplates);

  fastify.get('/templates/:id', {
    schema: { tags: ['Agreement Templates'], summary: 'Get agreement template by ID' },
  }, controller.getTemplateById);

  fastify.post('/templates', {
    schema: { tags: ['Agreement Templates'], summary: 'Create custom agreement template' },
  }, controller.createTemplate);

  // Agreement routes
  fastify.get('/', {
    schema: { tags: ['Agreements'], summary: 'List agreements with summary KPIs' },
  }, controller.list);

  fastify.get('/:id', {
    schema: { tags: ['Agreements'], summary: 'Get agreement by ID' },
  }, controller.getById);

  fastify.post('/', {
    schema: { tags: ['Agreements'], summary: 'Create agreement from guided wizard' },
  }, controller.create);

  fastify.put('/:id/details', {
    schema: { tags: ['Agreements'], summary: 'Edit structured transaction fields and recompile' },
  }, controller.updateStructuredDetails);

  fastify.put('/:id/clauses', {
    schema: { tags: ['Agreements'], summary: 'Full document editor: update clauses & order' },
  }, controller.updateClauses);

  fastify.post('/:id/custom-clause', {
    schema: { tags: ['Agreements'], summary: 'Insert custom clause into agreement' },
  }, controller.addCustomClause);

  fastify.post('/:id/reset-clause/:clauseId', {
    schema: { tags: ['Agreements'], summary: 'Reset single clause to master template' },
  }, controller.resetClause);

  fastify.post('/:id/reset-all', {
    schema: { tags: ['Agreements'], summary: 'Reset all clauses to master template' },
  }, controller.resetFullAgreement);

  fastify.post('/:id/duplicate', {
    schema: { tags: ['Agreements'], summary: 'Duplicate agreement' },
  }, controller.duplicate);

  fastify.patch('/:id/status', {
    schema: { tags: ['Agreements'], summary: 'Update agreement status' },
  }, controller.updateStatus);

  fastify.get('/:id/docx', {
    schema: { tags: ['Agreements'], summary: 'Export agreement as Word document' },
  }, controller.exportDocx);
}

module.exports = agreementRoutes;
