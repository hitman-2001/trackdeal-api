'use strict';

const { EVENTS } = require('../../shared/constants/app.constants');
const { AnalyticsService } = require('../../modules/analytics/analytics.service');
const { tenantContext } = require('../../shared/context/tenant-context');

// ---------------------------------------------------------------------------
// Analytics Event Handlers
//
// Listens to domain events published by other modules and funnels them into
// the AnalyticsService to incrementally update the materialised summary
// collections.
//
// Design principle:
//   - Handlers NEVER assume a full payload — they resolve the entity from the
//     database using the ID provided in the thin event payload.
//   - Resolution runs under isSystemOverride: true so the repository tenant
//     filter does not throw when there is no request context.
//   - Handlers must NEVER throw — they log and swallow errors so a bad
//     analytics write never breaks the primary transaction.
//
// Events handled:
//   lead.created, lead.won, lead.lost  → LeadSummary + AgentPerformanceSummary
//   deal.closed                        → SalesSummary + AgentPerformanceSummary
//   property.reserved, deal.cancelled  → SalesSummary (reservations bounce)
//   invoice.generated, invoice.cancelled → CommissionSummary
//   payment.received                   → CommissionSummary (cleared / bounced)
//   task.created, task.completed, task.overdue → TaskSummary + AgentPerformanceSummary
// ---------------------------------------------------------------------------

// ── Entity loaders (run under system-override context) ─────────────────────

async function loadLead(leadId) {
  const { Lead } = require('../../modules/lead/lead.model');
  return tenantContext.run({ isSystemOverride: true }, () =>
    Lead.findById(leadId).lean()
  );
}

async function loadDeal(dealId) {
  const { Deal } = require('../../modules/deal/deal.model');
  return tenantContext.run({ isSystemOverride: true }, () =>
    Deal.findById(dealId).lean()
  );
}

async function loadProperty(propertyId) {
  const { Property } = require('../../modules/property/property.model');
  return tenantContext.run({ isSystemOverride: true }, () =>
    Property.findById(propertyId).lean()
  );
}

async function loadInvoice(invoiceId) {
  const { Invoice } = require('../../modules/invoice/invoice.model');
  return tenantContext.run({ isSystemOverride: true }, () =>
    Invoice.findById(invoiceId).lean()
  );
}

async function loadPayment(paymentId) {
  const { Payment } = require('../../modules/invoice/payment.model');
  return tenantContext.run({ isSystemOverride: true }, () =>
    Payment.findById(paymentId).lean()
  );
}

async function loadTask(taskId) {
  const { Task } = require('../../modules/task/task.model');
  return tenantContext.run({ isSystemOverride: true }, () =>
    Task.findById(taskId).lean()
  );
}

// ── Handler registration ────────────────────────────────────────────────────

/**
 * Register all analytics event handlers on the event bus.
 * @param {import('eventemitter2').EventEmitter2} eventBus
 */
