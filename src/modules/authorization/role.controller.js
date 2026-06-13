'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { RoleService } = require('./role.service');

class RoleController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.roleService = deps.service || new RoleService(deps);
  }

  async list(req, reply) {
    const pagination = this.getPagination(req.query);
    const { data, pagination: meta } = await this.roleService.listRoles(pagination, this.getUser(req));
    return this.paginated(reply, data, meta);
  }

  async getById(req, reply) {
    const role = await this.roleService.roleRepository.findByIdOrFail(req.params.id, 'Role');
    return this.ok(reply, role);
  }

  async create(req, reply) {
    const role = await this.roleService.createRole(req.body, this.getUser(req));
    return this.created(reply, role, 'Role created successfully');
  }

  async update(req, reply) {
    const role = await this.roleService.updateRole(req.params.id, req.body, this.getUser(req));
    return this.ok(reply, role, 'Role updated successfully');
  }

  async delete(req, reply) {
    await this.roleService.deleteRole(req.params.id, this.getUser(req));
    return this.ok(reply, null, 'Role deleted successfully');
  }

  async clone(req, reply) {
    const role = await this.roleService.cloneRole(req.params.id, req.body, this.getUser(req));
    return this.created(reply, role, 'Role cloned successfully');
  }

  async activate(req, reply) {
    const role = await this.roleService.activateRole(req.params.id, this.getUser(req));
    return this.ok(reply, role, 'Role activated successfully');
  }

  async deactivate(req, reply) {
    const role = await this.roleService.deactivateRole(req.params.id, this.getUser(req));
    return this.ok(reply, role, 'Role deactivated successfully');
  }

  async getPermissions(req, reply) {
    const permissions = await this.roleService.getRolePermissions(req.params.id);
    return this.ok(reply, permissions);
  }

  async assignPermissions(req, reply) {
    const role = await this.roleService.assignPermissions(
      req.params.id,
      req.body.permissions,
      this.getUser(req)
    );
    return this.ok(reply, role, 'Permissions assigned successfully');
  }
}

module.exports = { RoleController };
