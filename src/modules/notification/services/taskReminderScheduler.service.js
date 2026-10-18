'use strict';

const { LeadFollowUp, Lead } = require('../../lead/lead.model');
const { Task } = require('../../task/task.model');
const { User } = require('../../user/user.model');
const { NotificationService } = require('../notification.service');

class TaskReminderSchedulerService {
  constructor(deps = {}) {
    this.notificationService = deps.notificationService || new NotificationService();
    this.intervalId = null;
    this.isProcessing = false;
    this.logger = deps.logger || console;
  }

  /**
   * Helper to format task/followup type into a human-friendly label
   */
  _formatType(rawType) {
    if (!rawType) return 'Follow-up';
    const typeMap = {
      call: 'Callback',
      phone_call: 'Phone Call',
      whatsapp: 'WhatsApp Follow-up',
      email: 'Email Outreach',
      visit: 'Campus Visit',
      site_visit: 'Site Visit',
      meeting: 'Student Meeting',
      document: 'Document Verification',
      payment: 'Fee Collection',
      general: 'Task',
      other: 'Follow-up',
    };
    return typeMap[rawType.toLowerCase()] || rawType.charAt(0).toUpperCase() + rawType.slice(1);
  }

  /**
   * Helper to format time into HH:MM AM/PM
   */
  _formatTime(date) {
    try {
      const d = new Date(date);
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  }

  /**
   * Helper to get full name of lead/student
   */
  _getLeadName(lead) {
    if (!lead) return 'Contact';
    if (lead.firstName || lead.lastName) {
      return `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
    }
    return lead.name || (lead.tenantVertical === 'education' ? 'Student' : 'Client');
  }

  /**
   * Main execution pass to discover tasks/followups due in ~10 minutes
   */
  async processUpcomingReminders() {
    if (this.isProcessing) {
      this.logger.debug?.('Task reminder tick skipped: previous tick still in progress');
      return { skipped: true, reason: 'Already running' };
    }

    this.isProcessing = true;
    const now = new Date();

    // Look for follow-ups and tasks scheduled between now and (now + 10m 30s)
    // To ensure none are missed if scheduler was briefly busy, allow window from now - 60s
    const windowStart = new Date(now.getTime() - 60 * 1000);
    const windowEnd = new Date(now.getTime() + 10 * 60 * 1000 + 30 * 1000);

    try {
      // 1. Fetch unreminded LeadFollowUps (used across both Education and Real Estate)
      const pendingFollowUps = await LeadFollowUp.find({
        scheduledAt: { $gte: windowStart, $lte: windowEnd },
        status: 'scheduled',
        reminder10MinSent: { $ne: true },
        isDeleted: { $ne: true },
      })
        .populate('leadId', 'firstName lastName name mobile email tenantVertical')
        .populate('assignedTo', '_id firstName lastName name email')
        .lean();

      // 2. Fetch unreminded Tasks (used across Real Estate CRM and Education)
      const pendingTasks = await Task.find({
        dueDate: { $gte: windowStart, $lte: windowEnd },
        status: { $in: ['pending', 'in_progress'] },
        reminder10MinSent: { $ne: true },
      })
        .populate('leadId', 'firstName lastName name mobile email tenantVertical')
        .populate('assignedTo', '_id firstName lastName name email')
        .lean();

      if (pendingFollowUps.length === 0 && pendingTasks.length === 0) {
        return { processed: 0, usersNotified: 0 };
      }

      // 3. Group by assignedTo user ID
      const userTasksMap = new Map();

      for (const fu of pendingFollowUps) {
        const userId = String(fu.assignedTo?._id || fu.assignedTo);
        if (!userId || userId === 'undefined' || userId === 'null') continue;

        if (!userTasksMap.has(userId)) {
          userTasksMap.set(userId, {
            user: fu.assignedTo,
            items: [],
          });
        }

        const leadName = this._getLeadName(fu.leadId);
        userTasksMap.get(userId).items.push({
          id: fu._id,
          source: 'followup',
          rawType: fu.type,
          typeLabel: this._formatType(fu.type),
          leadName,
          leadId: fu.leadId?._id ? String(fu.leadId._id) : null,
          mobile: fu.leadId?.mobile || '',
          tenantVertical: fu.leadId?.tenantVertical || 'realEstate',
          scheduledAt: fu.scheduledAt,
          notes: fu.notes || '',
        });
      }

      for (const t of pendingTasks) {
        const userId = String(t.assignedTo?._id || t.assignedTo);
        if (!userId || userId === 'undefined' || userId === 'null') continue;

        if (!userTasksMap.has(userId)) {
          userTasksMap.set(userId, {
            user: t.assignedTo,
            items: [],
          });
        }

        const leadName = t.leadId ? this._getLeadName(t.leadId) : (t.title || 'Task');
        userTasksMap.get(userId).items.push({
          id: t._id,
          source: 'task',
          rawType: t.type || 'general',
          typeLabel: this._formatType(t.type),
          leadName,
          leadId: t.leadId?._id ? String(t.leadId._id) : null,
          mobile: t.leadId?.mobile || '',
          tenantVertical: t.leadId?.tenantVertical || 'realEstate',
          scheduledAt: t.dueDate,
          notes: t.description || t.title || '',
        });
      }

      let usersNotified = 0;
      const processedFollowUpIds = [];
      const processedTaskIds = [];

      // 4. Send aggregated or single notification per user
      for (const [userId, group] of userTasksMap.entries()) {
        const { items } = group;
        if (items.length === 0) continue;

        let title = '';
        let message = '';
        let actionUrl = '/app/dashboard';
        const isEducationVertical = items.some((i) => i.tenantVertical === 'education');

        if (items.length === 1) {
          // Single task notification
          const item = items[0];
          const timeStr = this._formatTime(item.scheduledAt);
          title = `Reminder: ${item.typeLabel} in 10 minutes (${item.leadName})`;

          let details = `${item.typeLabel} with ${item.leadName} scheduled for ${timeStr}`;
          if (item.notes && item.notes.trim()) {
            details += ` - Note: ${item.notes.trim().slice(0, 100)}`;
          }
          message = details;

          if (item.tenantVertical === 'education') {
            actionUrl = item.leadId ? `/app/dashboard?leadId=${item.leadId}` : '/app/dashboard';
          } else {
            actionUrl = item.leadId ? `/app/leads/${item.leadId}` : (item.source === 'task' ? '/app/tasks' : '/app/dashboard');
          }
        } else {
          // Multiple tasks notification: aggregate all into a clean summary
          title = `Upcoming Agenda: ${items.length} tasks scheduled in 10 minutes`;

          const summaryLines = items.slice(0, 4).map((item, idx) => {
            const timeStr = this._formatTime(item.scheduledAt);
            return `${idx + 1}. ${item.leadName} (${item.typeLabel}${timeStr ? ` at ${timeStr}` : ''})`;
          });

          if (items.length > 4) {
            summaryLines.push(`...and ${items.length - 4} more tasks`);
          }

          message = summaryLines.join(' | ');
          actionUrl = '/app/dashboard';
        }

        try {
          await this.notificationService.send({
            recipientId: userId,
            title,
            message,
            type: 'warning',
            channel: 'in_app',
            entityType: items.length === 1 ? (items[0].source === 'followup' ? 'lead_followup' : 'task') : 'task_group',
            entityId: items.length === 1 ? items[0].id : null,
            actionUrl,
            metadata: {
              taskCount: items.length,
              tasks: items.map((i) => ({
                id: i.id,
                source: i.source,
                leadName: i.leadName,
                leadId: i.leadId,
                type: i.rawType,
                scheduledAt: i.scheduledAt,
              })),
            },
          });
          usersNotified++;

          // Track processed IDs for database flag update on successful dispatch
          for (const item of items) {
            if (item.source === 'followup') {
              processedFollowUpIds.push(item.id);
            } else if (item.source === 'task') {
              processedTaskIds.push(item.id);
            }
          }
        } catch (dispatchErr) {
          this.logger.error?.({ err: dispatchErr, userId }, 'Failed to dispatch 10-minute task reminder');
        }
      }

      // 5. Atomic batch mark as reminder sent
      if (processedFollowUpIds.length > 0) {
        await LeadFollowUp.updateMany(
          { _id: { $in: processedFollowUpIds } },
          { $set: { reminder10MinSent: true, reminder10MinSentAt: new Date() } }
        );
      }

      if (processedTaskIds.length > 0) {
        await Task.updateMany(
          { _id: { $in: processedTaskIds } },
          { $set: { reminder10MinSent: true, reminder10MinSentAt: new Date() } }
        );
      }

      return {
        processed: processedFollowUpIds.length + processedTaskIds.length,
        followUpsCount: processedFollowUpIds.length,
        tasksCount: processedTaskIds.length,
        usersNotified,
      };
    } catch (err) {
      this.logger.error?.({ err }, 'Error in TaskReminderSchedulerService.processUpcomingReminders');
      throw err;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start recurring background loop
   */
  startScheduler(intervalMs = 60000) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.logger.info?.(`Task Reminder Scheduler initialized with interval ${intervalMs}ms`);

    // Run first check after 5 seconds to warm up
    setTimeout(() => {
      this.processUpcomingReminders().catch((err) => {
        this.logger.error?.({ err }, 'Initial task reminder scan failed');
      });
    }, 5000);

    this.intervalId = setInterval(() => {
      this.processUpcomingReminders().catch((err) => {
        this.logger.error?.({ err }, 'Periodic task reminder scan failed');
      });
    }, intervalMs);

    // Ensure timer does not prevent process exit
    if (this.intervalId.unref) {
      this.intervalId.unref();
    }
  }

  /**
   * Stop recurring background loop
   */
  stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info?.('Task Reminder Scheduler stopped');
    }
  }
}

const taskReminderScheduler = new TaskReminderSchedulerService();

module.exports = {
  TaskReminderSchedulerService,
  taskReminderScheduler,
};

