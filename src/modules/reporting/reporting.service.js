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

    // 7. Dynamic 6-Month Lead & Deal Trend
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trendMonths.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: monthNames[d.getMonth()],
        value: 0,
      });
    }
    const trendStartDate = new Date(trendMonths[0].year, trendMonths[0].month - 1, 1);

    const leadTrendAgg = await Lead.aggregate([
      { $match: { ...leadFilter, createdAt: { $gte: trendStartDate } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]);

    for (const r of leadTrendAgg) {
      const m = trendMonths.find((item) => item.year === r._id.year && item.month === r._id.month);
      if (m) m.value = r.count;
    }

    const trendChartData = trendMonths.map((m) => ({ label: m.label, value: m.value }));

    // 8. Dynamic Funnel Chart Data
    const stageAgg = await Lead.aggregate([
      { $match: leadFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const stageMap = {};
    for (const s of stageAgg) {
      if (s._id) stageMap[String(s._id).toLowerCase()] = s.count;
    }
    const totalLeads = leadCount;
    const contactedLeads = totalLeads - (stageMap.new || 0);
    const inNegotiation = (stageMap.site_visit || 0) + (stageMap.negotiation || 0) + (stageMap.offer_accepted || 0) + (stageMap.converted || 0);
    const convertedDeals = convertedLeadCount;

    const funnelChartData = [
      { label: '1. Pipeline Opportunities', value: totalLeads, percent: 100 },
      { label: '2. Contacted & Engaged', value: contactedLeads, percent: totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0 },
      { label: '3. Site Visits & Offers', value: inNegotiation, percent: totalLeads > 0 ? Math.round((inNegotiation / totalLeads) * 100) : 0 },
      { label: '4. Closed Transactions', value: convertedDeals, percent: totalLeads > 0 ? Math.round((convertedDeals / totalLeads) * 100) : 0 },
    ];

    // 9. Dynamic Source Breakdown
    const sourcesAgg = await Lead.aggregate([
      { $match: leadFilter },
      { $group: { _id: { $ifNull: ['$source', 'Direct Referral'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);
    const sourceColors = ['#4f46e5', '#0284c7', '#059669', '#64748b', '#d97706', '#7c3aed'];
    const totalSources = sourcesAgg.reduce((acc, curr) => acc + curr.count, 0) || 1;
    const sourceChartData = sourcesAgg.map((s, idx) => ({
      label: s._id,
      value: s.count,
      percent: Math.round((s.count / totalSources) * 100),
      color: sourceColors[idx % sourceColors.length],
    }));

    // 10. Dynamic Agent Performance
    const counselorPerformanceData = brokerRankings.map((b) => ({
      label: b.name || b.email,
      value: b.dealsClosed || 0,
      target: Math.max((b.dealsClosed || 0) + 3, 5),
      color: '#4f46e5',
    }));

    // 11. Dynamic Strategic Insights
    const topLeadSource = sourceChartData[0]?.label || 'Referrals';
    const topSourceShare = sourceChartData[0]?.percent || 0;
    const strategicInsights = [
      {
        type: 'growth',
        title: `Primary Opportunity Sourcing: ${topLeadSource}`,
        description: `${topLeadSource} accounts for ${topSourceShare}% of all customer inquiries. Continue incentivizing direct client partner channels.`,
      },
      {
        type: 'pipeline',
        title: `Active Negotiation Velocity`,
        description: `Currently ${activeDeals} deals are in active documentation and negotiation stages representing significant upcoming commission settlement.`,
      },
      {
        type: 'portfolio',
        title: `Market Listing Coverage: ${propertyCount} Active Units`,
        description: `Your agency manages ${propertyCount} active verified properties across all designated branches.`,
      },
      {
        type: 'revenue',
        title: `Settled Brokerage Volume`,
        description: `Total earned brokerage settled through platform accounting stands at ₹${totalRevenue.toLocaleString('en-IN')}.`,
      },
    ];

    return {
      summaryMetrics: {
        totalInquiries: leadCount,
        confirmedConversions: convertedLeadCount,
        conversionRate,
        pipelineInProgress: activeDeals,
        inProgressRate: leadCount > 0 ? Math.round((activeDeals / leadCount) * 100) : 0,
        inquiriesGrowth: 0,
        priorPeriodInquiries: 0,
        todayInquiries: 0,
      },
      trendChartData,
      funnelChartData,
      sourceChartData: sourceChartData.length > 0 ? sourceChartData : [{ label: 'Direct Referral', value: leadCount, percent: 100, color: '#3b82f6' }],
      counselorPerformanceData: counselorPerformanceData.length > 0 ? counselorPerformanceData : [{ label: 'Senior Broker', value: convertedLeadCount, target: Math.max(leadCount, 1), color: '#10b981' }],
      strategicInsights,
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
