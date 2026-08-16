'use strict';

const { Transaction } = require('./transaction.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

class TransactionRepository extends BaseRepository {
  constructor() {
    super(Transaction);
  }

  async findByLeadId(leadId) {
    return this.find({ leadId, isDeleted: false });
  }

  async findByPropertyId(propertyId) {
    return this.find({ propertyId, isDeleted: false });
  }
}

module.exports = { TransactionRepository };
