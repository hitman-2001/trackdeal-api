'use strict';

// ---------------------------------------------------------------------------
// User Module JSON Schemas for Fastify AJV Input Validation
// ---------------------------------------------------------------------------

const userIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', pattern: '^[0-9a-fA-F]{24}$', description: 'Mongoose ObjectId' },
  },
};

const createUserSchema = {
  type: 'object',
  required: ['firstName', 'lastName', 'email', 'password', 'roleId'],
  additionalProperties: false,
  properties: {
    firstName: { type: 'string', minLength: 2, maxLength: 50 },
    lastName: { type: 'string', minLength: 2, maxLength: 50 },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string', pattern: '^[0-9+ -]{5,20}$' },
    mobile: { type: 'string', pattern: '^[0-9+ -]{5,20}$' }, // Keep for legacy fields
    password: { type: 'string', minLength: 8, maxLength: 100 },
    roleId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    branchId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$', nullable: true },
    employeeCode: { type: 'string', maxLength: 50 },
    designation: { type: 'string', maxLength: 100 },
    joiningDate: { type: 'string', format: 'date-time' },
    preferences: {
      type: 'object',
      properties: {
        timezone: { type: 'string' },
        language: { type: 'string', minLength: 2, maxLength: 5 },
        dateFormat: { type: 'string' },
        currency: { type: 'string', minLength: 3, maxLength: 3 },
      },
    },
    notes: { type: 'string', maxLength: 500 },
  },
};

const updateUserSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    firstName: { type: 'string', minLength: 2, maxLength: 50 },
    lastName: { type: 'string', minLength: 2, maxLength: 50 },
    phone: { type: 'string', pattern: '^[0-9+ -]{5,20}$' },
    mobile: { type: 'string', pattern: '^[0-9+ -]{5,20}$' },
    employeeCode: { type: 'string', maxLength: 50 },
    designation: { type: 'string', maxLength: 100 },
    joiningDate: { type: 'string', format: 'date-time' },
    preferences: {
      type: 'object',
      properties: {
        timezone: { type: 'string' },
        language: { type: 'string', minLength: 2, maxLength: 5 },
        dateFormat: { type: 'string' },
        currency: { type: 'string', minLength: 3, maxLength: 3 },
      },
    },
    notes: { type: 'string', maxLength: 500 },
  },
};

const assignRoleSchema = {
  type: 'object',
  required: ['roleId'],
  additionalProperties: false,
  properties: {
    roleId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
  },
};

const assignBranchSchema = {
  type: 'object',
  required: ['branchId'],
  additionalProperties: false,
  properties: {
    branchId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$', nullable: true },
  },
};

const transferBranchSchema = {
  type: 'object',
  required: ['branchId'],
  additionalProperties: false,
  properties: {
    branchId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$', nullable: true },
  },
};

const inviteUserSchema = {
  type: 'object',
  required: ['email', 'roleId'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email' },
    roleId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    branchId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$', nullable: true },
  },
};

const cancelInviteSchema = {
  type: 'object',
  required: ['email'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email' },
  },
};

const resendInviteSchema = {
  type: 'object',
  required: ['email'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email' },
  },
};

const acceptInviteSchema = {
  type: 'object',
  required: ['invitationToken', 'password'],
  additionalProperties: false,
  properties: {
    invitationToken: { type: 'string', minLength: 10 },
    password: { type: 'string', minLength: 8, maxLength: 100 },
  },
};

const updateProfileSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    firstName: { type: 'string', minLength: 2, maxLength: 50 },
    lastName: { type: 'string', minLength: 2, maxLength: 50 },
    phone: { type: 'string', pattern: '^[0-9+ -]{5,20}$' },
    mobile: { type: 'string', pattern: '^[0-9+ -]{5,20}$' },
    preferences: {
      type: 'object',
      properties: {
        timezone: { type: 'string' },
        language: { type: 'string', minLength: 2, maxLength: 5 },
        dateFormat: { type: 'string' },
        currency: { type: 'string', minLength: 3, maxLength: 3 },
      },
    },
    notes: { type: 'string', maxLength: 500 },
  },
};

const changePasswordSchema = {
  type: 'object',
  required: ['oldPassword', 'newPassword'],
  additionalProperties: false,
  properties: {
    oldPassword: { type: 'string', minLength: 8 },
    newPassword: { type: 'string', minLength: 8, maxLength: 100 },
  },
};

module.exports = {
  userIdParamSchema,
  createUserSchema,
  updateUserSchema,
  assignRoleSchema,
  assignBranchSchema,
  transferBranchSchema,
  inviteUserSchema,
  cancelInviteSchema,
  resendInviteSchema,
  acceptInviteSchema,
  updateProfileSchema,
  changePasswordSchema,
};
