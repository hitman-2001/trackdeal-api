'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { authorize } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { DealController } = require('./deal.controller');
const {
  createDealSchema,
  createReservationSchema,
  addPaymentLedgerSchema,
  uploadDocumentSchema,
  transitionStageSchema,
  addCancellationSchema,
} = require('./deal.validation');

const controller = new DealController();

async function dealRoutes(fastify, opts) {
  fastify.addHook('preValidation', authenticate);

  fastify.get('/', {
    preHandler: [authorize(PERMISSIONS.DEALS_VIEW)],
    schema: { tags: ['Deals'], summary: 'List deals' },
  }, controller.list);

  fastify.get('/:id', {
    preHandler: [authorize(PERMISSIONS.DEALS_VIEW)],
    schema: { tags: ['Deals'], summary: 'Get deal by ID' },
  }, controller.getById);

  fastify.post('/', {
    preHandler: [authorize(PERMISSIONS.DEALS_CREATE)],
    schema: {
      tags: ['Deals'],
      summary: 'Create deal',
      body: createDealSchema,
    },
  }, controller.create);

  fastify.post('/:id/offer', {
    preHandler: [authorize(PERMISSIONS.DEALS_UPDATE)],
    schema: { tags: ['Deals'], summary: 'Add offer' },
  }, controller.addOffer);

  fastify.post('/:id/reserve/extend', {
    preHandler: [authorize(PERMISSIONS.DEALS_UPDATE)],
    schema: {
      tags: ['Deals'],
      summary: 'Extend unit reservation SLA lock',
      body: {
        type: 'object',
        required: ['lockedDurationMinutes'],
        properties: { lockedDurationMinutes: { type: 'integer', minimum: 1 } },
      },
    },
  }, controller.extendReservation);

  fastify.post('/:id/reserve/release', {
    preHandler: [authorize(PERMISSIONS.DEALS_UPDATE)],
    schema: { tags: ['Deals'], summary: 'Release unit reservation back to public available status' },
  }, controller.releaseReservation);

  fastify.post('/:id/reserve/convert', {
    preHandler: [authorize(PERMISSIONS.DEALS_UPDATE)],
    schema: { tags: ['Deals'], summary: 'Convert EOI reservation to confirmed builder booking' },
  }, controller.convertReservation);

  fastify.post('/:id/payment', {
    preHandler: [authorize(PERMISSIONS.DEALS_UPDATE)],
    schema: {
      tags: ['Deals'],
      summary: 'Add payment transaction to ledger',
      body: addPaymentLedgerSchema,
    },
  }, controller.addPayment);

  fastify.post('/:id/refund', {
    preHandler: [authorize(PERMISSIONS.DEALS_UPDATE)],
    schema: {
      tags: ['Deals'],
      summary: 'Add cancellation refund allocation',
      body: {
        type: 'object',
        required: ['refundAmount'],
        properties: {
          refundAmount: { type: 'number', minimum: 1 },
          forfeitureAmount: { type: 'number', minimum: 0 },
          status: { type: 'string', enum: ['pending', 'completed'] },
        },
      },
    },
  }, controller.addRefund);

  fastify.post('/:id/document', {
    preHandler: [authorize(PERMISSIONS.DEALS_UPDATE)],
    schema: {
      tags: ['Deals'],
      summary: 'Upload KYC or RERA checklist document',
      body: uploadDocumentSchema,
    },
  }, controller.uploadDocument);

  fastify.post('/:id/verify', {
    preHandler: [authorize(PERMISSIONS.DEALS_UPDATE)],
    schema: {
      tags: ['Deals'],
      summary: 'Verify checklist document',
      body: {
        type: 'object',
        required: ['docType'],
        properties: { docType: { type: 'string' } },
      },
    },
  }, controller.verifyDocument);

  fastify.post('/:id/transition', {
    preHandler: [authorize(PERMISSIONS.DEALS_UPDATE)],
    schema: {
      tags: ['Deals'],
      summary: 'Transition deal pipeline stage',
      body: transitionStageSchema,
    },
  }, controller.transition);
}

module.exports = dealRoutes;
