'use strict';

const { EVENTS } = require('../../shared/constants/app.constants');
const { NotificationService } = require('../../modules/notification/notification.service');

/**
 * Register notification event handlers on the event bus.
 * @param {import('eventemitter2').EventEmitter2} eventBus
 */
function registerNotificationHandlers(eventBus) {
  const notificationService = new NotificationService();

  // 1. Site Visit Scheduled
  eventBus.on(EVENTS.VISIT_SCHEDULED, async (payload) => {
    try {
      const SiteVisit = require('mongoose').model('SiteVisit');
      const visit = await SiteVisit.findById(payload.visitId).populate('agent');
      if (!visit) return;

      // Notify the assigned agent
      await notificationService.send({
        recipientId: visit.agent.id || visit.agent,
        title: 'New Site Visit Scheduled',
        message: `You have a site visit scheduled on ${new Date(visit.scheduledAt).toLocaleString('en-IN')}`,
        type: 'info',
        channel: 'in_app',
        entityType: 'site-visit',
        entityId: visit.id,
      });
    } catch (err) {
      console.error('[Event:visit.scheduled] Error sending notification:', err.message);
    }
  });

  // 2. Deal Closed
  eventBus.on(EVENTS.DEAL_CLOSED, async (payload) => {
    try {
      const Deal = require('mongoose').model('Deal');
      const deal = await Deal.findById(payload.dealId).populate('broker');
      if (!deal) return;

      // Notify the broker owner / manager or broker who closed it
      await notificationService.send({
        recipientId: deal.broker.id || deal.broker,
        title: 'Deal Successfully Closed',
        message: `Deal ${deal.dealNumber} has been successfully closed!`,
        type: 'success',
        channel: 'in_app',
        entityType: 'deal',
        entityId: deal.id,
      });
    } catch (err) {
      console.error('[Event:deal.closed] Error sending notification:', err.message);
    }
  });

  // 3. Brokerage Calculated
  eventBus.on(EVENTS.BROKERAGE_CALCULATED, async (payload) => {
    try {
      const Brokerage = require('mongoose').model('Brokerage');
      const brokerage = await Brokerage.findById(payload.brokerageId);
      if (!brokerage) return;

      // Notify the agent of calculated commission
      await notificationService.send({
        recipientId: brokerage.agent,
        title: 'Brokerage Commission Calculated',
        message: `Commission of ${brokerage.amountFinal} INR has been calculated for you.`,
        type: 'info',
        channel: 'in_app',
        entityType: 'brokerage',
        entityId: brokerage.id,
      });
    } catch (err) {
      console.error('[Event:brokerage.calculated] Error sending notification:', err.message);
    }
  });
}

module.exports = { registerNotificationHandlers };
