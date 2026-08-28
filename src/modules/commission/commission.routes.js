"use strict";

const { authenticate } = require("../../shared/middleware/authenticate.middleware");
const { authorize } = require("../../shared/middleware/authorize.middleware");
const { PERMISSIONS } = require("../../shared/constants/roles-permissions.constants");
const { CommissionController } = require("./commission.controller");
const {
  createCommissionSchema,
  createInvoiceSchema,
  recordCollectionSchema,
  transitionStageSchema,
  addPayoutLedgerSchema,
} = require("./commission.validation");

const controller = new CommissionController();

async function commissionRoutes(fastify, opts) {
  fastify.addHook("preValidation", authenticate);

  fastify.get("/summary", {
    preHandler: [authorize(PERMISSIONS.COMMISSIONS_READ)],
    schema: { tags: ["Commissions"], summary: "Get executive commission and receivables summary" },
  }, controller.summary);

  fastify.get("/receivables", {
    preHandler: [authorize(PERMISSIONS.COMMISSIONS_READ)],
    schema: { tags: ["Commissions"], summary: "Get receivables ledger grouped by paying party" },
  }, controller.receivables);

  fastify.get("/", {
    preHandler: [authorize(PERMISSIONS.COMMISSIONS_READ)],
    schema: { tags: ["Commissions"], summary: "List commissions" },
  }, controller.list);

  fastify.get("/:id", {
    preHandler: [authorize(PERMISSIONS.COMMISSIONS_READ)],
    schema: { tags: ["Commissions"], summary: "Get commission details by ID" },
  }, controller.getById);

  fastify.post("/:id/payments", {
    preHandler: [authorize(PERMISSIONS.COMMISSIONS_UPDATE)],
    schema: { tags: ["Commissions"], summary: "Record payment against commission" },
  }, controller.recordPayment);

  fastify.post("/", {
    preHandler: [authorize(PERMISSIONS.COMMISSIONS_CREATE)],
    schema: {
      tags: ["Commissions"],
      summary: "Create parent commission record",
      body: createCommissionSchema,
    },
  }, controller.create);

  fastify.post("/:id/invoice", {
    preHandler: [authorize(PERMISSIONS.COMMISSIONS_UPDATE)],
    schema: {
      tags: ["Commissions"],
      summary: "Raise milestone slab B2B invoice",
      body: createInvoiceSchema,
    },
  }, controller.createInvoice);

  fastify.post("/invoices/:invoiceId/collection", {
    preHandler: [authorize(PERMISSIONS.COMMISSIONS_UPDATE)],
    schema: {
      tags: ["Commissions"],
      summary: "Record cleared client payment collection",
      body: recordCollectionSchema,
    },
  }, controller.recordCollection);

  fastify.post("/payouts/:payoutId/release", {
    preHandler: [authorize(PERMISSIONS.COMMISSIONS_APPROVE)],
    schema: {
      tags: ["Commissions"],
      summary: "Release agent split commission payout",
    },
  }, controller.releasePayout);

  fastify.post("/:id/clawback", {
    preHandler: [authorize(PERMISSIONS.COMMISSIONS_APPROVE)],
    schema: {
      tags: ["Commissions"],
      summary: "Process deal cancellation clawback reversals",
    },
  }, controller.processClawback);

  fastify.post("/:id/transition", {
    preHandler: [authorize(PERMISSIONS.COMMISSIONS_UPDATE)],
    schema: {
      tags: ["Commissions"],
      summary: "Transition commission stage manually",
      body: transitionStageSchema,
    },
  }, controller.transition);

  fastify.post("/collections/:collectionId/clear", {
    preHandler: [authorize(PERMISSIONS.COMMISSIONS_UPDATE)],
    schema: {
      tags: ["Commissions"],
      summary: "Clear a pending banking collection and distribute payouts",
    },
  }, controller.clearCollection);

  fastify.post("/collections/:collectionId/bounce", {
    preHandler: [authorize(PERMISSIONS.COMMISSIONS_UPDATE)],
    schema: {
      tags: ["Commissions"],
      summary: "Mark a pending banking collection as bounced and rollback balances",
    },
  }, controller.bounceCollection);
}

module.exports = commissionRoutes;
