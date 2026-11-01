'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EducationService } = require('../src/modules/education/education.service');
const { EducationController } = require('../src/modules/education/education.controller');

const admin = { id: 'admin', organizationId: 'school-org', role: 'org_admin', tenantVertical: 'education' };
const staff = { ...admin, id: 'staff', role: 'staff' };

function service(repositories) {
  return new EducationService({ classRepository: {}, followUpRepository: {}, ...repositories });
}

test('lead selection returns all 400 IDs with the same filters as paginated leads', async () => {
  const leads = Array.from({ length: 400 }, (_, index) => ({ _id: String(index) }));
  let pageFilter;
  const api = service({ leadRepository: {
    paginate: async (filter, options) => {
      pageFilter = filter;
      assert.equal(options.page, 2);
      assert.equal(options.sort._id, -1);
      return { data: leads.slice(20, 40), pagination: { total: 400, page: 2, limit: 20 } };
    },
    findMany: async (filter, options, projection) => {
      assert.deepEqual(filter, pageFilter);
      assert.equal(options.limit, undefined);
      assert.equal(projection, '_id');
      return leads;
    },
  } });
  const query = { page: 2, limit: 20, status: 'new,assigned', source: 'walk_in', search: 'A.B', standard: '10', assignedTo: 'staff' };
  const page = await api.listLeads(query, admin);
  assert.equal(page.data[0]._id, '20');
  assert.equal(page.pagination.pages, 20);
  assert.equal(pageFilter.organizationId, admin.organizationId);
  assert.equal(pageFilter.source, 'walk_in');
  assert.deepEqual(pageFilter.status, { $in: ['new', 'assigned'] });
  assert.equal((await api.listLeads(query, admin, { selectionOnly: true })).length, 400);
});

test('select all cannot override staff ownership or tenant boundaries', async () => {
  const api = service({ leadRepository: {
    findMany: async (filter) => {
      assert.equal(filter.assignedTo, staff.id);
      assert.equal(filter.organizationId, staff.organizationId);
      assert.equal(filter.isDeleted, false);
      assert.equal(filter.tenantVertical, 'education');
      return [];
    },
  } });
  assert.deepEqual(await api.listLeads({ assignedTo: 'someone-else', organizationId: 'other-org' }, staff, { selectionOnly: true }), []);
});

test('school options include unique schools across all accessible students and linked leads', async () => {
  const api = service({
    leadRepository: { findMany: async () => [{ _id: 'owned-lead' }] },
    studentRepository: { findMany: async (filter, options, projection) => {
      assert.equal(filter.organizationId, staff.organizationId);
      assert.deepEqual(filter.$or, [{ leadId: { $in: ['owned-lead'] } }, { createdBy: 'staff' }]);
      assert.equal(options.limit, undefined);
      assert.equal(projection, 'schoolName leadId');
      return [{ schoolName: 'Z School' }, { schoolName: 'A School' }, { schoolName: 'Z School' }, { leadId: { schoolName: 'Legacy School' } }, { schoolName: '' }];
    } },
  });
  assert.deepEqual(await api.listStudentSchools(staff), ['A School', 'Legacy School', 'Z School']);
});

test('school filtering preserves ownership and search and supports legacy school fallback', async () => {
  const api = service({
    leadRepository: { findMany: async (filter) => {
      if (filter.status === 'enrolled') return [];
      return [{ _id: filter.schoolName ? 'school-lead' : 'owned-lead' }];
    } },
    studentRepository: { paginate: async (filter, options) => {
      assert.equal(filter.organizationId, staff.organizationId);
      assert.equal(filter.status, 'active');
      assert.equal(options.page, 1);
      assert.deepEqual(filter.$and[0].$or, [{ leadId: { $in: ['owned-lead'] } }, { createdBy: 'staff' }]);
      assert.equal(filter.$and[1].$or[0].firstName.test('Alice'), true);
      assert.deepEqual(filter.$and[2].$or, [
        { schoolName: 'A School' },
        { schoolName: { $in: [null, ''] }, leadId: { $in: ['school-lead'] } },
      ]);
      return { data: [{ schoolName: '', leadId: { schoolName: 'A School' } }], pagination: { total: 1, page: 1, limit: 20 } };
    } },
  });
  const result = await api.listStudents({ page: 1, limit: 20, schoolName: 'A School', search: 'Alice', status: 'active' }, staff);
  assert.equal(result.data[0].schoolName, 'A School');
});

test('lead school options use all saved and imported records within staff scope', async () => {
  const api = service({ leadRepository: { findMany: async (filter, options, projection) => {
    assert.equal(filter.assignedTo, staff.id);
    assert.equal(filter.organizationId, staff.organizationId);
    assert.equal(filter.isDeleted, false);
    assert.equal(options.limit, undefined);
    assert.equal(projection, 'schoolName');
    return [{ schoolName: 'Saved School' }, { schoolName: 'Imported School' }, { schoolName: '' }, { schoolName: 'Saved School' }];
  } } });
  assert.deepEqual(await api.listLeadSchools(staff), ['Imported School', 'Saved School']);
});

