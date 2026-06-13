'use strict';

const createDealSchema = {
  type: 'object',
  required: ['customer', 'sourcingAgent', 'askingPrice'],
  additionalProperties: false,
  properties: {
    customer: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    assignedTo: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    sourcingAgent: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    closingAgent: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    teamLeader: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    project: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    unit: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    property: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    siteVisit: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    askingPrice: { type: 'number', minimum: 1 },
    agreedPrice: { type: 'number', minimum: 1 },
    dealValue: { type: 'number', minimum: 1 },
    notes: { type: 'string', maxLength: 1000 },
    branchId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
  },
};

const createReservationSchema = {
  type: 'object',
  required: ['unit', 'lockedDurationMinutes'],
  additionalProperties: false,
  properties: {
    unit: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    reservedByLeadId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    lockedDurationMinutes: { type: 'integer', minimum: 1 },
  },
};

const addPaymentLedgerSchema = {
  type: 'object',
  required: ['amount', 'paymentType', 'paymentMode', 'transactionRef', 'netAmount'],
  additionalProperties: false,
  properties: {
    amount: { type: 'number', minimum: 1 },
    paymentType: { type: 'string', enum: ['token', 'booking_deposit', 'builder_installment', 'other'] },
    paymentMode: { type: 'string', enum: ['cheque', 'wire', 'upi', 'cash', 'draft'] },
    transactionRef: { type: 'string', minLength: 1, maxLength: 100 },
    status: { type: 'string', enum: ['pending', 'cleared', 'bounced'] },
    paidAt: { type: 'string', format: 'date-time' },
    receiptUrl: { type: 'string' },
    gstAmount: { type: 'number', minimum: 0 },
    tdsAmount: { type: 'number', minimum: 0 },
    netAmount: { type: 'number', minimum: 1 },
  },
};

const uploadDocumentSchema = {
  type: 'object',
  required: ['docType', 'fileId'],
  additionalProperties: false,
  properties: {
    docType: {
      type: 'string',
      enum: ['kyc_pan', 'kyc_aadhaar', 'booking_form', 'allotment_letter', 'ats', 'sale_deed', 'receipt', 'other'],
    },
    fileId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
  },
};

const transitionStageSchema = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: {
    status: {
      type: 'string',
      enum: [
        'draft',
        'token_received',
        'token_bounced',
        'booking_initiated',
        'booking_confirmed',
        'agreement_executed',
        'registration_completed',
        'loan_disputed',
        'commission_eligible',
        'invoice_raised',
        'commission_received',
        'deal_closed',
        'booking_defaulted',
        'cancelled',
      ],
    },
    cancellationReason: { type: 'string', minLength: 1, maxLength: 500 },
  },
};

const addCancellationSchema = {
  type: 'object',
  required: ['reason', 'cancellationType'],
  additionalProperties: false,
  properties: {
    reason: { type: 'string', minLength: 5, maxLength: 1000 },
    cancellationType: {
      type: 'string',
      enum: ['customer', 'builder', 'loan_rejection', 'documentation_failure', 'default'],
    },
    forfeitureAmount: { type: 'number', minimum: 0 },
    refundAmount: { type: 'number', minimum: 0 },
    nocUploaded: { type: 'boolean' },
  },
};

module.exports = {
  createDealSchema,
  createReservationSchema,
  addPaymentLedgerSchema,
  uploadDocumentSchema,
  transitionStageSchema,
  addCancellationSchema,
};
