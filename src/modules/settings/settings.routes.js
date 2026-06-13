"use strict";

const {
  authenticate,
} = require("../../shared/middleware/authenticate.middleware");
const { authorize } = require("../../shared/middleware/authorize.middleware");
const {
  PERMISSIONS,
} = require("../../shared/constants/roles-permissions.constants");

const { SettingsController } = require("./settings.controller");
const {
  OrganizationController,
} = require("../organization/organization.controller");
const { BranchController } = require("../branch/branch.controller");
const { UserController } = require("../user/user.controller");
const { RoleController } = require("../authorization/role.controller");
const { AuditController } = require("../audit/audit.controller");

const {
  updateOrganizationSchema,
} = require("../organization/organization.validation");
const {
  createBranchSchema,
  updateBranchSchema,
} = require("../branch/branch.validation");
const {
  inviteUserSchema,
  assignRoleSchema,
  transferBranchSchema,
} = require("../user/user.validation");
const {
  assignPermissionsSchema,
} = require("../authorization/authorization.validation");

const { Organization } = require("../organization/organization.model");
const { OrganizationService } = require("../organization/organization.service");
const { tenantContext } = require("../../shared/context/tenant-context");

const controller = new SettingsController();
const orgController = new OrganizationController();
const branchController = new BranchController();
const userController = new UserController();
const roleController = new RoleController();
const auditController = new AuditController();
const orgService = new OrganizationService();

