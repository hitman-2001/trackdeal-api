'use strict';

const { Permission } = require('../modules/authorization/permission.model');
const { Role } = require('../modules/authorization/role.model');
const { ROLES, PERMISSIONS, ROLE_PERMISSIONS, ROLE_ALLOWED_TIERS } = require('../shared/constants/roles-permissions.constants');
const { tenantContext } = require('../shared/context/tenant-context');

/**
 * Capitalize first letter of a string.
 */
function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Format permission category based on module name.
 */
function formatCategory(moduleName) {
  if (moduleName === 'notifications') return 'Notification Management';
  if (moduleName === 'commissions') return 'Commission Management';
  return `${capitalize(moduleName)} Management`;
}

/**
 * Seed all default system permissions and role templates into MongoDB.
 * Runs in system bypass context to circumvent multi-tenant safeguards.
 * @param {import('pino').Logger} logger - Pino logger instance
 */
async function seedDatabase(logger = console) {
  logger.info('[Seeder] Starting database seeding process...');

  await tenantContext.run({ isSystemOverride: true }, async () => {
    try {
      // 1. Seed Permissions
      const permissionOps = [];
      const permissionKeys = Object.values(PERMISSIONS);

      for (const key of permissionKeys) {
        const [moduleName, actionName] = key.split('.');
        const category = formatCategory(moduleName);
        const description = `Grants permission to ${actionName} ${moduleName}`;

        permissionOps.push({
          updateOne: {
            filter: { permissionKey: key },
            update: {
              $set: {
                module: moduleName,
                action: actionName,
                permissionKey: key,
                description,
                category,
                isSystemPermission: true,
              },
            },
            upsert: true,
          },
        });
      }

      if (permissionOps.length > 0) {
        const permResult = await Permission.bulkWrite(permissionOps);
        logger.info(
          `[Seeder] Seeded ${permissionOps.length} system permissions. (Upserted: ${permResult.upsertedCount}, Modified: ${permResult.modifiedCount})`
        );
      }

      // 2. Seed Role Templates
      const roleTemplates = [
        { name: 'Super Admin', code: ROLES.SUPER_ADMIN, description: 'Full system and root administration access.' },
        { name: 'Organization Admin', code: ROLES.ORG_ADMIN, description: 'Full administrative access within the organization.' },
        { name: 'Branch Manager', code: ROLES.BRANCH_MANAGER, description: 'Branch-level operational and team control. Enterprise organizations only.' },
        { name: 'Manager', code: ROLES.MANAGER, description: 'Team performance, leads, and operational coordination. Agency and Enterprise organizations.' },
        { name: 'Agent', code: ROLES.AGENT, description: 'Day-to-day lead, property, and deal operations.' },
        { name: 'Read Only', code: ROLES.READ_ONLY, description: 'View-only access to CRM records.' },
      ];

      const roleOps = [];
      for (const temp of roleTemplates) {
        const permissions = ROLE_PERMISSIONS[temp.code] || [];

        roleOps.push({
          updateOne: {
            filter: { organizationId: null, code: temp.code },
            update: {
              $set: {
                name: temp.name,
                code: temp.code,
                description: temp.description,
                isSystemRole: true,
                isActive: true,
                permissions,
                availableForTiers: ROLE_ALLOWED_TIERS[temp.code] || [],
              },
            },
            upsert: true,
          },
        });
      }

      if (roleOps.length > 0) {
        const roleResult = await Role.bulkWrite(roleOps);
        logger.info(
          `[Seeder] Seeded ${roleTemplates.length} system role templates. (Upserted: ${roleResult.upsertedCount}, Modified: ${roleResult.modifiedCount})`
        );
      }

      logger.info('✅ [Seeder] Database seeding completed successfully.');
    } catch (err) {
      logger.error({ err }, '❌ [Seeder] Database seeding failed');
      throw err;
    }
  });
}

module.exports = { seedDatabase };
