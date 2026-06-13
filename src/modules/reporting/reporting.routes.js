'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { authorize } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { ReportingService } = require('./reporting.service');
const { ResponseFormatter } = require('../../shared/response/ResponseFormatter');

const reportingService = new ReportingService();

async function reportRoutes(fastify, opts) {
  fastify.addHook('preValidation', authenticate);

  fastify.get('/dashboard', {
    preHandler: [authorize(PERMISSIONS.REPORTS_VIEW)],
    schema: {
      tags: ['Reports'],
      summary: 'Get CRM dashboard performance statistics',
    },
  }, async (req, reply) => {
    const stats = await reportingService.getDashboardStats(req.user);
    return ResponseFormatter.success(reply, stats, 'Dashboard statistics loaded successfully');
  });

  fastify.post('/export', {
    preHandler: [authorize(PERMISSIONS.REPORTS_EXPORT)],
    schema: {
      tags: ['Reports'],
      summary: 'Record report export action',
      body: {
        type: 'object',
        required: ['reportName'],
        properties: {
          reportName: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    await reportingService.logExport(req.body.reportName, req.user);
    return ResponseFormatter.success(reply, null, 'Report export logged successfully');
  });
}

module.exports = reportRoutes;
