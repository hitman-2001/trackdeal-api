'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { OrganizationRepository } = require('./organization.repository');
const { auditService } = require('../audit/audit.service');
const { ConflictError, ForbiddenError, BusinessRuleError } = require('../../shared/errors');
const { AUDIT_ACTIONS } = require('../../shared/constants/app.constants');
const { tenantContext } = require('../../shared/context/tenant-context');

class OrganizationService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.organizationRepository = deps.organizationRepository || new OrganizationRepository();
    this.auditService = deps.auditService || auditService;
    this.repository = this.organizationRepository;
  }

  /**
   * Create a new organization (platform registration).
   * Only Super Admins are authorized.
   * @param {object} data
   * @param {object} actor
   * @returns {Promise<Organization>}
   */
  async createOrganization(data, actor) {
    // 1. Authorization hierarchy check
    if (actor.role !== 'super_admin') {
      throw new ForbiddenError('Access Denied: Only Super Admins can register new organizations.');
    }

    if (!data.adminEmail) {
      throw new BusinessRuleError('Admin email is required to register an organization.');
    }

    // Determine plan settings based on organizationType
    let plan = 'starter';
    let maxUsers = 5;
    let maxBranches = 0;
    if (data.organizationType === 'INDIVIDUAL_AGENT') {
      plan = 'individual';
      maxUsers = 1;
      maxBranches = 0;
    } else if (data.organizationType === 'AGENCY') {
      plan = 'starter';
      maxUsers = 5;
      maxBranches = 0;
    } else if (data.organizationType === 'ENTERPRISE_AGENCY') {
      plan = 'growth';
      maxUsers = 10;
      maxBranches = 3;
    }

    const subscription = {
      plan: data.subscription?.plan || plan,
      status: data.subscription?.status || 'trial',
      maxUsers: data.subscription?.maxUsers || maxUsers,
      maxBranches: data.subscription?.maxBranches || maxBranches,
      storageLimit: data.subscription?.storageLimit || 5368709120,
    };

    // Strict boundary enforcement
    if (data.organizationType === 'INDIVIDUAL_AGENT') {
      subscription.maxUsers = 1;
      subscription.maxBranches = 0;
      if (subscription.plan === 'enterprise' || subscription.plan === 'growth') {
        throw new BusinessRuleError('Individual Agents cannot be assigned to an enterprise or growth plan.');
      }
    } else if (data.organizationType === 'AGENCY') {
      subscription.maxBranches = 0;
    }

    const codeSlug = data.code.toLowerCase().trim();

    // 2. Validate uniqueness of code
    const existingCode = await this.organizationRepository.findByCode(codeSlug);
    if (existingCode) {
      throw new ConflictError(`Organization with code '${data.code}' already exists.`);
    }

    // 3. Validate uniqueness of email if provided
    if (data.email) {
      const emailLower = data.email.toLowerCase().trim();
      const existingEmail = await this.organizationRepository.findByEmail(emailLower);
      if (existingEmail) {
        throw new ConflictError(`Organization with email '${data.email}' already exists.`);
      }
    }

    // 4. Create Organization inside system override context to bypass tenant filters
    const org = await tenantContext.run({ isSystemOverride: true }, async () => {
      return this.organizationRepository.create({
        ...data,
        code: codeSlug,
        subscription,
      });
    });

    // 5. Generate secure invitation for Organization Admin
    const crypto = require('crypto');
    const { Role } = require('../authorization/role.model');
    const { UserInvitation } = require('../user/user-invitation.model');
    const { NotFoundError } = require('../../shared/errors');

    const orgAdminRole = await tenantContext.run({ isSystemOverride: true }, () =>
      Role.findOne({ code: 'org_admin', isDeleted: false })
    );
    if (!orgAdminRole) {
      throw new NotFoundError('Default org_admin role not found');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // 48 hours

    await tenantContext.run({ isSystemOverride: true }, () =>
      UserInvitation.create({
        organizationId: org._id,
        roleId: orgAdminRole._id,
        email: data.adminEmail.toLowerCase().trim(),
        invitationToken: hashedToken,
        expiresAt,
        status: 'pending',
      })
    );

    const inviteUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/accept-invitation?token=${rawToken}`;

    // 6. Audit Logging
    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Organization',
      entityId: org.id,
      userId: actor.id,
      organizationId: org.id,
      description: `Registered organization '${org.name}' (${org.code})`,
      newValues: org.toObject(),
    });

    return {
      organization: org,
      inviteUrl,
    };
  }

  /**
   * Update organization details.
   * Organization Admins can only update their own organization.
   * @param {string} id
   * @param {object} data
   * @param {object} actor
   * @returns {Promise<Organization>}
   */
  async updateOrganization(id, data, actor) {
    // 1. SaaS Isolation Guard
    if (actor.role !== 'super_admin' && String(actor.organizationId) !== String(id)) {
      throw new ForbiddenError('Access Denied: You can only modify your own organization.');
    }

    const org = await tenantContext.run({ isSystemOverride: true }, async () => {
      return this.organizationRepository.findByIdOrFail(id, 'Organization');
    });

    // Prevent code modification
    delete data.code;

    const oldValues = org.toObject();

    // Update inside bypass context
    const updated = await tenantContext.run({ isSystemOverride: true }, async () => {
      return this.organizationRepository.update(id, data);
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Organization',
      entityId: id,
      userId: actor.id,
      organizationId: id,
      description: `Updated organization '${updated.name}'`,
      oldValues,
      newValues: updated.toObject(),
    });

    return updated;
  }

  /**
   * Activate an organization.
   * @param {string} id
   * @param {object} actor
   * @returns {Promise<Organization>}
   */
  async activateOrganization(id, actor) {
    if (actor.role !== 'super_admin') {
      throw new ForbiddenError('Access Denied: Only Super Admins can activate organizations.');
    }

    const org = await tenantContext.run({ isSystemOverride: true }, async () => {
      return this.organizationRepository.findByIdOrFail(id, 'Organization');
    });

    if (org.subscription.status === 'active') {
      return org;
    }

    const updated = await tenantContext.run({ isSystemOverride: true }, async () => {
      return this.organizationRepository.update(id, { 'subscription.status': 'active' });
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Organization',
      entityId: id,
      userId: actor.id,
      organizationId: id,
      description: `Activated organization '${updated.name}'`,
      newValues: { 'subscription.status': 'active' },
    });

    return updated;
  }

  /**
   * Suspend an organization.
   * @param {string} id
   * @param {object} actor
   * @returns {Promise<Organization>}
   */
  async suspendOrganization(id, actor) {
    if (actor.role !== 'super_admin') {
      throw new ForbiddenError('Access Denied: Only Super Admins can suspend organizations.');
    }

    const org = await tenantContext.run({ isSystemOverride: true }, async () => {
      return this.organizationRepository.findByIdOrFail(id, 'Organization');
    });

    if (org.subscription.status === 'suspended') {
      return org;
    }

    const updated = await tenantContext.run({ isSystemOverride: true }, async () => {
      return this.organizationRepository.update(id, { 'subscription.status': 'suspended' });
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Organization',
      entityId: id,
      userId: actor.id,
      organizationId: id,
      description: `Suspended organization '${updated.name}'`,
      newValues: { 'subscription.status': 'suspended' },
    });

    return updated;
  }

  /**
   * Archive/Soft-delete an organization.
   * Triggers cascade deletions of all branches and user accounts!
   * @param {string} id
   * @param {object} actor
   */
  async archiveOrganization(id, actor) {
    if (actor.role !== 'super_admin') {
      throw new ForbiddenError('Access Denied: Only Super Admins can archive organizations.');
    }

    const org = await tenantContext.run({ isSystemOverride: true }, async () => {
      return this.organizationRepository.findByIdOrFail(id, 'Organization');
    });

    // 1. Cascade Soft-Delete Branches
    const { Branch } = require('../branch/branch.model');
    await tenantContext.run({ isSystemOverride: true }, async () => {
      await Branch.updateMany(
        { organizationId: id, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: actor.id } }
      );
    });

    // 2. Cascade Soft-Delete Users
    const { User } = require('../user/user.model');
    await tenantContext.run({ isSystemOverride: true }, async () => {
      await User.updateMany(
        { organizationId: id, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: actor.id, isActive: false } }
      );
    });

    // 3. Soft-delete Organization itself
    await tenantContext.run({ isSystemOverride: true }, async () => {
      await this.organizationRepository.softDelete(id, actor.id);
    });

    // 4. Audit Log
    await this.logAudit({
      action: AUDIT_ACTIONS.DELETE,
      entity: 'Organization',
      entityId: id,
      userId: actor.id,
      organizationId: id,
      description: `Archived organization '${org.name}' and all associated branches and user accounts.`,
    });
  }
}

module.exports = { OrganizationService };
