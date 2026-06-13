'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { BrokerageRepository } = require('./brokerage.repository');
const { BusinessRuleError, NotFoundError } = require('../../shared/errors');
const { AUDIT_ACTIONS, EVENTS } = require('../../shared/constants/app.constants');

class BrokerageService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.brokerageRepository = deps.brokerageRepository || new BrokerageRepository();
    this.repository = this.brokerageRepository;
  }

  /**
   * Automatically calculate brokerage commission for a closed Deal.
   */
  async calculateBrokerage(dealId, actor) {
    const Deal = require('mongoose').model('Deal');
    const deal = await Deal.findById(dealId);
    if (!deal) throw new NotFoundError('Deal', dealId);

    if (deal.status !== 'closed') {
      throw new BusinessRuleError('Brokerage can only be calculated for closed deals', 'DEAL_NOT_CLOSED');
    }

    // Load settings to fetch default commission rates
    const SystemSettings = require('mongoose').model('SystemSettings');
    const settings = await SystemSettings.findOne({ key: 'system' });
    const commissionType = settings?.brokerage?.commissionType || 'percentage';
    const rate = settings?.brokerage?.defaultCommissionRate || 2.0; // Default to 2% commission

    const dealValue = deal.dealValue || deal.agreedPrice || 0;
    let amountCalculated = 0;

    if (commissionType === 'percentage') {
      amountCalculated = Math.round((dealValue * rate) / 100);
    } else {
      amountCalculated = rate;
    }

    // Check if brokerage already calculated
    let brokerage = await this.brokerageRepository.findOne({ deal: dealId });
    if (brokerage) {
      if (brokerage.status === 'settled') {
        throw new BusinessRuleError('Cannot recalculate settled brokerage', 'BROKERAGE_SETTLED');
      }
      // Update existing calculation
      brokerage.commissionType = commissionType;
      brokerage.rate = rate;
      brokerage.amountCalculated = amountCalculated;
      brokerage.amountFinal = amountCalculated + brokerage.adjustments.reduce((sum, adj) => sum + adj.amount, 0);
      brokerage.updatedBy = actor.id;
      await brokerage.save();
    } else {
      // Create new calculation
      brokerage = await this.brokerageRepository.create({
        deal: dealId,
        agent: deal.broker,
        commissionType,
        rate,
        amountCalculated,
        amountFinal: amountCalculated,
        status: 'calculated',
        createdBy: actor.id,
      });
    }

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Brokerage',
      entityId: brokerage.id,
      userId: actor.id,
      description: `Calculated brokerage commission of ${brokerage.amountFinal} INR for agent on deal '${deal.dealNumber}'`,
      newValues: brokerage.toObject(),
    });

    await this.publishEvent(EVENTS.BROKERAGE_CALCULATED, { brokerageId: brokerage.id });
    return brokerage;
  }

  /**
   * Add a manual brokerage adjustment (deduction or bonus).
   */
  async addAdjustment(id, { amount, reason }, actor) {
    const brokerage = await this.brokerageRepository.findByIdOrFail(id, 'Brokerage');
    if (brokerage.status === 'settled') {
      throw new BusinessRuleError('Cannot adjust settled brokerage', 'BROKERAGE_SETTLED');
    }

    const oldValues = brokerage.toObject();

    brokerage.adjustments.push({
      amount,
      reason,
      addedBy: actor.id,
      addedAt: new Date(),
    });

    brokerage.amountFinal = brokerage.amountCalculated + brokerage.adjustments.reduce((sum, adj) => sum + adj.amount, 0);
    brokerage.updatedBy = actor.id;
    await brokerage.save();

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Brokerage',
      entityId: id,
      userId: actor.id,
      description: `Added brokerage adjustment of ${amount} INR for reason: '${reason}'`,
      oldValues,
      newValues: brokerage.toObject(),
    });

    return brokerage;
  }

  /**
   * Approve a brokerage calculation.
   */
  async approveBrokerage(id, actor) {
    const brokerage = await this.brokerageRepository.findByIdOrFail(id, 'Brokerage');
    if (brokerage.status !== 'calculated') {
      throw new BusinessRuleError('Only calculated brokerage can be approved', 'BROKERAGE_INVALID_STATE');
    }

    const oldValues = brokerage.toObject();
    brokerage.status = 'approved';
    brokerage.updatedBy = actor.id;
    await brokerage.save();

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Brokerage',
      entityId: id,
      userId: actor.id,
      description: `Approved brokerage commission calculation`,
      oldValues,
      newValues: brokerage.toObject(),
    });

    return brokerage;
  }

  /**
   * Settle a brokerage payment.
   */
  async settleBrokerage(id, { settlementReference }, actor) {
    const brokerage = await this.brokerageRepository.findByIdOrFail(id, 'Brokerage');
    if (brokerage.status !== 'approved') {
      throw new BusinessRuleError('Brokerage must be approved before settlement', 'BROKERAGE_NOT_APPROVED');
    }

    const oldValues = brokerage.toObject();
    brokerage.status = 'settled';
    brokerage.settledAt = new Date();
    brokerage.settledBy = actor.id;
    brokerage.settlementReference = settlementReference;
    brokerage.updatedBy = actor.id;
    await brokerage.save();

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Brokerage',
      entityId: id,
      userId: actor.id,
      description: `Settled brokerage commission payment. Reference: ${settlementReference}`,
      oldValues,
      newValues: brokerage.toObject(),
    });

    await this.publishEvent(EVENTS.BROKERAGE_SETTLED, { brokerageId: brokerage.id });
    return brokerage;
  }

  /**
   * Query all brokerage records.
   */
  async listBrokerages(query, actor) {
    const filter = { isDeleted: false };
    if (query.agentId) filter.agent = query.agentId;
    if (query.status) filter.status = query.status;
    if (query.dealId) filter.deal = query.dealId;

    return this.brokerageRepository.paginate(filter, {
      page: query.page,
      limit: query.limit,
      populate: ['agent', 'deal'],
    });
  }
}

module.exports = { BrokerageService };
