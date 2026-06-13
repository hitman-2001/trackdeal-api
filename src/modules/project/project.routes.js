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
const { ProjectController } = require("./project.controller");
const {
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
} = require("./project.validation");

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

const builderResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string" },
    data: {
      type: "object",
      properties: {
        _id: { type: "string" },
        name: { type: "string", example: "Prestige Group" },
        code: { type: "string", example: "PRESTIGE" },
        email: { type: "string" },
        phone: { type: "string" },
        website: { type: "string" },
        address: { type: "string" },
      },
    },
  },
};

const builderListResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    data: {
      type: "array",
      items: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string" },
          code: { type: "string" },
        },
      },
    },
    pagination: {
      type: "object",
      properties: {
        page: { type: "integer", example: 1 },
        limit: { type: "integer", example: 20 },
        total: { type: "integer", example: 5 },
        pages: { type: "integer", example: 1 },
      },
    },
  },
};

const projectResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string" },
    data: {
      type: "object",
      properties: {
        _id: { type: "string" },
        name: { type: "string", example: "Prestige Lakeside" },
        code: { type: "string", example: "P_LAKESIDE" },
        builderId: { type: "string" },
        city: { type: "string" },
        locality: { type: "string" },
        address: { type: "string" },
        status: { type: "string" },
        amenities: { type: "array", items: { type: "string" } },
      },
    },
  },
};

const projectListResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    data: {
      type: "array",
      items: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string" },
          code: { type: "string" },
          status: { type: "string" },
        },
      },
    },
    pagination: {
      type: "object",
      properties: {
        page: { type: "integer" },
        limit: { type: "integer" },
        total: { type: "integer" },
        pages: { type: "integer" },
      },
    },
  },
};

const towerResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string" },
    data: {
      type: "object",
      properties: {
        _id: { type: "string" },
        name: { type: "string", example: "Tower A" },
        code: { type: "string", example: "TOWER_A" },
        projectId: { type: "string" },
      },
    },
  },
};

const towerListResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    data: {
      type: "array",
      items: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string" },
          code: { type: "string" },
          projectId: { type: "string" },
        },
      },
    },
  },
};

const unitResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string" },
    data: {
      type: "object",
      properties: {
        _id: { type: "string" },
        unitNumber: { type: "string", example: "A-102" },
        configuration: { type: "string", example: "3BHK" },
        carpetArea: { type: "number" },
        price: { type: "number" },
        availability: { type: "string" },
        projectId: { type: "string" },
        towerId: { type: "string" },
      },
    },
  },
};

const unitListResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    data: {
      type: "array",
      items: {
        type: "object",
        properties: {
          _id: { type: "string" },
          unitNumber: { type: "string" },
          configuration: { type: "string" },
          price: { type: "number" },
          availability: { type: "string" },
        },
      },
    },
  },
};

const amenityResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string" },
    data: {
      type: "object",
      properties: {
        _id: { type: "string" },
        name: { type: "string", example: "Swimming Pool" },
        code: { type: "string", example: "POOL" },
        description: { type: "string" },
      },
    },
  },
};

const amenityListResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    data: {
      type: "array",
      items: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string" },
          code: { type: "string" },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Project & Property Routes Definition
// ---------------------------------------------------------------------------

async function projectRoutes(fastify, opts) {
  const controller = new ProjectController();
  fastify.addHook("preValidation", authenticate);

  // ---------------------------------------------------------------------------
  // Builders
  // ---------------------------------------------------------------------------

  fastify.get(
    "/builders",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_READ)],
      schema: {
        tags: ["Projects"],
        summary: "List builders",
        description: "List real estate builder developers scoped to parent organization context.",
        response: {
          200: builderListResponseSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.listBuilders.bind(controller),
  );

  fastify.get(
    "/builders/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_READ)],
      schema: {
        tags: ["Projects"],
        summary: "Get builder details by ID",
        params: projectIdParamSchema,
        response: {
          200: builderResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.getBuilderById.bind(controller),
  );

  fastify.post(
    "/builders",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_CREATE)],
      schema: {
        tags: ["Projects"],
        summary: "Create builder",
        body: createBuilderSchema,
        response: {
          201: builderResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.createBuilder.bind(controller),
  );

  fastify.put(
    "/builders/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_UPDATE)],
      schema: {
        tags: ["Projects"],
        summary: "Update builder details",
        params: projectIdParamSchema,
        body: updateBuilderSchema,
        response: {
          200: builderResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.updateBuilder.bind(controller),
  );

  fastify.delete(
    "/builders/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_DELETE)],
      schema: {
        tags: ["Projects"],
        summary: "Archive builder",
        params: projectIdParamSchema,
        response: {
          204: { type: "null", description: "No Content" },
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.removeBuilder.bind(controller),
  );

  // ---------------------------------------------------------------------------
  // Amenities
  // ---------------------------------------------------------------------------

  fastify.get(
    "/amenities",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_READ)],
      schema: {
        tags: ["Projects"],
        summary: "List amenities",
        response: {
          200: amenityListResponseSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.listAmenities.bind(controller),
  );

  fastify.get(
    "/amenities/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_READ)],
      schema: {
        tags: ["Projects"],
        summary: "Get amenity details",
        params: projectIdParamSchema,
        response: {
          200: amenityResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.getAmenityById.bind(controller),
  );

  fastify.post(
    "/amenities",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_CREATE)],
      schema: {
        tags: ["Projects"],
        summary: "Create amenity",
        body: createAmenitySchema,
        response: {
          201: amenityResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.createAmenity.bind(controller),
  );

  fastify.put(
    "/amenities/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_UPDATE)],
      schema: {
        tags: ["Projects"],
        summary: "Update amenity details",
        params: projectIdParamSchema,
        body: updateAmenitySchema,
        response: {
          200: amenityResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.updateAmenity.bind(controller),
  );

  fastify.delete(
    "/amenities/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_DELETE)],
      schema: {
        tags: ["Projects"],
        summary: "Archive amenity",
        params: projectIdParamSchema,
        response: {
          204: { type: "null", description: "No Content" },
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.removeAmenity.bind(controller),
  );

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------

  fastify.get(
    "/projects",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_READ)],
      schema: {
        tags: ["Projects"],
        summary: "List projects",
        response: {
          200: projectListResponseSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.listProjects.bind(controller),
  );

  fastify.get(
    "/projects/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_READ)],
      schema: {
        tags: ["Projects"],
        summary: "Get project details",
        params: projectIdParamSchema,
        response: {
          200: projectResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.getProjectById.bind(controller),
  );

  fastify.post(
    "/projects",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_CREATE)],
      schema: {
        tags: ["Projects"],
        summary: "Create project",
        body: createProjectSchema,
        response: {
          201: projectResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.createProject.bind(controller),
  );

  fastify.put(
    "/projects/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_UPDATE)],
      schema: {
        tags: ["Projects"],
        summary: "Update project details",
        params: projectIdParamSchema,
        body: updateProjectSchema,
        response: {
          200: projectResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.updateProject.bind(controller),
  );

  fastify.delete(
    "/projects/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_DELETE)],
      schema: {
        tags: ["Projects"],
        summary: "Archive project (cascades delete on Towers and Units)",
        params: projectIdParamSchema,
        response: {
          204: { type: "null", description: "No Content" },
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.removeProject.bind(controller),
  );

  // ---------------------------------------------------------------------------
  // Towers
  // ---------------------------------------------------------------------------

  fastify.get(
    "/towers",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_READ)],
      schema: {
        tags: ["Projects"],
        summary: "List towers",
        response: {
          200: towerListResponseSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.listTowers.bind(controller),
  );

  fastify.get(
    "/towers/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_READ)],
      schema: {
        tags: ["Projects"],
        summary: "Get tower details",
        params: projectIdParamSchema,
        response: {
          200: towerResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.getTowerById.bind(controller),
  );

  fastify.post(
    "/towers",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_CREATE)],
      schema: {
        tags: ["Projects"],
        summary: "Create tower",
        body: createTowerSchema,
        response: {
          201: towerResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.createTower.bind(controller),
  );

  fastify.put(
    "/towers/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_UPDATE)],
      schema: {
        tags: ["Projects"],
        summary: "Update tower details",
        params: projectIdParamSchema,
        body: updateTowerSchema,
        response: {
          200: towerResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.updateTower.bind(controller),
  );

  // ---------------------------------------------------------------------------
  // Units
  // ---------------------------------------------------------------------------

  fastify.get(
    "/units",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_READ)],
      schema: {
        tags: ["Projects"],
        summary: "List units",
        response: {
          200: unitListResponseSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.listUnits.bind(controller),
  );

  fastify.get(
    "/units/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_READ)],
      schema: {
        tags: ["Projects"],
        summary: "Get unit details",
        params: projectIdParamSchema,
        response: {
          200: unitResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.getUnitById.bind(controller),
  );

  fastify.post(
    "/units",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_CREATE)],
      schema: {
        tags: ["Projects"],
        summary: "Create unit",
        body: createUnitSchema,
        response: {
          201: unitResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
        },
      },
    },
    controller.createUnit.bind(controller),
  );

  fastify.put(
    "/units/:id",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_UPDATE)],
      schema: {
        tags: ["Projects"],
        summary: "Update unit details",
        params: projectIdParamSchema,
        body: updateUnitSchema,
        response: {
          200: unitResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.updateUnit.bind(controller),
  );

  fastify.post(
    "/units/:id/block",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_UPDATE)],
      schema: {
        tags: ["Projects"],
        summary: "Block unit / lock inventory",
        params: projectIdParamSchema,
        body: blockUnitSchema,
        response: {
          200: unitResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.blockUnit.bind(controller),
  );

  fastify.post(
    "/units/:id/reserve",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_UPDATE)],
      schema: {
        tags: ["Projects"],
        summary: "Reserve unit for lead",
        params: projectIdParamSchema,
        body: reserveUnitSchema,
        response: {
          200: unitResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.reserveUnit.bind(controller),
  );

  fastify.post(
    "/units/:id/sold",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_UPDATE)],
      schema: {
        tags: ["Projects"],
        summary: "Mark unit as sold",
        params: projectIdParamSchema,
        body: markUnitSoldSchema,
        response: {
          200: unitResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.markUnitSold.bind(controller),
  );

  fastify.post(
    "/units/:id/release",
    {
      preHandler: [requirePermission(PERMISSIONS.PROPERTIES_UPDATE)],
      schema: {
        tags: ["Projects"],
        summary: "Release locked/blocked unit",
        params: projectIdParamSchema,
        response: {
          200: unitResponseSchema,
          400: standardErrorSchema,
          401: standardErrorSchema,
          403: standardErrorSchema,
          404: standardErrorSchema,
        },
      },
    },
    controller.releaseUnit.bind(controller),
  );
}

module.exports = projectRoutes;
