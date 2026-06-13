'use strict';

const { Notification } = require('./notification.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

class NotificationRepository extends BaseRepository {
  constructor() { super(Notification); }

  async findUnread(userId, pagination = {}) {
    return this.paginate({ recipient: userId, isRead: false }, { sort: { createdAt: -1 }, ...pagination });
  }

  async findByUser(userId, pagination = {}) {
    return this.paginate({ recipient: userId }, { sort: { createdAt: -1 }, ...pagination });
  }

  async countUnread(userId) {
    return this.count({ recipient: userId, isRead: false });
  }

  async markRead(userId, notificationId) {
    return this.model.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true },
    );
  }

  async markAllRead(userId) {
    return this.model.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
  }
}

module.exports = { NotificationRepository };
