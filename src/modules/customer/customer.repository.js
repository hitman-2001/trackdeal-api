'use strict';

const { Customer } = require('./customer.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

class CustomerRepository extends BaseRepository {
  constructor() { super(Customer); }

  async findByMobile(mobile) { return this.findOne({ mobile }); }
  async findByLeadId(leadId) { return this.findOne({ leadId }); }

  async search(query, pagination = {}) {
    return this.paginate(
      { $text: { $search: query }, isDeleted: false },
      { sort: { score: { $meta: 'textScore' }, createdAt: -1 }, ...pagination },
    );
  }
}

module.exports = { CustomerRepository };
