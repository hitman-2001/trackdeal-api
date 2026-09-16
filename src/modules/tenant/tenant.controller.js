'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { TenantService } = require('./tenant.service');

class TenantController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.tenantService = deps.tenantService || new TenantService();
  }

  async listModules(request, reply) {
    const modules = await this.tenantService.listModules(request.query?.vertical || request.query?.domain);
    return this.ok(reply, modules);
  }

  async list(request, reply) {
    const actor = this.getUser(request);
    const result = await this.tenantService.listTenants(request.query, actor);
    return this.paginated(reply, result.data, result.pagination, 'Tenants retrieved successfully');
  }

  async create(request, reply) {
    const actor = this.getUser(request);
    const tenant = await this.tenantService.createTenant(request.body, actor);
    return this.created(reply, tenant, 'Tenant created successfully');
  }

  async getById(request, reply) {
    const actor = this.getUser(request);
    const tenant = await this.tenantService.getTenant(request.params.id, actor);
    return this.ok(reply, tenant);
  }

  async update(request, reply) {
    const actor = this.getUser(request);
    const tenant = await this.tenantService.updateTenant(request.params.id, request.body, actor);
    return this.ok(reply, tenant, 'Tenant updated successfully');
  }

  async suspend(request, reply) {
    const actor = this.getUser(request);
    const tenant = await this.tenantService.setTenantStatus(request.params.id, 'suspended', actor);
    return this.ok(reply, tenant, 'Tenant suspended successfully');
  }

  async activate(request, reply) {
    const actor = this.getUser(request);
    const tenant = await this.tenantService.setTenantStatus(request.params.id, 'active', actor);
    return this.ok(reply, tenant, 'Tenant activated successfully');
  }
}

module.exports = { TenantController };
