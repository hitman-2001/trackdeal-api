'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { requirePermission, requireAnyPermission } = require('../../shared/middleware/authorize.middleware');
const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
const { EducationController } = require('./education.controller');
const { ForbiddenError } = require('../../shared/errors');
const { isEducationVertical } = require('../tenant/tenant.constants');

async function requireEducationTenant(request) {
  if (!isEducationVertical(request.user?.tenantDomain || request.user?.tenantVertical)) {
    throw new ForbiddenError('Education APIs are only available for education tenants.');
  }
}

async function educationRoutes(fastify) {
  const controller = new EducationController();
  // Authenticate in preValidation so the global tenant-context hook sees request.user
  // and scopes Lead/Student/Class queries to organizationId.
  fastify.addHook('preValidation', authenticate);
  fastify.addHook('preHandler', requireEducationTenant);

  fastify.get('/summary', {
    preHandler: [requirePermission(PERMISSIONS.LEADS_READ)],
    schema: { tags: ['Education'], summary: 'Education workspace summary' },
    handler: (req, reply) => controller.summary(req, reply),
  });

  fastify.get('/analytics', {
    preHandler: [
      requireAnyPermission([
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.REPORTS_READ,
        PERMISSIONS.LEADS_READ,
        'analytics.view',
        'analytics.read',
      ]),
    ],
    schema: { tags: ['Education'], summary: 'Education admissions and reporting analytics' },
    handler: (req, reply) => controller.analytics(req, reply),
  });

  fastify.get('/classes', {
    preHandler: [requirePermission(PERMISSIONS.CLASSES_READ)],
    schema: { tags: ['Education'], summary: 'List classes' },
    handler: (req, reply) => controller.listClasses(req, reply),
  });

  fastify.post('/classes', {
    preHandler: [requirePermission(PERMISSIONS.CLASSES_CREATE)],
    schema: { tags: ['Education'], summary: 'Create class' },
    handler: (req, reply) => controller.createClass(req, reply),
  });

  fastify.put('/classes/:id', {
    preHandler: [requirePermission(PERMISSIONS.CLASSES_UPDATE)],
    schema: { tags: ['Education'], summary: 'Update class' },
    handler: (req, reply) => controller.updateClass(req, reply),
  });

  fastify.delete('/classes/:id', {
    preHandler: [requirePermission(PERMISSIONS.CLASSES_DELETE)],
    schema: { tags: ['Education'], summary: 'Delete class' },
    handler: (req, reply) => controller.removeClass(req, reply),
  });

  fastify.get('/students', {
    preHandler: [requirePermission(PERMISSIONS.STUDENTS_READ)],
    schema: { tags: ['Education'], summary: 'List students' },
    handler: (req, reply) => controller.listStudents(req, reply),
  });

  fastify.post('/students', {
    preHandler: [requirePermission(PERMISSIONS.STUDENTS_CREATE)],
    schema: { tags: ['Education'], summary: 'Create student' },
    handler: (req, reply) => controller.createStudent(req, reply),
  });

  fastify.put('/students/:id', {
    preHandler: [requirePermission(PERMISSIONS.STUDENTS_UPDATE)],
    schema: { tags: ['Education'], summary: 'Update student' },
    handler: (req, reply) => controller.updateStudent(req, reply),
  });

  fastify.delete('/students/:id', {
    preHandler: [requirePermission(PERMISSIONS.STUDENTS_DELETE)],
    schema: { tags: ['Education'], summary: 'Delete student' },
    handler: (req, reply) => controller.removeStudent(req, reply),
  });

  fastify.get('/leads', {
    preHandler: [requirePermission(PERMISSIONS.LEADS_READ)],
    schema: { tags: ['Education'], summary: 'List student leads' },
    handler: (req, reply) => controller.listLeads(req, reply),
  });

  fastify.get('/leads/:id', {
    preHandler: [requirePermission(PERMISSIONS.LEADS_READ)],
    schema: { tags: ['Education'], summary: 'Get student lead' },
    handler: (req, reply) => controller.getLead(req, reply),
  });

  fastify.post('/leads', {
    preHandler: [requirePermission(PERMISSIONS.LEADS_CREATE)],
    schema: { tags: ['Education'], summary: 'Create student lead' },
    handler: (req, reply) => controller.createLead(req, reply),
  });

  fastify.put('/leads/:id', {
    preHandler: [requirePermission(PERMISSIONS.LEADS_UPDATE)],
    schema: { tags: ['Education'], summary: 'Update student lead' },
    handler: (req, reply) => controller.updateLead(req, reply),
  });

  fastify.delete('/leads/:id', {
    preHandler: [requirePermission(PERMISSIONS.LEADS_DELETE)],
    schema: { tags: ['Education'], summary: 'Delete student lead' },
    handler: (req, reply) => controller.removeLead(req, reply),
  });

  fastify.post('/leads/:id/enroll', {
    preHandler: [requirePermission(PERMISSIONS.STUDENTS_CREATE)],
    schema: { tags: ['Education'], summary: 'Enroll a student lead into a class' },
    handler: (req, reply) => controller.enrollLead(req, reply),
  });
}

module.exports = educationRoutes;
