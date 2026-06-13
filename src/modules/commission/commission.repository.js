"use strict";

const {
  Commission,
  CommissionSlab,
  CommissionInvoice,
  CommissionCollection,
  AgentPayoutLedger,
  CommissionStageHistory,
} = require("./commission.model");
const { BaseRepository } = require("../../shared/base/BaseRepository");

class CommissionRepository extends BaseRepository {
  constructor() {
    super(Commission);
  }

  async findByDeal(dealId) {
    return this.findOne({ dealId, isDeleted: false });
  }

  async findByOrganization(organizationId, pagination = {}) {
    return this.paginate({ organizationId, isDeleted: false }, pagination);
  }
}

class CommissionSlabRepository extends BaseRepository {
  constructor() {
    super(CommissionSlab);
  }

  async findByCommission(commissionId) {
    return this.findMany({ commissionId }, { sort: { slabNumber: 1 } });
  }
}

class CommissionInvoiceRepository extends BaseRepository {
  constructor() {
    super(CommissionInvoice);
  }

  async findByCommission(commissionId) {
    return this.findMany({ commissionId }, { sort: { createdAt: -1 } });
  }
}

class CommissionCollectionRepository extends BaseRepository {
  constructor() {
    super(CommissionCollection);
  }

  async findByInvoice(invoiceId) {
    return this.findMany({ invoiceId }, { sort: { clearedAt: -1 } });
  }
}

class AgentPayoutLedgerRepository extends BaseRepository {
  constructor() {
    super(AgentPayoutLedger);
  }

  async findByAgent(agentId, pagination = {}) {
    return this.paginate({ agentId }, pagination);
  }
}

class CommissionStageHistoryRepository extends BaseRepository {
  constructor() {
    super(CommissionStageHistory);
  }

  async findByCommission(commissionId) {
    return this.findMany({ commissionId }, { sort: { changedAt: -1 } });
  }
}

module.exports = {
  CommissionRepository,
  CommissionSlabRepository,
  CommissionInvoiceRepository,
  CommissionCollectionRepository,
  AgentPayoutLedgerRepository,
  CommissionStageHistoryRepository,
};
