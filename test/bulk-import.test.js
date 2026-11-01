'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { processBulkImport } = require('../src/shared/utils/bulk-import');
const { EducationService } = require('../src/modules/education/education.service');
const { LeadService } = require('../src/modules/lead/lead.service');

const actor = { id: 'user', organizationId: 'org', tenantVertical: 'education' };

test('400 uploaded rows are handled as one batch with bounded concurrency', async () => {
  const rows = Array.from({ length: 400 }, (_, index) => ({
    mobile: String(9000000000 + index),
    firstName: `Lead ${index}`,
  }));
  let active = 0;
  let peak = 0;
  let processed = 0;
  const result = await processBulkImport(rows, async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setImmediate(resolve));
    processed++;
    active--;
  }, { concurrency: 8 });

  assert.equal(processed, 400);
  assert.equal(peak, 8);
  assert.deepEqual(result, { requestedCount: 400, importedCount: 400, failedCount: 0, errors: [] });
});

test('bulk import reports duplicate and row-specific failures without stopping valid rows', async () => {
  const rows = [
    { mobile: '9876543210' },
    { mobile: '+91 98765 43210' },
    { mobile: '9000000001' },
    { mobile: '9000000002' },
  ];
  const result = await processBulkImport(rows, async (row) => {
    if (row.mobile === '9000000002') throw Object.assign(new Error('Already exists'), { errorCode: 'CONFLICT' });
  });

  assert.equal(result.importedCount, 2);
  assert.equal(result.failedCount, 2);
  assert.deepEqual(result.errors.map(error => [error.index, error.rowNumber, error.code]), [
    [1, 3, 'DUPLICATE_IN_UPLOAD'],
    [3, 5, 'CONFLICT'],
  ]);
});

test('education lead and student bulk services reuse their complete create workflows', async () => {
  const api = Object.create(EducationService.prototype);
  api._assertEducation = () => {};
  api.logAudit = async () => {};
  const leadRows = [{ mobile: '9000000001' }, { mobile: '9000000002' }];
  const studentRows = [{ mobile: '9000000003' }];
  const created = [];
  api.createLead = async (row, receivedActor) => created.push(['lead', row.mobile, receivedActor.id]);
  api.createStudent = async (row, receivedActor) => created.push(['student', row.mobile, receivedActor.id]);

  assert.equal((await api.importLeadsBulk(leadRows, actor)).importedCount, 2);
  assert.equal((await api.importStudentsBulk(studentRows, actor)).importedCount, 1);
  assert.deepEqual(created, [
    ['lead', '9000000001', 'user'],
    ['lead', '9000000002', 'user'],
    ['student', '9000000003', 'user'],
  ]);
});

test('sales lead bulk service also preserves the existing create workflow', async () => {
  const api = Object.create(LeadService.prototype);
  api.logAudit = async () => {};
  const created = [];
  api.createLead = async (row, receivedActor) => created.push([row.mobile, receivedActor.id]);
  const result = await api.importLeadsBulk([
    { mobile: '9000000001' },
    { mobile: '9000000002' },
  ], actor);
  assert.equal(result.importedCount, 2);
  assert.deepEqual(created, [['9000000001', 'user'], ['9000000002', 'user']]);
});

test('bulk import rejects empty and oversized payloads before processing', async () => {
  await assert.rejects(processBulkImport([], async () => {}), /At least one row/);
  await assert.rejects(
    processBulkImport(Array.from({ length: 2001 }, (_, index) => ({ mobile: String(index) })), async () => {}),
    /maximum of 2000/,
  );
});
