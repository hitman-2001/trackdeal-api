"use strict";

const {
  Deal,
  DealStageHistory,
  DealReservation,
  DealDocument,
  DealPayment,
  DealCancellation,
} = require("./deal.model");
const { BaseRepository } = require("../../shared/base/BaseRepository");

class DealRepository extends BaseRepository {
  constructor() {
    super(Deal);
  }

  async findByBroker(brokerId, pagination = {}) {
    return this.paginate({ broker: brokerId, isDeleted: false }, pagination);
  }

  async findByCustomer(customerId, pagination = {}) {
    return this.paginate(
      { customer: customerId, isDeleted: false },
      pagination,
    );
  }

  async findByProperty(propertyId) {
    return this.findMany({
      property: propertyId,
      isDeleted: false,
      status: { $nin: ["cancelled"] },
    });
  }

  async addOffer(dealId, offer, userId) {
    return this.model.findByIdAndUpdate(
      dealId,
      {
        $push: {
          offers: offer,
          timeline: {
            event: "offer_added",
            description: `Offer of ₹${offer.amount} added`,
            performedBy: userId,
          },
        },
        $set: {
          currentOffer: {
            amount: offer.amount,
            offeredBy: offer.offeredBy,
            status: "pending",
          },
          updatedBy: userId,
        },
      },
      { new: true },
    );
  }

  async aggregateRevenue(organizationId, branchId = null, dateRange = {}) {
    if (!organizationId) {
      throw new Error("Multi-tenant isolation violation: organizationId is mandatory for aggregateRevenue.");
    }
    const mongoose = require("mongoose");
    const match = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      status: "deal_closed",
      isDeleted: false,
    };
    if (branchId) {
      match.branchId = new mongoose.Types.ObjectId(branchId);
    }
    if (dateRange.startDate) match.closedAt = { $gte: new Date(dateRange.startDate) };
    if (dateRange.endDate) {
      match.closedAt = { ...match.closedAt, $lte: new Date(dateRange.endDate) };
    }

    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ["$dealValue", "$agreedPrice"] } },
          count: { $sum: 1 },
          avgDealValue: { $avg: { $ifNull: ["$dealValue", "$agreedPrice"] } },
        },
      },
    ]);
  }

  async aggregateByBroker(organizationId, branchId = null, dateRange = {}) {
    if (!organizationId) {
      throw new Error("Multi-tenant isolation violation: organizationId is mandatory for aggregateByBroker.");
    }
    const mongoose = require("mongoose");
    const match = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      isDeleted: false,
    };
    if (branchId) {
      match.branchId = new mongoose.Types.ObjectId(branchId);
    }
    if (dateRange.startDate) match.createdAt = { $gte: new Date(dateRange.startDate) };
    if (dateRange.endDate) {
      match.createdAt = { ...match.createdAt, $lte: new Date(dateRange.endDate) };
    }

    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$broker",
          total: { $sum: 1 },
          closed: {
            $sum: { $cond: [{ $eq: ["$status", "deal_closed"] }, 1, 0] },
          },
          revenue: { $sum: { $ifNull: ["$dealValue", "$agreedPrice"] } },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "broker",
        },
      },
      { $unwind: "$broker" },
    ]);
  }
}

class DealStageHistoryRepository extends BaseRepository {
  constructor() {
    super(DealStageHistory);
  }
}

class DealReservationRepository extends BaseRepository {
  constructor() {
    super(DealReservation);
  }
}

class DealDocumentRepository extends BaseRepository {
  constructor() {
    super(DealDocument);
  }
}

class DealPaymentRepository extends BaseRepository {
  constructor() {
    super(DealPayment);
  }
}

class DealCancellationRepository extends BaseRepository {
  constructor() {
    super(DealCancellation);
  }
}

module.exports = {
  DealRepository,
  DealStageHistoryRepository,
  DealReservationRepository,
  DealDocumentRepository,
  DealPaymentRepository,
  DealCancellationRepository,
};
