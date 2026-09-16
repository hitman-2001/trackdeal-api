'use strict';

const { Tenant } = require('./tenant.model');
const { Organization } = require('../organization/organization.model');
const { User } = require('../user/user.model');
const { tenantContext } = require('../../shared/context/tenant-context');
const { NotFoundError, ForbiddenError, ConflictError, BusinessRuleError } = require('../../shared/errors');
const {
  isPlatformAdmin,
  isOrgAdmin,
  normalizeEnabledModules,
  normalizeVertical,
  modulesForVertical,
} = require('./tenant.constants');
const { toTenantSlug } = require('./tenant.utils');

class TenantService {
  _ensurePlatformAdmin(actor) {
    if (!isPlatformAdmin(actor?.role)) {
      throw new ForbiddenError('Access restricted to platform Super Administrators.');
    }
  }

  async listModules(vertical) {
    return modulesForVertical(vertical);
  }

  async listTenants(query = {}, actor) {
    this._ensurePlatformAdmin(actor);
    return tenantContext.run({ isSystemOverride: true }, async () => {
      const filter = { isDeleted: { $ne: true } };
      if (query.status) filter.status = query.status;
      if (query.search) {
        const rx = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ name: rx }, { slug: rx }];
      }

      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        Tenant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Tenant.countDocuments(filter),
      ]);

      const tenantIds = data.map((t) => t._id);
      const orgCounts = await Organization.aggregate([
        { $match: { tenantId: { $in: tenantIds }, isDeleted: { $ne: true } } },
        { $group: { _id: '$tenantId', count: { $sum: 1 } } },
      ]);
      const userCounts = await User.aggregate([
        { $match: { tenantId: { $in: tenantIds }, isDeleted: { $ne: true } } },
        { $group: { _id: '$tenantId', count: { $sum: 1 } } },
      ]);
      const orgMap = Object.fromEntries(orgCounts.map((r) => [String(r._id), r.count]));
      const userMap = Object.fromEntries(userCounts.map((r) => [String(r._id), r.count]));

      return {
        data: data.map((t) => ({
          ...t,
          organizationsCount: orgMap[String(t._id)] || 0,
          usersCount: userMap[String(t._id)] || 0,
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      };
    });
  }

  async createTenant(data, actor) {
    this._ensurePlatformAdmin(actor);
    const name = String(data?.name || '').trim();
    if (!name) throw new BusinessRuleError('Tenant name is required.');

    const slug = toTenantSlug(data.slug || name);
    if (!slug) throw new BusinessRuleError('A valid tenant slug is required.');

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const existing = await Tenant.findOne({ slug, isDeleted: { $ne: true } });
      if (existing) {
        throw new ConflictError(`Tenant '${slug}' already exists.`);
      }

      const domain = normalizeVertical(data.domain || data.vertical);
      const tenant = await Tenant.create({
        name,
        slug,
        domain,
        status: 'active',
        enabledModules: normalizeEnabledModules(data.enabledModules, domain),
        isDeleted: false,
        createdBy: actor.id || null,
      });

      return tenant;
    });
  }

  async getTenant(id, actor) {
    this._assertCanView(id, actor);
    return tenantContext.run({ isSystemOverride: true }, async () => {
      const tenant = await Tenant.findById(id);
      if (!tenant || tenant.isDeleted) throw new NotFoundError('Tenant', id);
      return tenant;
    });
  }

  async updateTenant(id, data, actor) {
    this._ensurePlatformAdmin(actor);
    return tenantContext.run({ isSystemOverride: true }, async () => {
      const tenant = await Tenant.findById(id);
      if (!tenant || tenant.isDeleted) throw new NotFoundError('Tenant', id);

      if (data.name) tenant.name = String(data.name).trim();
      if (Array.isArray(data.enabledModules)) {
        tenant.enabledModules = normalizeEnabledModules(data.enabledModules, tenant.domain);
      }
      if (data.status) {
        if (!['active', 'inactive', 'suspended'].includes(data.status)) {
          throw new BusinessRuleError('Invalid tenant status.');
        }
        tenant.status = data.status;
      }

      await tenant.save();
      return tenant;
    });
  }

  async setTenantStatus(id, status, actor) {
    if (!['active', 'suspended', 'inactive'].includes(status)) {
      throw new BusinessRuleError('Invalid tenant status.');
    }

    const platform = isPlatformAdmin(actor?.role);
    const orgAdmin = isOrgAdmin(actor?.role);
    if (!platform && !orgAdmin) {
      throw new ForbiddenError('You do not have permission to change tenant status.');
    }
    if (!platform && status !== 'suspended') {
      throw new ForbiddenError('Organization admins can only suspend their tenant.');
    }

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const tenant = await Tenant.findById(id);
      if (!tenant || tenant.isDeleted) throw new NotFoundError('Tenant', id);

      if (!platform) {
        if (!actor.tenantId || String(actor.tenantId) !== String(tenant._id)) {
          throw new ForbiddenError('You can only suspend your own tenant.');
        }
      }

      tenant.status = status;
      await tenant.save();
      return tenant;
    });
  }

  _assertCanView(id, actor) {
    if (isPlatformAdmin(actor?.role)) return;
    if (isOrgAdmin(actor?.role) && actor.tenantId && String(actor.tenantId) === String(id)) return;
    throw new ForbiddenError('Access denied for this tenant.');
  }
}

module.exports = { TenantService };
