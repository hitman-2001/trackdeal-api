'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { RoleRepository } = require('./role.repository');
const { PermissionRepository } = require('./permission.repository');
const { auditService } = require('../audit/audit.service');
const { BusinessRuleError, ConflictError, NotFoundError, ForbiddenError } = require('../../shared/errors');
const { AUDIT_ACTIONS } = require('../../shared/constants/app.constants');

class RoleService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.roleRepository = deps.roleRepository || new RoleRepository();
    this.permissionRepository = deps.permissionRepository || new PermissionRepository();
    this.auditService = deps.auditService || auditService;
    this.repository = this.roleRepository;
  }

  /**
   * Create a new custom role.
   * @param {object} data - { name, code, description, permissions }
   * @param {object} actor - Current authenticated user
   * @returns {Promise<Role>}
   */
  async createRole(data, actor) {
    const codeSlug = data.code.toLowerCase().trim();
    const nameTrimmed = data.name.trim();

    // 1. Validate that the role code or name doesn't already exist in the organization/system
    const existingCode = await this.roleRepository.findByCode(codeSlug);
    if (existingCode) {
      throw new ConflictError(`Role with code '${data.code}' already exists.`);
    }

    const existingName = await this.roleRepository.findByName(nameTrimmed);
    if (existingName) {
      throw new ConflictError(`Role with name '${data.name}' already exists.`);
    }

    // 2. Validate that all permissions exist in the Permission collection (No Tampering)
    const validPermissions = await this.permissionRepository.findByKeys(data.permissions);
    const validKeys = validPermissions.map((p) => p.permissionKey);
    const invalidKeys = data.permissions.filter((p) => !validKeys.includes(p));
    
    if (invalidKeys.length > 0) {
      throw new BusinessRuleError(
        `Cannot assign invalid or non-existent permissions: ${invalidKeys.join(', ')}`,
        'INVALID_PERMISSIONS_ASSIGNED'
      );
    }

    // 3. Privilege Escalation Prevention
    if (actor.role !== 'super_admin') {
      const actorPermissions = actor.permissions || [];
      const unauthorizedPermissions = data.permissions.filter(
        (p) => !actorPermissions.includes(p)
      );
      if (unauthorizedPermissions.length > 0) {
        throw new ForbiddenError(
          `Privilege Escalation Blocked: You cannot assign permissions you do not possess: ${unauthorizedPermissions.join(', ')}`
        );
      }

      if (actor.organizationType !== 'ENTERPRISE_AGENCY') {
        const enterpriseOnlyPermissions = [
          'branches.create',
          'branches.read',
          'branches.update',
          'branches.delete',
          'deals.view_branch',
        ];
        const forbiddenPermissions = data.permissions.filter((p) =>
          enterpriseOnlyPermissions.includes(p)
        );
        if (forbiddenPermissions.length > 0) {
          throw new ForbiddenError(
            `Access Denied: Enterprise-only permissions cannot be assigned for your organization type: ${forbiddenPermissions.join(', ')}`
          );
        }
      }
    }

    // 4. Create the custom role
    const role = await this.roleRepository.create({
      organizationId: actor.organizationId || null,
      name: nameTrimmed,
      code: codeSlug,
      description: data.description,
      permissions: data.permissions,
      isSystemRole: false,
      isActive: true,
      createdBy: actor.id,
    });

    // 5. Audit Log enqueuing
    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Role',
      entityId: role.id,
      userId: actor.id,
      description: `Created role '${role.name}' (${role.code})`,
      newValues: role.toObject(),
    });

    return role;
  }

  /**
   * Update an existing custom role.
   * @param {string} id
   * @param {object} data - { name, description, permissions }
   * @param {object} actor - Current authenticated user
   * @returns {Promise<Role>}
   */
  async updateRole(id, data, actor) {
    const role = await this.roleRepository.findByIdOrFail(id, 'Role');

    // Secure: Multi-tenant boundary check
    this._validateRoleAccess(role, actor);

    // 1. Safeguard: System roles are immutable
    if (role.isSystemRole) {
      throw new BusinessRuleError('System roles cannot be modified.', 'SYSTEM_ROLE_IMMUTABLE');
    }

    const updatePayload = {};

    // 2. Validate Name Uniqueness if changing
    if (data.name && data.name.trim() !== role.name) {
      const nameTrimmed = data.name.trim();
      const existingName = await this.roleRepository.findByName(nameTrimmed);
      if (existingName && existingName.id !== id) {
        throw new ConflictError(`Role with name '${data.name}' already exists.`);
      }
      updatePayload.name = nameTrimmed;
    }

    if (data.description !== undefined) {
      updatePayload.description = data.description;
    }

    // 3. Permissions Assignment Validation & Privilege Escalation check
    if (data.permissions) {
      const validPermissions = await this.permissionRepository.findByKeys(data.permissions);
      const validKeys = validPermissions.map((p) => p.permissionKey);
      const invalidKeys = data.permissions.filter((p) => !validKeys.includes(p));
      
      if (invalidKeys.length > 0) {
        throw new BusinessRuleError(
          `Cannot assign invalid or non-existent permissions: ${invalidKeys.join(', ')}`,
          'INVALID_PERMISSIONS_ASSIGNED'
        );
      }

      if (actor.role !== 'super_admin') {
        const actorPermissions = actor.permissions || [];
        const unauthorizedPermissions = data.permissions.filter(
          (p) => !actorPermissions.includes(p)
        );
        if (unauthorizedPermissions.length > 0) {
          throw new ForbiddenError(
            `Privilege Escalation Blocked: You cannot assign permissions you do not possess: ${unauthorizedPermissions.join(', ')}`
          );
        }

        if (actor.organizationType !== 'ENTERPRISE_AGENCY') {
          const enterpriseOnlyPermissions = [
            'branches.create',
            'branches.read',
            'branches.update',
            'branches.delete',
            'deals.view_branch',
          ];
          const forbiddenPermissions = data.permissions.filter((p) =>
            enterpriseOnlyPermissions.includes(p)
          );
          if (forbiddenPermissions.length > 0) {
            throw new ForbiddenError(
              `Access Denied: Enterprise-only permissions cannot be assigned for your organization type: ${forbiddenPermissions.join(', ')}`
            );
          }
        }
      }
      updatePayload.permissions = data.permissions;
    }

    updatePayload.updatedBy = actor.id;
    const oldValues = role.toObject();

    // 4. Update role
    const updated = await this.roleRepository.update(id, updatePayload);

    // 5. Audit Logging
    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Role',
      entityId: id,
      userId: actor.id,
      description: `Updated role '${updated.name}'`,
      oldValues,
      newValues: updated.toObject(),
    });

    return updated;
  }

  /**
   * Delete a custom role.
   * @param {string} id
   * @param {object} actor
   */
  async deleteRole(id, actor) {
    const role = await this.roleRepository.findByIdOrFail(id, 'Role');

    // Secure: Multi-tenant boundary check
    this._validateRoleAccess(role, actor);

    // 1. Safeguard: System roles cannot be deleted
    if (role.isSystemRole) {
      throw new BusinessRuleError('System roles cannot be deleted.', 'SYSTEM_ROLE_IMMUTABLE');
    }

    // 2. Safeguard: Role cannot be deleted if assigned to active users
    const { User } = require('../user/user.model');
    const userCount = await User.countDocuments({ role: id, isDeleted: false });
    if (userCount > 0) {
      throw new BusinessRuleError(
        `Cannot delete role: it is currently assigned to ${userCount} active users.`,
        'ROLE_IN_USE'
      );
    }

    // 3. Soft delete role
    await this.roleRepository.softDelete(id, actor.id);

    // 4. Audit Trail
    await this.logAudit({
      action: AUDIT_ACTIONS.DELETE,
      entity: 'Role',
      entityId: id,
      userId: actor.id,
      description: `Soft-deleted role '${role.name}' (${role.code})`,
    });
  }

  /**
   * Clone an existing role.
   * @param {string} id
   * @param {object} data - { name, code, description }
   * @param {object} actor
   * @returns {Promise<Role>}
   */
  async cloneRole(id, data, actor) {
    const sourceRole = await this.roleRepository.findByIdOrFail(id, 'Role');

    // Secure: Prevent cloning deleted or inactive roles
    if (!sourceRole.isActive || sourceRole.isDeleted) {
      throw new BusinessRuleError('Cannot clone an inactive or deleted role.', 'INVALID_SOURCE_ROLE');
    }

    // Secure: Prevent privilege escalation via cloning higher-privilege roles
    if (actor.role !== 'super_admin') {
      const actorPermissions = actor.permissions || [];
      const unauthorizedPermissions = sourceRole.permissions.filter(
        (p) => !actorPermissions.includes(p)
      );
      if (unauthorizedPermissions.length > 0) {
        throw new ForbiddenError(
          `Cloning Blocked: Target role contains permissions you do not possess: ${unauthorizedPermissions.join(', ')}`
        );
      }
    }

    const clonedData = {
      name: data.name,
      code: data.code,
      description: data.description || `Cloned from ${sourceRole.name}`,
      permissions: sourceRole.permissions,
    };

    return this.createRole(clonedData, actor);
  }

  /**
   * Activate a custom role.
   * @param {string} id
   * @param {object} actor
   * @returns {Promise<Role>}
   */
  async activateRole(id, actor) {
    const role = await this.roleRepository.findByIdOrFail(id, 'Role');
    
    // Secure: Multi-tenant boundary check
    this._validateRoleAccess(role, actor);

    if (role.isActive) {
      return role;
    }

    const updated = await this.roleRepository.update(id, { isActive: true, updatedBy: actor.id });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Role',
      entityId: id,
      userId: actor.id,
      description: `Activated role '${updated.name}'`,
      newValues: { isActive: true },
    });

    return updated;
  }

  /**
   * Deactivate a custom role.
   * @param {string} id
   * @param {object} actor
   * @returns {Promise<Role>}
   */
  async deactivateRole(id, actor) {
    const role = await this.roleRepository.findByIdOrFail(id, 'Role');
    
    // Secure: Multi-tenant boundary check
    this._validateRoleAccess(role, actor);

    // 1. Safeguard: System roles cannot be deactivated
    if (role.isSystemRole) {
      throw new BusinessRuleError('System roles cannot be deactivated.', 'SYSTEM_ROLE_IMMUTABLE');
    }

    if (!role.isActive) {
      return role;
    }

    // 2. Safeguard: Cannot deactivate if assigned to active users
    const { User } = require('../user/user.model');
    const userCount = await User.countDocuments({ role: id, isDeleted: false });
    if (userCount > 0) {
      throw new BusinessRuleError(
        `Cannot deactivate role: it is currently assigned to ${userCount} active users.`,
        'ROLE_IN_USE'
      );
    }

    const updated = await this.roleRepository.update(id, { isActive: false, updatedBy: actor.id });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Role',
      entityId: id,
      userId: actor.id,
      description: `Deactivated role '${updated.name}'`,
      newValues: { isActive: false },
    });

    return updated;
  }

  /**
   * Assign a new batch of permissions to a role.
   * @param {string} id
   * @param {string[]} permissions - List of permission keys
   * @param {object} actor
   * @returns {Promise<Role>}
   */
  async assignPermissions(id, permissions, actor) {
    return this.updateRole(id, { permissions }, actor);
  }

  /**
   * Get permissions of a role.
   * @param {string} id
   * @returns {Promise<string[]>}
   */
  async getRolePermissions(id) {
    const role = await this.roleRepository.findByIdOrFail(id, 'Role');
    return role.permissions;
  }

  /**
   * List all roles (custom + system roles) available to the actor's context.
   * @param {object} pagination
   * @returns {Promise<object>} Paginated roles list
   */
  async listRoles(pagination, actor) {
    const filter = {};
    if (actor && actor.organizationType) {
      filter.$or = [
        { availableForTiers: actor.organizationType },
        { availableForTiers: { $exists: false } },
        { availableForTiers: { $size: 0 } },
      ];
    }
    return this.roleRepository.paginate(filter, pagination);
  }

  /**
   * Secure multi-tenant check: Ensures non-super_admins can never mutate
   * global system roles or roles belonging to other organizations.
   * @private
   */
  _validateRoleAccess(role, actor) {
    if (actor.role === 'super_admin') return;

    if (!role.organizationId) {
      throw new ForbiddenError('Access Denied: You cannot modify global system roles.');
    }

    if (String(role.organizationId) !== String(actor.organizationId)) {
      throw new ForbiddenError('Access Denied: You cannot modify roles belonging to other organizations.');
    }
  }
}

module.exports = { RoleService };
