'use strict';

// ---------------------------------------------------------------------------
// Agent Module JSON Schemas for Fastify AJV Input Validation
// ---------------------------------------------------------------------------

const agentIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {
      type: 'string',
      pattern: '^[0-9a-fA-F]{24}$',
      description: 'Mongoose ObjectId',
    },
  },
};

const createAgentSchema = {
  type: 'object',
  required: ['name', 'officeName', 'phone', 'address'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 },
    officeName: { type: 'string', minLength: 2, maxLength: 150 },
    phone: { type: 'string', pattern: '^[0-9+ -]{5,20}$' },
    alternatePhone: { type: 'string', pattern: '^([0-9+ -]{5,20})?$' },
    email: { type: 'string', anyOf: [{ format: 'email' }, { type: 'string', maxLength: 0 }] },
    profilePhoto: { type: 'string', maxLength: 500 },

    reraNumber: { type: 'string', maxLength: 50 },
    registrationNumber: { type: 'string', maxLength: 50 },
    gstNumber: { type: 'string', maxLength: 50 },
    panNumber: { type: 'string', maxLength: 50 },
    agentType: {
      type: 'string',
      enum: ['individual', 'company', 'channel_partner', 'broker', 'other'],
    },
    specialization: {
      type: 'string',
      enum: ['residential', 'commercial', 'plot', 'rental', 'other'],
    },

    address: { type: 'string', minLength: 3, maxLength: 300 },
    city: { type: 'string', maxLength: 100 },
    state: { type: 'string', maxLength: 100 },
    pincode: { type: 'string', maxLength: 20 },
    country: { type: 'string', maxLength: 100 },

    contactPersonName: { type: 'string', maxLength: 100 },
    contactPersonPhone: { type: 'string', pattern: '^([0-9+ -]{5,20})?$' },
    website: { type: 'string', maxLength: 200 },
    notes: { type: 'string', maxLength: 1000 },
    status: { type: 'string', enum: ['active', 'inactive'] },
  },
};

const updateAgentSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 },
    officeName: { type: 'string', minLength: 2, maxLength: 150 },
    phone: { type: 'string', pattern: '^[0-9+ -]{5,20}$' },
    alternatePhone: { type: 'string', pattern: '^([0-9+ -]{5,20})?$' },
    email: { type: 'string', anyOf: [{ format: 'email' }, { type: 'string', maxLength: 0 }] },
    profilePhoto: { type: 'string', maxLength: 500 },

    reraNumber: { type: 'string', maxLength: 50 },
    registrationNumber: { type: 'string', maxLength: 50 },
    gstNumber: { type: 'string', maxLength: 50 },
    panNumber: { type: 'string', maxLength: 50 },
    agentType: {
      type: 'string',
      enum: ['individual', 'company', 'channel_partner', 'broker', 'other'],
    },
    specialization: {
      type: 'string',
      enum: ['residential', 'commercial', 'plot', 'rental', 'other'],
    },

    address: { type: 'string', minLength: 3, maxLength: 300 },
    city: { type: 'string', maxLength: 100 },
    state: { type: 'string', maxLength: 100 },
    pincode: { type: 'string', maxLength: 20 },
    country: { type: 'string', maxLength: 100 },

    contactPersonName: { type: 'string', maxLength: 100 },
    contactPersonPhone: { type: 'string', pattern: '^([0-9+ -]{5,20})?$' },
    website: { type: 'string', maxLength: 200 },
    notes: { type: 'string', maxLength: 1000 },
    status: { type: 'string', enum: ['active', 'inactive'] },
  },
};

const updateStatusSchema = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['active', 'inactive'] },
  },
};

const transferLeadToAgentSchema = {
  type: 'object',
  required: ['agentId'],
  additionalProperties: false,
  properties: {
    agentId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    remarks: { type: 'string', maxLength: 500 },
  },
};

module.exports = {
  agentIdParamSchema,
  createAgentSchema,
  updateAgentSchema,
  updateStatusSchema,
  transferLeadToAgentSchema,
};
