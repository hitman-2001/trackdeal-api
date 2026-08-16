"use strict";

const {
  Lead,
  LeadActivity,
  LeadNote,
  LeadFollowUp,
  LeadAssignment,
  LeadStageHistory,
  LeadVisit,
  LeadQuotation,
} = require("./lead.model");
const { BaseRepository } = require("../../shared/base/BaseRepository");

// ---------------------------------------------------------------------------
// LeadRepository
// ---------------------------------------------------------------------------
class LeadRepository extends BaseRepository {
  constructor() {
    super(Lead);
  }

  async findByAssignee(userId, pagination = {}) {
    return this.paginate(
      { assignedTo: userId, isDeleted: false },
      { sort: { createdAt: -1 }, ...pagination }
    );
  }

  async findByStatus(status, pagination = {}) {
    return this.paginate({ status, isDeleted: false }, pagination);
  }

  async search(query, pagination = {}) {
    const filter = { $text: { $search: query }, isDeleted: false };
    return this.paginate(filter, {
      sort: { score: { $meta: "textScore" }, createdAt: -1 },
      ...pagination,
    });
  }

  async aggregateBySource(dateRange = {}) {
    const match = { isDeleted: false };
    if (dateRange.startDate) match.createdAt = { $gte: dateRange.startDate };
    if (dateRange.endDate) {
      match.createdAt = match.createdAt || {};
      match.createdAt.$lte = dateRange.endDate;
    }
    return this.aggregate([
      { $match: match },
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
  }

  async aggregateStatusFunnel() {
    return this.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
  }

  async aggregateByAgent() {
    return this.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: "$assignedTo",
          total: { $sum: 1 },
          won: { $sum: { $cond: [{ $eq: ["$status", "won"] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "agent",
        },
      },
      { $unwind: "$agent" },
      {
        $project: {
          agent: { firstName: 1, lastName: 1, email: 1 },
          total: 1,
          won: 1,
        },
      },
    ]);
  }
}

// ---------------------------------------------------------------------------
// LeadActivityRepository
// ---------------------------------------------------------------------------
class LeadActivityRepository extends BaseRepository {
  constructor() {
    super(LeadActivity);
  }

  /**
   * Aggregate activity counts by type for a lead (activity center summary).
   */
  async getActivitySummary(leadId) {
    const ObjectId = require("mongoose").Types.ObjectId;
    return this.aggregate([
      { $match: { leadId: new ObjectId(leadId), isDeleted: { $ne: true } } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
  }
}

// ---------------------------------------------------------------------------
// LeadNoteRepository
// ---------------------------------------------------------------------------
class LeadNoteRepository extends BaseRepository {
  constructor() {
    super(LeadNote);
  }
}

// ---------------------------------------------------------------------------
// LeadFollowUpRepository
// ---------------------------------------------------------------------------
class LeadFollowUpRepository extends BaseRepository {
  constructor() {
    super(LeadFollowUp);
  }
}

// ---------------------------------------------------------------------------
// LeadAssignmentRepository
// ---------------------------------------------------------------------------
class LeadAssignmentRepository extends BaseRepository {
  constructor() {
    super(LeadAssignment);
  }
}

// ---------------------------------------------------------------------------
// LeadStageHistoryRepository
// ---------------------------------------------------------------------------
class LeadStageHistoryRepository extends BaseRepository {
  constructor() {
    super(LeadStageHistory);
  }
}

// ---------------------------------------------------------------------------
// LeadVisitRepository
// ---------------------------------------------------------------------------
class LeadVisitRepository extends BaseRepository {
  constructor() {
    super(LeadVisit);
  }

  async findByLeadId(leadId) {
    return this.findMany({ leadId, isDeleted: false }, { sort: { visitDate: -1 } });
  }
}

// ---------------------------------------------------------------------------
// LeadQuotationRepository
// ---------------------------------------------------------------------------
class LeadQuotationRepository extends BaseRepository {
  constructor() {
    super(LeadQuotation);
  }

  async findByLeadId(leadId) {
    return this.findMany({ leadId, isDeleted: false }, { sort: { quotedDate: -1 } });
  }
}

module.exports = {
  LeadRepository,
  LeadActivityRepository,
  LeadNoteRepository,
  LeadFollowUpRepository,
  LeadAssignmentRepository,
  LeadStageHistoryRepository,
  LeadVisitRepository,
  LeadQuotationRepository,
};
