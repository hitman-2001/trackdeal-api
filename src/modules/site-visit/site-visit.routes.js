"use strict";

const {
  authenticate,
} = require("../../shared/middleware/authenticate.middleware");
const { authorize } = require("../../shared/middleware/authorize.middleware");
const {
  PERMISSIONS,
} = require("../../shared/constants/roles-permissions.constants");
const { SiteVisitController } = require("./site-visit.controller");

const controller = new SiteVisitController();

async function siteVisitRoutes(fastify, opts) {
  fastify.addHook("preValidation", authenticate);
  fastify.get(
    "/",
    {
      preHandler: [authorize(PERMISSIONS.SITE_VISITS_VIEW)],
      schema: { tags: ["Site Visits"], summary: "List site visits" },
    },
    controller.list,
  );
  fastify.get(
    "/calendar",
    {
      preHandler: [authorize(PERMISSIONS.SITE_VISITS_VIEW)],
      schema: { tags: ["Site Visits"], summary: "Get visit calendar" },
    },
    controller.calendar,
  );
  fastify.get(
    "/:id",
    {
      preHandler: [authorize(PERMISSIONS.SITE_VISITS_VIEW)],
      schema: { tags: ["Site Visits"], summary: "Get visit by ID" },
    },
    controller.getById,
  );
  fastify.post(
    "/",
    {
      preHandler: [authorize(PERMISSIONS.SITE_VISITS_CREATE)],
      schema: { tags: ["Site Visits"], summary: "Schedule site visit" },
    },
    controller.schedule,
  );
  fastify.post(
    "/:id/complete",
    {
      preHandler: [authorize(PERMISSIONS.SITE_VISITS_UPDATE)],
      schema: { tags: ["Site Visits"], summary: "Complete site visit" },
    },
    controller.complete,
  );
  fastify.post(
    "/:id/cancel",
    {
      preHandler: [authorize(PERMISSIONS.SITE_VISITS_UPDATE)],
      schema: { tags: ["Site Visits"], summary: "Cancel site visit" },
    },
    controller.cancel,
  );
}

module.exports = siteVisitRoutes;
