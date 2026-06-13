'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { NotificationRepository } = require('./notification.repository');
const { notificationQueue } = require('../../queues/queue-manager');

// ---------------------------------------------------------------------------
// NotificationService — Owner: Notification Module
// Receives domain events and creates notifications.
// Pushes delivery jobs to BullMQ queues.
// ---------------------------------------------------------------------------

class NotificationService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.notificationRepository = deps.notificationRepository || new NotificationRepository();
  }

  /**
   * Create and queue a notification.
   */
  async send(data) {
    const notification = await this.notificationRepository.create({
      recipient: data.recipientId,
      title: data.title,
      message: data.message,
      type: data.type || 'info',
      channel: data.channel || 'in_app',
      entityType: data.entityType,
      entityId: data.entityId,
      actionUrl: data.actionUrl,
      metadata: data.metadata,
    });

    // Queue for actual delivery (email, WhatsApp, push)
    if (data.channel !== 'in_app') {
      await notificationQueue().add('send-notification', {
        notificationId: notification.id,
        channel: data.channel,
        recipientId: data.recipientId,
        title: data.title,
        message: data.message,
      });
    }

    return notification;
  }

  /**
   * Get notifications for the current user.
   */
  async getMyNotifications(userId, query) {
    return this.notificationRepository.findByUser(userId, { page: query.page, limit: query.limit });
  }

  /**
   * Get unread count for the current user.
   */
  async getUnreadCount(userId) {
    return this.notificationRepository.countUnread(userId);
  }

  /**
   * Mark a specific notification as read.
   */
  async markRead(userId, notificationId) {
    return this.notificationRepository.markRead(userId, notificationId);
  }

  /**
   * Mark all notifications as read.
   */
  async markAllRead(userId) {
    return this.notificationRepository.markAllRead(userId);
  }
}

module.exports = { NotificationService };
