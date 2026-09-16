'use strict';

const TENANT_VERTICALS = Object.freeze({
  REAL_ESTATE: 'realEstate',
  EDUCATION: 'education',
});

const TENANT_VERTICAL_KEYS = Object.freeze(Object.values(TENANT_VERTICALS));

const REAL_ESTATE_MODULES = Object.freeze([
  { key: 'leads', label: 'Leads' },
  { key: 'tasks', label: 'Tasks & Follow-ups' },
  { key: 'agents', label: 'Channel Partners' },
  { key: 'properties', label: 'Properties' },
  { key: 'projects', label: 'Projects' },
  { key: 'deals', label: 'Deals' },
  { key: 'loans', label: 'Loans' },
  { key: 'agreements', label: 'Agreements' },
  { key: 'commissions', label: 'Commissions' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Team & Settings' },
]);

const EDUCATION_MODULES = Object.freeze([
  { key: 'leads', label: 'Student Leads' },
  { key: 'students', label: 'Students' },
  { key: 'classes', label: 'Classes' },
  { key: 'tasks', label: 'Tasks & Follow-ups' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Team & Settings' },
]);

const VERTICAL_MODULES = Object.freeze({
  [TENANT_VERTICALS.REAL_ESTATE]: REAL_ESTATE_MODULES,
  [TENANT_VERTICALS.EDUCATION]: EDUCATION_MODULES,
});

const TENANT_MODULES = REAL_ESTATE_MODULES;
const TENANT_MODULE_KEYS = Object.freeze(REAL_ESTATE_MODULES.map((m) => m.key));
const ALL_MODULE_KEYS = Object.freeze([
  ...new Set([
    ...REAL_ESTATE_MODULES.map((m) => m.key),
    ...EDUCATION_MODULES.map((m) => m.key),
  ]),
]);

function normalizeVertical(value) {
  const raw = String(value || '').trim();
  if (raw === 'education' || raw === 'Education') return TENANT_VERTICALS.EDUCATION;
  if (raw === 'real_estate' || raw === 'realEstate' || raw === 'Real Estate') {
    return TENANT_VERTICALS.REAL_ESTATE;
  }
  return TENANT_VERTICALS.REAL_ESTATE;
}

function isEducationVertical(value) {
  return normalizeVertical(value) === TENANT_VERTICALS.EDUCATION;
}

function modulesForVertical(vertical) {
  return VERTICAL_MODULES[normalizeVertical(vertical)] || REAL_ESTATE_MODULES;
}

function moduleKeysForVertical(vertical) {
  return modulesForVertical(vertical).map((m) => m.key);
}

const VERTICAL_TENANT_SLUGS = Object.freeze({
  [TENANT_VERTICALS.REAL_ESTATE]: 'real-estate',
  [TENANT_VERTICALS.EDUCATION]: 'education',
});

const EDUCATION_PLAN_MAP = Object.freeze({
  INDEPENDENT_TUTOR: 'INDIVIDUAL_AGENT',
  COACHING_INSTITUTE: 'AGENCY',
  MULTI_CAMPUS_INSTITUTE: 'ENTERPRISE_AGENCY',
});

const ORG_PLAN_CODES = Object.freeze(['INDIVIDUAL_AGENT', 'AGENCY', 'ENTERPRISE_AGENCY']);

function mapOrganizationPlan(vertical, plan) {
  const code = String(plan || '').trim();
  if (normalizeVertical(vertical) === TENANT_VERTICALS.EDUCATION) {
    return EDUCATION_PLAN_MAP[code] || (ORG_PLAN_CODES.includes(code) ? code : 'AGENCY');
  }
  return ORG_PLAN_CODES.includes(code) ? code : 'AGENCY';
}

function verticalTenantSlug(vertical) {
  return VERTICAL_TENANT_SLUGS[normalizeVertical(vertical)];
}

function isPlatformAdmin(role) {
  const code = String(role || '').toLowerCase();
  return code === 'super_admin' || code === 'system_admin';
}

function isOrgAdmin(role) {
  const code = String(role || '').toLowerCase();
  return code === 'org_admin' || code === 'organization_admin';
}

function normalizeEnabledModules(modules, vertical = TENANT_VERTICALS.REAL_ESTATE) {
  const allowedKeys = moduleKeysForVertical(vertical);
  const allowed = new Set(allowedKeys);
  if (!Array.isArray(modules) || modules.length === 0) {
    return [...allowedKeys];
  }
  const unique = [...new Set(modules.map((m) => String(m).trim()).filter((m) => allowed.has(m)))];
  return unique.length ? unique : [...allowedKeys];
}

function modulesToFeatureFlags(modules, vertical = TENANT_VERTICALS.REAL_ESTATE) {
  const enabled = new Set(normalizeEnabledModules(modules, vertical));
  const flags = {};
  for (const key of ALL_MODULE_KEYS) {
    flags[key] = enabled.has(key);
  }
  flags.commissionModule = enabled.has('commissions');
  flags.reportsModule = enabled.has('reports');
  return flags;
}

module.exports = {
  TENANT_VERTICALS,
  TENANT_VERTICAL_KEYS,
  VERTICAL_TENANT_SLUGS,
  EDUCATION_PLAN_MAP,
  mapOrganizationPlan,
  verticalTenantSlug,
  REAL_ESTATE_MODULES,
  EDUCATION_MODULES,
  VERTICAL_MODULES,
  TENANT_MODULES,
  TENANT_MODULE_KEYS,
  ALL_MODULE_KEYS,
  normalizeVertical,
  isEducationVertical,
  modulesForVertical,
  moduleKeysForVertical,
  isPlatformAdmin,
  isOrgAdmin,
  normalizeEnabledModules,
  modulesToFeatureFlags,
};
