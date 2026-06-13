"use strict";

const createCommissionSchema = {
  type: "object",
  required: ["dealId", "totalCommissionExpected"],
  additionalProperties: false,
  properties: {
    dealId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    totalCommissionExpected: { type: "number", minimum: 1 },
    commissionPercentage: { type: "number", minimum: 0, maximum: 100 },
    notes: { type: "string", maxLength: 1000 },
  },
};

const createInvoiceSchema = {
  type: "object",
  required: ["commissionId", "slabId", "grossAmount", "netReceivable"],
  additionalProperties: false,
  properties: {
    commissionId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    slabId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    grossAmount: { type: "number", minimum: 1 },
    gstAmount: { type: "number", minimum: 0 },
    gstType: { type: "string", enum: ["CGST_SGST", "IGST"] },
    tdsAmount: { type: "number", minimum: 0 },
    tdsPercentage: { type: "number", minimum: 0, maximum: 100 },
    netReceivable: { type: "number", minimum: 1 },
    dueDate: { type: "string", format: "date-time" },
  },
};

const recordCollectionSchema = {
  type: "object",
  required: [
    "invoiceId",
    "amountCollected",
    "paymentMode",
    "transactionReference",
  ],
  additionalProperties: false,
  properties: {
    invoiceId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    amountCollected: { type: "number", minimum: 1 },
    paymentMode: {
      type: "string",
      enum: ["cheque", "wire", "upi", "cash", "draft"],
    },
    transactionReference: { type: "string", minLength: 1, maxLength: 100 },
    clearedAt: { type: "string", format: "date-time" },
    bankEscrowAccount: { type: "string", maxLength: 100 },
    deductions: { type: "number", minimum: 0 },
    adjustmentReasons: { type: "string", maxLength: 1000 },
    status: { type: "string", enum: ["pending", "cleared", "bounced"] },
  },
};

const transitionStageSchema = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: [
        "eligible",
        "invoice_draft",
        "invoice_raised",
        "invoice_sent",
        "payment_expected",
        "partially_collected",
        "fully_collected",
        "payout_calculated",
        "payout_eligible",
        "payout_authorized",
        "payout_released",
        "closed",
        "cancelled",
        "clawed_back",
      ],
    },
    notes: { type: "string", maxLength: 1000 },
  },
};

const addPayoutLedgerSchema = {
  type: "object",
  required: [
    "dealId",
    "commissionId",
    "agentId",
    "role",
    "grossAmount",
    "netAmount",
  ],
  additionalProperties: false,
  properties: {
    dealId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    commissionId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    agentId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    role: { type: "string", enum: ["sourcing", "closing", "team_leader"] },
    payoutType: { type: "string", enum: ["earning", "clawback"] },
    grossAmount: { type: "number" },
    tdsDeducted: { type: "number", minimum: 0 },
    tdsPercentage: { type: "number", minimum: 0, maximum: 100 },
    netAmount: { type: "number" },
    status: { type: "string", enum: ["pending", "approved", "released"] },
  },
};

module.exports = {
  createCommissionSchema,
  createInvoiceSchema,
  recordCollectionSchema,
  transitionStageSchema,
  addPayoutLedgerSchema,
};
