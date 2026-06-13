'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { PermissionRepository } = require('./permission.repository');
const { ROLE_PERMISSIONS, ROLES } = require('../../shared/constants/roles-permissions.constants');

class PermissionService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.permissionRepository = deps.permissionRepository || new PermissionRepository();
    this.repository = this.permissionRepository;
  }

  /**
   * List all permissions.
   * @param {object} [pagination]
   * @returns {Promise<object>} Paginated permissions
   */
  async listPermissions(pagination = {}) {
    return this.permissionRepository.paginate({}, pagination);
  }

  /**
   * Get all permissions grouped by their module/category.
   * @returns {Promise<object>} Grouped permissions
   */
  async getGroupedPermissions() {
    const permissions = await this.permissionRepository.findMany({}, { sort: { category: 1, module: 1, permissionKey: 1 } });
    
    const grouped = {};
    permissions.forEach((permission) => {
      const cat = permission.category || 'Other';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push({
        id: permission.id,
        module: permission.module,
        action: permission.action,
        permissionKey: permission.permissionKey,
        description: permission.description,
      });
    });

    return grouped;
  }

  /**
   * Return the static default role-permission matrix template.
   * Useful for UI/UX setup screens.
   * @returns {object} Default roles & permission list mapping
   */
  async getPermissionMatrix() {
    return {
      roles: Object.values(ROLES),
      matrix: ROLE_PERMISSIONS,
    };
  }
}

module.exports = { PermissionService };
