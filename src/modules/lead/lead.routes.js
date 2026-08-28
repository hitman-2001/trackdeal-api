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
    "/check-duplicate",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_READ)],
      schema: {
        tags: ["Leads"],
        summary: "Check duplicate customer or lead profile by mobile, email, or name",
      },
    },
    controller.checkDuplicate,
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
    "/:id/transfer-agent",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_ASSIGN)],
      schema: {
        tags: ["Leads"],
        summary: "Transfer lead to Agent / Channel Partner",
        params: leadIdParamSchema,
      },
    },
    controller.transferToAgent,
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

  fastify.post(
    "/:id/close-transaction",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Close lead with mandatory real estate transaction details",
        params: leadIdParamSchema,
      },
    },
    controller.closeTransaction,
  );

  // ---------------------------------------------------------------------------
  // Activity Center Routes
  // ---------------------------------------------------------------------------

  fastify.get(
    "/:id/activity-center",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_READ)],
      schema: {
        tags: ["Leads"],
        summary: "Get complete 360° activity center data for a lead",
        params: leadIdParamSchema,
      },
    },
    controller.getActivityCenter,
  );

  fastify.post(
    "/:id/visits",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Record a property / site visit for a lead",
        params: leadIdParamSchema,
      },
    },
    controller.addVisit,
  );

  fastify.get(
    "/:id/visits",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_READ)],
      schema: {
        tags: ["Leads"],
        summary: "List all visits for a lead",
        params: leadIdParamSchema,
      },
    },
    controller.listVisits,
  );

  fastify.put(
    "/:id/activities/:activityId",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Update lead activity",
      },
    },
    controller.updateActivity,
  );

  fastify.delete(
    "/:id/activities/:activityId",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Delete lead activity",
      },
    },
    controller.deleteActivity,
  );

  fastify.put(
    "/:id/visits/:visitId",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Update lead visit",
      },
    },
    controller.updateVisit,
  );

  fastify.delete(
    "/:id/visits/:visitId",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Delete lead visit",
      },
    },
    controller.deleteVisit,
  );

  fastify.post(
    "/:id/quotations",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Record a new rate / quotation for a lead (history-preserving)",
        params: leadIdParamSchema,
      },
    },
    controller.addQuotation,
  );

  fastify.get(
    "/:id/quotations",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_READ)],
      schema: {
        tags: ["Leads"],
        summary: "List all quotations / rate history for a lead",
        params: leadIdParamSchema,
      },
    },
    controller.listQuotations,
  );

  fastify.put(
    "/:id/quotations/:quotationId",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Update lead quotation",
      },
    },
    controller.updateQuotation,
  );

  fastify.delete(
    "/:id/quotations/:quotationId",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Delete lead quotation",
      },
    },
    controller.deleteQuotation,
  );

  fastify.put(
    "/:id/notes/:noteId",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Update lead note",
      },
    },
    controller.updateNote,
  );

  fastify.delete(
    "/:id/notes/:noteId",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Delete lead note",
      },
    },
    controller.deleteNote,
  );

  fastify.put(
    "/:id/follow-ups/:followUpId",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Update lead follow-up",
      },
    },
    controller.updateFollowUp,
  );

  fastify.delete(
    "/:id/follow-ups/:followUpId",
    {
      preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
      schema: {
        tags: ["Leads"],
        summary: "Delete lead follow-up",
      },
    },
    controller.deleteFollowUp,
  );
}

module.exports = leadRoutes;
