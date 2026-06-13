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
}

module.exports = notificationRoutes;