function registerAnalyticsHandlers(eventBus) {
  const analyticsService = new AnalyticsService();

  // ── LEAD events ───────────────────────────────────────────────────────────

  eventBus.on(EVENTS.LEAD_CREATED, async ({ payload }) => {
    try {
      const lead = await loadLead(payload.leadId);
      if (!lead) return;

      await analyticsService.updateFromLeadEvent({
        organizationId: lead.organizationId,
        branchId:       lead.branchId || null,
        agentId:        lead.assignedTo || lead.ownerId || null,
        source:         lead.source   || 'unknown',
        status:         lead.status   || 'new',
        holdValue:      lead.requirements?.budget?.max || 0,
        leadCountDelta: 1,
        agentDeltas:    { leadsCreatedCount: 1 },
      });
    } catch (err) {
      console.error('[Analytics:lead.created]', err.message);
    }
  });

  eventBus.on(EVENTS.LEAD_WON, async ({ payload }) => {
    try {
      const lead = await loadLead(payload.leadId);
      if (!lead) return;

      await analyticsService.updateFromLeadEvent({
        organizationId: lead.organizationId,
        branchId:       lead.branchId || null,
        agentId:        lead.assignedTo || lead.ownerId || null,
        source:         lead.source || 'unknown',
        status:         'won',
        holdValue:      0,
        leadCountDelta: 1,
        agentDeltas:    { leadsWonCount: 1 },
      });
    } catch (err) {
      console.error('[Analytics:lead.won]', err.message);
    }
  });

  eventBus.on(EVENTS.LEAD_LOST, async ({ payload }) => {
    try {
      const lead = await loadLead(payload.leadId);
      if (!lead) return;

      await analyticsService.updateFromLeadEvent({
        organizationId: lead.organizationId,
        branchId:       lead.branchId || null,
        agentId:        lead.assignedTo || lead.ownerId || null,
        source:         lead.source || 'unknown',
        status:         'lost',
        holdValue:      0,
        leadCountDelta: 1,
        agentDeltas:    { leadsLostCount: 1 },
      });
    } catch (err) {
      console.error('[Analytics:lead.lost]', err.message);
    }
  });

  // ── DEAL events ───────────────────────────────────────────────────────────

  eventBus.on(EVENTS.DEAL_CLOSED, async ({ payload }) => {
    try {
      const deal = await loadDeal(payload.dealId);
      if (!deal) return;

      await analyticsService.updateFromDealEvent({
        organizationId: deal.organizationId,
        branchId:       deal.branchId || null,
        agentId:        deal.assignedTo || deal.sourcingAgent || null,
        projectId:      deal.project || null,
        dealValue:      deal.dealValue || deal.agreedPrice || deal.askingPrice || 0,
        isReservation:  false,
        dealCountDelta: 1,
        agentDeltas:    {
          dealsClosedCount: 1,
          grossDealValue:   deal.dealValue || deal.agreedPrice || deal.askingPrice || 0,
        },
      });
    } catch (err) {
      console.error('[Analytics:deal.closed]', err.message);
    }
  });

  // property.reserved → track reservation in sales summary
  eventBus.on(EVENTS.PROPERTY_RESERVED, async ({ payload }) => {
    try {
      const property = await loadProperty(payload.propertyId);
      if (!property) return;

      await analyticsService.updateFromDealEvent({
        organizationId: property.organizationId,
        branchId:       property.branchId || null,
        agentId:        null,
        projectId:      property.project || null,
        dealValue:      0,
        isReservation:  true,
        dealCountDelta: 0,
        agentDeltas:    null,
      });
    } catch (err) {
      console.error('[Analytics:property.reserved]', err.message);
    }
  });

  // deal.cancelled when deal was a reservation → increment reservationsBouncedCount
  eventBus.on(EVENTS.DEAL_CANCELLED, async ({ payload }) => {
    try {
      const deal = await loadDeal(payload.dealId);
      if (!deal) return;

      // Only reverse reservations that bounced
      if (['token_bounced', 'booking_defaulted', 'cancelled'].includes(deal.status)) {
        await analyticsService.updateFromDealEvent({
          organizationId:       deal.organizationId,
          branchId:             deal.branchId || null,
          agentId:              null,
          projectId:            deal.project || null,
          dealValue:            0,
          isReservation:        false,
          dealCountDelta:       0,
          reservationBounced:   true,
          agentDeltas:          null,
        });
      }
    } catch (err) {
      console.error('[Analytics:deal.cancelled]', err.message);
    }
  });

  // ── COMMISSION / INVOICE / PAYMENT events ─────────────────────────────────

  eventBus.on(EVENTS.INVOICE_GENERATED, async ({ payload }) => {
    try {
      const invoice = await loadInvoice(payload.invoiceId);
      if (!invoice) return;

      await analyticsService.updateFromCommissionEvent({
        organizationId:     invoice.organizationId,
        branchId:           invoice.branchId || null,
        expectedRevenue:    invoice.totalAmount || 0,
        collectedRevenue:   0,
        outstandingRevenue: invoice.totalAmount || 0,
        totalChequesIssued: 0,
        totalChequesPending: 0,
        totalChequesBounced: 0,
      });
    } catch (err) {
      console.error('[Analytics:invoice.generated]', err.message);
    }
  });

  // invoice.cancelled → reverse expectedRevenue and outstandingRevenue
  eventBus.on(EVENTS.INVOICE_CANCELLED, async ({ payload }) => {
    try {
      const invoice = await loadInvoice(payload.invoiceId);
      if (!invoice) return;

      // Negate both expected and outstanding to remove the cancelled invoice
      await analyticsService.updateFromCommissionEvent({
        organizationId:     invoice.organizationId,
        branchId:           invoice.branchId || null,
        expectedRevenue:    -(invoice.totalAmount || 0),
        collectedRevenue:   0,
        outstandingRevenue: -(invoice.totalAmount || 0),
        totalChequesIssued: 0,
        totalChequesPending: 0,
        totalChequesBounced: 0,
      });
    } catch (err) {
      console.error('[Analytics:invoice.cancelled]', err.message);
    }
  });

  eventBus.on(EVENTS.PAYMENT_RECEIVED, async ({ payload }) => {
    try {
      const payment = await loadPayment(payload.paymentId);
      if (!payment) return;

      // Only shift outstanding → collected when the cheque is cleared.
      // Pending payments increment the pending cheque counter but do NOT
      // increment collectedRevenue (to avoid optimistic financials).
      // Bounced payments reverse previously counted pending counter.
      const isPending = payment.status === 'pending';
      const isBounced = payment.status === 'bounced';
      const isCleared = !isPending && !isBounced; // 'cleared', 'received', etc.

      await analyticsService.updateFromCommissionEvent({
        organizationId:      payment.organizationId,
        branchId:            payment.branchId || null,
        expectedRevenue:     0,
        collectedRevenue:    isCleared ? (payment.amount || 0) : 0,
        outstandingRevenue:  isCleared ? -(payment.amount || 0) : 0,
        adjustmentDeductions: 0,
        totalChequesIssued:  isCleared || isPending ? 1 : 0,
        totalChequesPending: isPending ? 1 : (isBounced ? -1 : 0),
        totalChequesBounced: isBounced ? 1 : 0,
      });
    } catch (err) {
      console.error('[Analytics:payment.received]', err.message);
    }
  });

  // ── TASK events ───────────────────────────────────────────────────────────

  eventBus.on(EVENTS.TASK_CREATED, async ({ payload }) => {
    try {
      const task = await loadTask(payload.taskId);
      if (!task) return;

      await analyticsService.updateFromTaskEvent({
        organizationId:    task.organizationId,
        branchId:          task.branchId || null,
        agentId:           task.assignedTo || null,
        tasksPendingDelta: 1,
        agentDeltas:       { tasksPending: 1 },
      });
    } catch (err) {
      console.error('[Analytics:task.created]', err.message);
    }
  });

  eventBus.on(EVENTS.TASK_COMPLETED, async ({ payload }) => {
    try {
      const task = await loadTask(payload.taskId);
      if (!task) return;

      const slaBreached = task.isOverdue === true;

      await analyticsService.updateFromTaskEvent({
        organizationId:       task.organizationId,
        branchId:             task.branchId || null,
        agentId:              task.assignedTo || null,
        tasksCompletedDelta:  1,
        tasksPendingDelta:    -1,
        slaViolationsDelta:   slaBreached ? 1 : 0,
        agentDeltas:          { tasksCompleted: 1, tasksPending: -1 },
      });
    } catch (err) {
      console.error('[Analytics:task.completed]', err.message);
    }
  });

  eventBus.on(EVENTS.TASK_OVERDUE, async ({ payload }) => {
    try {
      const task = await loadTask(payload.taskId);
      if (!task) return;

      await analyticsService.updateFromTaskEvent({
        organizationId:     task.organizationId,
        branchId:           task.branchId || null,
        agentId:            task.assignedTo || null,
        slaViolationsDelta: 1,
        agentDeltas:        null,
      });
    } catch (err) {
      console.error('[Analytics:task.overdue]', err.message);
    }
  });

  console.info('[Analytics] Domain event handlers registered ✅');
}

module.exports = { registerAnalyticsHandlers };
