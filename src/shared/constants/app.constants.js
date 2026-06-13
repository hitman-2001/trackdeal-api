'use strict';

/**
 * Pagination defaults and limits.
 */
const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

/**
 * Audit action types — used in audit_logs collection.
 */
const AUDIT_ACTIONS = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  RESTORE: 'RESTORE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET: 'PASSWORD_RESET',
  ASSIGN: 'ASSIGN',
  STATUS_CHANGE: 'STATUS_CHANGE',
  CONVERT: 'CONVERT',
  CLOSE: 'CLOSE',
  CANCEL: 'CANCEL',
  GENERATE: 'GENERATE',
  SEND: 'SEND',
  APPROVE: 'APPROVE',
  CALCULATE: 'CALCULATE',
  SETTLE: 'SETTLE',
});

/**
 * Domain event names — single source of truth for event bus.
 */
const EVENTS = Object.freeze({
  // Auth
  USER_LOGGED_IN: 'user.logged_in',
  USER_LOGGED_OUT: 'user.logged_out',
  PASSWORD_RESET: 'password.reset',

  // Leads
  LEAD_CREATED: 'lead.created',
  LEAD_UPDATED: 'lead.updated',
  LEAD_ASSIGNED: 'lead.assigned',
  LEAD_FOLLOWUP_CREATED: 'lead.followup.created',
  LEAD_CONVERTED: 'lead.converted',
  LEAD_WON: 'lead.won',
  LEAD_LOST: 'lead.lost',

  // Customers
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',

  // Sellers
  SELLER_CREATED: 'seller.created',
  SELLER_UPDATED: 'seller.updated',

  // Properties
  PROPERTY_CREATED: 'property.created',
  PROPERTY_UPDATED: 'property.updated',
  PROPERTY_SOLD: 'property.sold',
  PROPERTY_RESERVED: 'property.reserved',

  // Site Visits
  VISIT_SCHEDULED: 'visit.scheduled',
  VISIT_COMPLETED: 'visit.completed',
  VISIT_CANCELLED: 'visit.cancelled',

  // Deals
  DEAL_CREATED: 'deal.created',
  DEAL_UPDATED: 'deal.updated',
  DEAL_CLOSED: 'deal.closed',
  DEAL_CANCELLED: 'deal.cancelled',

  // Brokerage
  BROKERAGE_CALCULATED: 'brokerage.calculated',
  BROKERAGE_PAID: 'brokerage.paid',

  // Agreements
  AGREEMENT_GENERATED: 'agreement.generated',
  AGREEMENT_APPROVED: 'agreement.approved',

  // Invoices
  INVOICE_GENERATED: 'invoice.generated',
  INVOICE_CANCELLED: 'invoice.cancelled',
  PAYMENT_RECEIVED: 'payment.received',

  // Notifications
  NOTIFICATION_SENT: 'notification.sent',

  // Tasks
  TASK_CREATED:   'task.created',
  TASK_UPDATED:   'task.updated',
  TASK_COMPLETED: 'task.completed',
  TASK_OVERDUE:   'task.overdue',
  TASK_CANCELLED: 'task.cancelled',

  // Analytics / Reports
  REPORT_EXPORT_REQUESTED:  'report.export.requested',
  REPORT_EXPORT_COMPLETED:  'report.export.completed',
  REPORT_EXPORT_FAILED:     'report.export.failed',
});

/**
 * Queue names.
 */
const QUEUES = Object.freeze({
  NOTIFICATION: 'notification',
  EMAIL: 'email',
  WHATSAPP: 'whatsapp',
  AUDIT: 'audit',
  REPORT: 'report',
  PDF_GENERATION: 'pdf_generation',
});

module.exports = { PAGINATION, AUDIT_ACTIONS, EVENTS, QUEUES };
