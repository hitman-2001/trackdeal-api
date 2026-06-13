'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { UserService } = require('./user.service');

// ---------------------------------------------------------------------------
// UserController — thin HTTP layer
// All business logic delegated to UserService.
// ---------------------------------------------------------------------------

class UserController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.userService = deps.service || new UserService(deps);
  }

  /**
   * GET /users
   */
  async list(request, reply) {
    const query = this.getPagination(request.query);
    const actor = this.getUser(request);

    const { data, pagination } = await this.userService.listUsers({ ...request.query, ...query }, actor);
    return this.paginated(reply, data, pagination);
  }

  /**
   * GET /users/:id
   */
  async getById(request, reply) {
    const { id } = request.params;
    const actor = this.getUser(request);
    const user = await this.userService.getUserById(id, actor);
    return this.ok(reply, user);
  }

  /**
   * POST /users
   */
  async create(request, reply) {
    const actor = this.getUser(request);
    const user = await this.userService.createUser(request.body, actor);
    return this.created(reply, user, 'User created successfully');
  }

  /**
   * PUT /users/:id
   */
  async update(request, reply) {
    const { id } = request.params;
    const actor = this.getUser(request);
    const user = await this.userService.updateUser(id, request.body, actor);
    return this.ok(reply, user, 'User updated successfully');
  }

  /**
   * DELETE /users/:id
   */
  async remove(request, reply) {
    const { id } = request.params;
    const actor = this.getUser(request);
    await this.userService.deleteUser(id, actor);
    return this.noContent(reply);
  }

  /**
   * POST /users/:id/restore
   */
  async restore(request, reply) {
    const { id } = request.params;
    const actor = this.getUser(request);
    await this.userService.restoreUser(id, actor);
    return this.ok(reply, null, 'User account restored successfully');
  }

  /**
   * POST /users/:id/activate
   */
  async activate(request, reply) {
    const { id } = request.params;
    const actor = this.getUser(request);
    const user = await this.userService.activateUser(id, actor);
    return this.ok(reply, user, 'User account activated successfully');
  }

  /**
   * POST /users/:id/deactivate
   */
  async deactivate(request, reply) {
    const { id } = request.params;
    const actor = this.getUser(request);
    const user = await this.userService.deactivateUser(id, actor);
    return this.ok(reply, user, 'User account deactivated successfully');
  }

  /**
   * POST /users/:id/suspend
   */
  async suspend(request, reply) {
    const { id } = request.params;
    const actor = this.getUser(request);
    const user = await this.userService.suspendUser(id, actor);
    return this.ok(reply, user, 'User account suspended successfully');
  }

  /**
   * POST /users/:id/assign-role
   */
  async assignRole(request, reply) {
    const { id } = request.params;
    const actor = this.getUser(request);
    const user = await this.userService.assignRole(id, request.body.roleId, actor);
    return this.ok(reply, user, 'User role updated successfully');
  }

  /**
   * POST /users/:id/assign-branch
   */
  async assignBranch(request, reply) {
    const { id } = request.params;
    const actor = this.getUser(request);
    const user = await this.userService.assignBranch(id, request.body.branchId, actor);
    return this.ok(reply, user, 'User branch assigned successfully');
  }

  /**
   * POST /users/:id/transfer-branch
   */
  async transferBranch(request, reply) {
    const { id } = request.params;
    const actor = this.getUser(request);
    const user = await this.userService.transferBranch(id, request.body.branchId, actor);
    return this.ok(reply, user, 'User branch transferred successfully');
  }

  // -------------------------------------------------------------------------
  // User Invitation Management
  // -------------------------------------------------------------------------

  /**
   * POST /users/invite
   */
  async invite(request, reply) {
    const actor = this.getUser(request);
    const invite = await this.userService.inviteUser(request.body, actor);
    return this.created(reply, invite, 'User invitation sent successfully');
  }

  /**
   * POST /users/invite/resend
   */
  async resendInvite(request, reply) {
    const actor = this.getUser(request);
    const invite = await this.userService.resendInvitation(request.body.email, actor);
    return this.ok(reply, invite, 'User invitation resent successfully');
  }

  /**
   * POST /users/invite/cancel
   */
  async cancelInvite(request, reply) {
    const actor = this.getUser(request);
    const invite = await this.userService.cancelInvitation(request.body.email, actor);
    return this.ok(reply, invite, 'User invitation cancelled successfully');
  }



  // -------------------------------------------------------------------------
  // Personal Profile Management
  // -------------------------------------------------------------------------

  /**
   * GET /users/me
   */
  async getMe(request, reply) {
    const actor = this.getUser(request);
    const user = await this.userService.getUserById(actor.id, actor);
    return this.ok(reply, user);
  }

  /**
   * PUT /users/me
   */
  async updateMe(request, reply) {
    const actor = this.getUser(request);
    const user = await this.userService.updateProfile(actor, request.body);
    return this.ok(reply, user, 'Profile updated successfully');
  }

  /**
   * POST /users/me/change-password
   */
  async changePasswordMe(request, reply) {
    const actor = this.getUser(request);
    await this.userService.changePassword(actor, request.body);
    return this.ok(reply, null, 'Password changed successfully');
  }

  /**
   * POST /users/me/avatar
   */
  async avatarMe(request, reply) {
    const actor = this.getUser(request);
    const user = await this.userService.uploadAvatar(actor, request.body.avatar);
    return this.ok(reply, user, 'Profile avatar updated successfully');
  }
}

module.exports = { UserController };
