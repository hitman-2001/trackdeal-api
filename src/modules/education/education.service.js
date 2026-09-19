'use strict';

require('../user/user.model');
const mongoose = require('mongoose');
const { BaseService } = require('../../shared/base/BaseService');
const {
  EducationClassRepository,
  StudentRepository,
  EducationLeadRepository,
} = require('./education.repository');
const { LeadFollowUpRepository } = require('../lead/lead.repository');
const { BusinessRuleError, NotFoundError, ForbiddenError } = require('../../shared/errors');
const { isEducationVertical } = require('../tenant/tenant.constants');

class EducationService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.classRepository = deps.classRepository || new EducationClassRepository();
    this.studentRepository = deps.studentRepository || new StudentRepository();
    this.leadRepository = deps.leadRepository || new EducationLeadRepository();
    this.followUpRepository = deps.followUpRepository || new LeadFollowUpRepository();
  }

  _assertEducation(actor) {
    if (!isEducationVertical(actor?.tenantDomain || actor?.tenantVertical)) {
      throw new ForbiddenError('This workspace is not an education tenant.');
    }
  }

  async getSummary(actor) {
    this._assertEducation(actor);
    const orgId = actor.organizationId;
    const orgObjectId = (orgId && mongoose.Types.ObjectId.isValid(orgId))
      ? new mongoose.Types.ObjectId(orgId)
      : orgId;

    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [
      leads,
      students,
      classes,
      enrolled,
      newLeadsToday,
      stageCounts,
      unassignedLeads,
      staleLeads,
    ] = await Promise.all([
      this.leadRepository.count({ isDeleted: false, tenantVertical: 'education' }),
      this.studentRepository.count({ isDeleted: false }),
      this.classRepository.count({ isDeleted: false }),
      this.leadRepository.count({
        isDeleted: false,
        tenantVertical: 'education',
        status: { $in: ['enrolled', 'converted'] },
      }),
      this.leadRepository.count({
        isDeleted: false,
        tenantVertical: 'education',
        createdAt: { $gte: startOfToday },
      }),
      this.leadRepository.model.aggregate([
        {
          $match: {
            $or: [
              { organizationId: orgObjectId },
              { organizationId: orgId },
            ],
            isDeleted: false,
            tenantVertical: 'education',
          },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.leadRepository.count({
        isDeleted: false,
        tenantVertical: 'education',
        assignedTo: null,
      }),
      this.leadRepository.count({
        isDeleted: false,
        tenantVertical: 'education',
        updatedAt: { $lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        status: { $nin: ['enrolled', 'converted', 'lost'] },
      }),
    ]);

    const stageBreakdown = {
      new: 0,
      assigned: 0,
      contacted: 0,
      follow_up: 0,
      meeting_scheduled: 0,
      qualified: 0,
      application_trial: 0,
      converted: 0,
      on_hold: 0,
      lost: 0,
    };
    for (const s of stageCounts) {
      if (s._id) {
        const key = String(s._id).toLowerCase();
        if (key === 'enrolled') {
          stageBreakdown.converted = (stageBreakdown.converted || 0) + s.count;
        } else if (stageBreakdown[key] !== undefined) {
          stageBreakdown[key] = s.count;
        } else {
          stageBreakdown[key] = s.count;
        }
      }
    }

    // 2. Fetch scheduled follow-ups & reminders
    const rawFollowUps = await this.followUpRepository.findMany(
      { isDeleted: false, status: { $ne: 'cancelled' } },
      {
        sort: { scheduledAt: 1 },
        limit: 50,
        populate: [
          {
            path: 'leadId',
            select: 'firstName lastName mobile email parentName parentMobile status leadTemperature classInterestId tenantVertical',
            populate: { path: 'classInterestId', select: 'name code' },
          },
          { path: 'assignedTo', select: 'firstName lastName email' },
        ],
      }
    );

    const leadsWithFollowUp = await this.leadRepository.findMany(
      {
        isDeleted: false,
        tenantVertical: 'education',
        nextFollowUpAt: { $ne: null },
      },
      {
        sort: { nextFollowUpAt: 1 },
        limit: 30,
        populate: [
          { path: 'classInterestId', select: 'name code' },
          { path: 'assignedTo', select: 'firstName lastName email' },
        ],
      }
    );

    const seenLeadIds = new Set();
    const followUps = [];

    for (const f of rawFollowUps) {
      if (f.leadId) {
        // Only include if it's an education lead
        if (f.leadId.tenantVertical && f.leadId.tenantVertical !== 'education') {
          continue;
        }
        const lId = String(f.leadId._id || f.leadId);
        seenLeadIds.add(lId);
        const sched = new Date(f.scheduledAt);
        const isOverdue = f.status === 'scheduled' && sched < now;
        const isToday = sched >= startOfToday && sched <= endOfToday;
        const isUpcoming = sched > endOfToday;

        followUps.push({
          _id: String(f._id),
          leadId: lId,
          lead: f.leadId,
          studentName: `${f.leadId.firstName || ''} ${f.leadId.lastName || ''}`.trim() || 'Student Lead',
          parentName: f.leadId.parentName || '',
          contactNumber: f.leadId.parentMobile || f.leadId.mobile || '',
          studentMobile: f.leadId.mobile || '',
          className: f.leadId.classInterestId?.name || '',
          scheduledAt: f.scheduledAt,
          type: f.type || 'call',
          notes: f.notes || '',
          status: f.status || 'scheduled',
          assignedTo: f.assignedTo,
          isOverdue,
          isToday,
          isUpcoming,
        });
      }
    }

    for (const l of leadsWithFollowUp) {
      const lId = String(l._id);
      if (!seenLeadIds.has(lId)) {
        const sched = new Date(l.nextFollowUpAt);
        const isOverdue = sched < now;
        const isToday = sched >= startOfToday && sched <= endOfToday;
        const isUpcoming = sched > endOfToday;

        followUps.push({
          _id: `fu-${lId}`,
          leadId: lId,
          lead: l,
          studentName: `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'Student Lead',
          parentName: l.parentName || '',
          contactNumber: l.parentMobile || l.mobile || '',
          studentMobile: l.mobile || '',
          className: l.classInterestId?.name || '',
          scheduledAt: l.nextFollowUpAt,
          type: l.lastActivityType || 'call',
          notes: l.qualification?.notesRemarks || l.notesRemarks || 'Scheduled follow-up',
          status: 'scheduled',
          assignedTo: l.assignedTo,
          isOverdue,
          isToday,
          isUpcoming,
        });
      }
    }

    followUps.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    const overdueFollowUps = followUps.filter((f) => f.isOverdue).length;
    const todayFollowUps = followUps.filter((f) => f.isToday).length;
    const pendingFollowUps = followUps.filter((f) => f.status === 'scheduled').length;

    return {
      totalLeads: leads,
      totalStudents: students,
      totalClasses: classes,
      enrolledLeads: enrolled,
      newLeadsToday,
      leadsContacted: stageBreakdown.contacted || 0,
      callsScheduled: followUps.filter((f) => f.type === 'call').length,
      meetingsToday: followUps.filter((f) => f.type === 'meeting' && f.isToday).length,
      pendingFollowUps,
      overdueFollowUps,
      todayFollowUps,
      unassignedLeads,
      staleLeads,
      stageBreakdown,
      followUps,
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
      populate: [
        { path: 'classInterestId', select: 'name code subject' },
        {
          path: 'assignedTo',
          select: 'firstName lastName email',
          populate: { path: 'roleId', select: 'name code' },
        },
      ],
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
    ['firstName', 'lastName', 'mobile', 'email', 'source', 'parentName', 'parentMobile', 'status', 'assignedTo', 'classInterestId', 'leadTemperature'].forEach((key) => {
      if (data[key] !== undefined) patch[key] = data[key];
    });
    if (data.customerFeedback !== undefined) patch.customerFeedback = data.customerFeedback;
    if (data.notesRemarks !== undefined) patch.notesRemarks = data.notesRemarks;
    if (data.nextFollowUpAt !== undefined) {
      patch.nextFollowUpAt = data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null;
    }
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
