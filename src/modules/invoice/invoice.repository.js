'use strict';

const { Invoice } = require('./invoice.model');
const { Payment } = require('./payment.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

class InvoiceRepository extends BaseRepository {
  constructor() { super(Invoice); }

  async findByDeal(dealId) { return this.findMany({ deal: dealId, isDeleted: false }); }

  async findOverdue() {
    return this.findMany({ status: { $in: ['sent', 'partially_paid'] }, dueDate: { $lt: new Date() } });
  }

  async aggregateRevenue(dateRange = {}) {
    const match = { status: 'paid' };
    if (dateRange.startDate) match.paymentDate = { $gte: dateRange.startDate };
    return this.aggregate([
      { $match: match },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
  }
}

class PaymentRepository extends BaseRepository {
  constructor() { super(Payment); }

  async findByInvoice(invoiceId) { return this.findMany({ invoice: invoiceId }); }

  async aggregateByMethod(dateRange = {}) {
    const match = { status: 'verified' };
    if (dateRange.startDate) match.paymentDate = { $gte: dateRange.startDate };
    return this.aggregate([
      { $match: match },
      { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
  }
}

module.exports = { InvoiceRepository, PaymentRepository };
