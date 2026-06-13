'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { PermissionService } = require('./permission.service');

class PermissionController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.permissionService = deps.service || new PermissionService(deps);
  }

  async list(req, reply) {
    const pagination = this.getPagination(req.query);
    const { data, pagination: meta } = await this.permissionService.listPermissions(pagination);
    return this.paginated(reply, data, meta);
  }

  async grouped(req, reply) {
    const grouped = await this.permissionService.getGroupedPermissions();
    return this.ok(reply, grouped);
  }

  async matrix(req, reply) {
    const matrix = await this.permissionService.getPermissionMatrix();
    return this.ok(reply, matrix);
  }
}

module.exports = { PermissionController };
