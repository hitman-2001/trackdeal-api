'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { auditService } = require('./audit.service');

class AuditController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.auditService = deps.service || auditService;
  }

  async list(req, reply) {
    const pagination = this.getPagination(req.query);
    const { data, pagination: meta } = await this.auditService.queryLogs(req.query, pagination);
    return this.paginated(reply, data, meta);
  }

  async getEntityHistory(req, reply) {
    const pagination = this.getPagination(req.query);
    const { entity, entityId } = req.params;
    const { data, pagination: meta } = await this.auditService.getEntityHistory(entity, entityId, pagination);
    return this.paginated(reply, data, meta);
  }

  async getUserActivity(req, reply) {
    const pagination = this.getPagination(req.query);
    const { userId } = req.params;
    const { data, pagination: meta } = await this.auditService.getUserActivity(userId, pagination);
    return this.paginated(reply, data, meta);
  }
}

module.exports = { AuditController };
