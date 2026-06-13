'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { BranchRepository } = require('./branch.repository');
const { auditService } = require('../audit/audit.service');
const { ConflictError, ForbiddenError, BusinessRuleError, NotFoundError } = require('../../shared/errors');
const { AUDIT_ACTIONS } = require('../../shared/constants/app.constants');
const { tenantContext } = require('../../shared/context/tenant-context');

class BranchService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.branchRepository = deps.branchRepository || new BranchRepository();
    this.auditService = deps.auditService || auditService;
    this.repository = this.branchRepository;
  }

  /**
   * Create a new branch.
   * @param {object} data - { name, code, manager, email, phone, address }
   * @param {object} actor
   * @returns {Promise<Branch>}
   */
  async createBranch(data, actor) {
    const codeSlug = data.code.toLowerCase().trim();
    const nameTrimmed = data.name.trim();

    // 0. Org-Type Gate: Branches are not allowed for INDIVIDUAL_AGENT
    if (actor.organizationType === 'INDIVIDUAL_AGENT') {
      throw new BusinessRuleError(
        'Branch management is not available for Individual Agent tier.',
        'FEATURE_NOT_AVAILABLE_FOR_ORG_TYPE'
      );
    }

    // 1. Validate subscription limits: count active branches inside the tenant organization context
    const Organization = require('../organization/organization.model').Organization;
    const org = await tenantContext.run({ isSystemOverride: true }, () =>
      Organization.findById(actor.organizationId)
    );

    if (!org) {
      throw new NotFoundError('Organization', actor.organizationId);
    }

    const activeBranchesCount = await this.branchRepository.count({ isDeleted: false });
    if (activeBranchesCount >= org.subscription.maxBranches) {
      throw new BusinessRuleError(
        `Subscription Limit Reached: Your current plan only allows a maximum of ${org.subscription.maxBranches} branches. Please upgrade your subscription.`,
        'SUBSCRIPTION_LIMIT_EXCEEDED'
      );
    }

    // 2. Validate code and name uniqueness inside organization context
    const existingCode = await this.branchRepository.findByCode(codeSlug);
    if (existingCode) {
      throw new ConflictError(`Branch with code '${data.code}' already exists in your organization.`);
    }

    const existingName = await this.branchRepository.findByName(nameTrimmed);
    if (existingName) {
      throw new ConflictError(`Branch with name '${data.name}' already exists in your organization.`);
    }

    // 3. Validate Manager Assignment if manager ObjectId is passed
    if (data.manager) {
      const User = require('../user/user.model').User;
      // Fetch manager in system bypass context to allow secure cross-tenant verification
      const managerUser = await tenantContext.run({ isSystemOverride: true }, () =>
        User.findById(data.manager)
      );

      if (!managerUser || managerUser.isDeleted) {
        throw new NotFoundError('User', data.manager);
      }

      // Guard: Cross-Tenant Manager Assignment Protection
      if (String(managerUser.organizationId) !== String(actor.organizationId)) {
        throw new ForbiddenError('Security Denied: Assigned manager does not belong to your organization.');
      }
    }

    // 4. Create Branch
    const branch = await this.branchRepository.create({
      organizationId: actor.organizationId,
      name: nameTrimmed,
      code: codeSlug,
      manager: data.manager || null,
      email: data.email,
      phone: data.phone,
      address: data.address,
      isActive: true,
    });

    // 5. Audit Logging
    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Branch',
      entityId: branch.id,
      userId: actor.id,
      description: `Created branch '${branch.name}' (${branch.code})`,
      newValues: branch.toObject(),
    });

    return branch;
  }

  /**
   * Update an existing branch.
   * @param {string} id
   * @param {object} data
   * @param {object} actor
   * @returns {Promise<Branch>}
   */
  async updateBranch(id, data, actor) {
    const branch = await this.branchRepository.findByIdOrFail(id, 'Branch');

    const updatePayload = {};

    // Validate Name uniqueness if changing
    if (data.name && data.name.trim() !== branch.name) {
      const nameTrimmed = data.name.trim();
      const existingName = await this.branchRepository.findByName(nameTrimmed);
      if (existingName && existingName.id !== id) {
        throw new ConflictError(`Branch with name '${data.name}' already exists in your organization.`);
      }
      updatePayload.name = nameTrimmed;
    }

    // Validate Manager if changing
    if (data.manager && String(data.manager) !== String(branch.manager)) {
      const User = require('../user/user.model').User;
      const managerUser = await tenantContext.run({ isSystemOverride: true }, () =>
        User.findById(data.manager)
      );

      if (!managerUser || managerUser.isDeleted) {
        throw new NotFoundError('User', data.manager);
      }

      if (String(managerUser.organizationId) !== String(actor.organizationId)) {
        throw new ForbiddenError('Security Denied: Assigned manager does not belong to your organization.');
      }
      updatePayload.manager = data.manager;
    } else if (data.manager === null) {
      updatePayload.manager = null;
    }

    if (data.email !== undefined) updatePayload.email = data.email;
    if (data.phone !== undefined) updatePayload.phone = data.phone;
    if (data.address !== undefined) updatePayload.address = data.address;

    const oldValues = branch.toObject();
    const updated = await this.branchRepository.update(id, updatePayload);

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Branch',
      entityId: id,
      userId: actor.id,
      description: `Updated branch '${updated.name}'`,
      oldValues,
      newValues: updated.toObject(),
    });

    return updated;
  }

  /**
   * Activate a branch.
   * @param {string} id
   * @param {object} actor
   * @returns {Promise<Branch>}
   */
  async activateBranch(id, actor) {
    const branch = await this.branchRepository.findByIdOrFail(id, 'Branch');
    if (branch.isActive) {
      return branch;
    }

    const updated = await this.branchRepository.update(id, { isActive: true });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Branch',
      entityId: id,
      userId: actor.id,
      description: `Activated branch '${updated.name}'`,
      newValues: { isActive: true },
    });

    return updated;
  }

  /**
   * Deactivate a branch.
   * @param {string} id
   * @param {object} actor
   * @returns {Promise<Branch>}
   */
  async deactivateBranch(id, actor) {
    const branch = await this.branchRepository.findByIdOrFail(id, 'Branch');
    if (!branch.isActive) {
      return branch;
    }

    const updated = await this.branchRepository.update(id, { isActive: false });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Branch',
      entityId: id,
      userId: actor.id,
      description: `Deactivated branch '${updated.name}'`,
      newValues: { isActive: false },
    });

    return updated;
  }

  /**
   * Soft delete a branch.
   * @param {string} id
   * @param {object} actor
   */
  async deleteBranch(id, actor) {
    const branch = await this.branchRepository.findByIdOrFail(id, 'Branch');

    await this.branchRepository.softDelete(id, actor.id);

    await this.logAudit({
      action: AUDIT_ACTIONS.DELETE,
      entity: 'Branch',
      entityId: id,
      userId: actor.id,
      description: `Soft-deleted branch '${branch.name}' (${branch.code})`,
    });
  }

  /**
   * List all branches inside parent organization.
   * @param {object} pagination
   * @returns {Promise<object>}
   */
  async listBranches(pagination) {
    return this.branchRepository.paginate({}, pagination);
  }
}

module.exports = { BranchService };
