"use strict";

const { Task, Activity, Reminder } = require("./task.model");
const { BaseRepository } = require("../../shared/base/BaseRepository");

// ---------------------------------------------------------------------------
// TaskRepository — Handles operational tasks
// ---------------------------------------------------------------------------
class TaskRepository extends BaseRepository {
  constructor() {
    super(Task);
  }

  /**
   * Find tasks assigned to an agent.
   */
  async findByAssignee(userId, pagination = {}) {
    return this.paginate(
      { assignedTo: userId, isDeleted: false },
      {
        sort: { dueDate: 1 },
        ...pagination,
      }
    );
  }

  /**
   * Find pending overdue tasks.
   */
  async findOverdue(limitDate = new Date()) {
    return this.findMany({
      status: { $in: ["pending", "in_progress"] },
      dueDate: { $lt: limitDate },
      isDeleted: false,
    });
  }

  /**
   * Find tasks for a specific lead relation.
   */
  async findByLead(leadId) {
    return this.findMany({ leadId, isDeleted: false });
  }

  /**
   * Find tasks for a specific deal relation.
   */
  async findByDeal(dealId) {
    return this.findMany({ dealId, isDeleted: false });
  }
}

// ---------------------------------------------------------------------------
// ActivityRepository — Handles logged activities
// ---------------------------------------------------------------------------
class ActivityRepository extends BaseRepository {
  constructor() {
    super(Activity);
  }

  /**
   * Find activity feed for a lead.
   */
  async findByLead(leadId, pagination = {}) {
    return this.paginate(
      { leadId, isDeleted: false },
      {
        sort: { createdAt: -1 },
        ...pagination,
      }
    );
  }

  /**
   * Find activity feed for a deal.
   */
  async findByDeal(dealId, pagination = {}) {
    return this.paginate(
      { dealId, isDeleted: false },
      {
        sort: { createdAt: -1 },
        ...pagination,
      }
    );
  }
}

// ---------------------------------------------------------------------------
// ReminderRepository — Handles background reminder schedules
// ---------------------------------------------------------------------------
class ReminderRepository extends BaseRepository {
  constructor() {
    super(Reminder);
  }

  /**
   * Find reminders triggered or due for a specific time window.
   */
  async findDueReminders(limitDate = new Date()) {
    return this.findMany({
      status: "pending",
      remindAt: { $lte: limitDate },
      isDeleted: false,
    });
  }

  /**
   * Find active reminders for a task.
   */
  async findByTask(taskId) {
    return this.findMany({ taskId, status: "pending", isDeleted: false });
  }
}

module.exports = {
  TaskRepository,
  ActivityRepository,
  ReminderRepository,
};
