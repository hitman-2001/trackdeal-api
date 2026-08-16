'use strict';

// ---------------------------------------------------------------------------
// Central Route Loader
// Registers all module routes under /api/v1
//
// Adding a new module:
//   1. Create src/modules/<name>/<name>.routes.js
//   2. Import and register below
// ---------------------------------------------------------------------------

const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/user/user.routes');
const leadRoutes = require('../modules/lead/lead.routes');
const customerRoutes = require('../modules/customer/customer.routes');
const sellerRoutes = require('../modules/seller/seller.routes');
const propertyRoutes = require('../modules/property/property.routes');
const siteVisitRoutes = require('../modules/site-visit/site-visit.routes');
const dealRoutes = require('../modules/deal/deal.routes');
const invoiceRoutes = require('../modules/invoice/invoice.routes');
const notificationRoutes = require('../modules/notification/notification.routes');
const settingsRoutes = require('../modules/settings/settings.routes');
const roleRoutes = require('../modules/authorization/role.routes');
const permissionRoutes = require('../modules/authorization/permission.routes');
const organizationRoutes = require('../modules/organization/organization.routes');
const branchRoutes = require('../modules/branch/branch.routes');
const taskRoutes = require('../modules/task/task.routes');
const projectRoutes = require('../modules/project/project.routes');
const commissionRoutes = require('../modules/commission/commission.routes');
const agentRoutes = require('../modules/agent/agent.routes');

// Imported modules
const brokerageRoutes = require('../modules/brokerage/brokerage.routes');
const agreementRoutes = require('../modules/agreement/agreement.routes');
const auditRoutes = require('../modules/audit/audit.routes');
const reportRoutes = require('../modules/reporting/reporting.routes');
const fileRoutes = require('../modules/file/file.routes');
const analyticsRoutes = require('../modules/analytics/analytics.routes');

/**
 * Register all application routes.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} opts
 */
async function registerRoutes(fastify, opts) {
  // Health check (no auth required)
  fastify.get('/health', {
    schema: {
      tags: ['System'],
      summary: 'Health check',
      security: [],
    },
  }, async (request, reply) => {
    return reply.send({
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });
  });

  // Auth routes
  fastify.register(authRoutes, { prefix: '/auth' });

  // Domain module routes
  fastify.register(userRoutes, { prefix: '/users' });
  fastify.register(roleRoutes, { prefix: '/roles' });
  fastify.register(organizationRoutes, { prefix: '/organizations' });
  fastify.register(branchRoutes, { prefix: '/branches' });
  fastify.register(leadRoutes, { prefix: '/leads' });
  fastify.register(customerRoutes, { prefix: '/customers' });
  fastify.register(sellerRoutes, { prefix: '/sellers' });
  fastify.register(propertyRoutes, { prefix: '/properties' });
  fastify.register(siteVisitRoutes, { prefix: '/site-visits' });
  fastify.register(dealRoutes, { prefix: '/deals' });
  fastify.register(invoiceRoutes, { prefix: '/invoices' });
  fastify.register(notificationRoutes, { prefix: '/notifications' });
  fastify.register(settingsRoutes, { prefix: '/settings' });
  fastify.register(permissionRoutes, { prefix: '/permissions' });
  fastify.register(taskRoutes, { prefix: '/tasks' });
  fastify.register(projectRoutes, { prefix: '/projects' });
  fastify.register(commissionRoutes, { prefix: '/commissions' });
  fastify.register(agentRoutes, { prefix: '/agents' });

  // Active module routes
  fastify.register(brokerageRoutes, { prefix: '/brokerage' });
  fastify.register(agreementRoutes, { prefix: '/agreements' });
  fastify.register(auditRoutes, { prefix: '/audit-logs' });
  fastify.register(reportRoutes, { prefix: '/reports' });
  fastify.register(fileRoutes, { prefix: '/files' });

  // Analytics & Reporting
  fastify.register(analyticsRoutes, { prefix: '/analytics' });
}

module.exports = { registerRoutes };
