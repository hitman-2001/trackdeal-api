'use strict';

// ---------------------------------------------------------------------------
// Event Handler Registry
// Registers all domain event handlers on the event bus at startup.
// Each handler module exports a register(eventBus) function.
// ---------------------------------------------------------------------------

const { eventBus } = require('./event-bus');

// Import handlers — add new handlers here as modules grow
const { registerLeadHandlers } = require('./handlers/lead.handlers');
const { registerNotificationHandlers } = require('./handlers/notification.handlers');
const { registerAnalyticsHandlers } = require('./handlers/analytics.handlers');

/**
 * Register all domain event handlers.
 * Called once at application startup.
 * @param {import('pino').Logger} logger
 */
function registerEventHandlers(logger) {
  logger.info('Registering domain event handlers...');

  // Register active domain event handlers
  registerLeadHandlers(eventBus);
  registerNotificationHandlers(eventBus);
  registerAnalyticsHandlers(eventBus);

  logger.info('✅ Domain event handlers registered');
}

module.exports = { registerEventHandlers };
