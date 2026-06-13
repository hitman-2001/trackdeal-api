'use strict';

const { Seller } = require('./seller.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

class SellerRepository extends BaseRepository {
  constructor() { super(Seller); }
  async findByMobile(mobile) { return this.findOne({ mobile }); }
  async search(query, pagination = {}) {
    return this.paginate({ $text: { $search: query }, isDeleted: false }, { sort: { score: { $meta: 'textScore' } }, ...pagination });
  }
}

module.exports = { SellerRepository };
