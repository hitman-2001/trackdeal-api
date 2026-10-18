'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { NotificationRepository } = require('./notification.repository');
const { notificationQueue } = require('../../queues/queue-manager');
const { FirebaseAdapter } = require('./providers/firebase.adapter');
const { User } = require('../user/user.model');

// ---------------------------------------------------------------------------
// NotificationService — Owner: Notification Module
// Receives domain events and creates notifications.
// Handles in-app records and real-time native push notifications via FCM.
// ---------------------------------------------------------------------------

class NotificationService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.notificationRepository = deps.notificationRepository || new NotificationRepository();
    this.firebaseAdapter = deps.firebaseAdapter || new FirebaseAdapter();
  }

  /**
   * Create and queue a notification, and deliver push notification to user devices.
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

    // Send push notification to user's registered devices
    try {
      await this.sendPushNotification(data.recipientId, {
        title: data.title,
        message: data.message,
        actionUrl: data.actionUrl,
        imageUrl: data.imageUrl || data.metadata?.imageUrl || null,
        data: {
          notificationId: String(notification.id || notification._id),
          entityType: data.entityType || '',
          entityId: data.entityId ? String(data.entityId) : '',
          actionUrl: data.actionUrl || '/',
        },
      });
    } catch (pushErr) {
      // Non-fatal for in-app creation
      this.logger?.warn?.({ err: pushErr }, 'Push dispatch non-fatal failure');
    }

    // Queue for secondary delivery channels (email, WhatsApp) if specified
    if (data.channel && !['in_app', 'push'].includes(data.channel)) {
      try {
        await notificationQueue().add('send-notification', {
          notificationId: notification.id,
          channel: data.channel,
          recipientId: data.recipientId,
          title: data.title,
          message: data.message,
        });
      } catch (queueErr) {
        // Queue non-fatal
      }
    }

    return notification;
  }

  /**
   * Register an FCM device token for a user.
   */
  async registerDeviceToken(userId, token, platform = 'android') {
    if (!token || typeof token !== 'string') return null;

    const user = await User.findById(userId);
    if (!user) return null;

    if (!Array.isArray(user.deviceTokens)) {
      user.deviceTokens = [];
    }

    const existingIndex = user.deviceTokens.findIndex((dt) => dt.token === token.trim());
    if (existingIndex !== -1) {
      user.deviceTokens[existingIndex].updatedAt = new Date();
      user.deviceTokens[existingIndex].platform = platform;
    } else {
      user.deviceTokens.push({
        token: token.trim(),
        platform,
        updatedAt: new Date(),
      });
    }

    // Retain up to the 10 most recent device tokens
    if (user.deviceTokens.length > 10) {
      user.deviceTokens.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      user.deviceTokens = user.deviceTokens.slice(0, 10);
    }

    await user.save();
    return { success: true, count: user.deviceTokens.length };
  }

  /**
   * Unregister an FCM device token for a user.
   */
  async unregisterDeviceToken(userId, token) {
    if (!token || typeof token !== 'string') return null;

    const user = await User.findById(userId);
    if (!user || !Array.isArray(user.deviceTokens)) return null;

    user.deviceTokens = user.deviceTokens.filter((dt) => dt.token !== token.trim());
    await user.save();
    return { success: true, count: user.deviceTokens.length };
  }

  /**
   * Deliver push notification to a recipient's active devices.
   */
  async sendPushNotification(recipientId, { title, message, data = {}, imageUrl = null, actionUrl = '/' }) {
    const user = await User.findById(recipientId).select('deviceTokens preferences').lean();
    if (!user || !Array.isArray(user.deviceTokens) || user.deviceTokens.length === 0) {
      return { status: 'SKIPPED', reason: 'No registered devices' };
    }

    const tokens = user.deviceTokens.map((dt) => dt.token).filter(Boolean);
    if (tokens.length === 0) {
      return { status: 'SKIPPED', reason: 'No valid device tokens' };
    }

    const payload = {
      registration_ids: tokens,
      notification: {
        title: title || 'TrackDeal',
        body: message || '',
        ...(imageUrl ? { image: imageUrl } : {}),
      },
      data: {
        ...data,
        actionUrl: actionUrl || '/',
        ...(imageUrl ? { imageUrl } : {}),
      },
    };

    const result = await this.firebaseAdapter.send(payload);

    // Prune invalid tokens if reported by FCM
    if (result.metadata?.invalidTokens && result.metadata.invalidTokens.length > 0) {
      const deadSet = new Set(result.metadata.invalidTokens);
      await User.updateOne(
        { _id: recipientId },
        { $pull: { deviceTokens: { token: { $in: Array.from(deadSet) } } } }
      ).catch(() => {});
    }

    return result;
  }

  /**
   * Send a test push notification to the current user's registered devices.
   */
  async sendTestNotification(userId) {
    return this.send({
      recipientId: userId,
      title: 'TrackDeal Push Notification Test',
      message: 'Push notifications are working smoothly on your device!',
      type: 'info',
      channel: 'push',
      actionUrl: '/notifications',
    });
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
