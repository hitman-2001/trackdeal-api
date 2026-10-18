'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { NotificationService } = require('./notification.service');

class NotificationController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.notificationService = deps.service || new NotificationService(deps);
  }

  async list(req, reply) {
    const { data, pagination } = await this.notificationService.getMyNotifications(
      this.getUserId(req),
      this.getPagination(req.query)
    );
    return this.paginated(reply, data, pagination);
  }

  async unreadCount(req, reply) {
    return this.ok(reply, { count: await this.notificationService.getUnreadCount(this.getUserId(req)) });
  }

  async markRead(req, reply) {
    return this.ok(reply, await this.notificationService.markRead(this.getUserId(req), req.params.id));
  }

  async markAllRead(req, reply) {
    await this.notificationService.markAllRead(this.getUserId(req));
    return this.ok(reply, null, 'All notifications marked as read');
  }

  async registerDeviceToken(req, reply) {
    const { token, platform } = req.body || {};
    if (!token) {
      return this.badRequest(reply, 'Device token is required');
    }
    const result = await this.notificationService.registerDeviceToken(
      this.getUserId(req),
      token,
      platform || 'android'
    );
    return this.ok(reply, result, 'Device token registered successfully');
  }

  async unregisterDeviceToken(req, reply) {
    const { token } = req.body || {};
    const result = await this.notificationService.unregisterDeviceToken(
      this.getUserId(req),
      token
    );
    return this.ok(reply, result, 'Device token unregistered successfully');
  }

  async sendTestNotification(req, reply) {
    const result = await this.notificationService.sendTestNotification(this.getUserId(req));
    return this.ok(reply, result, 'Test push notification dispatched');
  }

  async triggerUpcomingReminders(req, reply) {
    const { taskReminderScheduler } = require('./services/taskReminderScheduler.service');
    const result = await taskReminderScheduler.processUpcomingReminders();
    return this.ok(reply, result, 'Task reminders scan executed successfully');
  }
}

module.exports = { NotificationController };
