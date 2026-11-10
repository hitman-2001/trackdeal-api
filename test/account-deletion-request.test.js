'use strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/trackdeal-test';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-that-is-at-least-32-characters';

const test = require('node:test');
const assert = require('node:assert/strict');
const { UserService } = require('../src/modules/user/user.service');

function chainResult(value) {
  return {
    select() { return this; },
    lean: async () => value,
  };
}

test('account deletion request is stored and organization admins are notified', async () => {
  const updates = [];
  const notifications = [];
  const user = {
    _id: 'user-1',
    id: 'user-1',
    firstName: 'Asha',
    lastName: 'Patil',
    email: 'asha@example.com',
    organizationId: 'org-1',
  };
  const repository = {
    findByIdOrFail: async () => user,
    update: async (id, update) => updates.push({ id, update }),
    model: {
      find: () => chainResult([{ _id: 'admin-1' }, { _id: 'admin-2' }]),
    },
  };
  const service = new UserService({
    userRepository: repository,
    userInvitationRepository: {},
    permissionRepository: {},
    notificationService: { send: async (payload) => notifications.push(payload) },
    roleModel: { find: () => chainResult([{ _id: 'role-admin' }]) },
  });
  service.logAudit = async () => {};

  const result = await service.requestAccountDeletion({ id: 'user-1' }, 'No longer needed');

  assert.equal(result.status, 'pending');
  assert.equal(result.alreadyRequested, false);
  assert.equal(updates[0].update.accountDeletionRequest.status, 'pending');
  assert.equal(updates[0].update.accountDeletionRequest.reason, 'No longer needed');
  assert.equal(notifications.length, 2);
  assert.match(notifications[0].message, /Asha Patil \(asha@example\.com\)/);
  assert.equal(notifications[0].actionUrl, '/app/settings/users');
});

test('an existing pending request does not create duplicate notifications', async () => {
  const requestedAt = new Date('2026-11-10T08:00:00.000Z');
  const service = new UserService({
    userRepository: {
      findByIdOrFail: async () => ({
        id: 'user-1',
        accountDeletionRequest: { status: 'pending', requestedAt },
      }),
    },
    userInvitationRepository: {},
    permissionRepository: {},
    notificationService: { send: async () => assert.fail('must not notify twice') },
    roleModel: {},
  });

  const result = await service.requestAccountDeletion({ id: 'user-1' });

  assert.equal(result.alreadyRequested, true);
  assert.equal(result.requestedAt, requestedAt);
});

test('rejecting a deletion request re-enables future requests and notifies the user', async () => {
  const updates = [];
  const notifications = [];
  const service = new UserService({
    userRepository: {
      findByIdOrFail: async () => ({
        _id: 'user-1',
        id: 'user-1',
        email: 'asha@example.com',
        organizationId: 'org-1',
        accountDeletionRequest: { status: 'pending' },
      }),
      update: async (id, update) => updates.push({ id, update }),
    },
    userInvitationRepository: {},
    permissionRepository: {},
    notificationService: { send: async (payload) => notifications.push(payload) },
    roleModel: {},
  });
  service.logAudit = async () => {};

  const result = await service.resolveAccountDeletionRequest('user-1', 'reject', {
    id: 'admin-1', role: 'org_admin', organizationId: 'org-1',
  });

  assert.equal(result.status, 'rejected');
  assert.equal(updates[0].update['accountDeletionRequest.status'], 'rejected');
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].message, /submit a new request/);
});

test('approving a deletion request uses the existing soft-delete workflow', async () => {
  const postDeleteUpdates = [];
  const service = new UserService({
    userRepository: {
      findByIdOrFail: async () => ({
        _id: 'user-1',
        id: 'user-1',
        email: 'asha@example.com',
        organizationId: 'org-1',
        accountDeletionRequest: { status: 'pending' },
      }),
      model: {
        updateOne: async (filter, update) => postDeleteUpdates.push({ filter, update }),
      },
    },
    userInvitationRepository: {},
    permissionRepository: {},
    notificationService: {},
    roleModel: {},
  });
  service.deleteUser = async () => ({ deletedUserId: 'user-1', reassignedLeadsCount: 2 });

  const result = await service.resolveAccountDeletionRequest('user-1', 'approve', {
    id: 'admin-1', role: 'org_admin', organizationId: 'org-1',
  });

  assert.equal(result.status, 'approved');
  assert.equal(result.deletedUserId, 'user-1');
  assert.equal(postDeleteUpdates[0].update.$set['accountDeletionRequest.status'], 'approved');
});
