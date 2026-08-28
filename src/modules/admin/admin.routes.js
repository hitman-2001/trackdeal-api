'use strict';

const { AdminController } = require('./admin.controller');
const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { ForbiddenError } = require('../../shared/errors');

/**
 * Strict System Administrator Middleware
 */
async function requireSystemAdmin(request, reply) {
  if (request.user?.role !== 'system_admin') {
    throw new ForbiddenError('Access restricted to TrackDeal System Administrators.');
  }
}

async function adminRoutes(fastify, options) {
  const controller = new AdminController();

  // Guard entire /admin prefix with auth and system admin role check
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireSystemAdmin);

  // Platform Dashboard
  fastify.get('/dashboard', (req, rep) => controller.getDashboardMetrics(req, rep));

  // Global Search
  fastify.get('/search', (req, rep) => controller.globalSearch(req, rep));

  // Organizations / Tenants Management
  fastify.get('/organizations', (req, rep) => controller.getOrganizations(req, rep));
  fastify.post('/organizations', (req, rep) => controller.createOrganization(req, rep));
  fastify.get('/organizations/:id', (req, rep) => controller.getOrganizationById(req, rep));
  fastify.put('/organizations/:id', (req, rep) => controller.updateOrganization(req, rep));
  fastify.get('/organizations/:id/users', (req, rep) => controller.getOrganizationUsers(req, rep));
  fastify.post('/organizations/:id/reset-owner-password', (req, rep) => controller.resetOwnerPassword(req, rep));

  // Global User Management
  fastify.get('/users', (req, rep) => controller.getUsers(req, rep));
  fastify.post('/users', (req, rep) => controller.createUser(req, rep));
  fastify.put('/users/:id', (req, rep) => controller.updateUser(req, rep));
  fastify.put('/users/:id/move-organization', (req, rep) => controller.moveUserOrganization(req, rep));

  // Global Audit Logs
  fastify.get('/audit-logs', (req, rep) => controller.getAuditLogs(req, rep));
}

module.exports = adminRoutes;
