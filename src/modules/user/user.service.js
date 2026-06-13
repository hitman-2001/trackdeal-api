'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { UserRepository } = require('./user.repository');
const { NotFoundError, ConflictError, BusinessRuleError, ForbiddenError } = require('../../shared/errors');
const { AUDIT_ACTIONS } = require('../../shared/constants/app.constants');
const { tenantContext } = require('../../shared/context/tenant-context');
const { UserInvitationRepository } = require('./user-invitation.repository');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// UserService — Owner: Authentication & User Management Module
// ---------------------------------------------------------------------------

class UserService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.userRepository = deps.userRepository || new UserRepository();
    this.userInvitationRepository = deps.userInvitationRepository || new UserInvitationRepository();
  }

  /**
   * List all users in organization tenant context.
   */
  async listUsers(query, actor) {
    const filter = { isDeleted: false };

    // Managers/TLs can view users in organization. Branch managers scope to branch (Enterprise only).
    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    if (actor.organizationType === 'ENTERPRISE_AGENCY' && actor.role === ROLES.BRANCH_MANAGER && actor.branchId) {
      filter.branchId = actor.branchId;
    } else if (actor.organizationType === 'ENTERPRISE_AGENCY' && query.branchId) {
      filter.branchId = query.branchId;
    }

    if (query.role) filter.roleId = query.role;
    if (typeof query.isActive === 'boolean') {
      filter.status = query.isActive ? 'active' : { $ne: 'active' };
    }
    if (query.status) filter.status = query.status;

    if (query.search) {
      filter.$or = [
        { firstName: { $regex: query.search, $options: 'i' } },
        { lastName: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { employeeCode: { $regex: query.search, $options: 'i' } },
      ];
    }

    return this.userRepository.paginate(filter, {
      page: query.page,
      limit: query.limit,
      sort: { [query.sort || 'createdAt']: query.order || -1 },
      populate: [
        { path: 'roleId', select: 'name code' },
        { path: 'branchId', select: 'name code' },
      ],
    });
  }

  /**
   * Fetch user details by ID.
   */
  async getUserById(id, actor) {
    const user = await this.userRepository.findByIdOrFail(id, 'User');
    
    // Scoping check for Branch Managers
    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    if (actor.role === ROLES.BRANCH_MANAGER && actor.branchId && user.branchId?.toString() !== actor.branchId.toString()) {
      throw new ForbiddenError('Access Denied: You can only view users in your assigned branch.');
    }

    return user;
  }

  /**
   * Create a new user account directly.
   */
  async createUser(data, actor) {
    // 1. Quota check: Enforce Organization user subscription limits
    await this._verifyUserQuota(actor.organizationId);

    // 2. Check for duplicate email
    const exists = await this.userRepository.findByEmail(data.email);
    if (exists) {
      throw new ConflictError(`User with email '${data.email}' already exists`);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Validate role assignment boundaries and hierarchy
    await this._validateUserRoleAssignment(data.roleId, actor);

    // Validate branch assignment if provided
    if (data.branchId) {
      await this._validateBranchAssignment(data.branchId, actor.organizationId, actor);
    }

    const { ROLES: SYSTEM_ROLES } = require('../../shared/constants/roles-permissions.constants');
    let targetBranchId = actor.organizationType === 'ENTERPRISE_AGENCY'
      ? (data.branchId || null)
      : null;
    if (actor.organizationType === 'ENTERPRISE_AGENCY' && actor.role === SYSTEM_ROLES.BRANCH_MANAGER && actor.branchId) {
      targetBranchId = actor.branchId;
    }

    const user = await this.userRepository.create({
      ...data,
      password: hashedPassword,
      organizationId: actor.organizationId,
      branchId: targetBranchId,
      status: 'active', // Direct creation registers active users
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: 'User',
      entityId: user.id,
      userId: actor.id,
      newValues: { email: user.email, roleId: user.roleId, status: user.status },
      description: `User '${user.email}' created directly`,
    });

    return user;
  }

  /**
   * Update user details.
   */
  async updateUser(id, data, actor) {
    const user = await this.userRepository.findByIdOrFail(id, 'User');
    this._enforceBranchWriteIsolation(user, actor);

    // Prevent password update via this method
    delete data.password;
    delete data.roleId; // Restrict role modifications to dedicated endpoint
    delete data.branchId; // Restrict branch assignments to dedicated endpoints

    const updated = await this.userRepository.update(id, {
      ...data,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actor.id,
      oldValues: { firstName: user.firstName, lastName: user.lastName, email: user.email },
      newValues: data,
      description: `User '${user.email}' profile updated`,
    });

    return updated;
  }

  /**
   * Soft-delete a user.
   */
  async deleteUser(id, actor) {
    const user = await this.userRepository.findByIdOrFail(id, 'User');
    this._enforceBranchWriteIsolation(user, actor);

    if (String(id) === String(actor.id)) {
      throw new BusinessRuleError('You cannot delete your own account');
    }

    await this.userRepository.softDelete(id, actor.id);

    await this.logAudit({
      action: AUDIT_ACTIONS.DELETE,
      entity: 'User',
      entityId: id,
      userId: actor.id,
      description: `User '${user.email}' soft-deleted`,
    });
  }

  /**
   * Restore a soft-deleted user.
   */
  async restoreUser(id, actor) {
    await this.userRepository.restore(id);
    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actor.id,
      description: `User restored`,
    });
  }

  // -------------------------------------------------------------------------
  // User Status Control Operations
  // -------------------------------------------------------------------------

  async activateUser(id, actor) {
    const user = await this.userRepository.findByIdOrFail(id, 'User');
    this._enforceBranchWriteIsolation(user, actor);

    if (user.status === 'active') return user;

    const updated = await this.userRepository.update(id, { status: 'active', updatedBy: actor.id });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actor.id,
      description: `Activated user account '${user.email}'`,
      newValues: { status: 'active' },
    });

    return updated;
  }

  async deactivateUser(id, actor) {
    if (String(id) === String(actor.id)) {
      throw new BusinessRuleError('You cannot deactivate your own account');
    }

    const user = await this.userRepository.findByIdOrFail(id, 'User');
    this._enforceBranchWriteIsolation(user, actor);

    if (user.status === 'inactive') return user;

    const updated = await this.userRepository.update(id, { status: 'inactive', updatedBy: actor.id });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actor.id,
      description: `Deactivated user account '${user.email}'`,
      newValues: { status: 'inactive' },
    });

    return updated;
  }

  async suspendUser(id, actor) {
    if (String(id) === String(actor.id)) {
      throw new BusinessRuleError('You cannot suspend your own account');
    }

    const user = await this.userRepository.findByIdOrFail(id, 'User');
    this._enforceBranchWriteIsolation(user, actor);

    if (user.status === 'suspended') return user;

    const updated = await this.userRepository.update(id, { status: 'suspended', updatedBy: actor.id });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actor.id,
      description: `Suspended user account '${user.email}'`,
      newValues: { status: 'suspended' },
    });

    return updated;
  }

  // -------------------------------------------------------------------------
  // User Role & Branch Assignment Operations
  // -------------------------------------------------------------------------

  async assignRole(id, roleId, actor) {
    const user = await this.userRepository.findByIdOrFail(id, 'User');
    this._enforceBranchWriteIsolation(user, actor);

    // Privilege escalation protection
    await this._validateUserRoleAssignment(roleId, actor);

    const updated = await this.userRepository.update(id, { roleId, updatedBy: actor.id });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actor.id,
      description: `Assigned new role ${roleId} to user '${user.email}'`,
    });

    return updated;
  }

  async assignBranch(id, branchId, actor) {
    if (actor.organizationType !== 'ENTERPRISE_AGENCY') {
      throw new BusinessRuleError('Branch operations are only available for Enterprise organizations.');
    }

    const user = await this.userRepository.findByIdOrFail(id, 'User');
    this._enforceBranchWriteIsolation(user, actor);

    if (branchId) {
      await this._validateBranchAssignment(branchId, actor.organizationId, actor);
    }

    const updated = await this.userRepository.update(id, { branchId, updatedBy: actor.id });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actor.id,
      description: `Assigned branch ${branchId} to user '${user.email}'`,
    });

    return updated;
  }

  async transferBranch(id, branchId, actor) {
    return this.assignBranch(id, branchId, actor);
  }

  // -------------------------------------------------------------------------
  // User Invitation Operations
  // -------------------------------------------------------------------------

  async inviteUser(data, actor) {
    // 0. Org-Type check: Individual Agents cannot invite users
    if (actor.organizationType === 'INDIVIDUAL_AGENT') {
      throw new ForbiddenError('Individual Agent organizations cannot invite users.');
    }

    const emailLower = data.email.toLowerCase().trim();

    // 1. Quota check: Enforce limits
    await this._verifyUserQuota(actor.organizationId);

    // 2. Check user duplicates
    const userExists = await this.userRepository.findByEmail(emailLower);
    if (userExists) {
      throw new ConflictError('A user with this email already exists on the platform.');
    }

    // 3. Check duplicate active invitation
    const inviteExists = await this.userInvitationRepository.findPendingByEmail(emailLower);
    if (inviteExists) {
      throw new ConflictError('A pending invitation has already been sent to this email address.');
    }

    // 4. Validate role
    await this._validateUserRoleAssignment(data.roleId, actor);

    // 5. Validate branch if provided
    if (data.branchId) {
      await this._validateBranchAssignment(data.branchId, actor.organizationId, actor);
    }

    const { ROLES: SYSTEM_ROLES } = require('../../shared/constants/roles-permissions.constants');
    let targetBranchId = actor.organizationType === 'ENTERPRISE_AGENCY'
      ? (data.branchId || null)
      : null;
    if (actor.organizationType === 'ENTERPRISE_AGENCY' && actor.role === SYSTEM_ROLES.BRANCH_MANAGER && actor.branchId) {
      targetBranchId = actor.branchId;
    }

    // 6. Cryptographically generate token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // Expires in 48 hours

    const inviteDoc = await this.userInvitationRepository.create({
      organizationId: actor.organizationId,
      branchId: targetBranchId,
      roleId: data.roleId,
      email: emailLower,
      invitationToken: hashedToken,
      expiresAt,
      status: 'pending',
    });

    const invite = inviteDoc.toObject();
    invite.invitationToken = token;

    // 7. Audit log & Event publishing
    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: 'UserInvitation',
      entityId: invite.id,
      userId: actor.id,
      description: `Sent invitation to '${emailLower}'`,
    });

    await this.publishEvent('invitation.sent', { inviteId: invite.id, email: emailLower, actor });

    return invite;
  }

  async resendInvitation(email, actor) {
    const emailLower = email.toLowerCase().trim();
    const invite = await this.userInvitationRepository.findPendingByEmail(emailLower);
    if (!invite) {
      throw new NotFoundError('Pending invitation', emailLower);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const updatedDoc = await this.userInvitationRepository.update(invite.id, {
      invitationToken: hashedToken,
      expiresAt,
    });

    const updated = updatedDoc.toObject();
    updated.invitationToken = token;

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'UserInvitation',
      entityId: invite.id,
      userId: actor.id,
      description: `Resent invitation to '${emailLower}'`,
    });

    await this.publishEvent('invitation.sent', { inviteId: invite.id, email: emailLower, actor });

    return updated;
  }

  async cancelInvitation(email, actor) {
    const emailLower = email.toLowerCase().trim();
    const invite = await this.userInvitationRepository.findPendingByEmail(emailLower);
    if (!invite) {
      throw new NotFoundError('Pending invitation', emailLower);
    }

    const updated = await this.userInvitationRepository.update(invite.id, { status: 'cancelled' });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'UserInvitation',
      entityId: invite.id,
      userId: actor.id,
      description: `Cancelled invitation for '${emailLower}'`,
    });

    return updated;
  }



  // -------------------------------------------------------------------------
  // Profile Management Operations
  // -------------------------------------------------------------------------

  async updateProfile(actor, data) {
    const updated = await this.userRepository.update(actor.id, {
      ...data,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'User',
      entityId: actor.id,
      userId: actor.id,
      description: `User updated personal profile`,
    });

    return updated;
  }

  async changePassword(actor, data) {
    const user = await this.userRepository.model.findById(actor.id).select('+password');
    if (!user) throw new NotFoundError('User', actor.id);

    const valid = await bcrypt.compare(data.oldPassword, user.password);
    if (!valid) {
      throw new BusinessRuleError('Invalid credentials: old password matches incorrectly.', 'PASSWORD_MISMATCH');
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 12);
    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    user.updatedBy = actor.id;
    await user.save();

    // Revoke all active refresh tokens for the user to force relogin across devices
    const { RefreshToken } = require('../auth/refresh-token.model');
    await tenantContext.run({ isSystemOverride: true }, () =>
      RefreshToken.deleteMany({ userId: actor.id })
    );

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'User',
      entityId: actor.id,
      userId: actor.id,
      description: `User updated credentials/changed password`,
    });
  }

  async uploadAvatar(actor, avatarUrl) {
    const updated = await this.userRepository.update(actor.id, { avatar: avatarUrl, updatedBy: actor.id });
    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'User',
      entityId: actor.id,
      userId: actor.id,
      description: `User uploaded profile avatar`,
    });
    return updated;
  }

  // -------------------------------------------------------------------------
  // PRIVATE SECURITY & SAAS BOUNDARIES SAFEGUARDS
  // -------------------------------------------------------------------------

  /**
   * Enforce branch-level isolation on write operations.
   * @private
   */
  _enforceBranchWriteIsolation(user, actor) {
    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    if (actor.organizationType === 'ENTERPRISE_AGENCY' && actor.role === ROLES.BRANCH_MANAGER && actor.branchId) {
      if (!user.branchId || String(user.branchId) !== String(actor.branchId)) {
        throw new ForbiddenError('Access Denied: You can only modify users in your assigned branch.');
      }
    }
  }

  /**
   * Verify dynamic organization user subscription limits.
   * Total Consumed Quota = Active/Inactive/Suspended Users + Pending Non-Expired Invitations.
   * @private
   */
  async _verifyUserQuota(organizationId) {
    const Organization = require('../organization/organization.model').Organization;
    const org = await tenantContext.run({ isSystemOverride: true }, () =>
      Organization.findById(organizationId)
    );

    if (!org) {
      throw new NotFoundError('Organization', organizationId);
    }

    const activeUsersCount = await this.userRepository.count({ isDeleted: false });
    
    const { UserInvitation } = require('./user-invitation.model');
    const pendingInvitesCount = await tenantContext.run({ isSystemOverride: true }, () =>
      UserInvitation.countDocuments({
        organizationId,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      })
    );

    if (activeUsersCount + pendingInvitesCount >= org.subscription.maxUsers) {
      throw new BusinessRuleError(
        `Subscription Limit Reached: Your current plan only allows a maximum of ${org.subscription.maxUsers} users/invites. Please upgrade your subscription.`,
        'SUBSCRIPTION_LIMIT_EXCEEDED'
      );
    }
  }

  /**
   * Validate role assignment rules.
   * @private
   */
  async _validateUserRoleAssignment(roleId, actor) {
    if (!roleId) return;

    const { Role } = require('../authorization/role.model');

    const targetRole = await tenantContext.run({ isSystemOverride: true }, () =>
      Role.findById(roleId)
    );

    if (!targetRole || targetRole.isDeleted) {
      throw new NotFoundError('Role', roleId);
    }

    // Cross-Tenant Role Hijack Prevention
    if (targetRole.organizationId && String(targetRole.organizationId) !== String(actor.organizationId)) {
      throw new ForbiddenError('You can only assign roles belonging to your own organization.');
    }

    // Hierarchy Privilege Escalation Block
    const ROLE_WEIGHTS = {
      super_admin: 100,
      org_admin: 80,
      branch_manager: 60,
      manager: 40,
      agent: 20,
      read_only: 10,
    };

    const actorWeight = ROLE_WEIGHTS[actor.role] || 0;
    const targetWeight = ROLE_WEIGHTS[targetRole.code] || 0;

    if (actor.role !== 'super_admin') {
      if (targetRole.code === 'super_admin') {
        throw new ForbiddenError('Only Super Admins can assign the Super Admin role.');
      }
      if (actor.role === 'org_admin') {
        if (targetWeight > actorWeight) {
          throw new ForbiddenError('You cannot assign a role higher than Organization Admin.');
        }
      } else {
        if (targetWeight >= actorWeight) {
          throw new ForbiddenError('You cannot assign or invite a user with a role equal to or higher than your own.');
        }
      }
    }

    // Enforce role tier availability
    if (targetRole.availableForTiers && targetRole.availableForTiers.length > 0) {
      if (!targetRole.availableForTiers.includes(actor.organizationType)) {
        throw new ForbiddenError(`The role '${targetRole.code}' is not available for your organization type (${actor.organizationType}).`);
      }
    }
  }

  /**
   * Validate branch assignment.
   * @private
   */
  async _validateBranchAssignment(branchId, organizationId, actor) {
    if (!branchId) return;

    if (actor.organizationType !== 'ENTERPRISE_AGENCY') {
      throw new BusinessRuleError('Branch assignment is only available for Enterprise organizations.');
    }

    const { Branch } = require('../branch/branch.model');

    const branch = await tenantContext.run({ isSystemOverride: true }, () =>
      Branch.findById(branchId)
    );

    if (!branch || branch.isDeleted) {
      throw new NotFoundError('Branch', branchId);
    }

    if (String(branch.organizationId) !== String(organizationId)) {
      throw new ForbiddenError('You can only assign branches belonging to your own organization.');
    }

    // Branch Manager Specific Restriction
    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    if (actor && actor.role === ROLES.BRANCH_MANAGER && actor.branchId && String(branchId) !== String(actor.branchId)) {
      throw new ForbiddenError('Access Denied: As a Branch Manager, you can only assign users to your own branch.');
    }
  }
}

module.exports = { UserService };
