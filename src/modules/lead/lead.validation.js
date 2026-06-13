"use strict";

// ---------------------------------------------------------------------------
// Lead Module JSON Schemas for Fastify AJV Input Validation
// ---------------------------------------------------------------------------

const leadIdParamSchema = {
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

const createLeadSchema = {
  type: "object",
  required: ["firstName", "mobile", "source"],
  additionalProperties: false,
  properties: {
    firstName: { type: "string", minLength: 2, maxLength: 50 },
    lastName: { type: "string", maxLength: 50 },
    mobile: { type: "string", pattern: "^[0-9+ -]{5,20}$" },
    alternativeMobile: { type: "string", pattern: "^[0-9+ -]{5,20}$" },
    email: { type: "string", format: "email" },
    source: {
      type: "string",
      enum: [
        "website",
        "magicbricks",
        "99acres",
        "housing",
        "whatsapp",
        "referral",
        "walk_in",
        "facebook_ads",
        "google_ads",
        "manual_entry",
      ],
    },
    sourceDetails: { type: "string", maxLength: 500 },
    branchId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    assignedTo: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    collaborators: {
      type: "array",
      items: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    },
    requirements: {
      type: "object",
      properties: {
        propertyType: {
          type: "array",
          items: {
            type: "string",
            enum: ["apartment", "villa", "plot", "commercial", "office"],
          },
        },
        budget: {
          type: "object",
          properties: {
            min: { type: "number", minimum: 0 },
            max: { type: "number", minimum: 0 },
            currency: { type: "string", minLength: 3, maxLength: 3 },
          },
        },
        area: {
          type: "object",
          properties: {
            min: { type: "number", minimum: 0 },
            max: { type: "number", minimum: 0 },
            unit: { type: "string" },
          },
        },
        bhk: { type: "array", items: { type: "integer" } },
        locations: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
    },
    tags: { type: "array", items: { type: "string" } },
    customFields: { type: "object" },
  },
};

const updateLeadSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    firstName: { type: "string", minLength: 2, maxLength: 50 },
    lastName: { type: "string", maxLength: 50 },
    mobile: { type: "string", pattern: "^[0-9+ -]{5,20}$" },
    alternativeMobile: { type: "string", pattern: "^[0-9+ -]{5,20}$" },
    email: { type: "string", format: "email" },
    source: {
      type: "string",
      enum: [
        "website",
        "magicbricks",
        "99acres",
        "housing",
        "whatsapp",
        "referral",
        "walk_in",
        "facebook_ads",
        "google_ads",
        "manual_entry",
      ],
    },
    sourceDetails: { type: "string", maxLength: 500 },
    branchId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    assignedTo: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    collaborators: {
      type: "array",
      items: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    },
    requirements: {
      type: "object",
      properties: {
        propertyType: {
          type: "array",
          items: {
            type: "string",
            enum: ["apartment", "villa", "plot", "commercial", "office"],
          },
        },
        budget: {
          type: "object",
          properties: {
            min: { type: "number", minimum: 0 },
            max: { type: "number", minimum: 0 },
            currency: { type: "string", minLength: 3, maxLength: 3 },
          },
        },
        area: {
          type: "object",
          properties: {
            min: { type: "number", minimum: 0 },
            max: { type: "number", minimum: 0 },
            unit: { type: "string" },
          },
        },
        bhk: { type: "array", items: { type: "integer" } },
        locations: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
    },
    tags: { type: "array", items: { type: "string" } },
    customFields: { type: "object" },
  },
};

const assignLeadSchema = {
  type: "object",
  required: ["assignedTo"],
  additionalProperties: false,
  properties: {
    assignedTo: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    reason: { type: "string", maxLength: 200 },
  },
};

const changeStageSchema = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: [
        "new",
        "assigned",
        "contacted",
        "qualified",
        "nurturing",
        "site_visit_scheduled",
        "site_visit_completed",
        "negotiation",
        "booking_initiated",
        "booked",
        "won",
        "booking_defaulted",
        "lost",
      ],
    },
    lostReason: { type: "string", maxLength: 100 },
    lostNotes: { type: "string", maxLength: 500 },
  },
};

const addFollowUpSchema = {
  type: "object",
  required: ["scheduledAt", "type"],
  additionalProperties: false,
  properties: {
    scheduledAt: { type: "string", format: "date-time" },
    type: {
      type: "string",
      enum: ["call", "email", "whatsapp", "visit", "meeting"],
    },
    notes: { type: "string", maxLength: 500 },
    assignedTo: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

const logActivitySchema = {
  type: "object",
  required: ["type", "description"],
  additionalProperties: false,
  properties: {
    type: {
      type: "string",
      enum: ["call", "whatsapp", "meeting", "email", "site_visit", "note", "stage_change", "assignment"],
    },
    description: { type: "string", minLength: 2, maxLength: 1000 },
    metadata: { type: "object" },
  },
};

const addNoteSchema = {
  type: "object",
  required: ["content"],
  additionalProperties: false,
  properties: {
    content: { type: "string", minLength: 1, maxLength: 5000 },
    isPrivate: { type: "boolean" },
  },
};

const bulkAssignSchema = {
  type: "object",
  required: ["leadIds", "assignedTo"],
  additionalProperties: false,
  properties: {
    leadIds: {
      type: "array",
      items: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
      minItems: 1,
    },
    assignedTo: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    reason: { type: "string", maxLength: 200 },
  },
};

const markLostSchema = {
  type: "object",
  required: ["reason"],
  additionalProperties: false,
  properties: {
    reason: { type: "string", minLength: 5, maxLength: 300 },
  },
};

module.exports = {
  leadIdParamSchema,
  createLeadSchema,
  updateLeadSchema,
  assignLeadSchema,
  changeStageSchema,
  addFollowUpSchema,
  logActivitySchema,
  addNoteSchema,
  bulkAssignSchema,
  markLostSchema,
};
