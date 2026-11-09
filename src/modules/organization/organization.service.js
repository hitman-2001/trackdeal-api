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

  _educationAdminCodes() {
    const configured = process.env.EDUCATION_TENANT_ADMIN_CODES || 'manchcla,manchclasses';
    return new Set(
      configured
        .split(',')
        .map((code) => code.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  async _resolveEducationAdmin(actor, { required = true } = {}) {
    const role = String(actor?.role || '').toLowerCase();
    const isOrgAdmin = role === 'org_admin' || role === 'organization_admin';
    if (!isOrgAdmin || !actor?.organizationId) {
      if (required) throw new ForbiddenError('Access restricted to the Manch Classes administrators.');
      return null;
    }

    const organization = await tenantContext.run({ isSystemOverride: true }, () =>
      this.organizationRepository.findById(actor.organizationId),
    );
    const hasDelegatedAccess = Boolean(
      organization &&
      !organization.isDeleted &&
      organization.vertical === 'education' &&
      (
        organization.settings?.educationTenantAdmin === true ||
        this._educationAdminCodes().has(String(organization.code || '').toLowerCase())
      )
    );

    if (!hasDelegatedAccess) {
      if (required) throw new ForbiddenError('Access restricted to the Manch Classes administrators.');
      return null;
    }
    return organization;
  }

  async getEducationAdminAccess(actor) {
    const organization = await this._resolveEducationAdmin(actor, { required: false });
    return {
      allowed: Boolean(organization),
      organizationId: organization?._id || null,
    };
  }

  async listEducationTenants(query = {}, actor) {
    const manager = await this._resolveEducationAdmin(actor);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const filter = { vertical: 'education', isDeleted: { $ne: true } };

    if (query.status) {
      if (query.status === 'suspended') {
        filter.$or = [{ status: 'suspended' }, { 'subscription.status': 'suspended' }];
      } else {
        filter.status = query.status;
        filter['subscription.status'] = { $ne: 'suspended' };
      }
    }
    if (query.search) {
      const escaped = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const search = new RegExp(escaped, 'i');
      const searchFields = [{ name: search }, { code: search }, { city: search }, { email: search }];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchFields }];
        delete filter.$or;
      } else {
        filter.$or = searchFields;
      }
    }

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const { User } = require('../user/user.model');
      const { Lead } = require('../lead/lead.model');
      const [total, organizations] = await Promise.all([
        this.organizationRepository.model.countDocuments(filter),
        this.organizationRepository.model.find(filter)
          .select('name code email phone city state organizationType status subscription maxUsers createdAt')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);
      const organizationIds = organizations.map((organization) => organization._id);
      const [userCounts, leadCounts] = await Promise.all([
        User.aggregate([
          { $match: { organizationId: { $in: organizationIds }, isDeleted: { $ne: true } } },
          { $group: { _id: '$organizationId', count: { $sum: 1 } } },
        ]),
        Lead.aggregate([
          { $match: { organizationId: { $in: organizationIds }, isDeleted: { $ne: true } } },
          { $group: { _id: '$organizationId', count: { $sum: 1 } } },
        ]),
      ]);
      const usersByOrg = Object.fromEntries(userCounts.map((row) => [String(row._id), row.count]));
      const leadsByOrg = Object.fromEntries(leadCounts.map((row) => [String(row._id), row.count]));

      return {
        data: organizations.map((organization) => ({
          ...organization,
          status: organization.status === 'suspended' || organization.subscription?.status === 'suspended'
            ? 'suspended'
            : organization.status,
          usersCount: usersByOrg[String(organization._id)] || 0,
          leadsCount: leadsByOrg[String(organization._id)] || 0,
          isCurrentOrganization: String(organization._id) === String(manager._id),
        })),
        pagination: { page, limit, total },
      };
    });
  }

  async setEducationTenantStatus(id, status, actor) {
    const manager = await this._resolveEducationAdmin(actor);
    if (!['active', 'suspended'].includes(status)) {
      throw new BusinessRuleError('Invalid Education tenant status.');
    }
    if (String(manager._id) === String(id)) {
      throw new BusinessRuleError('Manch Classes cannot disable its own administrator tenant.');
    }

    const organization = await tenantContext.run({ isSystemOverride: true }, () =>
      this.organizationRepository.findByIdOrFail(id, 'Organization'),
    );
    if (organization.vertical !== 'education') {
      throw new ForbiddenError('Only Education tenant organizations can be managed here.');
    }
    if (organization.subscription?.status === 'cancelled') {
      throw new BusinessRuleError('A cancelled tenant cannot be enabled from the Education directory.');
    }

    const oldStatus = organization.status;
    const oldSubscriptionStatus = organization.subscription?.status;
    const updated = await tenantContext.run({ isSystemOverride: true }, () =>
      this.organizationRepository.update(id, {
        status,
        'subscription.status': status,
      }),
    );

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Organization',
      entityId: id,
      userId: actor.id,
      organizationId: manager._id,
      description: `${status === 'suspended' ? 'Disabled' : 'Enabled'} Education tenant '${updated.name}' from Manch Classes`,
      oldValues: { status: oldStatus, 'subscription.status': oldSubscriptionStatus },
      newValues: { status, 'subscription.status': status },
    });
    return updated;
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
      let tenantId = data.tenantId || actor.tenantId || null;
      if (!tenantId) {
        const { Tenant } = require('../tenant/tenant.model');
        const swarajya = await Tenant.findOne({ slug: 'swarajya', status: 'active', isDeleted: { $ne: true } });
        tenantId = swarajya?._id || null;
      }

      return this.organizationRepository.create({
        ...data,
        code: codeSlug,
        subscription,
        maxUsers: subscription.maxUsers || 10,
        tenantId,
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
        tenantId: org.tenantId || null,
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
    // Delegated tenant administration is a platform-controlled capability and
    // must never be self-assigned through the regular organization settings API.
    if (actor.role !== 'super_admin' && data.settings) {
      delete data.settings.educationTenantAdmin;
    }

    // Synchronize maxUsers across root and subscription subdocument
    if (data.maxUsers !== undefined) {
      if (!data.subscription) {
        data.subscription = org.subscription?.toObject ? org.subscription.toObject() : { ...(org.subscription || {}) };
      }
      data.subscription.maxUsers = Number(data.maxUsers);
    } else if (data.subscription?.maxUsers !== undefined) {
      data.maxUsers = Number(data.subscription.maxUsers);
    }

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
