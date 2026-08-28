'use strict';

const { Customer } = require('./customer.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

class CustomerRepository extends BaseRepository {
  constructor() { super(Customer); }

  async findByMobile(mobile) {
    if (!mobile) return null;
    const clean = String(mobile).replace(/[\s+-]/g, '');
    return this.findOne({
      isDeleted: false,
      $or: [
        { mobile: mobile },
        { mobile: { $regex: new RegExp(clean.slice(-10) + '$', 'i') } }
      ]
    });
  }

  async findByEmail(email) {
    if (!email) return null;
    return this.findOne({
      email: email.trim().toLowerCase(),
      isDeleted: false
    });
  }

  async findByName(firstName, lastName = '') {
    if (!firstName) return null;
    const query = {
      firstName: { $regex: new RegExp(`^${firstName.trim()}$`, 'i') },
      isDeleted: false
    };
    if (lastName && lastName.trim()) {
      query.lastName = { $regex: new RegExp(`^${lastName.trim()}$`, 'i') };
    }
    return this.findOne(query);
  }

  async lookupCustomer({ mobile, email, firstName, lastName }) {
    // Priority 1: Mobile (Strong match)
    if (mobile && mobile.trim()) {
      const match = await this.findByMobile(mobile.trim());
      if (match) return { customer: match, matchType: 'mobile' };
    }

    // Priority 2: Email (Strong match)
    if (email && email.trim()) {
      const match = await this.findByEmail(email.trim());
      if (match) return { customer: match, matchType: 'email' };
    }

    // Priority 3: Name (Name match)
    if (firstName && firstName.trim() && firstName.trim().length >= 2) {
      const match = await this.findByName(firstName.trim(), lastName ? lastName.trim() : '');
      if (match) return { customer: match, matchType: 'name' };
    }

    return { customer: null, matchType: null };
  }

  async findByLeadId(leadId) { return this.findOne({ leadId, isDeleted: false }); }

  async search(query, pagination = {}) {
    return this.paginate(
      { $text: { $search: query }, isDeleted: false },
      { sort: { score: { $meta: 'textScore' }, createdAt: -1 }, ...pagination },
    );
  }
}

module.exports = { CustomerRepository };