async function settingsRoutes(fastify, opts) {
  fastify.addHook("preValidation", authenticate);

  // System Settings Routes
  fastify.get(
    "/",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_VIEW)],
      schema: { tags: ["Settings"], summary: "Get system settings" },
    },
    controller.get,
  );
  fastify.put(
    "/company",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_MANAGE)],
      schema: { tags: ["Settings"], summary: "Update company settings" },
    },
    controller.updateCompany,
  );
  fastify.put(
    "/crm",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_MANAGE)],
      schema: { tags: ["Settings"], summary: "Update CRM settings" },
    },
    controller.updateCRM,
  );
  fastify.put(
    "/workflow",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_MANAGE)],
      schema: { tags: ["Settings"], summary: "Update workflow settings" },
    },
    controller.updateWorkflow,
  );
  fastify.put(
    "/notifications",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_MANAGE)],
      schema: { tags: ["Settings"], summary: "Update notification settings" },
    },
    controller.updateNotifications,
  );

  // Organisation Settings Routes
  fastify.get(
    "/org",
    {
      preHandler: [authorize(PERMISSIONS.ORGANIZATIONS_READ)],
    },
    async (req, reply) => {
      const actor = req.user;
      if (!actor.organizationId) {
        throw new Error("No organization context");
      }
      const org = await tenantContext.run({ isSystemOverride: true }, () =>
        Organization.findById(actor.organizationId),
      );
      return reply.send(org);
    },
  );

  fastify.put(
    "/org",
    {
      preHandler: [authorize(PERMISSIONS.ORGANIZATIONS_UPDATE)],
      schema: { body: updateOrganizationSchema },
    },
    async (req, reply) => {
      const actor = req.user;
      if (!actor.organizationId) {
        throw new Error("No organization context");
      }
      const updated = await orgService.updateOrganization(
        actor.organizationId,
        req.body,
        actor,
      );
      return reply.send(updated);
    },
  );

  // Branch Settings Routes
  fastify.get("/branches", {
    preHandler: [authorize(PERMISSIONS.BRANCHES_READ)],
    handler: branchController.list.bind(branchController),
  });
  fastify.post("/branches", {
    preHandler: [authorize(PERMISSIONS.BRANCHES_CREATE)],
    schema: { body: createBranchSchema },
    handler: branchController.create.bind(branchController),
  });
  fastify.put("/branches/:id", {
    preHandler: [authorize(PERMISSIONS.BRANCHES_UPDATE)],
    schema: { body: updateBranchSchema },
    handler: branchController.update.bind(branchController),
  });
  fastify.delete("/branches/:id", {
    preHandler: [authorize(PERMISSIONS.BRANCHES_DELETE)],
    handler: branchController.delete.bind(branchController),
  });

  // User Settings Routes
  fastify.get("/users", {
    preHandler: [authorize(PERMISSIONS.USERS_READ)],
    handler: userController.list.bind(userController),
  });
  fastify.post("/users/invite", {
    preHandler: [authorize(PERMISSIONS.USERS_CREATE)],
    schema: { body: inviteUserSchema },
    handler: userController.invite.bind(userController),
  });
  fastify.post("/users/:id/suspend", {
    preHandler: [authorize(PERMISSIONS.USERS_DEACTIVATE)],
    handler: userController.suspend.bind(userController),
  });
  fastify.post("/users/:id/branch", {
    preHandler: [authorize(PERMISSIONS.USERS_UPDATE)],
    schema: { body: transferBranchSchema },
    handler: userController.transferBranch.bind(userController),
  });
  fastify.post("/users/:id/role", {
    preHandler: [authorize(PERMISSIONS.USERS_UPDATE)],
    schema: { body: assignRoleSchema },
    handler: userController.assignRole.bind(userController),
  });

  // Role Settings Routes
  fastify.get("/roles", {
    preHandler: [authorize(PERMISSIONS.ROLES_READ)],
    handler: roleController.list.bind(roleController),
  });
  fastify.put("/roles/:id/permissions", {
    preHandler: [authorize(PERMISSIONS.ROLES_ASSIGN_PERMISSIONS)],
    schema: { body: assignPermissionsSchema },
    handler: roleController.assignPermissions.bind(roleController),
  });
  fastify.post("/roles/:id/clone", {
    preHandler: [authorize(PERMISSIONS.ROLES_CREATE)],
    handler: roleController.clone.bind(roleController),
  });

  // Audit Log Settings Routes
  fastify.get("/audit-logs", {
    preHandler: [authorize(PERMISSIONS.AUDIT_VIEW)],
    handler: auditController.list.bind(auditController),
  });

  // Scoring Rules Mock Settings Routes
  fastify.get(
    "/scoring",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_VIEW)],
    },
    async (req, reply) => {
      return reply.send({
        profileFit: [
          { id: "1", label: "Budget > ₹1 Crore", points: 20 },
          {
            id: "2",
            label: "Preferred Location equals 'Mumbai South'",
            points: 15,
          },
          { id: "3", label: "Lead Source equals 'Referrals'", points: 15 },
        ],
        interactions: [
          { id: "4", label: "Site Visit Completed", points: 30 },
          { id: "5", label: "WhatsApp Message Replied", points: 10 },
          { id: "6", label: "Email Opened", points: 5 },
        ],
        decay: [
          { id: "7", label: "No active contact in 7 days", points: -15 },
          { id: "8", label: "Overdue task or missed follow-up", points: -10 },
        ],
      });
    },
  );

  fastify.put(
    "/scoring",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_MANAGE)],
    },
    async (req, reply) => {
      return reply.send({
        success: true,
        message: "Lead scoring rules updated (simulated)",
      });
    },
  );

  // Automation Mock Settings Routes
  fastify.get(
    "/automation",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_VIEW)],
    },
    async (req, reply) => {
      return reply.send([
        {
          id: "1",
          name: "Site Visit Confirmation Notification",
          active: true,
          trigger: "site_visit_scheduled",
          conditions: [{ field: "lead.score", operator: ">=", value: 70 }],
          actions: [
            { type: "whatsapp", template: "site_visit_details" },
            { type: "task", title: "Call visitor 2h after visit" },
            { type: "notify_manager", scope: "Alert Branch Manager on Slack" },
          ],
        },
      ]);
    },
  );

  fastify.post(
    "/automation",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_MANAGE)],
    },
    async (req, reply) => {
      return reply.send({
        success: true,
        id: "rule_" + Date.now(),
        message: "Automation rule created (simulated)",
      });
    },
  );

  fastify.put(
    "/automation/:id",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_MANAGE)],
    },
    async (req, reply) => {
      return reply.send({
        success: true,
        message: "Automation rule updated (simulated)",
      });
    },
  );

  fastify.delete(
    "/automation/:id",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_MANAGE)],
    },
    async (req, reply) => {
      return reply.send({
        success: true,
        message: "Automation rule deleted (simulated)",
      });
    },
  );

  // WhatsApp Templates Mock Settings Routes
  fastify.get(
    "/whatsapp-templates",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_VIEW)],
    },
    async (req, reply) => {
      return reply.send([
        {
          id: "wt_01",
          name: "site_visit_details",
          language: "en",
          category: "UTILITY",
          status: "approved",
          body: "Hello {{1}}, your site visit to {{2}} is scheduled for {{3}}. We look forward to seeing you.",
        },
        {
          id: "wt_02",
          name: "lead_welcome",
          language: "en",
          category: "MARKETING",
          status: "pending",
          body: "Welcome {{1}}! Thanks for registering interest in {{2}}. One of our agents will contact you shortly.",
        },
        {
          id: "wt_03",
          name: "booking_alert",
          language: "en",
          category: "UTILITY",
          status: "approved",
          body: "Dear {{1}}, congratulations! Your booking for unit {{2}} at {{3}} has been confirmed. Booking ID: {{4}}.",
        },
      ]);
    },
  );

  fastify.post(
    "/whatsapp-templates/sync",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_MANAGE)],
    },
    async (req, reply) => {
      return reply.send({
        success: true,
        message: "WhatsApp templates synced successfully",
      });
    },
  );

  // Email Templates Mock Settings Routes
  fastify.get(
    "/email-templates",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_VIEW)],
    },
    async (req, reply) => {
      return reply.send([
        {
          id: "et_01",
          name: "Welcome Email Template",
          subject: "Welcome to Prestige Builders",
          body: "<p>Dear {{Primary_Applicant_Name}},</p><p>Thank you for expressing interest. Your lead profile is registered on {{Allotment_Date}}.</p>",
        },
        {
          id: "et_02",
          name: "Payment Outstanding Dues Escalation",
          subject: "Urgent: Payment Dues for Allotment",
          body: "<p>Dear {{Primary_Applicant_Name}},</p><p>This is a follow-up that your dues of {{Dues_Outstanding}} are outstanding. Please clear immediately.</p>",
        },
      ]);
    },
  );

  fastify.post(
    "/email-templates",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_MANAGE)],
    },
    async (req, reply) => {
      return reply.send({
        success: true,
        id: "email_" + Date.now(),
        message: "Email template created (simulated)",
      });
    },
  );

  fastify.put(
    "/email-templates/:id",
    {
      preHandler: [authorize(PERMISSIONS.SETTINGS_MANAGE)],
    },
    async (req, reply) => {
      return reply.send({
        success: true,
        message: "Email template updated (simulated)",
      });
    },
  );
}

module.exports = settingsRoutes;
