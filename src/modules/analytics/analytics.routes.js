'use strict';

const {
  getLeadAnalytics,
  getSalesAnalytics,
  getCommissionAnalytics,
  getTaskAnalytics,
  getExecutiveSummary,
  getAgentPerformance,
  enqueueExport,
  getExportStatus,
  downloadExport,
} = require('./analytics.controller');
const { authenticate } = require('../../shared/middleware/authenticate.middleware');

// ---------------------------------------------------------------------------
// Analytics Routes
//
// All routes are protected by JWT authentication (fastify-jwt preValidation).
// Role-based access is enforced at the controller/service boundary:
//
//   /leads        → admin, finance, branch_manager, team_leader, agent
//   /sales        → admin, finance, branch_manager, team_leader
//   /commission   → admin, finance
//   /tasks        → admin, finance, branch_manager, team_leader
//   /executive    → admin, finance
//   /export/*     → admin, finance
//
// Common query params (all GET endpoints):
//   startDate  (ISO date string, default: 30 days ago)
//   endDate    (ISO date string, default: today)
//   branchId   (ObjectId, optional — admin/finance only for cross-branch)
// ---------------------------------------------------------------------------

// Shared date range query string schema (used by all GET analytics endpoints)
const dateRangeQuerySchema = {
  type: 'object',
  properties: {
    startDate: { type: 'string', format: 'date', description: 'Start of the reporting period (YYYY-MM-DD)' },
    endDate:   { type: 'string', format: 'date', description: 'End of the reporting period (YYYY-MM-DD)' },
    branchId:  { type: 'string', description: 'Filter by branch (admin/finance only)' },
  },
};

/**
 * Fastify plugin — register all /analytics routes.
 * @param {import('fastify').FastifyInstance} fastify
 */
async function analyticsRoutes(fastify) {

  // Shared authentication preValidation for all routes in this plugin
  const authenticateHook = [authenticate];

  // ── GET /analytics/leads ──────────────────────────────────────────────────
  fastify.get('/leads', {
    preValidation: authenticateHook,
    schema: {
      tags: ['Analytics'],
      summary: 'Lead Analytics — source performance, funnel, conversion',
      security: [{ BearerAuth: [] }],
      querystring: {
        ...dateRangeQuerySchema,
        properties: {
          ...dateRangeQuerySchema.properties,
          source: { type: 'string', description: 'Filter by lead source' },
        },
      },
    },
  }, getLeadAnalytics);

  // ── GET /analytics/sales ──────────────────────────────────────────────────
  fastify.get('/sales', {
    preValidation: authenticateHook,
    schema: {
      tags: ['Analytics'],
      summary: 'Sales Analytics — deal funnel, booking conversion, value trends',
      security: [{ BearerAuth: [] }],
      querystring: {
        ...dateRangeQuerySchema,
        properties: {
          ...dateRangeQuerySchema.properties,
          projectId: { type: 'string', description: 'Filter by project' },
        },
      },
    },
  }, getSalesAnalytics);

  // ── GET /analytics/commission ─────────────────────────────────────────────
  fastify.get('/commission', {
    preValidation: authenticateHook,
    schema: {
      tags: ['Analytics'],
      summary: 'Commission Analytics — expected vs collected revenue, cheque clearing',
      security: [{ BearerAuth: [] }],
      querystring: dateRangeQuerySchema,
    },
  }, getCommissionAnalytics);

  // ── GET /analytics/tasks ──────────────────────────────────────────────────
  fastify.get('/tasks', {
    preValidation: authenticateHook,
    schema: {
      tags: ['Analytics'],
      summary: 'Task Analytics — completion rate, SLA violations, follow-up compliance',
      security: [{ BearerAuth: [] }],
      querystring: dateRangeQuerySchema,
    },
  }, getTaskAnalytics);

  // ── GET /analytics/executive ──────────────────────────────────────────────
  fastify.get('/executive', {
    preValidation: authenticateHook,
    schema: {
      tags: ['Analytics'],
      summary: 'Executive Summary — combined KPIs across all domains',
      security: [{ BearerAuth: [] }],
      querystring: dateRangeQuerySchema,
    },
  }, getExecutiveSummary);

  // ── GET /analytics/agents ───────────────────────────────────────────
  fastify.get('/agents', {
    preValidation: authenticateHook,
    schema: {
      tags: ['Analytics'],
      summary: 'Agent Performance — leads won/lost, deals closed, conversion rate',
      security: [{ BearerAuth: [] }],
      querystring: {
        ...dateRangeQuerySchema,
        properties: {
          ...dateRangeQuerySchema.properties,
          agentId: {
            type: 'string',
            description: 'Filter by agent (admin/finance/branch_manager). Agents always see their own data only.',
          },
        },
      },
    },
  }, getAgentPerformance);

  // ── POST /analytics/export ────────────────────────────────────────────────
  fastify.post('/export', {
    preValidation: authenticateHook,
    schema: {
      tags: ['Analytics'],
      summary: 'Enqueue an async PDF or CSV report export',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        required: ['reportType', 'format', 'startDate', 'endDate'],
        properties: {
          reportType: {
            type: 'string',
            enum: ['leads', 'sales', 'commission', 'tasks', 'executive'],
            description: 'The domain to export',
          },
          format: {
            type: 'string',
            enum: ['pdf', 'csv'],
            description: 'Output format',
          },
          startDate: { type: 'string', format: 'date' },
          endDate:   { type: 'string', format: 'date' },
          branchId:  { type: 'string' },
          filters:   { type: 'object', additionalProperties: true },
        },
      },
    },
  }, enqueueExport);

  // ── GET /analytics/export/:jobId/status ──────────────────────────────────
  fastify.get('/export/:jobId/status', {
    preValidation: authenticateHook,
    schema: {
      tags: ['Analytics'],
      summary: 'Poll the status of an export job',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        required: ['jobId'],
        properties: {
          jobId: { type: 'string', description: 'BullMQ job ID returned from enqueue' },
        },
      },
    },
  }, getExportStatus);

  // ── GET /analytics/export/:jobId/download ────────────────────────────────
  fastify.get('/export/:jobId/download', {
    preValidation: authenticateHook,
    schema: {
      tags: ['Analytics'],
      summary: 'Download a completed report export (PDF or CSV)',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        required: ['jobId'],
        properties: {
          jobId: { type: 'string' },
        },
      },
    },
  }, downloadExport);
}

module.exports = analyticsRoutes;
