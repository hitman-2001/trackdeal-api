'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const {
  EducationClassRepository,
  StudentRepository,
  EducationLeadRepository,
} = require('./education.repository');
const { BusinessRuleError, NotFoundError, ForbiddenError } = require('../../shared/errors');
const { isEducationVertical } = require('../tenant/tenant.constants');

class EducationService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.classRepository = deps.classRepository || new EducationClassRepository();
    this.studentRepository = deps.studentRepository || new StudentRepository();
    this.leadRepository = deps.leadRepository || new EducationLeadRepository();
  }

  _assertEducation(actor) {
    if (!isEducationVertical(actor?.tenantDomain || actor?.tenantVertical)) {
      throw new ForbiddenError('This workspace is not an education tenant.');
    }
  }

  async getSummary(actor) {
    this._assertEducation(actor);
    const [leads, students, classes, enrolled] = await Promise.all([
      this.leadRepository.count({ isDeleted: false, tenantVertical: 'education' }),
      this.studentRepository.count({ isDeleted: false }),
      this.classRepository.count({ isDeleted: false }),
      this.leadRepository.count({ isDeleted: false, tenantVertical: 'education', status: 'enrolled' }),
    ]);
    return {
      totalLeads: leads,
      totalStudents: students,
      totalClasses: classes,
      enrolledLeads: enrolled,
    };
  }

  async listClasses(query, actor) {
    this._assertEducation(actor);
    const filter = { isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.search) {
      const rx = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { code: rx }, { subject: rx }, { grade: rx }];
    }
    const result = await this.classRepository.paginate(filter, {
      page: query.page,
      limit: query.limit,
      sort: { createdAt: -1 },
    });
    return {
      data: result.data,
      pagination: {
        ...result.pagination,
        pages: Math.ceil((result.pagination.total || 0) / (result.pagination.limit || 10)) || 1,
      },
    };
  }

  async createClass(data, actor) {
    this._assertEducation(actor);
    const name = String(data?.name || '').trim();
    if (!name) throw new BusinessRuleError('Class name is required.');
    return this.classRepository.create({
      name,
      code: data.code || '',
      subject: data.subject || '',
      grade: data.grade || '',
      description: data.description || '',
      capacity: Number(data.capacity) || 30,
      fees: Number(data.fees) || 0,
      schedule: data.schedule || '',
      instructorName: data.instructorName || '',
      status: data.status || 'upcoming',
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
  }

  async updateClass(id, data, actor) {
    this._assertEducation(actor);
    const existing = await this.classRepository.findByIdOrFail(id, 'Class');
    const patch = { updatedBy: actor.id };
    ['name', 'code', 'subject', 'grade', 'description', 'schedule', 'instructorName', 'status'].forEach((key) => {
      if (data[key] !== undefined) patch[key] = data[key];
    });
    if (data.capacity !== undefined) patch.capacity = Number(data.capacity);
    if (data.fees !== undefined) patch.fees = Number(data.fees);
    if (data.startDate !== undefined) patch.startDate = data.startDate;
    if (data.endDate !== undefined) patch.endDate = data.endDate;
    return this.classRepository.update(existing._id || id, { $set: patch });
  }

  async removeClass(id, actor) {
    this._assertEducation(actor);
    await this.classRepository.findByIdOrFail(id, 'Class');
    await this.classRepository.softDelete(id, actor.id);
  }

  async listStudents(query, actor) {
    this._assertEducation(actor);
    const filter = { isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.classId) filter.classId = query.classId;
    if (query.search) {
      const rx = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ firstName: rx }, { lastName: rx }, { mobile: rx }, { email: rx }, { parentName: rx }];
    }
    const result = await this.studentRepository.paginate(filter, {
      page: query.page,
      limit: query.limit,
      sort: { createdAt: -1 },
      populate: { path: 'classId', select: 'name code subject grade' },
    });
    return {
      data: result.data,
      pagination: {
        ...result.pagination,
        pages: Math.ceil((result.pagination.total || 0) / (result.pagination.limit || 10)) || 1,
      },
    };
  }

  async createStudent(data, actor) {
    this._assertEducation(actor);
    const firstName = String(data?.firstName || '').trim();
    const mobile = String(data?.mobile || '').trim();
    if (!firstName || !mobile) throw new BusinessRuleError('Student first name and mobile are required.');
    if (data.classId) {
      await this.classRepository.findByIdOrFail(data.classId, 'Class');
    }
    return this.studentRepository.create({
      firstName,
      lastName: data.lastName || '',
      mobile,
      email: data.email || '',
      parentName: data.parentName || '',
      parentMobile: data.parentMobile || '',
      classId: data.classId || null,
      leadId: data.leadId || null,
      status: data.status || 'active',
      notes: data.notes || '',
      enrollmentDate: data.enrollmentDate || new Date(),
      createdBy: actor.id,
      updatedBy: actor.id,
    });
  }

  async updateStudent(id, data, actor) {
    this._assertEducation(actor);
    await this.studentRepository.findByIdOrFail(id, 'Student');
    const patch = { updatedBy: actor.id };
    ['firstName', 'lastName', 'mobile', 'email', 'parentName', 'parentMobile', 'status', 'notes', 'classId'].forEach((key) => {
      if (data[key] !== undefined) patch[key] = data[key];
    });
    if (patch.classId) {
      await this.classRepository.findByIdOrFail(patch.classId, 'Class');
    }
    return this.studentRepository.update(id, { $set: patch });
  }

  async getLead(id, actor) {
    this._assertEducation(actor);
    const lead = await this.leadRepository.findByIdOrFail(id, 'Lead');
    if (lead.tenantVertical && lead.tenantVertical !== 'education') {
      throw new ForbiddenError('This lead belongs to the real-estate workspace.');
    }
    if (lead.populate) {
      await lead.populate('classInterestId', 'name code subject');
    }
    return lead;
  }

  async listLeads(query, actor) {
    this._assertEducation(actor);
    const filter = { isDeleted: false, tenantVertical: 'education' };
    if (query.status) filter.status = query.status;
    if (query.classInterestId) filter.classInterestId = query.classInterestId;
    if (query.search) {
      const rx = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ firstName: rx }, { lastName: rx }, { mobile: rx }, { email: rx }, { parentName: rx }];
    }
    const result = await this.leadRepository.paginate(filter, {
      page: query.page,
      limit: query.limit,
      sort: { createdAt: -1 },
      populate: { path: 'classInterestId', select: 'name code subject' },
    });
    return {
      data: result.data,
      pagination: {
        ...result.pagination,
        pages: Math.ceil((result.pagination.total || 0) / (result.pagination.limit || 10)) || 1,
      },
    };
  }

  async createLead(data, actor) {
    this._assertEducation(actor);
    const firstName = String(data?.firstName || '').trim();
    const mobile = String(data?.mobile || '').trim();
    if (!firstName || !mobile) throw new BusinessRuleError('Student lead first name and mobile are required.');
    if (data.classInterestId) {
      await this.classRepository.findByIdOrFail(data.classInterestId, 'Class');
    }
    return this.leadRepository.create({
      firstName,
      lastName: data.lastName || '',
      mobile,
      email: data.email || '',
      source: data.source || 'manual_entry',
      parentName: data.parentName || '',
      parentMobile: data.parentMobile || '',
      classInterestId: data.classInterestId || null,
      tenantVertical: 'education',
      status: data.assignedTo ? 'assigned' : 'new',
      ownerId: actor.id,
      assignedTo: data.assignedTo || actor.id,
      createdBy: actor.id,
      updatedBy: actor.id,
      requirements: { notes: data.notes || '' },
    });
  }

  async updateLead(id, data, actor) {
    this._assertEducation(actor);
    const lead = await this.leadRepository.findByIdOrFail(id, 'Lead');
    if (lead.tenantVertical && lead.tenantVertical !== 'education') {
      throw new ForbiddenError('This lead belongs to the real-estate workspace.');
    }
    const patch = { updatedBy: actor.id };
    ['firstName', 'lastName', 'mobile', 'email', 'source', 'parentName', 'parentMobile', 'status', 'assignedTo', 'classInterestId'].forEach((key) => {
      if (data[key] !== undefined) patch[key] = data[key];
    });
    if (data.notes !== undefined) {
      patch.requirements = { ...(lead.requirements || {}), notes: data.notes };
    }
    return this.leadRepository.update(id, { $set: patch });
  }

  async enrollLead(id, data, actor) {
    this._assertEducation(actor);
    const lead = await this.leadRepository.findByIdOrFail(id, 'Lead');
    if (lead.status === 'enrolled' && lead.convertedStudentId) {
      throw new BusinessRuleError('This student lead is already enrolled.');
    }
    const classId = data.classId || lead.classInterestId;
    if (!classId) throw new BusinessRuleError('Select a class to enroll this student.');
    await this.classRepository.findByIdOrFail(classId, 'Class');

    const student = await this.studentRepository.create({
      firstName: lead.firstName,
      lastName: lead.lastName || '',
      mobile: lead.mobile,
      email: lead.email || '',
      parentName: lead.parentName || data.parentName || '',
      parentMobile: lead.parentMobile || data.parentMobile || '',
      classId,
      leadId: lead._id,
      status: 'active',
      notes: data.notes || '',
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await this.leadRepository.update(lead._id, {
      $set: {
        status: 'enrolled',
        convertedStudentId: student._id,
        classInterestId: classId,
        updatedBy: actor.id,
      },
    });

    return student;
  }
}

module.exports = { EducationService };
