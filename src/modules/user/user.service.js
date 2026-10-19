'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { UserRepository } = require('./user.repository');
const { NotFoundError, ConflictError, BusinessRuleError, ForbiddenError } = require('../../shared/errors');
const { AUDIT_ACTIONS } = require('../../shared/constants/app.constants');
const { tenantContext } = require('../../shared/context/tenant-context');
const { UserInvitationRepository } = require('./user-invitation.repository');
const { PermissionRepository } = require('../authorization/permission.repository');
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
    this.permissionRepository = deps.permissionRepository || new PermissionRepository();
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

    const emailLower = data.email.toLowerCase().trim();

    // 2. Check for duplicate email (ignoring soft-deleted users)
    const exists = await this.userRepository.findByEmail(emailLower);
    if (exists) {
      throw new ConflictError(`User with email '${emailLower}' already exists`);
    }

    // Release any soft-deleted user records currently holding this email address in MongoDB
    try {
      const softDeletedUsers = await this.userRepository.model.find({
        email: emailLower,
        isDeleted: true,
      });
      for (const dUser of softDeletedUsers) {
        dUser.email = `${dUser.email}__deleted__${dUser._id}`;
        await dUser.save().catch(async () => {
          dUser.email = `${emailLower}__deleted__${Date.now()}_${dUser._id}`;
          await dUser.save();
        });
      }
    } catch (err) {
      console.warn('[UserService] Error freeing soft-deleted user email:', err.message);
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

    // Capitalize first letter of every name word (Title Case)
    const toTitleCase = (str) => {
      if (!str || typeof str !== 'string') return '';
      return str
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    };

    let firstName = data.firstName ? toTitleCase(data.firstName) : '';
    let lastName = data.lastName ? toTitleCase(data.lastName) : '';

    if (!firstName && data.name) {
      const parts = data.name.trim().split(/\s+/).filter(Boolean);
      firstName = toTitleCase(parts[0]);
      lastName = parts.length > 1 ? toTitleCase(parts.slice(1).join(' ')) : '';
    }

    if (!firstName) {
      firstName = 'Staff';
    }

    // Clean up any pending invitation for this email
    const pendingInvite = await this.userInvitationRepository.findPendingByEmail(emailLower);
    if (pendingInvite) {
      await this.userInvitationRepository.update(pendingInvite.id, { status: 'accepted' });
    }

    const user = await this.userRepository.create({
      ...data,
      firstName,
      lastName: lastName || '',
      email: emailLower,
      password: hashedPassword,
      organizationId: actor.organizationId,
      tenantId: actor.tenantId || data.tenantId || null,
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
      description: `User '${user.email}' created directly (staff onboarded)`,
    });

    // Dispatch welcome credentials email asynchronously via Brevo SMTP
    if (data.password) {
      try {
        const { emailService } = require('../email/email.service');
        const staffName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Staff Member';
        let roleName = 'Staff Member';
        let orgName = actor?.organizationName;
        let isEducation = false;

        const dispatchWelcome = async () => {
          if (actor?.organizationId) {
            try {
              const { Organization } = require('../organization/organization.model');
              const org = await Organization.findById(actor.organizationId).select('name vertical').lean();
              if (org?.name) orgName = org.name;
              if (org?.vertical === 'education') isEducation = true;
            } catch (_) {}
          }

          if (data.roleId) {
            try {
              const { Role } = require('../authorization/role.model');
              const assignedRole = await Role.findById(data.roleId).select('name code').lean();
              if (assignedRole?.name) roleName = assignedRole.name;
            } catch (_) {}
          }

          // In education vertical, map Agent/broker terminology to Staff
          if (isEducation) {
            roleName = roleName.replace(/agent/gi, 'Staff');
          }

          return emailService.sendStaffWelcomeCredentialsEmail({
            to: user.email,
            staffName,
            username: user.email,
            password: data.password,
            roleName,
            organizationName: orgName || 'TrackDeal CRM',
            isEducation,
          });
        };

        dispatchWelcome().catch((err) => {
          console.error('[UserService] Failed to dispatch staff welcome email:', err.message);
        });
      } catch (err) {
        console.error('[UserService] Error initiating welcome email dispatch:', err.message);
      }
    }

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
   * Soft-delete a user and reassign their leads to the organization administrator.
   */
  async deleteUser(id, actor) {
    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    const isOrgOrSuperAdmin = [
      ROLES.ORG_ADMIN,
      'org_admin',
      'organization_admin',
      ROLES.SUPER_ADMIN,
      'super_admin',
      'system_admin',
    ].includes(actor.role);

    if (!isOrgOrSuperAdmin) {
      throw new ForbiddenError('Only an Organization Administrator can delete user accounts.');
    }

    const user = await this.userRepository.findByIdOrFail(id, 'User');
    this._enforceBranchWriteIsolation(user, actor);

    if (String(id) === String(actor.id)) {
      throw new BusinessRuleError('You cannot delete your own account');
    }

    // 1. Resolve Organization Administrator to receive the reassigned leads
    const adminUser = await this._resolveOrgAdminForReassignment(user, actor);

    let reassignedLeadsCount = 0;
    if (adminUser && String(adminUser._id || adminUser.id) !== String(id)) {
      const { Lead, LeadActivity, LeadAssignment, LeadFollowUp } = require('../lead/lead.model');

      const adminId = adminUser._id || adminUser.id;
      const adminName = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || adminUser.email || 'Admin';
      const reason = `Auto-reassigned to Admin (${adminName}) upon deletion of user '${user.email}'`;
      const now = new Date();

      // Find all non-deleted leads assigned to this user (both assignedTo and agentId)
      const leadsToReassign = await Lead.find({
        $or: [{ assignedTo: user._id }, { agentId: user._id }],
        isDeleted: false,
      }).select('_id branchId status assignedTo agentId').lean();

      if (leadsToReassign.length > 0) {
        reassignedLeadsCount = leadsToReassign.length;
        const leadIds = leadsToReassign.map((l) => l._id);

        // Bulk update leads to Admin
        await Lead.updateMany(
          { _id: { $in: leadIds } },
          {
            $set: {
              assignedTo: adminId,
              updatedBy: actor.id,
            },
            $push: {
              assignmentHistory: {
                assignedTo: adminId,
                assignedBy: actor.id,
                assignedAt: now,
                reason,
              },
            },
          }
        );

        // Reassign pending follow-ups belonging to these leads or assigned to this user
        await LeadFollowUp.updateMany(
          {
            $or: [
              { assignedTo: user._id },
              { leadId: { $in: leadIds }, assignedTo: user._id },
            ],
            status: { $in: ['pending', 'scheduled'] },
            isDeleted: false,
          },
          {
            $set: {
              assignedTo: adminId,
              updatedBy: actor.id,
            },
          }
        );

        // Record LeadAssignment and LeadActivity audit logs
        const assignmentDocs = leadsToReassign.map((l) => ({
          organizationId: user.organizationId,
          branchId: l.branchId || null,
          leadId: l._id,
          assignedTo: adminId,
          assignedBy: actor.id,
          reason,
          createdAt: now,
          updatedAt: now,
        }));

        const activityDocs = leadsToReassign.map((l) => ({
          organizationId: user.organizationId,
          branchId: l.branchId || null,
          leadId: l._id,
          type: 'assignment',
          description: `Lead automatically reassigned to Admin (${adminName}) due to deletion of user '${user.email}'`,
          performedBy: actor.id,
          metadata: {
            previousAssignee: user._id,
            newAssignee: adminId,
            reason,
          },
          createdAt: now,
          updatedAt: now,
        }));

        if (assignmentDocs.length > 0) {
          await LeadAssignment.insertMany(assignmentDocs, { ordered: false }).catch(() => {});
        }
        if (activityDocs.length > 0) {
          await LeadActivity.insertMany(activityDocs, { ordered: false }).catch(() => {});
        }
      }

      // Reassign pending operational tasks if Task collection is in use
      try {
        const { Task } = require('../task/task.model');
        if (Task) {
          await Task.updateMany(
            {
              assignedTo: user._id,
              status: { $in: ['pending', 'in_progress'] },
              isDeleted: false,
            },
            {
              $set: {
                assignedTo: adminId,
                updatedBy: actor.id,
              },
            }
          );
        }
      } catch (e) {
        // Task reassignment best-effort
      }
    }

    // 2. Soft-delete the user and release their email address so it can be immediately re-used
    const deletedEmail = `${user.email}__deleted__${user._id || id}`;
    await this.userRepository.model.updateOne(
      { _id: id },
      {
        $set: {
          isDeleted: true,
          status: 'inactive',
          email: deletedEmail,
          deletedAt: new Date(),
          deletedBy: actor.id,
        },
      }
    );

    // Cancel any pending invitations for this user's email
    try {
      const { UserInvitation } = require('./user-invitation.model');
      if (UserInvitation) {
        await UserInvitation.updateMany(
          { email: user.email.toLowerCase(), status: 'pending' },
          { $set: { status: 'cancelled' } }
        );
      }
    } catch (_) {}

    await this.logAudit({
      action: AUDIT_ACTIONS.DELETE,
      entity: 'User',
      entityId: id,
      userId: actor.id,
      description: `User '${user.email}' soft-deleted${reassignedLeadsCount > 0 ? ` (${reassignedLeadsCount} leads reassigned to Admin)` : ''}`,
    });

    return {
      deletedUserId: id,
      reassignedLeadsCount,
      adminId: adminUser?._id || adminUser?.id || null,
    };
  }

  /**
   * Helper to resolve the active Organization Administrator to whom leads
   * will be reassigned when a staff member or user is deleted.
   */
  async _resolveOrgAdminForReassignment(user, actor) {
    const userOrgId = user.organizationId;
    const deletedUserId = String(user._id || user.id);

    // 1. If actor is an active org_admin of this organization
    if (
      actor &&
      actor.id &&
      String(actor.id) !== deletedUserId &&
      ['org_admin', 'organization_admin'].includes(actor.role) &&
      (!actor.organizationId || String(actor.organizationId) === String(userOrgId))
    ) {
      const activeActor = await this.userRepository.model.findOne({
        _id: actor.id,
        isDeleted: false,
        status: { $ne: 'inactive' },
      });
      if (activeActor) return activeActor;
    }

    // 2. Check Organization ownerId
    if (userOrgId) {
      try {
        const { Organization } = require('../organization/organization.model');
        const org = await Organization.findById(userOrgId).lean();
        if (org && org.ownerId && String(org.ownerId) !== deletedUserId) {
          const owner = await this.userRepository.model.findOne({
            _id: org.ownerId,
            isDeleted: false,
            status: { $ne: 'inactive' },
          });
          if (owner) return owner;
        }
      } catch (err) {
        // Fall through
      }
    }

    // 3. Search for any active user with org_admin role in this organization
    if (userOrgId) {
      try {
        const { Role } = require('../authorization/role.model');
        const orgAdminRole = await Role.findOne({
          code: { $in: ['org_admin', 'organization_admin'] },
        }).lean();

        if (orgAdminRole) {
          const adminInOrg = await this.userRepository.model.findOne({
            organizationId: userOrgId,
            roleId: orgAdminRole._id,
            _id: { $ne: user._id },
            isDeleted: false,
            status: { $ne: 'inactive' },
          });
          if (adminInOrg) return adminInOrg;
        }

        // Fallback: any active user in the organization that is not the deleted user
        const anyActiveOrgUser = await this.userRepository.model.findOne({
          organizationId: userOrgId,
          _id: { $ne: user._id },
          isDeleted: false,
          status: { $ne: 'inactive' },
        }).sort({ createdAt: 1 });
        if (anyActiveOrgUser) return anyActiveOrgUser;
      } catch (err) {
        // Fall through
      }
    }

    // 4. Fallback to actor if actor is not the deleted user
    if (actor?.id && String(actor.id) !== deletedUserId) {
      return this.userRepository.model.findOne({
        _id: actor.id,
        isDeleted: false,
      });
    }

    return null;
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

    const updated = await this.userRepository.update(
      id,
      { status: 'active', updatedBy: actor.id },
      {
        new: true,
        populate: [
          { path: 'roleId', select: 'name code' },
          { path: 'branchId', select: 'name code' },
        ],
      }
    );

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

    const updated = await this.userRepository.update(
      id,
      { status: 'inactive', updatedBy: actor.id },
      {
        new: true,
        populate: [
          { path: 'roleId', select: 'name code' },
          { path: 'branchId', select: 'name code' },
        ],
      }
    );

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

  /**
   * Replace the explicit permissions added to and removed from a user's role.
   * Only an organization administrator can delegate permissions within their
   * own organization. The role remains the user's baseline access profile.
   */
  async updateUserPermissions(id, permissionOverrides, actor) {
    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    const isOrgOrSuperAdmin = [
      ROLES.ORG_ADMIN,
      'org_admin',
      'organization_admin',
      ROLES.SUPER_ADMIN,
      'super_admin',
      'system_admin',
    ].includes(actor.role);

    if (!isOrgOrSuperAdmin) {
      throw new ForbiddenError('Only an Organization Admin can manage user-specific permissions.');
    }
    if (String(id) === String(actor.id)) {
      throw new BusinessRuleError('You cannot modify your own permissions.');
    }

    const user = await this.userRepository.findByIdOrFail(id, 'User');
    this._enforceBranchWriteIsolation(user, actor);

    const { Role } = require('../authorization/role.model');
    const targetRole = await tenantContext.run({ isSystemOverride: true }, () =>
      Role.findById(user.roleId).select('code').lean()
    );
    if (targetRole?.code === ROLES.SUPER_ADMIN || targetRole?.code === 'super_admin') {
      throw new ForbiddenError('Organization Admins cannot modify a Super Admin account.');
    }

    const normalize = (keys) => [...new Set((keys || []).map((key) => String(key).toLowerCase().trim()))];
    const added = normalize(permissionOverrides.added);
    const removed = normalize(permissionOverrides.removed);
    const conflictingKeys = added.filter((key) => removed.includes(key));
    if (conflictingKeys.length) {
      throw new BusinessRuleError('A permission cannot be both granted and denied for the same user.', 'CONFLICTING_PERMISSION_OVERRIDES');
    }

    const requestedKeys = [...added, ...removed];
    const validPermissions = await this.permissionRepository.findByKeys(requestedKeys);
    const validKeys = new Set(validPermissions.map((permission) => permission.permissionKey));
    const invalidKeys = requestedKeys.filter((key) => !validKeys.has(key));
    if (invalidKeys.length) {
      throw new BusinessRuleError(`Cannot assign unknown permissions: ${invalidKeys.join(', ')}`, 'INVALID_PERMISSIONS_ASSIGNED');
    }

    // Platform Super Admins and Organization Admins possess administrative authority
    // to manage and delegate any registered system permissions within their organization.
    // For non-admin roles (if delegation is ever opened to managers), enforce token possession.
    if (!isOrgOrSuperAdmin) {
      const actorPermissions = new Set(actor.permissions || []);
      if (!actorPermissions.has('*')) {
        const unauthorizedKeys = requestedKeys.filter((key) => !actorPermissions.has(key));
        if (unauthorizedKeys.length) {
          throw new ForbiddenError(`You cannot delegate permissions you do not possess: ${unauthorizedKeys.join(', ')}`);
        }
      }
    }

    const oldOverrides = {
      added: user.permissionOverrides?.added || [],
      removed: user.permissionOverrides?.removed || [],
    };
    const updated = await this.userRepository.update(id, {
      permissionOverrides: { added, removed },
      permissionsVersion: Number(user.permissionsVersion || 0) + 1,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actor.id,
      oldValues: { permissionOverrides: oldOverrides },
      newValues: { permissionOverrides: { added, removed } },
      description: `Updated user-specific permissions for '${user.email}'`,
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

    const updated = await this.userRepository.update(id, {
      roleId,
      permissionsVersion: Number(user.permissionsVersion || 0) + 1,
      updatedBy: actor.id,
    });

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

    // 2. Check user duplicates (ignoring soft-deleted users)
    const userExists = await this.userRepository.findByEmail(emailLower);
    if (userExists) {
      throw new ConflictError('A user with this email already exists on the platform.');
    }

    // Release any soft-deleted user records currently holding this email address in MongoDB
    try {
      const softDeletedUsers = await this.userRepository.model.find({
        email: emailLower,
        isDeleted: true,
      });
      for (const dUser of softDeletedUsers) {
        dUser.email = `${dUser.email}__deleted__${dUser._id}`;
        await dUser.save().catch(async () => {
          dUser.email = `${emailLower}__deleted__${Date.now()}_${dUser._id}`;
          await dUser.save();
        });
      }
    } catch (err) {
      console.warn('[UserService] Error freeing soft-deleted user email during invite:', err.message);
    }

    // 3. Check duplicate active invitation
    const inviteExists = await this.userInvitationRepository.findPendingByEmail(emailLower);
    if (inviteExists) {
      // If there's an existing pending invitation, cancel the old one so a fresh invitation token is generated
      await this.userInvitationRepository.update(inviteExists.id, { status: 'cancelled' });
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
      tenantId: actor.tenantId || null,
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

    const { User } = require('./user.model');
    const activeUsersCount = await tenantContext.run({ isSystemOverride: true }, () =>
      User.countDocuments({ organizationId: org._id, isDeleted: false })
    );
    
    const { UserInvitation } = require('./user-invitation.model');
    const pendingInvitesCount = await tenantContext.run({ isSystemOverride: true }, () =>
      UserInvitation.countDocuments({
        organizationId: org._id,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      })
    );

    const limits = [];
    if (typeof org.maxUsers === 'number' && org.maxUsers > 0) limits.push(org.maxUsers);
    if (typeof org.subscription?.maxUsers === 'number' && org.subscription.maxUsers > 0) limits.push(org.subscription.maxUsers);
    const quota = limits.length > 0 ? Math.min(...limits) : 10;

    if (activeUsersCount + pendingInvitesCount >= quota) {
      throw new BusinessRuleError(
        `User limit reached: Organization '${org.name}' allows a maximum of ${quota} users/invites. Please upgrade the organization quota to add more users.`,
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
      if (['super_admin', 'org_admin', 'organization_admin'].includes(targetRole.code)) {
        throw new ForbiddenError('You cannot assign Super Admin or Organization Admin roles.');
      }
      if (targetWeight >= actorWeight) {
        throw new ForbiddenError('You cannot assign or invite a user with a role equal to or higher than your own.');
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
