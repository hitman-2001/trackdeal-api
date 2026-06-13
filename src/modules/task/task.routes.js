"use strict";

const {
  authenticate,
} = require("../../shared/middleware/authenticate.middleware");
const {
  requirePermission,
} = require("../../shared/middleware/authorize.middleware");
const {
  PERMISSIONS,
} = require("../../shared/constants/roles-permissions.constants");
const { TaskController } = require("./task.controller");
const {
  taskIdParamSchema,
  createTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
  cancelTaskSchema,
  bulkAssignTasksSchema,
  createActivitySchema,
  scheduleReminderSchema,
  rescheduleReminderSchema,
} = require("./task.validation");

// ---------------------------------------------------------------------------
// Swagger / OpenAPI Shared Component Response Schemas
// ---------------------------------------------------------------------------

const standardErrorSchema = {
  type: "object",
  description: "Standard API error response wrapper",
  properties: {
    success: { type: "boolean", example: false },
    message: { type: "string" },
    errors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
};

const taskResponseSchema = {
  type: "object",
  description: "Task object response wrapper",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string" },
    data: {
      type: "object",
      properties: {
        _id: { type: "string", example: "507f1f77bcf86cd799439011" },
        title: { type: "string", example: "Follow up call" },
        description: { type: "string", example: "Discuss project details" },
        type: { type: "string", example: "call" },
        status: { type: "string", example: "pending" },
        priority: { type: "string", example: "medium" },
        dueDate: { type: "string", format: "date-time", example: "2026-06-01T12:00:00.000Z" },
        assignedTo: { type: "string", example: "507f1f77bcf86cd799439022" },
        organizationId: { type: "string", example: "507f1f77bcf86cd799439033" },
        branchId: { type: "string", example: "507f1f77bcf86cd799439044" },
        leadId: { type: "string", example: "507f1f77bcf86cd799439055" },
        propertyId: { type: "string", example: "507f1f77bcf86cd799439066" },
        dealId: { type: "string" },
        commissionId: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
  },
};

const taskListResponseSchema = {
  type: "object",
  description: "Paginated list of tasks",
  properties: {
    success: { type: "boolean", example: true },
    data: {
      type: "array",
      items: {
        type: "object",
        properties: {
          _id: { type: "string" },
          title: { type: "string" },
          type: { type: "string" },
          status: { type: "string" },
          priority: { type: "string" },
          dueDate: { type: "string", format: "date-time" },
          assignedTo: { type: "string" },
          organizationId: { type: "string" },
          branchId: { type: "string" },
        },
      },
    },
    pagination: {
      type: "object",
      properties: {
        page: { type: "integer", example: 1 },
        limit: { type: "integer", example: 10 },
        total: { type: "integer", example: 25 },
        pages: { type: "integer", example: 3 },
      },
    },
  },
};

const activityResponseSchema = {
  type: "object",
  description: "Activity object response wrapper",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string" },
    data: {
      type: "object",
      properties: {
        _id: { type: "string", example: "507f1f77bcf86cd799439011" },
        type: { type: "string", example: "call" },
        description: { type: "string", example: "Called client to follow up" },
        outcome: { type: "string", example: "connected" },
        duration: { type: "integer", example: 5 },
        organizationId: { type: "string" },
        branchId: { type: "string" },
        leadId: { type: "string" },
        taskId: { type: "string" },
        createdBy: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  },
};

const reminderResponseSchema = {
  type: "object",
  description: "Reminder object response wrapper",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string" },
    data: {
      type: "object",
      properties: {
        _id: { type: "string", example: "507f1f77bcf86cd799439011" },
        taskId: { type: "string" },
        remindAt: { type: "string", format: "date-time" },
        frequency: { type: "string", example: "one_time" },
        channels: { type: "array", items: { type: "string" } },
        status: { type: "string", example: "pending" },
        organizationId: { type: "string" },
        branchId: { type: "string" },
      },
    },
  },
};

const metricsResponseSchema = {
  type: "object",
  description: "Productivity metrics response wrapper",
  properties: {
    success: { type: "boolean", example: true },
    data: {
      type: "object",
      properties: {
        completedTasks: { type: "integer", example: 12 },
        pendingTasks: { type: "integer", example: 5 },
        overdueTasks: { type: "integer", example: 1 },
        totalActivities: { type: "integer", example: 18 },
        completedCalls: { type: "integer", example: 8 },
        completedMeetings: { type: "integer", example: 2 },
        slaEscalationRate: { type: "number", example: 0.05 },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Task Routes Definition
// ---------------------------------------------------------------------------

async function taskRoutes(fastify, opts) {
  const controller = new TaskController();
  fastify.addHook("preValidation", authenticate);

  fastify.get(
    "/",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_READ)],
      schema: {
        tags: ["Tasks"],
        summary: "List tasks",
        description: "Retrieve a paginated list of tasks scoped under the user's organization and branch isolation rules. Supports search, filter, and pagination.",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 10 },
            status: { type: "string", enum: ["pending", "in_progress", "completed", "missed", "cancelled", ""] },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent", ""] },
            type: { type: "string", enum: ["call", "whatsapp", "email", "site_visit", "meeting", "document", "payment", "general", ""] },
            assignedTo: { type: "string", pattern: "^([0-9a-fA-F]{24})?$" },
            leadId: { type: "string", pattern: "^([0-9a-fA-F]{24})?$" },
            dealId: { type: "string", pattern: "^([0-9a-fA-F]{24})?$" },
            search: { type: "string" },
            dateRange: { type: "string" },
          },
        },
        response: {
          200: taskListResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.list,
  );

  fastify.get(
    "/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_READ)],
      schema: {
        tags: ["Tasks"],
        summary: "Get task by ID",
        description: "Retrieve a specific task by its unique ID. Enforces strict organization isolation.",
        params: taskIdParamSchema,
        response: {
          200: taskResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.getById,
  );

  fastify.post(
    "/",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Tasks"],
        summary: "Create task",
        description: "Create a new task under the current organization and branch context. Validates model, assigned agent, and scheduled date.",
        body: createTaskSchema,
        response: {
          201: taskResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.create,
  );

  fastify.put(
    "/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Tasks"],
        summary: "Update task",
        description: "Update details of an existing task. Enforces won-state immutability and tenant limits.",
        params: taskIdParamSchema,
        body: updateTaskSchema,
        response: {
          200: taskResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.update,
  );

  fastify.delete(
    "/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_DELETE)],
      schema: {
        tags: ["Tasks"],
        summary: "Delete task",
        description: "Soft-delete a task from the system.",
        params: taskIdParamSchema,
        response: {
          204: {
            type: "null",
            description: "No Content on successful deletion",
          },
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.remove,
  );

  fastify.post(
    "/:id/assign",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_ASSIGN)],
      schema: {
        tags: ["Tasks"],
        summary: "Assign task",
        description: "Assign a task to a specific active agent within the same organization.",
        params: taskIdParamSchema,
        body: {
          type: "object",
          required: ["assignedTo"],
          properties: {
            assignedTo: {
              type: "string",
              pattern: "^[0-9a-fA-F]{24}$",
              description: "Agent Mongoose ObjectId",
            },
          },
        },
        response: {
          200: taskResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.assign,
  );

  fastify.post(
    "/bulk-assign",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_ASSIGN)],
      schema: {
        tags: ["Tasks"],
        summary: "Bulk assign tasks",
        description: "Assign multiple tasks to an agent simultaneously.",
        body: bulkAssignTasksSchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    _id: { type: "string" },
                    assignedTo: { type: "string" },
                  },
                },
              },
            },
          },
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.bulkAssign,
  );

  fastify.post(
    "/:id/complete",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Tasks"],
        summary: "Complete task and log activity",
        description: "Mark a task as completed and automatically log a corresponding activity log entry in the system.",
        params: taskIdParamSchema,
        body: completeTaskSchema,
        response: {
          200: taskResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.complete,
  );

  fastify.post(
    "/:id/cancel",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Tasks"],
        summary: "Cancel task",
        description: "Cancel a pending task with a mandatory cancellation reason.",
        params: taskIdParamSchema,
        body: cancelTaskSchema,
        response: {
          200: taskResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.cancel,
  );

  fastify.post(
    "/activities",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Tasks"],
        summary: "Log completed activity directly",
        description: "Directly log a completed outreach activity (call, whatsapp, meeting, etc.) without pre-scheduling a task.",
        body: createActivitySchema,
        response: {
          201: activityResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.logActivity,
  );

  fastify.post(
    "/reminders",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Tasks"],
        summary: "Schedule notification reminder",
        description: "Schedule a push, email or whatsapp notification reminder for a scheduled task or event.",
        body: scheduleReminderSchema,
        response: {
          201: reminderResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.scheduleReminder,
  );

  fastify.put(
    "/reminders/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Tasks"],
        summary: "Reschedule notification reminder",
        description: "Reschedule an existing pending notification reminder to a new future timestamp.",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" } },
        },
        body: rescheduleReminderSchema,
        response: {
          200: reminderResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.rescheduleReminder,
  );

  fastify.delete(
    "/reminders/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Tasks"],
        summary: "Cancel notification reminder",
        description: "Cancel and remove a pending notification reminder.",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" } },
        },
        response: {
          200: reminderResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.cancelReminder,
  );

  fastify.get(
    "/metrics",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_READ)],
      schema: {
        tags: ["Tasks"],
        summary: "Get agent productivity metrics",
        description: "Fetch agent task completion, activity metrics, and response times.",
        querystring: {
          type: "object",
          properties: {
            agentId: { type: "string", pattern: "^[0-9a-fA-F]{24}$", description: "Filter by agent ID (defaults to active user)" },
          },
        },
        response: {
          200: metricsResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.getMetrics,
  );
}

module.exports = taskRoutes;
