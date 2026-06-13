"use strict";

// ---------------------------------------------------------------------------
// Property & Project Management Module AJV Validation Schemas
// ---------------------------------------------------------------------------

const projectIdParamSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: {
      type: "string",
      pattern: "^[0-9a-fA-F]{24}$",
      description: "Mongoose ObjectId",
    },
  },
};

// ---------------------------------------------------------------------------
// Builder Validation Schemas
// ---------------------------------------------------------------------------

const createBuilderSchema = {
  type: "object",
  required: ["name", "code"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 2, maxLength: 100 },
    code: {
      type: "string",
      minLength: 2,
      maxLength: 20,
      pattern: "^[a-zA-Z0-9_-]+$",
    },
    email: { type: "string", format: "email" },
    phone: { type: "string" },
    website: { type: "string" },
    address: { type: "string" },
    rera: { type: "string" },
    bankName: { type: "string" },
    bankIfsc: { type: "string" },
    bankAccount: { type: "string" },
    bankHolder: { type: "string" },
    branchId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

const updateBuilderSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 2, maxLength: 100 },
    email: { type: "string", format: "email" },
    phone: { type: "string" },
    website: { type: "string" },
    address: { type: "string" },
    rera: { type: "string" },
    bankName: { type: "string" },
    bankIfsc: { type: "string" },
    bankAccount: { type: "string" },
    bankHolder: { type: "string" },
    branchId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

// ---------------------------------------------------------------------------
// Amenity Validation Schemas
// ---------------------------------------------------------------------------

const createAmenitySchema = {
  type: "object",
  required: ["name", "code"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 2, maxLength: 50 },
    code: {
      type: "string",
      minLength: 2,
      maxLength: 20,
      pattern: "^[a-zA-Z0-9_-]+$",
    },
    description: { type: "string", maxLength: 500 },
    branchId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

const updateAmenitySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 2, maxLength: 50 },
    description: { type: "string", maxLength: 500 },
    branchId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

// ---------------------------------------------------------------------------
// Project Validation Schemas
// ---------------------------------------------------------------------------

const createProjectSchema = {
  type: "object",
  required: ["builderId", "name", "code", "city"],
  additionalProperties: false,
  properties: {
    builderId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    name: { type: "string", minLength: 2, maxLength: 100 },
    code: {
      type: "string",
      minLength: 2,
      maxLength: 20,
      pattern: "^[a-zA-Z0-9_-]+$",
    },
    city: { type: "string", minLength: 2, maxLength: 100 },
    locality: { type: "string" },
    address: { type: "string" },
    rera: { type: "string" },
    status: {
      type: "string",
      enum: ["upcoming", "under_construction", "ready_to_move", "sold_out"],
    },
    amenities: {
      type: "array",
      items: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    },
    branchId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

const updateProjectSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    builderId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    name: { type: "string", minLength: 2, maxLength: 100 },
    city: { type: "string", minLength: 2, maxLength: 100 },
    locality: { type: "string" },
    address: { type: "string" },
    rera: { type: "string" },
    status: {
      type: "string",
      enum: ["upcoming", "under_construction", "ready_to_move", "sold_out"],
    },
    amenities: {
      type: "array",
      items: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    },
    branchId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

// ---------------------------------------------------------------------------
// Tower Validation Schemas
// ---------------------------------------------------------------------------

const createTowerSchema = {
  type: "object",
  required: ["projectId", "name", "code"],
  additionalProperties: false,
  properties: {
    projectId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    name: { type: "string", minLength: 1, maxLength: 100 },
    code: {
      type: "string",
      minLength: 1,
      maxLength: 20,
      pattern: "^[a-zA-Z0-9_-]+$",
    },
    branchId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

const updateTowerSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100 },
    branchId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

// ---------------------------------------------------------------------------
// Unit Validation Schemas
// ---------------------------------------------------------------------------

const createUnitSchema = {
  type: "object",
  required: [
    "projectId",
    "towerId",
    "unitNumber",
    "configuration",
    "carpetArea",
    "price",
  ],
  additionalProperties: false,
  properties: {
    projectId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    towerId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    unitNumber: { type: "string", minLength: 1, maxLength: 50 },
    configuration: {
      type: "string",
      enum: [
        "1BHK",
        "2BHK",
        "3BHK",
        "4BHK",
        "5BHK",
        "penthouse",
        "villa",
        "studio",
        "commercial",
        "office",
        "shop",
        "other",
      ],
    },
    carpetArea: { type: "number", minimum: 1 },
    builtUpArea: { type: "number", minimum: 1 },
    price: { type: "number", minimum: 1 },
    branchId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

const updateUnitSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    unitNumber: { type: "string", minLength: 1, maxLength: 50 },
    configuration: {
      type: "string",
      enum: [
        "1BHK",
        "2BHK",
        "3BHK",
        "4BHK",
        "5BHK",
        "penthouse",
        "villa",
        "studio",
        "commercial",
        "office",
        "shop",
        "other",
      ],
    },
    carpetArea: { type: "number", minimum: 1 },
    builtUpArea: { type: "number", minimum: 1 },
    price: { type: "number", minimum: 1 },
    branchId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

const blockUnitSchema = {
  type: "object",
  required: ["lockedBy", "lockedDurationMinutes"],
  additionalProperties: false,
  properties: {
    lockedBy: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    lockedDurationMinutes: { type: "integer", minimum: 1 },
  },
};

const reserveUnitSchema = {
  type: "object",
  required: ["reservedByLeadId"],
  additionalProperties: false,
  properties: {
    reservedByLeadId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

const markUnitSoldSchema = {
  type: "object",
  required: ["soldToCustomerId", "soldPrice", "soldDate"],
  additionalProperties: false,
  properties: {
    soldToCustomerId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    soldPrice: { type: "number", minimum: 1 },
    soldDate: { type: "string", format: "date-time" },
  },
};

module.exports = {
  projectIdParamSchema,
  createBuilderSchema,
  updateBuilderSchema,
  createAmenitySchema,
  updateAmenitySchema,
  createProjectSchema,
  updateProjectSchema,
  createTowerSchema,
  updateTowerSchema,
  createUnitSchema,
  updateUnitSchema,
  blockUnitSchema,
  reserveUnitSchema,
  markUnitSoldSchema,
};
