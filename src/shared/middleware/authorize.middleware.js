'use strict';

const { ForbiddenError } = require('../errors');
const { ROLES } = require('../constants/roles-permissions.constants');

// ---------------------------------------------------------------------------
// RBAC & Tenant-Aware Authorization Middleware Suite (Fastify preHandler Hooks)
// ---------------------------------------------------------------------------

/**
 * Require a single granular permission key.
 * Bypasses checks for the 'super_admin' system role.
 *
 * @param {string} permissionKey - e.g. 'users.create'
 * @returns {function} Fastify preHandler hook
 */
function requirePermission(permissionKey) {
  const normalizedKey = permissionKey.toLowerCase().trim();
  
  return async function requirePermissionHandler(request, reply) {
    const user = request.user;
    if (!user) {
      throw new ForbiddenError('Access denied: not authenticated');
    }

    // Super admin bypasses all permission restrictions
    if (user.role === ROLES.SUPER_ADMIN) {
      return;
    }

    const userPermissions = user.permissions || [];
    if (!userPermissions.includes(normalizedKey)) {
      throw new ForbiddenError(
        `Access denied: insufficient permissions. Required: ${permissionKey}`
      );
    }
  };
}

/**
 * Require at least one of the listed permission keys (OR logic).
 * Bypasses checks for the 'super_admin' system role.
 *
 * @param {string[]} permissionsList - e.g. ['deals.read', 'deals.update']
 * @returns {function} Fastify preHandler hook
 */
function requireAnyPermission(permissionsList) {
  const normalizedList = permissionsList.map((p) => p.toLowerCase().trim());

  return async function requireAnyPermissionHandler(request, reply) {
    const user = request.user;
    if (!user) {
      throw new ForbiddenError('Access denied: not authenticated');
    }

    // Super admin bypass
    if (user.role === ROLES.SUPER_ADMIN) {
      return;
    }

    const userPermissions = user.permissions || [];
    const hasAny = normalizedList.some((p) => userPermissions.includes(p));

    if (!hasAny) {
      throw new ForbiddenError(
        `Access denied: insufficient permissions. Required at least one of: ${permissionsList.join(', ')}`
      );
    }
  };
}

/**
 * Require a specific system role.
 *
 * @param {string} roleCode - e.g. 'org_admin', 'branch_manager'
 * @returns {function} Fastify preHandler hook
 */
function requireRole(roleCode) {
  const normalizedCode = roleCode.toLowerCase().trim();

  return async function requireRoleHandler(request, reply) {
    const user = request.user;
    if (!user) {
      throw new ForbiddenError('Access denied: not authenticated');
    }

    if (user.role !== ROLES.SUPER_ADMIN && user.role !== normalizedCode) {
      throw new ForbiddenError(
        `Access denied: role restriction active. Required: ${roleCode}`
      );
    }
  };
}

/**
 * Legacy support: authorize(requiredPermissions, options)
 * Maps to requirePermission or requireAnyPermission for backward compatibility.
 */
function authorize(requiredPermissions, options = { requireAll: false }) {
  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  if (permissions.length === 1 && !options.requireAll) {
    return requirePermission(permissions[0]);
  }

  return async function rbacHandler(request, reply) {
    const user = request.user;
    if (!user) {
      throw new ForbiddenError('Access denied: not authenticated');
    }

    if (user.role === ROLES.SUPER_ADMIN) {
      return;
    }

    const userPermissions = user.permissions || [];
    const hasPermission = options.requireAll
      ? permissions.every((p) => userPermissions.includes(p.toLowerCase().trim()))
      : permissions.some((p) => userPermissions.includes(p.toLowerCase().trim()));

    if (!hasPermission) {
      throw new ForbiddenError(
        `Access denied: insufficient permissions. Required: ${permissions.join(', ')}`
      );
    }
  };
}

/**
 * Check if the authenticated user is accessing their own resource, or has an overriding permission.
 *
 * @param {function} getResourceUserId - Extracts the owner userId from the request
 * @param {string} permission - Overriding permission key
 * @returns {function} Fastify preHandler hook
 */
function authorizeOwnerOrPermission(getResourceUserId, permission) {
  return async function ownerCheck(request, reply) {
    const user = request.user;
    if (!user) {
      throw new ForbiddenError('Access denied: not authenticated');
    }

    // Super admin or users with the overriding permission bypass ownership restrictions
    if (user.role === ROLES.SUPER_ADMIN || (user.permissions || []).includes(permission.toLowerCase().trim())) {
      return;
    }

    const resourceUserId = await getResourceUserId(request);
    if (String(resourceUserId) !== String(user.id)) {
      throw new ForbiddenError('Access denied: you can only access your own resources');
    }
  };
}

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireRole,
  authorize,
  authorizeOwnerOrPermission,
};
