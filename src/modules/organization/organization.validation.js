'use strict';

// ---------------------------------------------------------------------------
// Organization Module JSON Schemas for Fastify AJV Input Validation
// ---------------------------------------------------------------------------

const orgIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', pattern: '^[0-9a-fA-F]{24}$', description: 'Mongoose ObjectId' },
  },
};

const createOrganizationSchema = {
  type: 'object',
  required: ['name', 'code', 'organizationType', 'adminEmail'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 },
    code: { type: 'string', minLength: 2, maxLength: 50, pattern: '^[a-z0-9_-]+$' },
    adminEmail: { type: 'string', format: 'email' },
    legalName: { type: 'string', maxLength: 100 },
    registrationNumber: { type: 'string', maxLength: 50 },
    gstNumber: { type: 'string', maxLength: 15 },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string', minLength: 5, maxLength: 20 },
    website: { type: 'string', maxLength: 100 },
    address: { type: 'string', maxLength: 200 },
    city: { type: 'string', maxLength: 50 },
    state: { type: 'string', maxLength: 50 },
    country: { type: 'string', maxLength: 50 },
    postalCode: { type: 'string', maxLength: 20 },
    organizationType: { type: 'string', enum: ['INDIVIDUAL_AGENT', 'AGENCY', 'ENTERPRISE_AGENCY'] },
    subscription: {
      type: 'object',
      properties: {
        plan: { type: 'string', enum: ['individual', 'starter', 'growth', 'enterprise'] },
        status: { type: 'string', enum: ['active', 'suspended', 'cancelled', 'trial'] },
        maxUsers: { type: 'integer', minimum: 1 },
        maxBranches: { type: 'integer', minimum: 0 },
        storageLimit: { type: 'integer', minimum: 0 },
      },
    },
    branding: {
      type: 'object',
      properties: {
        primaryColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        secondaryColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        logoUrl: { type: 'string' },
        faviconUrl: { type: 'string' },
      },
    },
    settings: {
      type: 'object',
      properties: {
        timezone: { type: 'string' },
        currency: { type: 'string', minLength: 3, maxLength: 3 },
        dateFormat: { type: 'string' },
      },
    },
  },
};

const updateOrganizationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 },
    legalName: { type: 'string', maxLength: 100 },
    registrationNumber: { type: 'string', maxLength: 50 },
    gstNumber: { type: 'string', maxLength: 15 },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string', minLength: 5, maxLength: 20 },
    website: { type: 'string', maxLength: 100 },
    address: { type: 'string', maxLength: 200 },
    city: { type: 'string', maxLength: 50 },
    state: { type: 'string', maxLength: 50 },
    country: { type: 'string', maxLength: 50 },
    postalCode: { type: 'string', maxLength: 20 },
    subscription: {
      type: 'object',
      properties: {
        plan: { type: 'string', enum: ['individual', 'starter', 'growth', 'enterprise'] },
        status: { type: 'string', enum: ['active', 'suspended', 'cancelled', 'trial'] },
        maxUsers: { type: 'integer', minimum: 1 },
        maxBranches: { type: 'integer', minimum: 0 },
        storageLimit: { type: 'integer', minimum: 0 },
      },
    },
    branding: {
      type: 'object',
      properties: {
        primaryColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        secondaryColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        logoUrl: { type: 'string' },
        faviconUrl: { type: 'string' },
      },
    },
    settings: {
      type: 'object',
      properties: {
        timezone: { type: 'string' },
        currency: { type: 'string', minLength: 3, maxLength: 3 },
        dateFormat: { type: 'string' },
      },
    },
  },
};

module.exports = {
  orgIdParamSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
};
