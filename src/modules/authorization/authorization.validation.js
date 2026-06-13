'use strict';

// ---------------------------------------------------------------------------
// Authorization Module JSON Schemas for Fastify AJV Input Validation
// ---------------------------------------------------------------------------

const roleIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', pattern: '^[0-9a-fA-F]{24}$', description: 'Mongoose ObjectId' },
  },
};

const createRoleSchema = {
  type: 'object',
  required: ['name', 'code', 'permissions'],
  additionalProperties: false,
  properties: {
    name: { 
      type: 'string', 
      minLength: 2, 
      maxLength: 50, 
      description: 'Human display name of the role' 
    },
    code: { 
      type: 'string', 
      minLength: 2, 
      maxLength: 50, 
      pattern: '^[a-z0-9_]+$', 
      description: 'Unique lowercase identifier slug (lowercase letters, numbers, underscores)' 
    },
    description: { 
      type: 'string', 
      maxLength: 200, 
      description: 'Brief description of the role responsibilities' 
    },
    permissions: {
      type: 'array',
      items: { type: 'string', minLength: 3 },
      uniqueItems: true,
      description: 'List of granular permission keys assigned to this role'
    },
  },
};

const updateRoleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { 
      type: 'string', 
      minLength: 2, 
      maxLength: 50, 
      description: 'Human display name of the role' 
    },
    description: { 
      type: 'string', 
      maxLength: 200, 
      description: 'Brief description of the role responsibilities' 
    },
    permissions: {
      type: 'array',
      items: { type: 'string', minLength: 3 },
      uniqueItems: true,
      description: 'List of granular permission keys assigned to this role'
    },
  },
};

const assignPermissionsSchema = {
  type: 'object',
  required: ['permissions'],
  additionalProperties: false,
  properties: {
    permissions: {
      type: 'array',
      items: { type: 'string', minLength: 3 },
      uniqueItems: true,
      description: 'List of permission keys to replace the current role permissions'
    },
  },
};

module.exports = {
  roleIdParamSchema,
  createRoleSchema,
  updateRoleSchema,
  assignPermissionsSchema,
};
