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
    return this.model.find({ permissionKey: { $in: normalizedKeys } });
  }
}

module.exports = { PermissionRepository };
