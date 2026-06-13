'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { NotificationService } = require('./notification.service');

class NotificationController extends BaseController {
  constructor(deps = {}) { super(deps); this.notificationService = deps.service || new NotificationService(deps); }
  async list(req, reply) { const { data, pagination } = await this.notificationService.getMyNotifications(this.getUserId(req), this.getPagination(req.query)); return this.paginated(reply, data, pagination); }
  async unreadCount(req, reply) { return this.ok(reply, { count: await this.notificationService.getUnreadCount(this.getUserId(req)) }); }
  async markRead(req, reply) { return this.ok(reply, await this.notificationService.markRead(this.getUserId(req), req.params.id)); }
  async markAllRead(req, reply) { await this.notificationService.markAllRead(this.getUserId(req)); return this.ok(reply, null, 'All notifications marked as read'); }
}

module.exports = { NotificationController };
