'use strict';

const { Agreement, AgreementTemplate } = require('./agreement.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

class AgreementRepository extends BaseRepository {
  constructor() {
    super(Agreement);
  }

  async findByDeal(dealId) {
    return this.findMany({ deal: dealId, isDeleted: false });
  }

  async findByCustomer(customerId, pagination = {}) {
    return this.paginate({ customer: customerId, isDeleted: false }, pagination);
  }
}

class AgreementTemplateRepository extends BaseRepository {
  constructor() {
    super(AgreementTemplate);
  }

  async findActive() {
    return this.findMany({ isActive: true, isDeleted: false });
  }
}

module.exports = { AgreementRepository, AgreementTemplateRepository };
