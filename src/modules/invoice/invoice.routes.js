'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { authorize } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { InvoiceController } = require('./invoice.controller');

const controller = new InvoiceController();

async function invoiceRoutes(fastify, opts) {
  fastify.addHook('preValidation', authenticate);
  fastify.get('/', { preHandler: [authorize(PERMISSIONS.INVOICES_VIEW)], schema: { tags: ['Invoices'], summary: 'List invoices' } }, controller.list);
  fastify.get('/:id', { preHandler: [authorize(PERMISSIONS.INVOICES_VIEW)], schema: { tags: ['Invoices'], summary: 'Get invoice by ID' } }, controller.getById);
  fastify.post('/', { preHandler: [authorize(PERMISSIONS.INVOICES_CREATE)], schema: { tags: ['Invoices'], summary: 'Create invoice' } }, controller.create);
  fastify.post('/:id/send', { preHandler: [authorize(PERMISSIONS.INVOICES_SEND)], schema: { tags: ['Invoices'], summary: 'Send invoice' } }, controller.send);
  fastify.post('/:id/cancel', { preHandler: [authorize(PERMISSIONS.INVOICES_CANCEL)], schema: { tags: ['Invoices'], summary: 'Cancel invoice' } }, controller.cancel);
  fastify.post('/:id/payments', { preHandler: [authorize(PERMISSIONS.PAYMENTS_RECORD)], schema: { tags: ['Invoices'], summary: 'Record payment' } }, controller.recordPayment);
}

module.exports = invoiceRoutes;
