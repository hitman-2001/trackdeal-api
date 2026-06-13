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
const { LeadController } = require("./lead.controller");
const {
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
} = require("./lead.validation");

async function leadRoutes(fastify, opts) {
  const controller = new LeadController();
  fastify.addHook("preValidation", authenticate);

  fastify.get(
    "/",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_READ)],
      schema: {
        tags: ["Leads"],
        summary: "List leads",
      },
    },
    controller.list,
  );

  fastify.get(
    "/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_READ)],
      schema: {
        tags: ["Leads"],
        summary: "Get lead by ID",
        params: leadIdParamSchema,
      },
    },
    controller.getById,
  );

  fastify.post(
    "/",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_CREATE)],
      schema: {
        tags: ["Leads"],
        summary: "Create lead",
        body: createLeadSchema,
      },
    },
    controller.create,
  );

  fastify.put(
    "/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Update lead",
        params: leadIdParamSchema,
        body: updateLeadSchema,
      },
    },
    controller.update,
  );

  fastify.delete(
    "/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_DELETE)],
      schema: {
        tags: ["Leads"],
        summary: "Delete lead",
        params: leadIdParamSchema,
      },
    },
    controller.remove,
  );

  fastify.post(
    "/:id/assign",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_ASSIGN)],
      schema: {
        tags: ["Leads"],
        summary: "Assign lead",
        params: leadIdParamSchema,
        body: assignLeadSchema,
      },
    },
    controller.assign,
  );

  fastify.post(
    "/bulk-assign",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_ASSIGN)],
      schema: {
        tags: ["Leads"],
        summary: "Bulk assign leads",
        body: bulkAssignSchema,
      },
    },
    controller.bulkAssign,
  );

  fastify.post(
    "/:id/stage",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Change lead stage",
        params: leadIdParamSchema,
        body: changeStageSchema,
      },
    },
    controller.changeStage,
  );

  fastify.post(
    "/:id/notes",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Add internal note",
        params: leadIdParamSchema,
        body: addNoteSchema,
      },
    },
    controller.addNote,
  );

  fastify.post(
    "/:id/activities",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Log manual activity",
        params: leadIdParamSchema,
        body: logActivitySchema,
      },
    },
    controller.logActivity,
  );

  fastify.post(
    "/:id/follow-up",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Add follow-up",
        params: leadIdParamSchema,
        body: addFollowUpSchema,
      },
    },
    controller.addFollowUp,
  );

  fastify.post(
    "/:id/reopen",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Reopen a lost lead",
        params: leadIdParamSchema,
      },
    },
    controller.reopen,
  );

  fastify.post(
    "/:id/won",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Mark lead as won",
        params: leadIdParamSchema,
      },
    },
    controller.markWon,
  );

  fastify.post(
    "/:id/lost",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Mark lead as lost",
        params: leadIdParamSchema,
        body: markLostSchema,
      },
    },
    controller.markLost,
  );
}

module.exports = leadRoutes;