for (const entity of ['Leads', 'Students']) {
  test(`${entity}: controller and service return all 400 matching rows, including correct pagination`, async () => {
    const records = Array.from({ length: 400 }, (_, i) => ({ _id: String(i), schoolName: 'A School' }));
    const repository = {
      paginate: () => assert.fail('All must not use the capped paginator'),
      findMany: async (filter, options) => {
        if (entity === 'Leads') {
          assert.equal(filter.schoolName, 'A School');
          assert.equal(filter.assignedTo, 'staff');
        } else {
          assert.equal(filter.$and[0].$or[0].schoolName, 'A School');
        }
        assert.equal(filter.organizationId, admin.organizationId);
        assert.equal(options.limit, undefined);
        assert.ok(options.populate);
        return records;
      },
    };
    const api = service({
      leadRepository: entity === 'Leads' ? repository : { findMany: async () => [] },
      studentRepository: repository,
    });
    const controller = new EducationController({ educationService: api });
    let response;
    const reply = { status: () => reply, send: (body) => { response = body; } };
    await controller[`list${entity}`]({ query: { limit: 'all', page: 9, schoolName: 'A School', assignedTo: 'staff' }, user: admin }, reply);
    assert.equal(response.data.length, 400);
    assert.deepEqual(response.pagination, { page: 1, limit: 400, total: 400, totalPages: 1, hasNextPage: false, hasPrevPage: false });
  });
}

test('All with no matching records produces valid empty pagination', async () => {
  const api = service({ leadRepository: { findMany: async () => [] } });
  const result = await api.listLeads({ limit: 'all', schoolName: 'Missing' }, admin);
  assert.deepEqual(result.pagination, { page: 1, limit: 1, total: 0, pages: 1 });
});

test('multi-value lead filters use OR within each field and remain combined across fields', async () => {
  const filters = [];
  const capture = async (filter) => { filters.push(filter); return []; };
  const api = service({ leadRepository: {
    findMany: capture,
    paginate: async (filter) => { await capture(filter); return { data: [], pagination: { page: 1, limit: 20, total: 0 } }; },
  } });
  const query = {
    schoolName: ['School, North', 'School South'], assignedTo: ['staff-a', 'staff-b'],
    institutionType: ['School', 'College'], educationBoard: ['CBSE', 'ICSE'],
    standard: ['10', '11'], academicStream: ['Science', 'Commerce'], search: 'Alice',
  };
  await api.listLeads(query, admin);
  await api.listLeads({ ...query, limit: 'all' }, admin);
  await api.listLeads(query, admin, { selectionOnly: true });
  for (const filter of filters) {
    for (const key of Object.keys(query).filter(key => key !== 'search')) assert.deepEqual(filter[key], { $in: query[key] });
    assert.equal(filter.$or[0].firstName.test('Alice'), true);
    assert.equal(filter.organizationId, admin.organizationId);
  }
  await api.listLeads(query, staff, { selectionOnly: true });
  assert.equal(filters[3].assignedTo, staff.id);
});

test('multiple student schools match direct and linked-lead schools while retaining ownership', async () => {
  const schools = ['School, North', 'School South'];
  const api = service({
    leadRepository: { findMany: async (filter) => {
      if (filter.status === 'enrolled') return [];
      if (filter.schoolName) assert.deepEqual(filter.schoolName, { $in: schools });
      return [{ _id: 'owned-lead' }];
    } },
    studentRepository: { paginate: async (filter) => {
      assert.deepEqual(filter.$or, [{ leadId: { $in: ['owned-lead'] } }, { createdBy: staff.id }]);
      assert.deepEqual(filter.$and[0].$or[0].schoolName, { $in: schools });
      assert.deepEqual(filter.$and[0].$or[1].leadId, { $in: ['owned-lead'] });
      return { data: [], pagination: { page: 1, limit: 20, total: 0 } };
    } },
  });
  await api.listStudents({ schoolName: schools }, staff);
});

test('empty multi-filters are omitted and object-valued filters are rejected', async () => {
  const api = service({ leadRepository: { findMany: async (filter) => {
    assert.equal(filter.schoolName, undefined);
    assert.equal(filter.assignedTo, undefined);
    return [];
  } } });
  await api.listLeads({ schoolName: [], assignedTo: [] }, admin, { selectionOnly: true });
  await assert.rejects(api.listLeads({ schoolName: [{ $ne: '' }] }, admin), /Filter values must be strings or numbers/);
});
