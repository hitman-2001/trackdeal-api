'use strict';

const { Organization } = require('../organization/organization.model');
const { User } = require('../user/user.model');
const { Lead, LeadFollowUp, LeadActivity } = require('../lead/lead.model');
const { Task } = require('../task/task.model');
const { emailService } = require('./email.service');

class DailyDigestSchedulerService {
  constructor(deps = {}) {
    this.emailService = deps.emailService || emailService;
    this.intervalId = null;
    this.lastDispatchedDate = null;
    this.isProcessing = false;
    this.logger = deps.logger || console;
    this.targetHour = deps.targetHour ?? 11; // 11:00 AM
    this.targetMinute = deps.targetMinute ?? 0;
    this.timezone = deps.timezone || 'Asia/Kolkata';
  }

  /**
   * Start the 11:00 AM IST Cron Scheduler (Native, Zero External Dependencies)
   */
  startScheduler(intervalMs = 30000) {
    if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MAIL_CRON !== 'true') {
      this.logger.info?.('[DailyDigestScheduler] Skipped starting daily digest scheduler in local/dev environment.');
      return;
    }

    if (this.intervalId) {
      this.logger.warn?.('[DailyDigestScheduler] Scheduler is already running.');
      return;
    }

    this.logger.info?.(`[DailyDigestScheduler] Initialized daily 11:00 AM IST operations digest scheduler (Timezone: ${this.timezone})`);

    // Check every 30s for the 11:00 AM IST window
    this.intervalId = setInterval(() => {
      this._checkAndTriggerDailyDigest().catch((err) => {
        this.logger.error?.('[DailyDigestScheduler] Error during scheduled check:', err.message);
      });
    }, intervalMs);

