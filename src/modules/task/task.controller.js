"use strict";

const { BaseController } = require("../../shared/base/BaseController");
const { TaskService } = require("./task.service");

class TaskController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.taskService = deps.service || new TaskService(deps);
  }

  async list(request, reply) {
    const query = this.getPagination(request.query);
    const { data, pagination } = await this.taskService.listTasks(
      { ...request.query, ...query },
      this.getUser(request)
    );
    return this.paginated(reply, data, pagination);
  }

  async getById(request, reply) {
    const task = await this.taskService.taskRepository.findByIdOrFail(
      request.params.id,
      "Task"
    );
    return this.ok(reply, task);
  }

  async create(request, reply) {
    const task = await this.taskService.createTask(
      request.body,
      this.getUser(request)
    );
    return this.created(reply, task, "Task created successfully");
  }

  async update(request, reply) {
    const task = await this.taskService.updateTask(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, task, "Task updated successfully");
  }

  async remove(request, reply) {
    await this.taskService.taskRepository.findByIdOrFail(request.params.id, "Task");
    await this.taskService.taskRepository.softDelete(request.params.id, this.getUserId(request));
    return this.noContent(reply);
  }

  async assign(request, reply) {
    const task = await this.taskService.assignTask(
      request.params.id,
      request.body.assignedTo,
      this.getUser(request)
    );
    return this.ok(reply, task, "Task assigned successfully");
  }

  async bulkAssign(request, reply) {
    const tasks = await this.taskService.bulkAssign(
      request.body.taskIds,
      request.body.assignedTo,
      this.getUser(request)
    );
    return this.ok(reply, tasks, "Tasks assigned successfully in bulk");
  }

  async complete(request, reply) {
    const task = await this.taskService.completeTask(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, task, "Task marked completed successfully");
  }

  async cancel(request, reply) {
    const task = await this.taskService.cancelTask(
      request.params.id,
      request.body.cancellationReason,
      this.getUser(request)
    );
    return this.ok(reply, task, "Task cancelled successfully");
  }

  async logActivity(request, reply) {
    const activity = await this.taskService.logActivity(
      request.body,
      this.getUser(request)
    );
    return this.created(reply, activity, "Activity logged successfully");
  }

  async scheduleReminder(request, reply) {
    const reminder = await this.taskService.scheduleReminder(
      request.body,
      this.getUser(request)
    );
    return this.created(reply, reminder, "Reminder scheduled successfully");
  }

  async rescheduleReminder(request, reply) {
    const reminder = await this.taskService.rescheduleReminder(
      request.params.id,
      request.body.remindAt,
      this.getUser(request)
    );
    return this.ok(reply, reminder, "Reminder rescheduled successfully");
  }

  async cancelReminder(request, reply) {
    const reminder = await this.taskService.cancelReminder(
      request.params.id,
      this.getUser(request)
    );
    return this.ok(reply, reminder, "Reminder cancelled successfully");
  }

  async getMetrics(request, reply) {
    const agentId = request.query.agentId || this.getUserId(request);
    const metrics = await this.taskService.getAgentProductivityMetrics(
      agentId,
      this.getUser(request)
    );
    return this.ok(reply, metrics);
  }
}

module.exports = { TaskController };
