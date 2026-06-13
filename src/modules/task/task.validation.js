"use strict";

// ---------------------------------------------------------------------------
// Tasks & Activities Module AJV Validation Schemas
// ---------------------------------------------------------------------------

const taskIdParamSchema = {
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

const createTaskSchema = {
  type: "object",
  required: ["title", "type", "dueDate", "assignedTo"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 2, maxLength: 150 },
    description: { type: "string", maxLength: 2000 },
    type: {
      type: "string",
      enum: ["call", "whatsapp", "email", "site_visit", "meeting", "document", "payment", "general"],
    },
    priority: {
      type: "string",
      enum: ["low", "medium", "high", "urgent"],
    },
    dueDate: { type: "string", format: "date-time" },
    assignedTo: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },

    // Relationships
    leadId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    propertyId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    dealId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    commissionId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

const updateTaskSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 2, maxLength: 150 },
    description: { type: "string", maxLength: 2000 },
    type: {
      type: "string",
      enum: ["call", "whatsapp", "email", "site_visit", "meeting", "document", "payment", "general"],
    },
    status: {
      type: "string",
      enum: ["pending", "in_progress", "completed", "missed", "cancelled"],
    },
    priority: {
      type: "string",
      enum: ["low", "medium", "high", "urgent"],
    },
    dueDate: { type: "string", format: "date-time" },
    assignedTo: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },

    // Relationships
    leadId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    propertyId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    dealId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    commissionId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

const completeTaskSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    outcome: { type: "string", maxLength: 500 },
    notes: { type: "string", maxLength: 1000 },
  },
};

const cancelTaskSchema = {
  type: "object",
  required: ["cancellationReason"],
  additionalProperties: false,
  properties: {
    cancellationReason: { type: "string", minLength: 3, maxLength: 500 },
  },
};

const bulkAssignTasksSchema = {
  type: "object",
  required: ["taskIds", "assignedTo"],
  additionalProperties: false,
  properties: {
    taskIds: {
      type: "array",
      items: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
      minItems: 1,
    },
    assignedTo: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

const createActivitySchema = {
  type: "object",
  required: ["type", "description"],
  additionalProperties: false,
  properties: {
    type: {
      type: "string",
      enum: ["call", "whatsapp", "email", "site_visit", "meeting", "note"],
    },
    description: { type: "string", minLength: 2, maxLength: 2000 },
    outcome: { type: "string", maxLength: 200 },
    duration: { type: "integer", minimum: 0 },

    // Relationships
    leadId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    propertyId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    dealId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    taskId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
};

const scheduleReminderSchema = {
  type: "object",
  required: ["taskId", "remindAt", "channels"],
  additionalProperties: false,
  properties: {
    taskId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    remindAt: { type: "string", format: "date-time" },
    frequency: {
      type: "string",
      enum: ["one_time", "daily", "weekly", "monthly"],
    },
    channels: {
      type: "array",
      items: { type: "string", enum: ["in_app", "email", "whatsapp"] },
      minItems: 1,
    },
  },
};

const rescheduleReminderSchema = {
  type: "object",
  required: ["remindAt"],
  additionalProperties: false,
  properties: {
    remindAt: { type: "string", format: "date-time" },
  },
};

module.exports = {
  taskIdParamSchema,
  createTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
  cancelTaskSchema,
  bulkAssignTasksSchema,
  createActivitySchema,
  scheduleReminderSchema,
  rescheduleReminderSchema,
};
