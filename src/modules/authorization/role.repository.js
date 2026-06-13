'use strict';

const { Role } = require('./role.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

// ---------------------------------------------------------------------------
// RoleRepository
// Owner: Authorization Module
// ---------------------------------------------------------------------------

class RoleRepository extends BaseRepository {
  constructor() {
    super(Role);
  }

  /**
   * Override _applyTenantFilter to allow querying custom tenant roles
   * AND system-wide global roles (where organizationId is null and isSystemRole is true).
   * @param {object} filter
   * @returns {object} Filter query with tenant constraints
   * @private
   */
  _applyTenantFilter(filter = {}) {
    const { tenantContext } = require('../../shared/context/tenant-context');

    // System bypass
    if (tenantContext.isSystemOverride()) {
      return filter;
    }

    const organizationId = tenantContext.getOrganizationId();
    if (!organizationId) {
      throw new Error(
        `[SecurityError] Multi-tenant isolation failure: organizationId is missing in execution context for Role Repository.`
      );
    }

    // Ensure we don't break existing filter properties but restrict queries
    // to either the tenant's organization OR system-level default roles.
    const tenantFilter = {
      ...filter,
      $and: [
        {
          $or: [
            { organizationId },
            { organizationId: null, isSystemRole: true },
          ],
        },
      ],
    };

    // If there were query conditions on the filter itself, preserve them
    const originalKeys = Object.keys(filter);
    if (originalKeys.length > 0) {
      const criteria = {};
      originalKeys.forEach((key) => {
        criteria[key] = filter[key];
      });
      tenantFilter.$and.push(criteria);
    }

    return tenantFilter;
  }

  /**
   * Find a role by its unique code (e.g. 'super_admin' or custom codes).
   * @param {string} code
   * @returns {Promise<Role|null>}
   */
  async findByCode(code) {
    return this.findOne({ code: code.toLowerCase().trim() });
  }

  /**
   * Find a role by its unique name (e.g. 'Super Admin').
   * @param {string} name
   * @returns {Promise<Role|null>}
   */
  async findByName(name) {
    return this.findOne({ name: name.trim() });
  }

  /**
   * Find active roles.
   * @returns {Promise<Role[]>}
   */
  async findActive() {
    return this.findMany({ isActive: true });
  }
}

module.exports = { RoleRepository };
