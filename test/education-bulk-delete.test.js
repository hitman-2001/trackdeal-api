'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { EducationService } = require('../src/modules/education/education.service');
const { EducationLeadRepository } = require('../src/modules/education/education.repository');
const { EducationController } = require('../src/modules/education/education.controller');
const { tenantContext } = require('../src/shared/context/tenant-context');
const educationRoutes = require('../src/modules/education/education.routes');

const admin = { id: 'admin', organizationId: 'org', tenantVertical: 'education', role: 'org_admin' };
const ids = Array.from({ length: 371 }, (_, i) => (i + 1).toString(16).padStart(24, '0'));

function service(leadRepository) {
  const api = new EducationService({ leadRepository, classRepository: {}, studentRepository: {}, followUpRepository: {} });
  api.logAudit = async () => {};
  return api;
}

test('371 selected leads use one scoped database operation, with accurate counts on retry', async () => {
  let writes = 0;
  const api = service({ softDeleteMany: async (filter, userId) => {
    assert.deepEqual(filter, { _id: { $in: ids }, organizationId: 'org', tenantVertical: 'education', isDeleted: false });
    assert.equal(userId, admin.id);
    return { modifiedCount: writes++ === 0 ? 371 : 0 };
  } });
  assert.deepEqual(await api.removeLeadsBulk([...ids, ids[0]], admin), { deletedCount: 371, requestedCount: 371, skippedCount: 0 });
  assert.equal(writes, 1);
  assert.deepEqual(await api.removeLeadsBulk(ids, admin), { deletedCount: 0, requestedCount: 371, skippedCount: 371 });
});

test('delete permission does not allow staff to delete other staff leads', async () => {
  const api = service({ softDeleteMany: async filter => {
    assert.equal(filter.assignedTo, 'staff');
    assert.equal(filter.organizationId, 'org');
    return { modifiedCount: 3 };
  } });
  const result = await api.removeLeadsBulk(ids, { ...admin, id: 'staff', role: 'staff', permissions: ['leads.bulk_delete'] });
  assert.deepEqual(result, { deletedCount: 3, requestedCount: 371, skippedCount: 368 });
});

test('invalid selections, missing tenant, wrong vertical and unauthorized users cannot write', async () => {
  const api = service({ softDeleteMany: async () => assert.fail('must not write') });
  for (const invalid of [undefined, [], ['bad-id'], [ids[0], { $ne: null }]]) {
    await assert.rejects(api.removeLeadsBulk(invalid, admin), /valid lead IDs/);
  }
  await assert.rejects(api.removeLeadsBulk(ids, { ...admin, role: 'staff' }), /permission/);
  await assert.rejects(api.removeLeadsBulk(ids, { ...admin, tenantVertical: 'real_estate' }), /education tenant/);
  await assert.rejects(api.removeLeadsBulk(ids, { ...admin, organizationId: undefined }), /organization/);
});

test('repository enforces request tenant and preserves soft-delete metadata', async () => {
  const repo = new EducationLeadRepository();
  repo.model = { schema: { path: () => true }, updateMany: async (filter, update) => {
    assert.equal(filter.organizationId, 'actual-org');
    assert.deepEqual(filter.tenantId, { $in: ['actual-tenant', null] });
    assert.deepEqual(filter._id, { $in: ids });
    assert.equal(filter.isDeleted, false);
    assert.equal(update.$set.isDeleted, true);
    assert.equal(update.$set.deletedBy, admin.id);
    assert.ok(update.$set.deletedAt instanceof Date);
    return { modifiedCount: 371 };
  } };
  await assert.rejects(repo.softDeleteMany({ _id: { $in: ids } }, admin.id), /isolation failure/);
  await tenantContext.run({ organizationId: 'actual-org', tenantId: 'actual-tenant' }, () =>
    repo.softDeleteMany({ _id: { $in: ids }, organizationId: 'other-org', isDeleted: false }, admin.id));
});

test('bulk route accepts 371 IDs, rejects malformed requests, and requires deletion permission', async t => {
  let route;
  await educationRoutes({ addHook() {}, get() {}, put() {}, delete() {}, post(path, options) {
    if (path === '/leads/bulk-delete') route = options;
  } });
  const app = Fastify();
  t.after(() => app.close());
  let actor = admin;
  app.addHook('onRequest', async request => { request.user = actor; });
  const controller = new EducationController({ educationService: service({ softDeleteMany: async () => ({ modifiedCount: 371 }) }) });
  app.post('/leads/bulk-delete', { ...route, handler: controller.removeLeadsBulk });
  const request = payload => app.inject({ method: 'POST', url: '/leads/bulk-delete', payload });
  const response = await request({ ids });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.deletedCount, 371);
  for (const payload of [{}, { ids: [] }, { ids: ['bad'] }]) assert.equal((await request(payload)).statusCode, 400);
  actor = { ...admin, role: 'staff', permissions: [] };
  assert.equal((await request({ ids })).statusCode, 403);
});
