'use strict';

const { Brokerage } = require('./brokerage.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

class BrokerageRepository extends BaseRepository {
  constructor() {
    super(Brokerage);
  }

  /**
   * Find brokerage records by agent.
   */
  async findByAgent(agentId, pagination = {}) {
    return this.paginate(
      { agent: agentId, isDeleted: false },
      { populate: 'deal', ...pagination },
    );
  }

  /**
   * Find brokerage records for a deal.
   */
  async findByDeal(dealId) {
    return this.findMany({ deal: dealId, isDeleted: false }, { populate: 'agent' });
  }

  /**
   * Aggregate total commissions by status for an agent.
   */
  async getAgentCommissionStats(agentId) {
    return this.aggregate([
      { $match: { agent: agentId, isDeleted: false } },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amountFinal' },
          count: { $sum: 1 },
        },
      },
    ]);
  }

  /**
   * Aggregate overall brokerage analytics (revenue & settlements).
   */
  async getSystemWideStats() {
    return this.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amountFinal' },
          count: { $sum: 1 },
        },
      },
    ]);
  }
}

module.exports = { BrokerageRepository };
