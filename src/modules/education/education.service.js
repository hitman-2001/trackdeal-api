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

    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, 'super_admin', 'org_admin', 'admin'];
    const isAdmin = adminRoles.includes(actor?.role) || actor?.permissions?.includes('leads.view_all');
    const actorId = actor?.id || actor?._id;
    const actorObjectId = (actorId && mongoose.Types.ObjectId.isValid(actorId))
      ? new mongoose.Types.ObjectId(actorId)
      : actorId;

    const baseLeadFilter = { isDeleted: false, tenantVertical: 'education' };
    if (!isAdmin) {
      baseLeadFilter.assignedTo = actorObjectId;
    }

    const stageMatch = {
      $or: [
        { organizationId: orgObjectId },
        { organizationId: orgId },
      ],
      isDeleted: false,
      tenantVertical: 'education',
    };
    if (!isAdmin) {
      stageMatch.assignedTo = actorObjectId;
    }

    let studentFilter = { isDeleted: false };
    if (!isAdmin) {
      const userLeads = await this.leadRepository.findMany(
        { ...baseLeadFilter },
        { select: '_id' }
      );
      const userLeadIds = userLeads.map((l) => l._id);
      studentFilter = {
        isDeleted: false,
        $or: [
          { leadId: { $in: userLeadIds } },
          { createdBy: actorObjectId },
        ],
      };
    }

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
      this.leadRepository.count(baseLeadFilter),
      this.studentRepository.count(studentFilter),
      this.classRepository.count({ isDeleted: false }),
      this.leadRepository.count({
        ...baseLeadFilter,
        status: { $in: ['enrolled', 'converted'] },
      }),
      this.leadRepository.count({
        ...baseLeadFilter,
        createdAt: { $gte: startOfToday },
      }),
      this.leadRepository.model.aggregate([
        { $match: stageMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      isAdmin ? this.leadRepository.count({
        isDeleted: false,
        tenantVertical: 'education',
        assignedTo: null,
      }) : 0,
      this.leadRepository.count({
        ...baseLeadFilter,
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
      { isDeleted: false, status: 'scheduled' },
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
        if (!isAdmin) {
          const actorIdStr = String(actorId || '');
          const assignedId = String(f.assignedTo?._id || f.assignedTo || f.leadId?.assignedTo?._id || f.leadId?.assignedTo || '');
          if (!assignedId || assignedId !== actorIdStr) {
            continue;
          }
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
        if (!isAdmin) {
          const actorIdStr = String(actorId || '');
          const assignedId = String(l.assignedTo?._id || l.assignedTo || '');
          if (!assignedId || assignedId !== actorIdStr) {
            continue;
          }
        }
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

  async getAnalytics(query = {}, actor) {
    this._assertEducation(actor);
    const orgId = actor.organizationId;
    const orgObjectId = (orgId && mongoose.Types.ObjectId.isValid(orgId))
      ? new mongoose.Types.ObjectId(orgId)
      : orgId;

    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, 'super_admin', 'org_admin', 'admin'];
    const isAdmin = adminRoles.includes(actor?.role) || actor?.permissions?.includes('leads.view_all');
    const actorId = actor?.id || actor?._id;
    const actorObjectId = (actorId && mongoose.Types.ObjectId.isValid(actorId))
      ? new mongoose.Types.ObjectId(actorId)
      : actorId;

    const baseMatch = {
      $or: [
        { organizationId: orgObjectId },
        { organizationId: orgId },
      ],
      isDeleted: false,
      tenantVertical: 'education',
    };
    if (!isAdmin) {
      baseMatch.assignedTo = actorObjectId;
    }

    // 1. Time horizon filtering
    const now = new Date();
    let rangeStart = null;
    const range = query.range || '30d';
    if (range === '7d') {
      rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === 'quarter') {
      rangeStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (range === 'year') {
      rangeStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    } else if (range === 'all') {
      rangeStart = null;
    } else {
      rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const rangeMatch = { ...baseMatch };
    let priorMatch = null;
    if (rangeStart) {
      rangeMatch.createdAt = { $gte: rangeStart };
      const windowMs = now.getTime() - rangeStart.getTime();
      const priorStart = new Date(rangeStart.getTime() - windowMs);
      priorMatch = {
        ...baseMatch,
        createdAt: { $gte: priorStart, $lt: rangeStart },
      };
    }

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayMatch = {
      ...baseMatch,
      createdAt: { $gte: startOfToday },
    };

    let analyticsStudentFilter = { isDeleted: false };
    if (!isAdmin) {
      const userLeads = await this.leadRepository.findMany(
        { ...baseMatch },
        { select: '_id' }
      );
      const userLeadIds = userLeads.map((l) => l._id);
      analyticsStudentFilter = {
        isDeleted: false,
        $or: [
          { leadId: { $in: userLeadIds } },
          { createdBy: actorObjectId },
        ],
      };
    }

    // 2. Summary Counts
    const [
      totalInquiries,
      confirmedConversions,
      pipelineInProgress,
      totalClasses,
      totalStudents,
      priorPeriodInquiries,
      todayInquiries,
    ] = await Promise.all([
      this.leadRepository.count(rangeMatch),
      this.leadRepository.count({
        ...rangeMatch,
        status: { $in: ['enrolled', 'converted'] },
      }),
      this.leadRepository.count({
        ...rangeMatch,
        status: { $in: ['counseling_scheduled', 'meeting_scheduled', 'follow_up', 'qualified', 'application_trial'] },
      }),
      this.classRepository.count({ isDeleted: false }),
      this.studentRepository.count(analyticsStudentFilter),
      priorMatch ? this.leadRepository.count(priorMatch) : Promise.resolve(0),
      this.leadRepository.count(todayMatch),
    ]);

    const conversionRate = totalInquiries > 0
      ? parseFloat(((confirmedConversions / totalInquiries) * 100).toFixed(1))
      : 0;

    const inProgressRate = totalInquiries > 0
      ? Math.round((pipelineInProgress / totalInquiries) * 100)
      : 0;

    const inquiriesGrowth = priorPeriodInquiries > 0
      ? Math.round(((totalInquiries - priorPeriodInquiries) / priorPeriodInquiries) * 100)
      : (totalInquiries > 0 ? 100 : 0);

    const summaryMetrics = {
      totalInquiries,
      confirmedConversions,
      conversionRate,
      pipelineInProgress,
      inProgressRate,
      todayInquiries,
      priorPeriodInquiries,
      inquiriesGrowth,
      totalClasses,
      totalStudents,
    };

    // 3. Dynamic 6-Month Trend
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trendMonths.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: monthNames[d.getMonth()],
        value: 0,
        converted: 0,
      });
    }
    const trendStartDate = new Date(trendMonths[0].year, trendMonths[0].month - 1, 1);

    const trendAgg = await this.leadRepository.model.aggregate([
      { $match: { ...baseMatch, createdAt: { $gte: trendStartDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $in: ['$status', ['enrolled', 'converted']] }, 1, 0] },
          },
        },
      },
    ]);

    for (const r of trendAgg) {
      const m = trendMonths.find((item) => item.year === r._id.year && item.month === r._id.month);
      if (m) {
        m.value = r.count;
        m.converted = r.converted;
      }
    }

    const trendChartData = trendMonths.map((m) => ({
      label: m.label,
      value: m.value,
      converted: m.converted,
    }));

    // 4. Dynamic Conversion Funnel
    const stageAgg = await this.leadRepository.model.aggregate([
      { $match: rangeMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const stageMap = {};
    for (const s of stageAgg) {
      if (s._id) stageMap[String(s._id).toLowerCase()] = s.count;
    }

    const stage1 = totalInquiries;
    const stage2 = stage1 - (stageMap.new || 0);
    const stage3 = (stageMap.counseling_scheduled || 0) + (stageMap.meeting_scheduled || 0) + (stageMap.follow_up || 0) + (stageMap.qualified || 0) + (stageMap.application_trial || 0) + (stageMap.enrolled || 0) + (stageMap.converted || 0);
    const stage4 = (stageMap.enrolled || 0) + (stageMap.converted || 0);

    const funnelChartData = [
      { label: '1. Inquiries Registered', value: stage1, percent: 100 },
      { label: '2. Contacted & Screened', value: stage2, percent: stage1 > 0 ? Math.round((stage2 / stage1) * 100) : 0 },
      { label: '3. Counseling & Trial Class', value: stage3, percent: stage1 > 0 ? Math.round((stage3 / stage1) * 100) : 0 },
      { label: '4. Confirmed Enrollments', value: stage4, percent: stage1 > 0 ? Math.round((stage4 / stage1) * 100) : 0 },
    ];

    // 5. Dynamic Lead Source Breakdown
    const sourcesAgg = await this.leadRepository.model.aggregate([
      { $match: rangeMatch },
      {
        $group: {
          _id: { $ifNull: ['$source', 'direct'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    const sourceColors = ['#4f46e5', '#0284c7', '#059669', '#64748b', '#d97706', '#7c3aed'];
    const sourceLabelMap = {
      walk_in: 'Campus Walk-in',
      referral: 'Direct Referral',
      website: 'Website & Digital',
      social_media: 'Social Media Ads',
      google_ads: 'Google Search Ads',
      education_fair: 'Education Fairs',
      direct: 'Direct Inquiry',
    };

    const totalSources = sourcesAgg.reduce((acc, curr) => acc + curr.count, 0) || 1;
    const sourceChartData = sourcesAgg.length > 0
      ? sourcesAgg.map((s, idx) => {
          const rawKey = String(s._id).toLowerCase();
          const label = sourceLabelMap[rawKey] || s._id;
          return {
            label,
            value: s.count,
            percent: Math.round((s.count / totalSources) * 100),
            color: sourceColors[idx % sourceColors.length],
          };
        })
      : [
          { label: 'Direct Intake', value: totalInquiries, percent: 100, color: '#4f46e5' },
        ];

    // 6. Dynamic Counselor Performance
    const counselorAgg = await this.leadRepository.model.aggregate([
      { $match: { ...rangeMatch, assignedTo: { $ne: null } } },
      {
        $group: {
          _id: '$assignedTo',
          totalAssigned: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $in: ['$status', ['enrolled', 'converted']] }, 1, 0] },
          },
        },
      },
      { $sort: { converted: -1, totalAssigned: -1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
    ]);

    const barColors = ['#4f46e5', '#4f46e5', '#4f46e5', '#4f46e5', '#4f46e5', '#4f46e5'];
    const counselorPerformanceData = counselorAgg.length > 0
      ? counselorAgg.map((c, idx) => {
          const name = c.userInfo
            ? `${c.userInfo.firstName || ''} ${c.userInfo.lastName || ''}`.trim() || c.userInfo.email
            : 'Admissions Counselor';
          return {
            label: name,
            value: c.converted,
            target: Math.max(c.totalAssigned, 1),
            color: barColors[idx % barColors.length],
          };
        })
      : [
          { label: 'Admissions Desk', value: confirmedConversions, target: Math.max(totalInquiries, 1), color: '#4f46e5' },
        ];

    // 7. Dynamic Actionable Strategic Insights
    const topSource = sourceChartData[0]?.label || 'Direct Inquiries';
    const topSourcePercent = sourceChartData[0]?.percent || 0;
    const dropOffPercent = stage1 > 0 ? Math.round(((stage1 - stage3) / stage1) * 100) : 0;

    const strategicInsights = [
      {
        type: 'growth',
        title: `Primary Acquisition Engine: ${topSource}`,
        description: `${topSource} accounts for ${topSourcePercent}% of all inquiries. Investing further in this channel yields the fastest enrollment ROI for your institute.`,
      },
      {
        type: 'bottleneck',
        title: `Conversion Funnel Progression`,
        description: `${dropOffPercent}% of inquiries have not yet scheduled a counseling session or demo class. Automated SMS/WhatsApp reminders after registration will reduce this drop-off.`,
      },
      {
        type: 'sla',
        title: `Active Pipeline: ${pipelineInProgress} Inquiries In Progress`,
        description: pipelineInProgress > 0
          ? `${pipelineInProgress} student inquiries are currently in active counseling or trial class stages. Following up promptly will maximize enrollment conversions.`
          : `All current student inquiries have been processed through counseling.`,
      },
      {
        type: 'capacity',
        title: `Active Program Offerings: ${totalClasses} Classes`,
        description: `With ${totalStudents} active students enrolled across ${totalClasses} ongoing batches, the student-to-batch ratio is well balanced.`,
      },
    ];

    return {
      summaryMetrics,
      trendChartData,
      funnelChartData,
      sourceChartData,
      counselorPerformanceData,
      strategicInsights,
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
    const cls = await this.classRepository.create({
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

    await this.logAudit({
      actor,
      action: 'education.class.create',
      entity: 'Class',
      entityId: cls._id,
      module: 'Education',
      description: `Created new course/batch "${cls.name}" (${cls.code || 'No Code'})`,
      newValues: { name: cls.name, code: cls.code, capacity: cls.capacity, fees: cls.fees },
    });

    return cls;
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
    const updated = await this.classRepository.update(existing._id || id, { $set: patch });

    await this.logAudit({
      actor,
      action: 'education.class.update',
      entity: 'Class',
      entityId: existing._id || id,
      module: 'Education',
      description: `Updated course/batch "${existing.name}" settings`,
      oldValues: { name: existing.name, capacity: existing.capacity, fees: existing.fees },
      newValues: patch,
    });

    return updated;
  }

  async removeClass(id, actor) {
    this._assertEducation(actor);
    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, 'super_admin', 'org_admin', 'admin'];
    if (!adminRoles.includes(actor?.role)) {
      throw new ForbiddenError('Only institute administrators can delete classes.');
    }
    const cls = await this.classRepository.findByIdOrFail(id, 'Class');
    await this.classRepository.softDelete(id, actor.id);

    await this.logAudit({
      actor,
      action: 'education.class.delete',
      entity: 'Class',
      entityId: id,
      module: 'Education',
      description: `Archived/deleted course batch "${cls.name || id}"`,
    });
  }

  async listStudents(query, actor) {
    this._assertEducation(actor);
    const filter = { isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.classId) filter.classId = query.classId;
    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, 'super_admin', 'org_admin', 'admin'];
    const isAdmin = adminRoles.includes(actor?.role) || actor?.permissions?.includes('leads.view_all');

    if (!isAdmin) {
      const actorId = actor?.id || actor?._id;
      const actorObjectId = (actorId && mongoose.Types.ObjectId.isValid(actorId))
        ? new mongoose.Types.ObjectId(actorId)
        : actorId;
      const userLeads = await this.leadRepository.findMany(
        { isDeleted: false, tenantVertical: 'education', assignedTo: actorObjectId },
        { select: '_id' }
      );
      const userLeadIds = userLeads.map((l) => l._id);
      const ownershipCondition = {
        $or: [
          { leadId: { $in: userLeadIds } },
          { createdBy: actorObjectId },
        ],
      };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, ownershipCondition];
        delete filter.$or;
      } else {
        filter.$or = ownershipCondition.$or;
      }
    }

    if (query.search) {
      const rx = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchOr = [{ firstName: rx }, { lastName: rx }, { mobile: rx }, { email: rx }, { parentName: rx }];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else if (filter.$and) {
        filter.$and.push({ $or: searchOr });
      } else {
        filter.$or = searchOr;
      }
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
    const student = await this.studentRepository.create({
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

    await this.logAudit({
      actor,
      action: 'education.student.create',
      entity: 'Student',
      entityId: student._id,
      module: 'Education',
      description: `Directly registered student ${student.firstName} ${student.lastName || ''} (${student.mobile})`.trim(),
      newValues: { firstName: student.firstName, mobile: student.mobile, classId: student.classId },
    });

    return student;
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
    const updated = await this.studentRepository.update(id, { $set: patch });

    await this.logAudit({
      actor,
      action: 'education.student.update',
      entity: 'Student',
      entityId: id,
      module: 'Education',
      description: `Updated record for student ${patch.firstName || id}`,
      newValues: patch,
    });

    return updated;
  }

  async removeStudent(id, actor) {
    this._assertEducation(actor);
    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, 'super_admin', 'org_admin', 'admin'];
    if (!adminRoles.includes(actor?.role)) {
      throw new ForbiddenError('Only institute administrators can delete student records.');
    }
    const student = await this.studentRepository.findByIdOrFail(id, 'Student');
    await this.studentRepository.softDelete(id, actor.id);

    await this.logAudit({
      actor,
      action: 'education.student.delete',
      entity: 'Student',
      entityId: id,
      module: 'Education',
      description: `Archived/deleted student record for "${student.firstName} ${student.lastName || ''}" (${student.mobile})`,
    });
  }

  async getLead(id, actor) {
    this._assertEducation(actor);
    const lead = await this.leadRepository.findByIdOrFail(id, 'Lead');
    if (lead.tenantVertical && lead.tenantVertical !== 'education') {
      throw new ForbiddenError('This lead belongs to the real-estate workspace.');
    }

    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, 'super_admin', 'org_admin', 'admin'];
    const isAdmin = adminRoles.includes(actor?.role) || actor?.permissions?.includes('leads.view_all');

    if (!isAdmin) {
      const actorId = String(actor?.id || actor?._id || '');
      const assignedId = String(lead.assignedTo?._id || lead.assignedTo || '');
      if (!lead.assignedTo || assignedId !== actorId) {
        throw new ForbiddenError('Access Denied: You can only view leads assigned directly to you.');
      }
    }

    if (lead.populate) {
      await lead.populate('classInterestId', 'name code subject');
    }
    return lead;
  }

  async listLeads(query, actor) {
    this._assertEducation(actor);
    const filter = { isDeleted: false, tenantVertical: 'education' };

    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, 'super_admin', 'org_admin', 'admin'];
    const isAdmin = adminRoles.includes(actor?.role) || actor?.permissions?.includes('leads.view_all');

    if (!isAdmin) {
      // Non-admin staff/counselor: can ONLY see leads assigned to them.
      // Unassigned leads or leads assigned to other staff members are strictly hidden.
      const actorId = actor?.id || actor?._id;
      filter.assignedTo = actorId;
    } else if (query.assignedTo) {
      filter.assignedTo = query.assignedTo;
    }

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
    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, 'super_admin', 'org_admin', 'admin'];
    const isAdmin = adminRoles.includes(actor?.role) || actor?.permissions?.includes('leads.view_all');

    let resolvedAssignedTo = actor.id;
    if (data.assignedTo && String(data.assignedTo) !== String(actor.id)) {
      const canAssign = isAdmin || actor?.permissions?.includes('leads.assign') || actor?.permissions?.includes('*');
      if (canAssign) {
        resolvedAssignedTo = data.assignedTo;
      } else {
        throw new ForbiddenError('Access Denied: You do not have permission to assign leads to other staff members.');
      }
    }

    const lead = await this.leadRepository.create({
      firstName,
      lastName: data.lastName || '',
      mobile,
      email: data.email || '',
      source: data.source || 'manual_entry',
      parentName: data.parentName || '',
      parentMobile: data.parentMobile || '',
      classInterestId: data.classInterestId || null,
      tenantVertical: 'education',
      status: resolvedAssignedTo ? 'assigned' : 'new',
      ownerId: actor.id,
      assignedTo: resolvedAssignedTo,
      createdBy: actor.id,
      updatedBy: actor.id,
      requirements: { notes: data.notes || '' },
    });

    await this.logAudit({
      actor,
      action: 'education.lead.create',
      entity: 'Lead',
      entityId: lead._id,
      module: 'Education',
      description: `Inquiry registered for ${lead.firstName} ${lead.lastName || ''} (${lead.mobile})`.trim(),
      newValues: { firstName: lead.firstName, lastName: lead.lastName, mobile: lead.mobile, status: lead.status },
    });

    return lead;
  }

  async updateLead(id, data, actor) {
    this._assertEducation(actor);
    const lead = await this.leadRepository.findByIdOrFail(id, 'Lead');
    if (lead.tenantVertical && lead.tenantVertical !== 'education') {
      throw new ForbiddenError('This lead belongs to the real-estate workspace.');
    }

    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, 'super_admin', 'org_admin', 'admin'];
    const isAdmin = adminRoles.includes(actor?.role) || actor?.permissions?.includes('leads.view_all');

    if (!isAdmin) {
      const actorId = String(actor?.id || actor?._id || '');
      const assignedId = String(lead.assignedTo?._id || lead.assignedTo || '');
      if (!lead.assignedTo || assignedId !== actorId) {
        throw new ForbiddenError('Access Denied: You can only modify leads assigned directly to you.');
      }
    }

    if (data.assignedTo !== undefined && String(data.assignedTo || '') !== String(lead.assignedTo?._id || lead.assignedTo || '')) {
      const canAssign = isAdmin || actor?.permissions?.includes('leads.assign') || actor?.permissions?.includes('*');
      if (!canAssign) {
        throw new ForbiddenError('Access Denied: You do not have permission to assign or reassign leads.');
      }
    }

    const patch = { updatedBy: actor.id };
    ['firstName', 'lastName', 'mobile', 'email', 'source', 'parentName', 'parentMobile', 'status', 'assignedTo', 'classInterestId', 'leadTemperature'].forEach((key) => {
      if (data[key] !== undefined) patch[key] = data[key];
    });
    if (data.customerFeedback !== undefined) patch.customerFeedback = data.customerFeedback;
    if (data.notesRemarks !== undefined) patch.notesRemarks = data.notesRemarks;
    if (data.nextFollowUpAt !== undefined) {
      patch.nextFollowUpAt = data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null;
      if (!patch.nextFollowUpAt) {
        const { LeadFollowUp } = require('../lead/lead.model');
        await LeadFollowUp.updateMany(
          { leadId: id, status: 'scheduled', isDeleted: { $ne: true } },
          { $set: { status: 'completed', completedAt: new Date(), completedBy: actor?.id || null } }
        );
      }
    }
    if (data.notes !== undefined) {
      patch.requirements = { ...(lead.requirements || {}), notes: data.notes };
    }
    const updated = await this.leadRepository.update(id, { $set: patch });

    await this.logAudit({
      actor,
      action: data.status && data.status !== lead.status ? 'education.lead.stage_change' : 'education.lead.update',
      entity: 'Lead',
      entityId: lead._id || id,
      module: 'Education',
      description: data.status && data.status !== lead.status
        ? `Inquiry stage progressed from "${lead.status}" to "${data.status}" for ${lead.firstName} ${lead.lastName || ''}`.trim()
        : `Inquiry details updated for ${lead.firstName} ${lead.lastName || ''}`.trim(),
      oldValues: { status: lead.status, assignedTo: lead.assignedTo },
      newValues: patch,
    });

    return updated;
  }

  async enrollLead(id, data, actor) {
    this._assertEducation(actor);
    const lead = await this.leadRepository.findByIdOrFail(id, 'Lead');
    if (lead.status === 'enrolled' && lead.convertedStudentId) {
      throw new BusinessRuleError('This student lead is already enrolled.');
    }

    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, 'super_admin', 'org_admin', 'admin'];
    const isAdmin = adminRoles.includes(actor?.role) || actor?.permissions?.includes('leads.view_all');

    if (!isAdmin) {
      const actorId = String(actor?.id || actor?._id || '');
      const assignedId = String(lead.assignedTo?._id || lead.assignedTo || '');
      if (!lead.assignedTo || assignedId !== actorId) {
        throw new ForbiddenError('Access Denied: You can only enroll leads assigned directly to you.');
      }
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

    await this.logAudit({
      actor,
      action: 'education.student.enroll',
      entity: 'Student',
      entityId: student._id,
      module: 'Education',
      description: `Enrolled student ${student.firstName} ${student.lastName || ''} into class ${classId}`.trim(),
      newValues: { studentId: student._id, classId, enrollmentDate: student.enrollmentDate },
    });

    return student;
  }

  async removeLead(id, actor) {
    this._assertEducation(actor);
    const { ROLES } = require('../../shared/constants/roles-permissions.constants');
    const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, 'super_admin', 'org_admin', 'admin'];
    const canDelete = adminRoles.includes(actor?.role) || (actor?.permissions && (actor.permissions.includes('leads.delete') || actor.permissions.includes('*')));
    if (!canDelete) {
      throw new ForbiddenError('Access Denied: You do not have permission to delete leads.');
    }
    const lead = await this.leadRepository.findByIdOrFail(id, 'Lead');
    await this.leadRepository.softDelete(id, actor.id);

    await this.logAudit({
      actor,
      action: 'education.lead.delete',
      entity: 'Lead',
      entityId: id,
      module: 'Education',
      description: `Deleted student lead "${lead.firstName} ${lead.lastName || ''}" (${lead.mobile})`.trim(),
    });
  }
}

module.exports = { EducationService };
