'use strict';

const { Tenant } = require('./tenant.model');

function toTenantSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve an active tenant from a login input (name or slug).
 * Accepts "Swarajya" or "swarajya".
 */
async function findActiveTenantByInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const slug = toTenantSlug(raw);
  if (!slug) return null;

  return Tenant.findOne({
    status: 'active',
    isDeleted: { $ne: true },
    $or: [
      { slug },
      { name: { $regex: `^${escapeRegex(raw)}$`, $options: 'i' } },
    ],
  });
}

const { Organization } = require('../organization/organization.model');
const { normalizeVertical, verticalTenantSlug, moduleKeysForVertical } = require('./tenant.constants');

async function findActiveOrganizationByInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const slug = toTenantSlug(raw);
  const escaped = escapeRegex(raw);
  return Organization.findOne({
    status: { $in: ['active', 'trial'] },
    isDeleted: { $ne: true },
    $or: [
      { code: slug },
      { code: raw.toLowerCase() },
      { name: { $regex: `^${escaped}$`, $options: 'i' } },
    ],
  });
}

async function findVerticalTenant(vertical) {
  const slug = verticalTenantSlug(vertical);
  return Tenant.findOne({
    slug,
    status: 'active',
    isDeleted: { $ne: true },
  });
}

async function ensureVerticalTenant(vertical) {
  const domain = normalizeVertical(vertical);
  const slug = verticalTenantSlug(domain);
  const name = domain === 'education' ? 'Education' : 'Real Estate';
  return Tenant.findOneAndUpdate(
    { slug },
    {
      $set: {
        name,
        slug,
        domain,
        status: 'active',
        enabledModules: moduleKeysForVertical(domain),
        isDeleted: false,
        deletedAt: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = {
  toTenantSlug,
  findActiveTenantByInput,
  findActiveOrganizationByInput,
  findVerticalTenant,
  ensureVerticalTenant,
};
