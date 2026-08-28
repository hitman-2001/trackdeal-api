'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { BaseService } = require('../../shared/base/BaseService');
const { Organization } = require('../organization/organization.model');
const { User } = require('../user/user.model');
const { Role } = require('../authorization/role.model');
const { Lead } = require('../lead/lead.model');
const { Property } = require('../property/property.model');
const { Project } = require('../project/project.model');
const { Deal } = require('../deal/deal.model');
const { Agent } = require('../agent/agent.model');
const { AuditLog } = require('../audit/audit.model');
const { tenantContext } = require('../../shared/context/tenant-context');
const { NotFoundError, ForbiddenError, ConflictError, BusinessRuleError } = require('../../shared/errors');

class AdminService extends BaseService {
  /**
   * Enforce system admin authority
   */
  _ensureSystemAdmin(actor) {
    if (!actor || actor.role !== 'system_admin') {
      throw new ForbiddenError('Access restricted to TrackDeal System Administrators.');
    }
  }

  /**
   * Log administrative audit event
   */
  async _logAdminAudit(action, target, targetId, details, actor) {
    try {
      await tenantContext.run({ isSystemOverride: true }, async () => {
        await AuditLog.create({
          action,
          entity: target,
          entityId: targetId ? new mongoose.Types.ObjectId(targetId) : null,
          userId: actor.id ? new mongoose.Types.ObjectId(actor.id) : null,
          userEmail: actor.email,
          userName: `${actor.firstName || 'System'} ${actor.lastName || 'Admin'}`.trim(),
          description: details,
          organizationId: null,
          timestamp: new Date(),
        });
      });
    } catch (err) {
      console.error('Failed to log admin audit event:', err.message);
    }
  }

