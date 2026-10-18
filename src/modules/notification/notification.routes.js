'use strict';

const { authenticate } = require('../../shared/middleware/authenticate.middleware');
const { NotificationController } = require('./notification.controller');

const controller = new NotificationController();

async function notificationRoutes(fastify, opts) {
  fastify.addHook('preValidation', authenticate);
  fastify.get('/', { schema: { tags: ['Notifications'], summary: 'Get my notifications' } }, controller.list);
  fastify.get('/unread-count', { schema: { tags: ['Notifications'], summary: 'Get unread count' } }, controller.unreadCount);
  fastify.post('/:id/read', { schema: { tags: ['Notifications'], summary: 'Mark notification as read' } }, controller.markRead);
  fastify.post('/read-all', { schema: { tags: ['Notifications'], summary: 'Mark all as read' } }, controller.markAllRead);
  fastify.post('/device-token', { schema: { tags: ['Notifications'], summary: 'Register FCM device token' } }, controller.registerDeviceToken);
  fastify.delete('/device-token', { schema: { tags: ['Notifications'], summary: 'Unregister FCM device token' } }, controller.unregisterDeviceToken);
  fastify.post('/test', { schema: { tags: ['Notifications'], summary: 'Send test push notification' } }, controller.sendTestNotification);
  fastify.post('/trigger-reminders', { schema: { tags: ['Notifications'], summary: 'Trigger upcoming 10-minute task reminders scan' } }, controller.triggerUpcomingReminders);
}

module.exports = notificationRoutes;
