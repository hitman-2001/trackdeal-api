"use strict";

const { SiteVisit } = require("./site-visit.model");
const { BaseRepository } = require("../../shared/base/BaseRepository");

class SiteVisitRepository extends BaseRepository {
  constructor() {
    super(SiteVisit);
  }

  async findByAgent(agentId, pagination = {}) {
    return this.paginate(
      { agent: agentId, isDeleted: false },
      { sort: { scheduledAt: 1 }, ...pagination },
    );
  }

  async findUpcoming(agentId, startDate, endDate) {
    return this.findMany(
      {
        agent: agentId,
        status: "scheduled",
        scheduledAt: { $gte: startDate, $lte: endDate },
        isDeleted: false,
      },
      { sort: { scheduledAt: 1 } },
    );
  }

  async findByProperty(propertyId, pagination = {}) {
    return this.paginate(
      { property: propertyId, isDeleted: false },
      pagination,
    );
  }

  async aggregateByOutcome() {
    return this.aggregate([
      { $match: { status: "completed", isDeleted: false } },
      {
        $group: {
          _id: "$outcome",
          count: { $sum: 1 },
          avgRating: { $avg: "$feedback.rating" },
        },
      },
    ]);
  }
}

module.exports = { SiteVisitRepository };
