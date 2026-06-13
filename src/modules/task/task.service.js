"use strict";

const { BaseService } = require("../../shared/base/BaseService");
const {
  TaskRepository,
  ActivityRepository,
  ReminderRepository,
} = require("./task.repository");
const {
  NotFoundError,
  BusinessRuleError,
  ForbiddenError,
} = require("../../shared/errors");
const {
  AUDIT_ACTIONS,
  EVENTS,
} = require("../../shared/constants/app.constants");

// ---------------------------------------------------------------------------
// TaskService — Operational execution engine
// ---------------------------------------------------------------------------
class TaskService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.taskRepository = deps.taskRepository || new TaskRepository();
    this.activityRepository =
      deps.activityRepository || new ActivityRepository();
    this.reminderRepository =
      deps.reminderRepository || new ReminderRepository();
  }

  /**
   * List all tasks within tenant context.
   */
  async listTasks(query, actor) {
    const filter = { isDeleted: false };

    // Agents can only see tasks assigned to them unless view_all override is present
    const {
      ROLES,
    } = require("../../shared/constants/roles-permissions.constants");
    if (
      actor.role === ROLES.AGENT &&
      !actor.permissions?.includes("tasks.view_all")
    ) {
      filter.assignedTo = actor.id;
    }

    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.type) filter.type = query.type;
    if (query.assignedTo) filter.assignedTo = query.assignedTo;
    if (query.leadId) filter.leadId = query.leadId;
    if (query.dealId) filter.dealId = query.dealId;

    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: "i" } },
        { description: { $regex: query.search, $options: "i" } },
      ];
    }

    if (query.dateRange && query.dateRange !== "all") {
      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

      if (query.dateRange === "today") {
        const endOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
        filter.dueDate = { $gte: startOfDay, $lte: endOfDay };
      } else if (query.dateRange === "tomorrow") {
        const startOfTomorrow = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
        );
        const endOfTomorrow = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
          23,
          59,
          59,
          999,
        );
        filter.dueDate = { $gte: startOfTomorrow, $lte: endOfTomorrow };
      } else if (query.dateRange === "week") {
        const endOfWeek = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 7,
          23,
          59,
          59,
          999,
        );
        filter.dueDate = { $gte: startOfDay, $lte: endOfWeek };
      } else if (query.dateRange === "overdue") {
        filter.dueDate = { $lt: now };
        filter.status = { $in: ["pending", "in_progress"] };
      }
    }

    return this.taskRepository.paginate(filter, {
      page: query.page,
      limit: query.limit,
      sort: { dueDate: 1 },
      populate: [
        { path: "assignedTo", select: "firstName lastName email" },
        { path: "leadId", select: "firstName lastName mobile" },
      ],
    });
  }

  /**
   * Create a new Task.
   */
  async createTask(data, actor) {
    // 1. Validate due date is in the future
    if (new Date(data.dueDate) < new Date()) {
      throw new BusinessRuleError(
        "Task due date cannot be in the past",
        "DUE_DATE_PAST",
      );
    }

    // 2. Validate assigned user exists, is active, and is in tenant boundaries
    const { User } = require("../user/user.model");
    const user = await User.findById(data.assignedTo);
    if (!user || user.isDeleted) {
      throw new NotFoundError("User", data.assignedTo);
    }
    if (!user.isActive) {
      throw new BusinessRuleError("Assigned user is inactive", "USER_INACTIVE");
    }
    if (user.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError(
        "Assigned user belongs to a different organization",
      );
    }

    // Branch isolation boundary check
    const targetBranchId = data.branchId || actor.branchId;
    if (
      targetBranchId &&
      user.branchId &&
      user.branchId.toString() !== targetBranchId.toString()
    ) {
      throw new ForbiddenError("Assigned user belongs to a different branch");
    }

    const task = await this.taskRepository.create({
      ...data,
      organizationId: actor.organizationId,
      branchId: targetBranchId || null,
      status: "pending",
      isOverdue: false,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await this.publishEvent(EVENTS.TASK_CREATED, { taskId: task.id });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: "Task",
      entityId: task.id,
      userId: actor.id,
      newValues: {
        title: task.title,
        type: task.type,
        assignedTo: task.assignedTo,
      },
      description: `Task '${task.title}' created and assigned to user ${task.assignedTo}`,
    });

    return task;
  }

  /**
   * Update task details (metadata and details).
   */
  async updateTask(id, data, actor) {
    const task = await this.taskRepository.findByIdOrFail(id, "Task");

    if (task.status === "completed" || task.status === "cancelled") {
      throw new BusinessRuleError(
        "Closed tasks cannot be updated",
        "TASK_CLOSED_IMMUTABLE",
      );
    }

    // Validate due date if updated
    if (data.dueDate && new Date(data.dueDate) < new Date()) {
      throw new BusinessRuleError(
        "Task due date cannot be in the past",
        "DUE_DATE_PAST",
      );
    }

    // Validate assignment if modified
    if (data.assignedTo && data.assignedTo !== task.assignedTo.toString()) {
      const { User } = require("../user/user.model");
      const user = await User.findById(data.assignedTo);
      if (!user || user.isDeleted) {
        throw new NotFoundError("User", data.assignedTo);
      }
      if (!user.isActive) {
        throw new BusinessRuleError(
          "Assigned user is inactive",
          "USER_INACTIVE",
        );
      }
      if (user.organizationId.toString() !== actor.organizationId.toString()) {
        throw new ForbiddenError(
          "Assigned user belongs to a different organization",
        );
      }
    }

    const updated = await this.taskRepository.update(id, {
      ...data,
      updatedBy: actor.id,
    });

    return updated;
  }

  /**
   * Assign/Reassign a Task.
   */
  async assignTask(id, assignedTo, actor) {
    const task = await this.taskRepository.findByIdOrFail(id, "Task");

    if (task.status === "completed" || task.status === "cancelled") {
      throw new BusinessRuleError(
        "Closed tasks cannot be reassigned",
        "TASK_CLOSED_IMMUTABLE",
      );
    }

    const { User } = require("../user/user.model");
    const user = await User.findById(assignedTo);
    if (!user || user.isDeleted) {
      throw new NotFoundError("User", assignedTo);
    }
    if (!user.isActive) {
      throw new BusinessRuleError("Assigned user is inactive", "USER_INACTIVE");
    }
    if (user.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError(
        "Assigned user belongs to a different organization",
      );
    }

    const updated = await this.taskRepository.update(id, {
      assignedTo,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.ASSIGN,
      entity: "Task",
      entityId: id,
      userId: actor.id,
      oldValues: { assignedTo: task.assignedTo },
      newValues: { assignedTo },
      description: `Task assigned to user ${assignedTo}`,
    });

    return updated;
  }

  /**
   * Bulk assign tasks.
   */
  async bulkAssign(taskIds, assignedTo, actor) {
    const updatedTasks = [];
    for (const taskId of taskIds) {
      const updated = await this.assignTask(taskId, assignedTo, actor);
      updatedTasks.push(updated);
    }
    return updatedTasks;
  }

  /**
   * Complete a Task, logging corresponding interaction activity.
   */
  async completeTask(id, completionData = {}, actor) {
    const task = await this.taskRepository.findByIdOrFail(id, "Task");

    if (task.status !== "pending" && task.status !== "in_progress") {
      throw new BusinessRuleError(
        "Only pending or in progress tasks can be completed",
        "TASK_NOT_ACTIVE",
      );
    }

    const updated = await this.taskRepository.update(id, {
      status: "completed",
      completedAt: new Date(),
      updatedBy: actor.id,
    });

    // Cancel all pending reminders for this completed task
    const reminders = await this.reminderRepository.findByTask(id);
    for (const reminder of reminders) {
      await this.reminderRepository.update(reminder.id, {
        status: "cancelled",
      });
    }

    // Log operational Activity interaction automatically
    await this.activityRepository.create({
      organizationId: actor.organizationId,
      branchId: task.branchId,
      leadId: task.leadId,
      propertyId: task.propertyId,
      dealId: task.dealId,
      taskId: id,
      type: ["call", "whatsapp", "email", "site_visit", "meeting"].includes(
        task.type,
      )
        ? task.type
        : "note",
      description: completionData.notes || `Task Completed: ${task.title}`,
      outcome: completionData.outcome || "completed_successfully",
      performedBy: actor.id,
    });

    // Trigger Lead Score update if linked to Lead
    if (task.leadId) {
      try {
        const { LeadService } = require("../lead/lead.service");
        const leadService = new LeadService();
        await leadService.recalculateLeadScore(task.leadId);
      } catch (err) {
        // Fails silently in isolation test bounds
      }
    }

    await this.publishEvent(EVENTS.TASK_COMPLETED, { taskId: id });

    await this.logAudit({
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      entity: "Task",
      entityId: id,
      userId: actor.id,
      newValues: { status: "completed" },
      description: `Task '${task.title}' marked completed`,
    });

    return updated;
  }

  /**
   * Cancel a Task, logging reasons.
   */
  async cancelTask(id, reason, actor) {
    const task = await this.taskRepository.findByIdOrFail(id, "Task");

    if (task.status === "completed" || task.status === "cancelled") {
      throw new BusinessRuleError(
        "Closed tasks cannot be cancelled",
        "TASK_CLOSED_IMMUTABLE",
      );
    }

    const updated = await this.taskRepository.update(id, {
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: reason,
      updatedBy: actor.id,
    });

    // Cancel reminders
    const reminders = await this.reminderRepository.findByTask(id);
    for (const reminder of reminders) {
      await this.reminderRepository.update(reminder.id, {
        status: "cancelled",
      });
    }

    await this.logAudit({
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      entity: "Task",
      entityId: id,
      userId: actor.id,
      newValues: { status: "cancelled", cancellationReason: reason },
      description: `Task '${task.title}' cancelled: ${reason}`,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Activity Logging Services
  // ---------------------------------------------------------------------------

  /**
   * Log completed interaction directly to Activities ledger.
   */
  async logActivity(data, actor) {
    const activity = await this.activityRepository.create({
      ...data,
      organizationId: actor.organizationId,
      branchId: data.branchId || actor.branchId || null,
      performedBy: actor.id,
    });

    if (activity.leadId) {
      try {
        const { LeadService } = require("../lead/lead.service");
        const leadService = new LeadService();
        await leadService.recalculateLeadScore(activity.leadId);
      } catch (err) {}
    }

    return activity;
  }

  // ---------------------------------------------------------------------------
  // Reminder Management Services
  // ---------------------------------------------------------------------------

  /**
   * Schedule a notification reminder.
   */
  async scheduleReminder(data, actor) {
    const task = await this.taskRepository.findByIdOrFail(data.taskId, "Task");

    if (new Date(data.remindAt) < new Date()) {
      throw new BusinessRuleError(
        "Reminder time must be in the future",
        "REMINDER_DATE_PAST",
      );
    }

    const reminder = await this.reminderRepository.create({
      ...data,
      organizationId: actor.organizationId,
      branchId: task.branchId,
      userId: actor.id,
      status: "pending",
    });

    return reminder;
  }

  /**
   * Reschedule a reminder.
   */
  async rescheduleReminder(id, remindAt, actor) {
    const reminder = await this.reminderRepository.findByIdOrFail(
      id,
      "Reminder",
    );

    if (reminder.status !== "pending") {
      throw new BusinessRuleError(
        "Only pending reminders can be rescheduled",
        "REMINDER_NOT_PENDING",
      );
    }

    if (new Date(remindAt) < new Date()) {
      throw new BusinessRuleError(
        "Reminder time must be in the future",
        "REMINDER_DATE_PAST",
      );
    }

    const updated = await this.reminderRepository.update(id, {
      remindAt: new Date(remindAt),
      updatedBy: actor.id,
    });

    return updated;
  }

  /**
   * Cancel a Reminder.
   */
  async cancelReminder(id, actor) {
    const reminder = await this.reminderRepository.findByIdOrFail(
      id,
      "Reminder",
    );

    if (reminder.status !== "pending") {
      throw new BusinessRuleError(
        "Only pending reminders can be cancelled",
        "REMINDER_NOT_PENDING",
      );
    }

    const updated = await this.reminderRepository.update(id, {
      status: "cancelled",
      updatedBy: actor.id,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Overdue SLA and Productivity Services
  // ---------------------------------------------------------------------------

  /**
   * Background runner executing SLA overdue tracking and high-priority escalation triggers.
   */
  async checkOverdueTasks(actor) {
    const overdueTasks = await this.taskRepository.findOverdue();
    const updatedCount = overdueTasks.length;

    for (const task of overdueTasks) {
      const updates = { isOverdue: true };

      // SLA Escalation rule: urgent/high priority overdue for > 2 hours is escalated
      const diffMs = Date.now() - new Date(task.dueDate).getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (
        ["high", "urgent"].includes(task.priority) &&
        diffHours > 2 &&
        !task.escalatedAt
      ) {
        updates.escalatedAt = new Date();
        updates.escalationReason = `High-priority task overdue for ${Math.round(diffHours)} hours`;
      }

      await this.taskRepository.update(task.id, updates);
      await this.publishEvent(EVENTS.TASK_OVERDUE, { taskId: task.id });
    }

    return { processed: updatedCount };
  }

  /**
   * Calculate agent operational compliance statistics.
   */
  async getAgentProductivityMetrics(agentId, actor) {
    const totalCount = await this.taskRepository.count({
      assignedTo: agentId,
      isDeleted: false,
    });
    const completedCount = await this.taskRepository.count({
      assignedTo: agentId,
      status: "completed",
      isDeleted: false,
    });
    const cancelledCount = await this.taskRepository.count({
      assignedTo: agentId,
      status: "cancelled",
      isDeleted: false,
    });
    const overdueCount = await this.taskRepository.count({
      assignedTo: agentId,
      isOverdue: true,
      isDeleted: false,
    });

    const completionRate =
      totalCount > 0
        ? Math.round((completedCount / (totalCount - cancelledCount)) * 100)
        : 100;

    return {
      totalTasks: totalCount,
      completedTasks: completedCount,
      cancelledTasks: cancelledCount,
      overdueTasks: overdueCount,
      completionRate,
    };
  }
}

module.exports = { TaskService };