    if (this.intervalId.unref) {
      this.intervalId.unref();
    }
  }

  /**
   * Stop the Scheduler (called on graceful server shutdown)
   */
  stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info?.('[DailyDigestScheduler] Stopped daily digest scheduler.');
    }
  }

  /**
   * Check whether current time matches 11:00 AM in configured timezone (Asia/Kolkata)
   */
  async _checkAndTriggerDailyDigest() {
    const now = new Date();
    try {
      const timeParts = new Intl.DateTimeFormat('en-GB', {
        timeZone: this.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now).split(':');

      const currentHour = parseInt(timeParts[0], 10);
      const currentMinute = parseInt(timeParts[1], 10);

      const todayDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: this.timezone,
      }).format(now); // Format: 'YYYY-MM-DD'

      if (currentHour === this.targetHour && currentMinute === this.targetMinute && this.lastDispatchedDate !== todayDateStr) {
        this.lastDispatchedDate = todayDateStr;
        this.logger.info?.(`[DailyDigestScheduler] 11:00 AM IST reached for ${todayDateStr}. Executing daily admin digests...`);
        await this.dispatchAllOrganizationDigests();
      }
    } catch (err) {
      this.logger.error?.('[DailyDigestScheduler] Timecheck calculation failed:', err.message);
    }
  }

  /**
   * Helper: Format action/followup type into a clear title
   */
  _formatType(rawType) {
    if (!rawType) return 'Follow-up';
    const typeMap = {
      call: 'Callback',
      phone_call: 'Phone Call',
      whatsapp: 'WhatsApp Outreach',
      email: 'Email Outreach',
      visit: 'Campus Visit',
      site_visit: 'Site Visit',
      meeting: 'Student Meeting',
      stage_change: 'Stage Updated',
      document: 'Document Verification',
      payment: 'Fee Collection',
      general: 'Task',
      note: 'Note Added',
      other: 'Follow-up',
    };
    return typeMap[rawType.toLowerCase()] || rawType.charAt(0).toUpperCase() + rawType.slice(1);
  }

  /**
   * Helper: Calculate human-friendly delay label
   */
  _getDelayLabel(scheduledDate, now = new Date()) {
    const diffMs = now.getTime() - new Date(scheduledDate).getTime();
    if (diffMs <= 0) return 'Due Today';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 1) {
      return `Overdue by ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    }
    if (diffHours >= 1) {
      return `Overdue by ${diffHours} hr${diffHours > 1 ? 's' : ''}`;
    }
    return 'Overdue';
  }

  /**
   * Format time in IST
   */
  _formatTime(date) {
    try {
      return new Date(date).toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: this.timezone,
      });
    } catch {
      return '';
    }
  }

  /**
   * Extract student or school/college name
   */
  _getSchoolOrCollege(lead) {
    if (!lead) return '';
    if (lead.schoolName) return lead.schoolName;
    if (lead.customFields) {
      return (
        lead.customFields.school_name ||
        lead.customFields.college_name ||
        lead.customFields.school_or_college_name ||
        lead.customFields.institution_name ||
        ''
      );
    }
    return '';
  }

  /**
   * Dispatch daily digest for all active organizations in the database
   */
  async dispatchAllOrganizationDigests() {
    if (this.isProcessing) {
      this.logger.warn?.('[DailyDigestScheduler] Previous digest dispatch is still in progress, skipping.');
      return;
    }

    this.isProcessing = true;
    const now = new Date();

    try {
      const organizations = await Organization.find({ isDeleted: false }).lean();
      this.logger.info?.(`[DailyDigestScheduler] Processing daily digest for ${organizations.length} organizations...`);

      for (const org of organizations) {
        try {
          await this.dispatchDigestForOrganization(org._id, now);
        } catch (err) {
          this.logger.error?.(`[DailyDigestScheduler] Failed for organization ${org.name} (${org._id}):`, err.message);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Collect metrics and dispatch digest for a single organization
   */
  async dispatchDigestForOrganization(orgId, targetDate = new Date()) {
    const org = await Organization.findById(orgId).lean();
    if (!org) return;

    // 1. Resolve Organization Administrators
    const admins = await User.find({
      organizationId: org._id,
      isDeleted: false,
      status: 'active',
    })
      .populate('roleId')
      .lean();

    const orgAdmins = admins.filter((u) => {
      const roleCode = String(u.roleId?.code || u.roleId?.name || '').toLowerCase();
      return (
        ['org_admin', 'organization_admin', 'super_admin'].includes(roleCode) ||
        (org.ownerId && String(org.ownerId) === String(u._id))
      );
    });

    if (orgAdmins.length === 0) {
      this.logger.info?.(`[DailyDigestScheduler] No active org admin found for '${org.name}'. Skipping.`);
      return;
    }

    // 2. Compute date boundaries for "today" in IST
    const now = new Date(targetDate);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // 3. Retrieve all active staff members in this organization
    const staffMembers = await User.find({
      organizationId: org._id,
      isDeleted: false,
    })
      .populate('roleId')
      .lean();

    const staffSummaryList = [];

    for (const staff of staffMembers) {
      const staffName = `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email;
      let roleName = staff.roleId?.name || staff.roleId?.code || 'Staff';
      if (org.vertical === 'education') {
        roleName = roleName.replace(/agent/gi, 'Staff');
      }

      // A. Overdue Follow-ups (scheduledAt < now and pending/scheduled)
      const overdueFollowUps = await LeadFollowUp.find({
        organizationId: org._id,
        assignedTo: staff._id,
        status: { $in: ['scheduled', 'pending'] },
        scheduledAt: { $lt: now },
        isDeleted: false,
      })
        .populate('leadId', 'firstName lastName phone schoolName customFields')
        .sort({ scheduledAt: 1 })
        .limit(20)
        .lean();

      // B. Overdue Tasks
      const overdueTasksList = await Task.find({
        organizationId: org._id,
        assignedTo: staff._id,
        status: { $in: ['pending', 'in_progress'] },
        dueDate: { $lt: now },
        isDeleted: false,
      })
        .populate('leadId', 'firstName lastName phone schoolName customFields')
        .sort({ dueDate: 1 })
        .limit(20)
        .lean();

      // Combine Overdue Items
      const overdueTasks = [
        ...overdueFollowUps.map((f) => ({
          leadName: f.leadId ? `${f.leadId.firstName || ''} ${f.leadId.lastName || ''}`.trim() : 'Prospect',
          leadPhone: f.leadId?.phone || '',
          schoolName: this._getSchoolOrCollege(f.leadId),
          taskTitle: `${this._formatType(f.type)}: ${f.notes || 'Follow-up Call'}`,
          dueDate: new Date(f.scheduledAt).toLocaleDateString('en-IN', { timeZone: this.timezone }),
          dueTime: this._formatTime(f.scheduledAt),
          delayLabel: this._getDelayLabel(f.scheduledAt, now),
        })),
        ...overdueTasksList.map((t) => ({
          leadName: t.leadId ? `${t.leadId.firstName || ''} ${t.leadId.lastName || ''}`.trim() : 'General Task',
          leadPhone: t.leadId?.phone || '',
          schoolName: this._getSchoolOrCollege(t.leadId),
          taskTitle: t.title || 'Task',
          dueDate: new Date(t.dueDate).toLocaleDateString('en-IN', { timeZone: this.timezone }),
          dueTime: this._formatTime(t.dueDate),
          delayLabel: this._getDelayLabel(t.dueDate, now),
        })),
      ];

      // C. Work Completed Today (Follow-ups completed today + Activities performed today)
      const completedFollowUps = await LeadFollowUp.find({
        organizationId: org._id,
        assignedTo: staff._id,
        status: 'completed',
        updatedAt: { $gte: startOfDay, $lte: now },
        isDeleted: false,
      })
        .populate('leadId', 'firstName lastName phone schoolName customFields')
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean();

      const activitiesToday = await LeadActivity.find({
        organizationId: org._id,
        performedBy: staff._id,
        createdAt: { $gte: startOfDay, $lte: now },
        isDeleted: false,
      })
        .populate('leadId', 'firstName lastName phone schoolName customFields')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      const completedTasksList = await Task.find({
        organizationId: org._id,
        assignedTo: staff._id,
        status: 'completed',
        completedAt: { $gte: startOfDay, $lte: now },
        isDeleted: false,
      })
        .populate('leadId', 'firstName lastName phone schoolName customFields')
        .sort({ completedAt: -1 })
        .limit(20)
        .lean();

      // Deduplicate and assemble completed items
      const completedTasks = [
        ...completedFollowUps.map((f) => ({
          leadName: f.leadId ? `${f.leadId.firstName || ''} ${f.leadId.lastName || ''}`.trim() : 'Prospect',
          leadPhone: f.leadId?.phone || '',
          schoolName: this._getSchoolOrCollege(f.leadId),
          actionTitle: `${this._formatType(f.type)} Completed`,
          outcome: f.outcome || f.notes || 'Follow-up marked completed',
          completedAt: this._formatTime(f.completedAt || f.updatedAt),
        })),
        ...activitiesToday.map((a) => ({
          leadName: a.leadId ? `${a.leadId.firstName || ''} ${a.leadId.lastName || ''}`.trim() : 'Prospect',
          leadPhone: a.leadId?.phone || '',
          schoolName: this._getSchoolOrCollege(a.leadId),
          actionTitle: a.summary || this._formatType(a.type),
          outcome: a.description || a.customerResponse || '',
          completedAt: this._formatTime(a.activityDate || a.createdAt),
        })),
        ...completedTasksList.map((t) => ({
          leadName: t.leadId ? `${t.leadId.firstName || ''} ${t.leadId.lastName || ''}`.trim() : 'Task',
          leadPhone: t.leadId?.phone || '',
          schoolName: this._getSchoolOrCollege(t.leadId),
          actionTitle: t.title || 'Task Completed',
          outcome: t.description || 'Task completed successfully',
          completedAt: this._formatTime(t.completedAt || t.updatedAt),
        })),
      ];

      // D. Tasks remaining due for today
      const todayFollowUps = await LeadFollowUp.find({
        organizationId: org._id,
        assignedTo: staff._id,
        status: { $in: ['scheduled', 'pending'] },
        scheduledAt: { $gte: now, $lte: endOfDay },
        isDeleted: false,
      }).lean();

      staffSummaryList.push({
        staffName,
        staffEmail: staff.email,
        role: roleName,
        completedTasks,
        overdueTasks,
        todayTasks: todayFollowUps,
      });
    }

    // 4. Dispatch Email to all Org Admins of this Organization
    for (const admin of orgAdmins) {
      const adminName = `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Administrator';
      this.logger.info?.(`[DailyDigestScheduler] Dispatching daily digest to ${admin.email} (${org.name})...`);

      await this.emailService.sendDailyOverdueTaskDigestEmail({
        toAdmin: admin.email,
        adminName,
        organizationName: org.name,
        date: now,
        staffMembers: staffSummaryList,
        staffMembersWithTasks: staffSummaryList,
        dashboardUrl: `${(process.env.FRONTEND_URL || 'https://trackdeal.in').replace(/\/+$/, '')}/app/dashboard`,
        isEducation: org.vertical === 'education',
        vertical: org.vertical || 'education',
      });
    }

    return {
      success: true,
      orgId: org._id,
      orgName: org.name,
      adminCount: orgAdmins.length,
      staffCount: staffSummaryList.length,
    };
  }
}

const dailyDigestScheduler = new DailyDigestSchedulerService();

module.exports = {
  DailyDigestSchedulerService,
  dailyDigestScheduler,
};

