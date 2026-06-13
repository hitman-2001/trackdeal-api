'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { BranchService } = require('./branch.service');

class BranchController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.branchService = deps.service || new BranchService(deps);
  }

  async list(req, reply) {
    const pagination = this.getPagination(req.query);
    const { data, pagination: meta } = await this.branchService.listBranches(pagination);
    return this.paginated(reply, data, meta);
  }

  async getById(req, reply) {
    const branch = await this.branchService.branchRepository.findByIdOrFail(req.params.id, 'Branch');
    return this.ok(reply, branch);
  }

  async create(req, reply) {
    const branch = await this.branchService.createBranch(req.body, this.getUser(req));
    return this.created(reply, branch, 'Branch created successfully');
  }

  async update(req, reply) {
    const branch = await this.branchService.updateBranch(req.params.id, req.body, this.getUser(req));
    return this.ok(reply, branch, 'Branch updated successfully');
  }

  async delete(req, reply) {
    await this.branchService.deleteBranch(req.params.id, this.getUser(req));
    return this.ok(reply, null, 'Branch deleted successfully');
  }

  async activate(req, reply) {
    const branch = await this.branchService.activateBranch(req.params.id, this.getUser(req));
    return this.ok(reply, branch, 'Branch activated successfully');
  }

  async deactivate(req, reply) {
    const branch = await this.branchService.deactivateBranch(req.params.id, this.getUser(req));
    return this.ok(reply, branch, 'Branch deactivated successfully');
  }
}

module.exports = { BranchController };