  /**
   * 1. High-level platform KPIs & Growth analytics
   */
  async getDashboardMetrics(actor) {
    this._ensureSystemAdmin(actor);

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalOrgs,
        activeOrgs,
        inactiveOrgs,
        suspendedOrgs,
        newOrgsThisMonth,
        totalUsers,
        newUsersThisMonth,
        totalLeads,
        totalProperties,
        totalProjects,
        totalDeals,
        totalAgents,
      ] = await Promise.all([
        Organization.countDocuments({ isDeleted: { $ne: true } }),
        Organization.countDocuments({ isDeleted: { $ne: true }, status: { $ne: 'suspended' } }),
        Organization.countDocuments({ isDeleted: { $ne: true }, status: 'inactive' }),
        Organization.countDocuments({ isDeleted: { $ne: true }, status: 'suspended' }),
        Organization.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: startOfMonth } }),
        User.countDocuments({ isDeleted: { $ne: true } }),
        User.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: startOfMonth } }),
        Lead.countDocuments({ isDeleted: { $ne: true } }),
        Property.countDocuments({ isDeleted: { $ne: true } }),
        Project.countDocuments({ isDeleted: { $ne: true } }),
        Deal.countDocuments({ isDeleted: { $ne: true } }),
        Agent.countDocuments({ isDeleted: { $ne: true } }),
      ]);

      // Top active organizations with user and lead counts
      const recentOrgs = await Organization.find({ isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate('ownerId', 'firstName lastName email')
        .lean();

      // Enrich recent orgs with stats
      const enrichedRecentOrgs = await Promise.all(
        recentOrgs.map(async (org) => {
          const [usersCount, leadsCount] = await Promise.all([
            User.countDocuments({ organizationId: org._id, isDeleted: false }),
            Lead.countDocuments({ organizationId: org._id, isDeleted: false }),
          ]);
          return {
            ...org,
            usersCount,
            leadsCount,
          };
        })
      );

      return {
        summary: {
          totalOrganizations: totalOrgs,
          activeTenants: activeOrgs,
          inactiveTenants: inactiveOrgs,
          suspendedTenants: suspendedOrgs,
          newOrganizationsThisMonth: newOrgsThisMonth,
          totalUsers,
          newUsersThisMonth,
          totalLeads,
          totalProperties,
          totalProjects,
          totalDeals,
          totalChannelPartners: totalAgents,
        },
        recentOrganizations: enrichedRecentOrgs,
      };
    });
  }

  /**
   * 2. Paginated tenant organizations list with stats
   */
  async getOrganizations(query = {}, actor) {
    this._ensureSystemAdmin(actor);

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const page = Math.max(1, parseInt(query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
      const skip = (page - 1) * limit;

      const filter = { isDeleted: { $ne: true } };
      if (query.status) filter.status = query.status;
      if (query.search) {
        const searchRegex = new RegExp(query.search.trim(), 'i');
        filter.$or = [
          { name: searchRegex },
          { code: searchRegex },
          { email: searchRegex },
          { city: searchRegex },
        ];
      }

      const [total, orgs] = await Promise.all([
        Organization.countDocuments(filter),
        Organization.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('ownerId', 'firstName lastName email mobile')
          .lean(),
      ]);

      // Enrich with live counters
      const enrichedOrgs = await Promise.all(
        orgs.map(async (org) => {
          const [usersCount, leadsCount, propertiesCount, dealsCount] = await Promise.all([
            User.countDocuments({ organizationId: org._id, isDeleted: false }),
            Lead.countDocuments({ organizationId: org._id, isDeleted: false }),
            Property.countDocuments({ organizationId: org._id, isDeleted: false }),
            Deal.countDocuments({ organizationId: org._id, isDeleted: false }),
          ]);

          return {
            ...org,
            usersCount,
            leadsCount,
            propertiesCount,
            dealsCount,
          };
        })
      );

      return {
        data: enrichedOrgs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      };
    });
  }

  /**
   * 3. Create a new Organization + Owner User
   */
  async createOrganization(data, actor) {
    this._ensureSystemAdmin(actor);

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const {
        name,
        code,
        ownerName,
        ownerEmail,
        ownerMobile,
        password,
        plan = 'AGENCY',
        maxUsers = 10,
        city = 'Pune',
        state = 'Maharashtra',
        country = 'India',
        address = '',
      } = data;

      if (!name || !name.trim()) throw new BusinessRuleError('Organization name is required.');
      if (!ownerEmail || !ownerEmail.trim()) throw new BusinessRuleError('Owner email is required.');

      const cleanEmail = ownerEmail.trim().toLowerCase();
      const existingUser = await User.findOne({ email: cleanEmail, isDeleted: false });
      if (existingUser) {
        throw new ConflictError(`A user with email '${cleanEmail}' already exists.`);
      }

      // Generate organization code if not provided
      const orgCode = (code || name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)).toUpperCase();

      // 1. Create Organization
      const org = await Organization.create({
        name: name.trim(),
        code: orgCode,
        email: cleanEmail,
        phone: ownerMobile || '',
        organizationType: plan,
        status: 'active',
        subscriptionPlan: plan.toLowerCase(),
        maxUsers: Number(maxUsers) || 10,
        city: city || 'Pune',
        state: state || 'Maharashtra',
        country: country || 'India',
        address: address || `${city || 'Pune'}, ${state || 'Maharashtra'}`,
        createdBy: actor.id,
      });

      // 2. Resolve org_admin role
      let orgAdminRole = await Role.findOne({ code: 'org_admin' });
      if (!orgAdminRole) {
        orgAdminRole = await Role.create({
          name: 'Organization Admin',
          code: 'org_admin',
          description: 'Organization Administrator with full tenant-scoped management access.',
          permissions: ['*'],
          isSystem: true,
          organizationId: null,
        });
      }

      // 3. Create Owner User
      const [firstName, ...rest] = (ownerName || 'Admin User').trim().split(' ');
      const lastName = rest.join(' ') || 'Admin';
      const initialPassword = password || 'TrackDeal@123';
      const hashedPassword = await bcrypt.hash(initialPassword, 12);

      const owner = await User.create({
        firstName,
        lastName,
        email: cleanEmail,
        mobile: ownerMobile || '',
        password: hashedPassword,
        organizationId: org._id,
        roleId: orgAdminRole._id,
        status: 'active',
        isActive: true,
        createdBy: actor.id,
      });

      // Link owner back to Organization
      org.ownerId = owner._id;
      await org.save();

      await this._logAdminAudit('CREATE_ORGANIZATION', 'Organization', org._id, `Created organization '${org.name}' with owner '${cleanEmail}'`, actor);

      return {
        organization: org,
        owner: {
          id: owner._id,
          name: `${firstName} ${lastName}`,
          email: owner.email,
          initialPassword,
        },
      };
    });
  }

  /**
   * 4. Get detailed Organization overview with stats
   */
  async getOrganizationById(id, actor) {
    this._ensureSystemAdmin(actor);

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const org = await Organization.findById(id)
        .populate('ownerId', 'firstName lastName email mobile status lastLoginAt')
        .lean();

      if (!org || org.isDeleted) {
        throw new NotFoundError('Organization', id);
      }

      const [usersCount, leadsCount, propertiesCount, projectsCount, dealsCount, agentsCount] =
        await Promise.all([
          User.countDocuments({ organizationId: org._id, isDeleted: false }),
          Lead.countDocuments({ organizationId: org._id, isDeleted: false }),
          Property.countDocuments({ organizationId: org._id, isDeleted: false }),
          Project.countDocuments({ organizationId: org._id, isDeleted: false }),
          Deal.countDocuments({ organizationId: org._id, isDeleted: false }),
          Agent.countDocuments({ organizationId: org._id, isDeleted: false }),
        ]);

      return {
        ...org,
        stats: {
          totalUsers: usersCount,
          totalLeads: leadsCount,
          totalProperties: propertiesCount,
          totalProjects: projectsCount,
          totalDeals: dealsCount,
          totalAgents: agentsCount,
        },
      };
    });
  }

  /**
   * 5. Update Organization settings, plan, status
   */
  async updateOrganization(id, data, actor) {
    this._ensureSystemAdmin(actor);

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const org = await Organization.findById(id);
      if (!org || org.isDeleted) {
        throw new NotFoundError('Organization', id);
      }

      if (data.name) org.name = data.name.trim();
      if (data.status) org.status = data.status;
      if (data.organizationType || data.plan) {
        org.organizationType = data.organizationType || data.plan;
        org.subscriptionPlan = (data.organizationType || data.plan).toLowerCase();
      }
      if (data.maxUsers !== undefined) org.maxUsers = Number(data.maxUsers);
      if (data.phone) org.phone = data.phone;
      if (data.city) org.city = data.city;
      if (data.state) org.state = data.state;
      if (data.country) org.country = data.country;
      if (data.address) org.address = data.address;

      await org.save();
      await this._logAdminAudit('UPDATE_ORGANIZATION', 'Organization', org._id, `Updated organization '${org.name}' (Status: ${org.status}, Plan: ${org.organizationType})`, actor);

      return org;
    });
  }

  /**
   * 6. Get all users belonging to a specific organization
   */
  async getOrganizationUsers(orgId, query = {}, actor) {
    this._ensureSystemAdmin(actor);

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const filter = { organizationId: orgId, isDeleted: false };
      if (query.status) filter.status = query.status;

      const users = await User.find(filter)
        .populate('roleId', 'name code')
        .sort({ createdAt: -1 })
        .lean();

      return users;
    });
  }

  /**
   * 7. Reset Password for Tenant Owner
   */
  async resetOwnerPassword(orgId, newPassword, actor) {
    this._ensureSystemAdmin(actor);

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const org = await Organization.findById(orgId);
      if (!org || org.isDeleted) {
        throw new NotFoundError('Organization', orgId);
      }

      if (!org.ownerId) {
        throw new BusinessRuleError('No owner assigned to this organization.');
      }

      const user = await User.findById(org.ownerId);
      if (!user) throw new NotFoundError('User', org.ownerId);

      const pass = newPassword || 'TrackDeal@123';
      user.password = await bcrypt.hash(pass, 12);
      user.loginAttempts = 0;
      user.lockoutUntil = undefined;
      await user.save();

      await this._logAdminAudit('RESET_OWNER_PASSWORD', 'User', user._id, `Reset password for organization owner '${user.email}'`, actor);

      return {
        success: true,
        message: `Password for ${user.email} successfully updated.`,
        temporaryPassword: pass,
      };
    });
  }

  /**
   * 8. Global User Management (List users across all or specific orgs)
   */
  async getUsers(query = {}, actor) {
    this._ensureSystemAdmin(actor);

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const page = Math.max(1, parseInt(query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 15));
      const skip = (page - 1) * limit;

      const filter = { isDeleted: false };
      if (query.organizationId) filter.organizationId = query.organizationId;
      if (query.status) filter.status = query.status;
      if (query.role) {
        const roleDoc = await Role.findOne({ code: query.role });
        if (roleDoc) filter.roleId = roleDoc._id;
      }
      if (query.search) {
        const searchRegex = new RegExp(query.search.trim(), 'i');
        filter.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { mobile: searchRegex },
        ];
      }

      const [total, users] = await Promise.all([
        User.countDocuments(filter),
        User.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('organizationId', 'name code status')
          .populate('roleId', 'name code')
          .lean(),
      ]);

      return {
        data: users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      };
    });
  }

  /**
   * 9. Create a user under any tenant organization
   */
  async createUser(data, actor) {
    this._ensureSystemAdmin(actor);

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const {
        organizationId,
        firstName,
        lastName,
        email,
        mobile,
        role = 'agent',
        password,
        status = 'active',
      } = data;

      if (!organizationId) throw new BusinessRuleError('Organization ID is required.');
      if (!firstName || !firstName.trim()) throw new BusinessRuleError('First name is required.');
      if (!email || !email.trim()) throw new BusinessRuleError('Email is required.');

      const cleanEmail = email.trim().toLowerCase();
      const existing = await User.findOne({ email: cleanEmail, isDeleted: false });
      if (existing) {
        throw new ConflictError(`A user with email '${cleanEmail}' already exists.`);
      }

      const org = await Organization.findById(organizationId);
      if (!org || org.isDeleted) throw new NotFoundError('Organization', organizationId);

      const roleDoc = await this._resolveRoleDoc(role);

      const initialPassword = password || 'TrackDeal@123';
      const hashedPassword = await bcrypt.hash(initialPassword, 12);

      const newUser = await User.create({
        organizationId: org._id,
        firstName: firstName.trim(),
        lastName: (lastName || '').trim(),
        email: cleanEmail,
        mobile: mobile || '',
        roleId: roleDoc._id,
        role: roleDoc._id,
        status,
        isActive: status === 'active',
        password: hashedPassword,
        createdBy: actor.id,
      });

      await this._logAdminAudit('CREATE_USER', 'User', newUser._id, `Created user '${cleanEmail}' (Role: ${roleDoc.name}) under organization '${org.name}'`, actor);

      return {
        user: {
          ...newUser.toObject(),
          role: roleDoc.code,
        },
        temporaryPassword: initialPassword,
      };
    });
  }

  /**
   * Helper to robustly resolve Role document from ID, code, or name (case-insensitive)
   */
  async _resolveRoleDoc(roleInput) {
    if (!roleInput) {
      return Role.findOne({ code: 'agent' });
    }
    const clean = String(roleInput).trim();
    if (require('mongoose').Types.ObjectId.isValid(clean) && clean.length === 24) {
      const byId = await Role.findById(clean);
      if (byId) return byId;
    }

    let normalized = clean.toLowerCase().replace(/[\s-]+/g, '_');
    if (normalized === 'organization_admin') normalized = 'org_admin';
    if (normalized === 'system_administrator') normalized = 'system_admin';

    const roleDoc = await Role.findOne({
      $or: [
        { code: normalized },
        { code: clean },
        { code: clean.toLowerCase() },
        { name: new RegExp(`^${clean}$`, 'i') },
      ],
    });

    if (!roleDoc) {
      throw new BusinessRuleError(`Role '${roleInput}' is invalid or not registered in the system.`);
    }
    return roleDoc;
  }

  /**
   * 10. Update User (Role, Status, Password, Profile)
   */
  async updateUser(id, data, actor) {
    this._ensureSystemAdmin(actor);

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const user = await User.findById(id);
      if (!user || user.isDeleted) throw new NotFoundError('User', id);

      if (data.firstName) user.firstName = data.firstName.trim();
      if (data.lastName !== undefined) user.lastName = data.lastName.trim();
      if (data.mobile !== undefined) user.mobile = data.mobile;
      if (data.status) {
        user.status = data.status;
        user.isActive = data.status === 'active';
      }
      if (data.role) {
        const roleDoc = await this._resolveRoleDoc(data.role);
        user.roleId = roleDoc._id;
        user.role = roleDoc._id;
      }
      if (data.password) {
        user.password = await bcrypt.hash(data.password, 12);
        user.loginAttempts = 0;
        user.lockoutUntil = undefined;
      }

      await user.save();
      await this._logAdminAudit('UPDATE_USER', 'User', user._id, `Updated user '${user.email}' (Status: ${user.status}, Role: ${data.role || 'unchanged'})`, actor);

      return user;
    });
  }

  /**
   * 11. Move User to Another Organization
   */
  async moveUserOrganization(userId, newOrgId, actor) {
    this._ensureSystemAdmin(actor);

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const user = await User.findById(userId);
      if (!user || user.isDeleted) throw new NotFoundError('User', userId);

      const targetOrg = await Organization.findById(newOrgId);
      if (!targetOrg || targetOrg.isDeleted) throw new NotFoundError('Organization', newOrgId);

      const previousOrgId = user.organizationId;
      user.organizationId = targetOrg._id;
      user.branchId = null;
      await user.save();

      await this._logAdminAudit('MOVE_USER_ORGANIZATION', 'User', user._id, `Moved user '${user.email}' from Org '${previousOrgId}' to Org '${targetOrg.name}'`, actor);

      return user;
    });
  }

  /**
   * 12. Global Audit Logs
   */
  async getAuditLogs(query = {}, actor) {
    this._ensureSystemAdmin(actor);

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const page = Math.max(1, parseInt(query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
      const skip = (page - 1) * limit;

      const filter = {};
      if (query.action) filter.action = query.action;
      if (query.search) {
        const searchRegex = new RegExp(query.search.trim(), 'i');
        filter.$or = [
          { action: searchRegex },
          { userEmail: searchRegex },
          { userName: searchRegex },
          { description: searchRegex },
        ];
      }

      const [total, logs] = await Promise.all([
        AuditLog.countDocuments(filter),
        AuditLog.find(filter)
          .sort({ createdAt: -1, timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      return {
        data: logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      };
    });
  }

  /**
   * 13. Global Search across Organizations and Users
   */
  async globalSearch(queryStr, actor) {
    this._ensureSystemAdmin(actor);

    if (!queryStr || !queryStr.trim()) {
      return { organizations: [], users: [] };
    }

    const q = queryStr.trim();
    const regex = new RegExp(q, 'i');

    return tenantContext.run({ isSystemOverride: true }, async () => {
      const [organizations, users] = await Promise.all([
        Organization.find({
          isDeleted: false,
          $or: [{ name: regex }, { code: regex }, { email: regex }, { city: regex }],
        })
          .limit(8)
          .select('name code status email organizationType')
          .lean(),
        User.find({
          isDeleted: false,
          $or: [{ firstName: regex }, { lastName: regex }, { email: regex }, { mobile: regex }],
        })
          .limit(8)
          .populate('organizationId', 'name')
          .select('firstName lastName email mobile status organizationId')
          .lean(),
      ]);

      return { organizations, users };
    });
  }
}

module.exports = { AdminService };
