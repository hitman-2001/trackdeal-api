'use strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/trackdeal-test';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-that-is-at-least-32-characters';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { UserService } = require('../src/modules/user/user.service');

function queryResult(value) {
  return {
    select() { return this; },
    lean: async () => value,
  };
}

function serviceWith(overrides = {}) {
  const updates = [];
  const revocations = [];
  const service = new UserService({
    userRepository: {
      findByIdOrFail: async () => ({
        _id: 'user-2',
        id: 'user-2',
        email: 'staff@example.com',
        organizationId: 'org-1',
        roleId: 'staff-role',
      }),
      update: async (id, update) => updates.push({ id, update }),
      ...overrides.userRepository,
    },
    userInvitationRepository: {},
    permissionRepository: {},
    notificationService: {},
    roleModel: overrides.roleModel || { findById: () => queryResult({ code: 'agent' }) },
    refreshTokenModel: {
      updateMany: async (filter, update) => revocations.push({ filter, update }),
    },
  });
  service.logAudit = async (entry) => { service.auditEntry = entry; };
  return { service, updates, revocations };
}

test('organization admin updates a same-organization password and revokes sessions', async () => {
  const { service, updates, revocations } = serviceWith();

  await service.updatePasswordAsAdmin('user-2', 'NewSecure123!', {
    id: 'admin-1',
    role: 'org_admin',
    organizationId: 'org-1',
  });

  assert.equal(updates.length, 1);
  assert.notEqual(updates[0].update.password, 'NewSecure123!');
  assert.equal(await bcrypt.compare('NewSecure123!', updates[0].update.password), true);
  assert.ok(updates[0].update.passwordChangedAt instanceof Date);
  assert.deepEqual(revocations[0].filter, { user: 'user-2', isRevoked: false });
  assert.doesNotMatch(JSON.stringify(service.auditEntry), /NewSecure123!/);
});

test('organization admin cannot update a user in another organization', async () => {
  const { service, updates } = serviceWith({
    userRepository: {
      findByIdOrFail: async () => ({
        id: 'user-2',
        email: 'outside@example.com',
        organizationId: 'org-2',
        roleId: 'staff-role',
      }),
    },
  });

  await assert.rejects(
    () => service.updatePasswordAsAdmin('user-2', 'NewSecure123!', {
      id: 'admin-1', role: 'org_admin', organizationId: 'org-1',
    }),
    /own organization/,
  );
  assert.equal(updates.length, 0);
});

test('non-admin users cannot update another user password', async () => {
  const { service, updates } = serviceWith();

  await assert.rejects(
    () => service.updatePasswordAsAdmin('user-2', 'NewSecure123!', {
      id: 'manager-1', role: 'manager', organizationId: 'org-1',
    }),
    /Only an Organization Admin/,
  );
  assert.equal(updates.length, 0);
});
