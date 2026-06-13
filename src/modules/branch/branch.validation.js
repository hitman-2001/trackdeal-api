'use strict';

// ---------------------------------------------------------------------------
// Branch Module JSON Schemas for Fastify AJV Input Validation
// ---------------------------------------------------------------------------

const branchIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', pattern: '^[0-9a-fA-F]{24}$', description: 'Mongoose ObjectId' },
  },
};

const createBranchSchema = {
  type: 'object',
  required: ['name', 'code'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 },
    code: { type: 'string', minLength: 2, maxLength: 50, pattern: '^[a-z0-9_-]+$' },
    manager: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string', minLength: 5, maxLength: 20 },
    address: {
      type: 'object',
      properties: {
        city: { type: 'string', maxLength: 50 },
        state: { type: 'string', maxLength: 50 },
        country: { type: 'string', maxLength: 50 },
        postalCode: { type: 'string', maxLength: 20 },
      },
    },
  },
};

const updateBranchSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 },
    manager: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string', minLength: 5, maxLength: 20 },
    address: {
      type: 'object',
      properties: {
        city: { type: 'string', maxLength: 50 },
        state: { type: 'string', maxLength: 50 },
        country: { type: 'string', maxLength: 50 },
        postalCode: { type: 'string', maxLength: 20 },
      },
    },
  },
};

module.exports = {
  branchIdParamSchema,
  createBranchSchema,
  updateBranchSchema,
};
