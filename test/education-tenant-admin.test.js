'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { OrganizationService } = require('../src/modules/organization/organization.service');

function makeService(organizations) {
  const records = new Map(organizations.map((organization) => [String(organization._id), { ...organization }]));
  const repository = {
    async findById(id) {
      return records.get(String(id)) || null;
    },
    async findByIdOrFail(id) {
      const organization = records.get(String(id));
      if (!organization) throw new Error('not found');
      return organization;
    },
    async update(id, changes) {
      const organization = records.get(String(id));
      Object.assign(organization, { status: changes.status });
      organization.subscription = {
        ...(organization.subscription || {}),
        status: changes['subscription.status'],
      };
      return organization;
    },
  };
  const service = new OrganizationService({ organizationRepository: repository });
  service.logAudit = async () => {};
  return service;
}

const actor = { id: 'user-1', role: 'org_admin', organizationId: 'manch-id' };

test('Manch Classes org admins receive delegated Education tenant access', async () => {
  const service = makeService([
    {
      _id: 'manch-id',
      name: 'Manch Classes',
      code: 'manchcla',
      vertical: 'education',
      settings: {},
      isDeleted: false,
    },
  ]);

  const access = await service.getEducationAdminAccess(actor);
  assert.equal(access.allowed, true);
  assert.equal(String(access.organizationId), 'manch-id');
});

test('other organizations cannot self-grant Education tenant administration', async () => {
  const service = makeService([
    {
      _id: 'other-id',
      name: 'Other Institute',
      code: 'other',
      vertical: 'education',
      settings: {},
      isDeleted: false,
    },
  ]);

  const access = await service.getEducationAdminAccess({ ...actor, organizationId: 'other-id' });
  assert.equal(access.allowed, false);
});

test('delegated access can disable Education tenants but cannot disable itself or another vertical', async () => {
  const service = makeService([
    {
      _id: 'manch-id',
      name: 'Manch Classes',
      code: 'manchcla',
      vertical: 'education',
      settings: {},
      isDeleted: false,
      status: 'active',
      subscription: { status: 'active' },
    },
    {
      _id: 'education-id',
      name: 'Education Tenant',
      code: 'education',
      vertical: 'education',
      isDeleted: false,
      status: 'active',
      subscription: { status: 'active' },
    },
    {
      _id: 'real-estate-id',
      name: 'Real Estate Tenant',
      code: 'realestate',
      vertical: 'realEstate',
      isDeleted: false,
      status: 'active',
      subscription: { status: 'active' },
    },
  ]);

  const disabled = await service.setEducationTenantStatus('education-id', 'suspended', actor);
  assert.equal(disabled.status, 'suspended');
  assert.equal(disabled.subscription.status, 'suspended');

  await assert.rejects(
    () => service.setEducationTenantStatus('manch-id', 'suspended', actor),
    /cannot disable its own administrator tenant/i,
  );
  await assert.rejects(
    () => service.setEducationTenantStatus('real-estate-id', 'suspended', actor),
    /Only Education tenant organizations/i,
  );
});
