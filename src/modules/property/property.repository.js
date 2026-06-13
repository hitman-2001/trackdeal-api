'use strict';

const { Property } = require('./property.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

class PropertyRepository extends BaseRepository {
  constructor() { super(Property); }

  async findAvailable(filters = {}, pagination = {}) {
    const match = { status: 'available', isDeleted: false };
    if (filters.type) match.type = filters.type;
    if (filters.city) match['location.city'] = { $regex: filters.city, $options: 'i' };
    if (filters.minPrice) match.price = { ...match.price, $gte: filters.minPrice };
    if (filters.maxPrice) match.price = { ...match.price, $lte: filters.maxPrice };
    if (filters.bhk) match.bhk = { $in: filters.bhk };
    return this.paginate(match, pagination);
  }

  async search(query, filters = {}, pagination = {}) {
    const match = { $text: { $search: query }, isDeleted: false, ...filters };
    return this.paginate(match, { sort: { score: { $meta: 'textScore' } }, ...pagination });
  }

  async findBySeller(sellerId, pagination = {}) {
    return this.paginate({ seller: sellerId, isDeleted: false }, pagination);
  }

  async updateStatus(id, status, userId) {
    return this.update(id, { status, updatedBy: userId, $push: { statusHistory: { status, changedAt: new Date(), changedBy: userId } } });
  }

  async aggregatePriceStats(filters = {}) {
    return this.aggregate([
      { $match: { isDeleted: false, ...filters } },
      { $group: { _id: '$type', avgPrice: { $avg: '$price' }, minPrice: { $min: '$price' }, maxPrice: { $max: '$price' }, count: { $sum: 1 } } },
    ]);
  }
}

module.exports = { PropertyRepository };
