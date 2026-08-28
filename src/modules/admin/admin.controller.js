'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { AdminService } = require('./admin.service');

class AdminController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.adminService = deps.adminService || new AdminService();
  }

  async getDashboardMetrics(request, reply) {
    const actor = this.getUser(request);
    const result = await this.adminService.getDashboardMetrics(actor);
    return this.ok(reply, result);
  }

  async getOrganizations(request, reply) {
    const actor = this.getUser(request);
    const result = await this.adminService.getOrganizations(request.query, actor);
    return this.ok(reply, result.data, 'Organizations retrieved successfully', result.pagination);
  }

  async createOrganization(request, reply) {
    const actor = this.getUser(request);
    const result = await this.adminService.createOrganization(request.body, actor);
    return this.created(reply, result, 'Organization created successfully');
  }

  async getOrganizationById(request, reply) {
    const actor = this.getUser(request);
    const result = await this.adminService.getOrganizationById(request.params.id, actor);
    return this.ok(reply, result);
  }

  async updateOrganization(request, reply) {
    const actor = this.getUser(request);
    const result = await this.adminService.updateOrganization(request.params.id, request.body, actor);
    return this.ok(reply, result, 'Organization updated successfully');
  }

  async getOrganizationUsers(request, reply) {
    const actor = this.getUser(request);
    const result = await this.adminService.getOrganizationUsers(request.params.id, request.query, actor);
    return this.ok(reply, result);
  }

  async resetOwnerPassword(request, reply) {
    const actor = this.getUser(request);
    const result = await this.adminService.resetOwnerPassword(request.params.id, request.body?.password, actor);
    return this.ok(reply, result, result.message);
  }

  async getUsers(request, reply) {
    const actor = this.getUser(request);
    const result = await this.adminService.getUsers(request.query, actor);
    return this.ok(reply, result.data, 'Users retrieved successfully', result.pagination);
  }

  async createUser(request, reply) {
    const actor = this.getUser(request);
    const result = await this.adminService.createUser(request.body, actor);
    return this.created(reply, result, 'User created successfully');
  }

  async updateUser(request, reply) {
    const actor = this.getUser(request);
    const result = await this.adminService.updateUser(request.params.id, request.body, actor);
    return this.ok(reply, result, 'User updated successfully');
  }

  async moveUserOrganization(request, reply) {
    const actor = this.getUser(request);
    const result = await this.adminService.moveUserOrganization(request.params.id, request.body?.organizationId, actor);
    return this.ok(reply, result, 'User successfully moved to new organization');
  }

  async getAuditLogs(request, reply) {
    const actor = this.getUser(request);
    const result = await this.adminService.getAuditLogs(request.query, actor);
    return this.ok(reply, result.data, 'Audit logs retrieved successfully', result.pagination);
  }

  async globalSearch(request, reply) {
    const actor = this.getUser(request);
    const result = await this.adminService.globalSearch(request.query?.q, actor);
    return this.ok(reply, result);
  }
}

module.exports = { AdminController };
