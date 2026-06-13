'use strict';

const { BaseRepository } = require('../../shared/base/BaseRepository');
const {
  LeadSummary,
  SalesSummary,
  CommissionSummary,
  TaskSummary,
  LeadMonthlySummary,
  SalesMonthlySummary,
  CommissionMonthlySummary,
  AgentPerformanceSummary,
} = require('./analytics.model');

// ---------------------------------------------------------------------------
// Analytics Repositories
//
// Each summary model has its own repository sub-class.
// Crucial: upsertSummary() MUST enforce tenant context boundaries and validate
// that organizationId is present, routing writes through BaseRepository
// rather than bypassing it via direct model calls.
// ---------------------------------------------------------------------------

// ── LeadSummaryRepository ────────────────────────────────────────────────────

class LeadSummaryRepository extends BaseRepository {
  constructor() {
    super(LeadSummary);
  }

  async upsertSummary(filter, inc) {
    if (!filter || !filter.organizationId) {
      throw new Error('Multi-tenant boundary violation: organizationId is required for summary upserts.');
    }
    return this.findOneAndUpdate(
      filter,
      { $inc: inc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async queryRange(match, startDate, endDate, groupBy = null) {
    const { tenantContext } = require('../../shared/context/tenant-context');
    const organizationId = tenantContext.getOrganizationId();

    const pipeline = [
      {
        $match: {
          organizationId,
          date: { $gte: startDate, $lte: endDate },
          ...match,
        },
      },
      {
        $group: groupBy || {
          _id: { date: '$date', source: '$source', status: '$status' },
          leadCount: { $sum: '$leadCount' },
          totalHoldValue: { $sum: '$totalHoldValue' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ];

    return LeadSummary.aggregate(pipeline);
  }
}

// ── SalesSummaryRepository ────────────────────────────────────────────────────

class SalesSummaryRepository extends BaseRepository {
  constructor() {
    super(SalesSummary);
  }

  async upsertSummary(filter, inc) {
    if (!filter || !filter.organizationId) {
      throw new Error('Multi-tenant boundary violation: organizationId is required for summary upserts.');
    }
    return this.findOneAndUpdate(
      filter,
      { $inc: inc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async queryRange(match, startDate, endDate, groupBy = null) {
    const { tenantContext } = require('../../shared/context/tenant-context');
    const organizationId = tenantContext.getOrganizationId();

    const pipeline = [
      {
        $match: {
          organizationId,
          date: { $gte: startDate, $lte: endDate },
          ...match,
        },
      },
      {
        $group: groupBy || {
          _id: { date: '$date', projectId: '$projectId' },
          dealsClosedCount: { $sum: '$dealsClosedCount' },
          grossDealValue: { $sum: '$grossDealValue' },
          reservationsCount: { $sum: '$reservationsCount' },
          reservationsBouncedCount: { $sum: '$reservationsBouncedCount' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ];

    return SalesSummary.aggregate(pipeline);
  }
}

// ── CommissionSummaryRepository ───────────────────────────────────────────────

class CommissionSummaryRepository extends BaseRepository {
  constructor() {
    super(CommissionSummary);
  }

  async upsertSummary(filter, inc) {
    if (!filter || !filter.organizationId) {
      throw new Error('Multi-tenant boundary violation: organizationId is required for summary upserts.');
    }
    return this.findOneAndUpdate(
      filter,
      { $inc: inc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async queryRange(match, startDate, endDate, groupBy = null) {
    const { tenantContext } = require('../../shared/context/tenant-context');
    const organizationId = tenantContext.getOrganizationId();

    const pipeline = [
      {
        $match: {
          organizationId,
          date: { $gte: startDate, $lte: endDate },
          ...match,
        },
      },
      {
        $group: groupBy || {
          _id: { date: '$date', branchId: '$branchId' },
          expectedRevenue: { $sum: '$expectedRevenue' },
          collectedRevenue: { $sum: '$collectedRevenue' },
          outstandingRevenue: { $sum: '$outstandingRevenue' },
          adjustmentDeductions: { $sum: '$adjustmentDeductions' },
          totalChequesPending: { $sum: '$totalChequesPending' },
          totalChequesBounced: { $sum: '$totalChequesBounced' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ];

    return CommissionSummary.aggregate(pipeline);
  }
}

// ── TaskSummaryRepository ─────────────────────────────────────────────────────

class TaskSummaryRepository extends BaseRepository {
  constructor() {
    super(TaskSummary);
  }

  async upsertSummary(filter, inc) {
    if (!filter || !filter.organizationId) {
      throw new Error('Multi-tenant boundary violation: organizationId is required for summary upserts.');
    }
    return this.findOneAndUpdate(
      filter,
      { $inc: inc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async queryRange(match, startDate, endDate, groupBy = null) {
    const { tenantContext } = require('../../shared/context/tenant-context');
    const organizationId = tenantContext.getOrganizationId();

    const pipeline = [
      {
        $match: {
          organizationId,
          date: { $gte: startDate, $lte: endDate },
          ...match,
        },
      },
      {
        $group: groupBy || {
          _id: { date: '$date', branchId: '$branchId' },
          tasksCompleted: { $sum: '$tasksCompleted' },
          tasksPending: { $sum: '$tasksPending' },
          slaViolations: { $sum: '$slaViolations' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ];

    return TaskSummary.aggregate(pipeline);
  }
}

// ── LeadMonthlySummaryRepository ──────────────────────────────────────────────

class LeadMonthlySummaryRepository extends BaseRepository {
  constructor() {
    super(LeadMonthlySummary);
  }

  async upsertSummary(filter, inc) {
    if (!filter || !filter.organizationId) {
      throw new Error('Multi-tenant boundary violation: organizationId is required for summary upserts.');
    }
    return this.findOneAndUpdate(
      filter,
      { $inc: inc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async queryRange(match, startDate, endDate, groupBy = null) {
    const { tenantContext } = require('../../shared/context/tenant-context');
    const organizationId = tenantContext.getOrganizationId();

    const pipeline = [
      {
        $match: {
          organizationId,
          date: { $gte: startDate, $lte: endDate },
          ...match,
        },
      },
      {
        $group: groupBy || {
          _id: { date: '$date', source: '$source', status: '$status' },
          leadCount: { $sum: '$leadCount' },
          totalHoldValue: { $sum: '$totalHoldValue' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ];

    return LeadMonthlySummary.aggregate(pipeline);
  }
}

// ── SalesMonthlySummaryRepository ─────────────────────────────────────────────

class SalesMonthlySummaryRepository extends BaseRepository {
  constructor() {
    super(SalesMonthlySummary);
  }

  async upsertSummary(filter, inc) {
    if (!filter || !filter.organizationId) {
      throw new Error('Multi-tenant boundary violation: organizationId is required for summary upserts.');
    }
    return this.findOneAndUpdate(
      filter,
      { $inc: inc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async queryRange(match, startDate, endDate, groupBy = null) {
    const { tenantContext } = require('../../shared/context/tenant-context');
    const organizationId = tenantContext.getOrganizationId();

    const pipeline = [
      {
        $match: {
          organizationId,
          date: { $gte: startDate, $lte: endDate },
          ...match,
        },
      },
      {
        $group: groupBy || {
          _id: { date: '$date', projectId: '$projectId' },
          dealsClosedCount: { $sum: '$dealsClosedCount' },
          grossDealValue: { $sum: '$grossDealValue' },
          reservationsCount: { $sum: '$reservationsCount' },
          reservationsBouncedCount: { $sum: '$reservationsBouncedCount' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ];

    return SalesMonthlySummary.aggregate(pipeline);
  }
}

// ── CommissionMonthlySummaryRepository ────────────────────────────────────────

class CommissionMonthlySummaryRepository extends BaseRepository {
  constructor() {
    super(CommissionMonthlySummary);
  }

  async upsertSummary(filter, inc) {
    if (!filter || !filter.organizationId) {
      throw new Error('Multi-tenant boundary violation: organizationId is required for summary upserts.');
    }
    return this.findOneAndUpdate(
      filter,
      { $inc: inc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async queryRange(match, startDate, endDate, groupBy = null) {
    const { tenantContext } = require('../../shared/context/tenant-context');
    const organizationId = tenantContext.getOrganizationId();

    const pipeline = [
      {
        $match: {
          organizationId,
          date: { $gte: startDate, $lte: endDate },
          ...match,
        },
      },
      {
        $group: groupBy || {
          _id: { date: '$date', branchId: '$branchId' },
          expectedRevenue: { $sum: '$expectedRevenue' },
          collectedRevenue: { $sum: '$collectedRevenue' },
          outstandingRevenue: { $sum: '$outstandingRevenue' },
          adjustmentDeductions: { $sum: '$adjustmentDeductions' },
          totalChequesPending: { $sum: '$totalChequesPending' },
          totalChequesBounced: { $sum: '$totalChequesBounced' },
          totalChequesIssued: { $sum: '$totalChequesIssued' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ];

    return CommissionMonthlySummary.aggregate(pipeline);
  }
}

// ── AgentPerformanceSummaryRepository ─────────────────────────────────────────

class AgentPerformanceSummaryRepository extends BaseRepository {
  constructor() {
    super(AgentPerformanceSummary);
  }

  async upsertSummary(filter, inc) {
    if (!filter || !filter.organizationId) {
      throw new Error('Multi-tenant boundary violation: organizationId is required for summary upserts.');
    }
    return this.findOneAndUpdate(
      filter,
      { $inc: inc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async queryRange(match, startDate, endDate, groupBy = null) {
    const { tenantContext } = require('../../shared/context/tenant-context');
    const organizationId = tenantContext.getOrganizationId();

    const pipeline = [
      {
        $match: {
          organizationId,
          date: { $gte: startDate, $lte: endDate },
          ...match,
        },
      },
      {
        $group: groupBy || {
          _id: { date: '$date', agentId: '$agentId' },
          leadsCreatedCount: { $sum: '$leadsCreatedCount' },
          leadsWonCount: { $sum: '$leadsWonCount' },
          leadsLostCount: { $sum: '$leadsLostCount' },
          dealsClosedCount: { $sum: '$dealsClosedCount' },
          grossDealValue: { $sum: '$grossDealValue' },
          tasksCompleted: { $sum: '$tasksCompleted' },
          tasksPending: { $sum: '$tasksPending' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ];

    return AgentPerformanceSummary.aggregate(pipeline);
  }
}

module.exports = {
  LeadSummaryRepository,
  SalesSummaryRepository,
  CommissionSummaryRepository,
  TaskSummaryRepository,
  LeadMonthlySummaryRepository,
  SalesMonthlySummaryRepository,
  CommissionMonthlySummaryRepository,
  AgentPerformanceSummaryRepository,
};
