'use strict';

const mongoose = require('mongoose');
const { BaseService } = require('../../shared/base/BaseService');
const { AUDIT_ACTIONS } = require('../../shared/constants/app.constants');

class ReportingService extends BaseService {
  constructor(deps = {}) {
    super(deps);
  }

  /**
   * Calculate high-level metrics for the Broker Owner dashboard.
   */
  async getDashboardStats(actor) {
    const Lead = mongoose.model('Lead');
    const Deal = mongoose.model('Deal');
    const Brokerage = mongoose.model('Brokerage');
    const Property = mongoose.model('Property');

    const toObjectId = (id) => {
      if (id && mongoose.Types.ObjectId.isValid(id)) {
        return new mongoose.Types.ObjectId(id);
      }
      return id;
    };

    // 1. Lead metrics filter
    const leadFilter = { isDeleted: false };
    if (actor?.organizationId) {
      leadFilter.organizationId = actor.organizationId;
    }
    if (actor?.organizationType === 'INDIVIDUAL_AGENT' || actor?.role === 'agent') {
      leadFilter.assignedTo = actor.id;
    } else if (actor?.organizationType === 'ENTERPRISE_AGENCY' && actor.role === 'branch_manager' && actor.branchId) {
      leadFilter.branchId = actor.branchId;
    }

    const leadCount = await Lead.countDocuments(leadFilter);
    const convertedLeadCount = await Lead.countDocuments({ ...leadFilter, status: 'converted' });
    const conversionRate = leadCount > 0 ? parseFloat(((convertedLeadCount / leadCount) * 100).toFixed(2)) : 0;

    // 2. Active property count
    const propertyFilter = { status: 'available', isDeleted: false };
    if (actor?.organizationId) {
      propertyFilter.organizationId = actor.organizationId;
    }
    const propertyCount = await Property.countDocuments(propertyFilter);

    // 3. Revenue Metrics (Total Settled Brokerage Commission)
    const matchStage = { status: 'settled' };
    if (actor?.organizationId) {
      matchStage['dealInfo.organizationId'] = toObjectId(actor.organizationId);
    }
    if (actor?.organizationType === 'INDIVIDUAL_AGENT' || actor?.role === 'agent') {
      matchStage['dealInfo.assignedTo'] = toObjectId(actor.id);
    } else if (actor?.organizationType === 'ENTERPRISE_AGENCY' && actor.role === 'branch_manager' && actor.branchId) {
      matchStage['dealInfo.branchId'] = toObjectId(actor.branchId);
    }

    const revenueAgg = await Brokerage.aggregate([
      {
        $lookup: {
          from: 'deals',
          localField: 'deal',
          foreignField: '_id',
          as: 'dealInfo',
        },
      },
      { $unwind: '$dealInfo' },
      { $match: { ...matchStage, 'dealInfo.isDeleted': false } },
      { $group: { _id: null, total: { $sum: '$amountFinal' } } },
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    // 4. Monthly closed deals
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const dealFilter = { isDeleted: false };
    if (actor?.organizationId) {
      dealFilter.organizationId = actor.organizationId;
    }
    if (actor?.organizationType === 'INDIVIDUAL_AGENT' || actor?.role === 'agent') {
      dealFilter.assignedTo = actor.id;
    } else if (actor?.organizationType === 'ENTERPRISE_AGENCY' && actor.role === 'branch_manager' && actor.branchId) {
      dealFilter.branchId = actor.branchId;
    }

    const closedDealsThisMonth = await Deal.countDocuments({
      ...dealFilter,
      status: 'closed',
      closedAt: { $gte: currentMonthStart },
    });

    // 5. Active Deals pipeline
    const activeDeals = await Deal.countDocuments({
      ...dealFilter,
      status: { $in: ['negotiation', 'offer_accepted', 'agreement_sent'] },
    });

    // 6. Broker performance rankings
    const brokerRankings = await Brokerage.aggregate([
      {
        $lookup: {
          from: 'deals',
          localField: 'deal',
          foreignField: '_id',
          as: 'dealInfo',
        },
      },
      { $unwind: '$dealInfo' },
      { $match: { ...matchStage, 'dealInfo.isDeleted': false } },
      {
        $group: {
          _id: '$agent',
          totalEarned: { $sum: '$amountFinal' },
          dealsClosed: { $sum: 1 },
        },
      },
      { $sort: { totalEarned: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'brokerInfo',
        },
      },
      { $unwind: '$brokerInfo' },
      {
        $project: {
          brokerId: '$_id',
          name: { $concat: ['$brokerInfo.firstName', ' ', '$brokerInfo.lastName'] },
          email: '$brokerInfo.email',
          totalEarned: 1,
          dealsClosed: 1,
        },
      },
    ]);

    return {
      leads: {
        total: leadCount,
        converted: convertedLeadCount,
        conversionRate,
      },
      properties: {
        activeListings: propertyCount,
      },
      deals: {
        activePipeline: activeDeals,
        closedThisMonth: closedDealsThisMonth,
      },
      revenue: {
        totalSettledCommission: totalRevenue,
      },
      brokerPerformance: brokerRankings,
    };
  }

  /**
   * Log export activity for audit tracking.
   */
  async logExport(reportName, actor) {
    await this.logAudit({
      action: AUDIT_ACTIONS.EXPORT,
      entity: 'Report',
      entityId: new mongoose.Types.ObjectId().toString(),
      userId: actor.id,
      description: `Exported report: '${reportName}'`,
    });
  }
}

module.exports = { ReportingService };
