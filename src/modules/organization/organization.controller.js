'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { OrganizationService } = require('./organization.service');
const { ForbiddenError } = require('../../shared/errors');

class OrganizationController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.organizationService = deps.service || new OrganizationService(deps);
  }

  async list(req, reply) {
    const pagination = this.getPagination(req.query);
    const { data, pagination: meta } = await this.organizationService.organizationRepository.paginate({}, pagination);
    return this.paginated(reply, data, meta);
  }

  async getById(req, reply) {
    const actor = this.getUser(req);
    if (actor.role !== 'super_admin' && String(actor.organizationId) !== String(req.params.id)) {
      throw new ForbiddenError('Access Denied: You cannot view details of another organization.');
    }
    const org = await this.organizationService.organizationRepository.findByIdOrFail(req.params.id, 'Organization');
    return this.ok(reply, org);
  }

  async create(req, reply) {
    const org = await this.organizationService.createOrganization(req.body, this.getUser(req));
    return this.created(reply, org, 'Organization registered successfully');
  }

  async update(req, reply) {
    const org = await this.organizationService.updateOrganization(req.params.id, req.body, this.getUser(req));
    return this.ok(reply, org, 'Organization updated successfully');
  }

  async delete(req, reply) {
    await this.organizationService.archiveOrganization(req.params.id, this.getUser(req));
    return this.ok(reply, null, 'Organization archived successfully');
  }

  async activate(req, reply) {
    const org = await this.organizationService.activateOrganization(req.params.id, this.getUser(req));
    return this.ok(reply, org, 'Organization activated successfully');
  }

  async suspend(req, reply) {
    const org = await this.organizationService.suspendOrganization(req.params.id, this.getUser(req));
    return this.ok(reply, org, 'Organization suspended successfully');
  }
}

module.exports = { OrganizationController };
