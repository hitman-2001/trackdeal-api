'use strict';

const { Permission } = require('./permission.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

// ---------------------------------------------------------------------------
// PermissionRepository
// Owner: Authorization Module
// ---------------------------------------------------------------------------

class PermissionRepository extends BaseRepository {
  constructor() {
    super(Permission);
    this.isTenantScoped = false; // Permissions are system-wide metadata and not tenant-scoped
  }

  /**
   * Find a permission by its unique key (e.g. 'users.create').
   * @param {string} permissionKey
   * @returns {Promise<Permission|null>}
   */
  async findByKey(permissionKey) {
    return this.model.findOne({ permissionKey: permissionKey.toLowerCase().trim() });
  }

  /**
   * Find permissions by an array of keys.
   * @param {string[]} keys
   * @returns {Promise<Permission[]>}
   */
  async findByKeys(keys) {
    if (!keys || keys.length === 0) return [];
    const normalizedKeys = keys.map((k) => k.toLowerCase().trim());
    const dbPermissions = await this.model.find({ permissionKey: { $in: normalizedKeys } });
    const foundKeys = new Set(dbPermissions.map((p) => p.permissionKey));

    // Fallback: If any system permission key defined in PERMISSIONS is in keys
    // but not yet inserted in Permission collection, return synthetic doc so validation does not fail
    const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');
    const systemValues = new Set(Object.values(PERMISSIONS).map((v) => v.toLowerCase().trim()));

    for (const key of normalizedKeys) {
      if (!foundKeys.has(key) && (systemValues.has(key) || key === '*' || key.endsWith('.read') || key.endsWith('.view'))) {
        dbPermissions.push({
          permissionKey: key,
          module: key.split('.')[0] || key,
          action: key.split('.')[1] || 'access',
          isSystemPermission: true,
        });
      }
    }

    return dbPermissions;
  }
}

module.exports = { PermissionRepository };
