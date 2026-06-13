'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { InvoiceRepository, PaymentRepository } = require('./invoice.repository');
const { BusinessRuleError } = require('../../shared/errors');
const { AUDIT_ACTIONS, EVENTS } = require('../../shared/constants/app.constants');

// ---------------------------------------------------------------------------
// InvoiceService — Owner: Invoice Module
// Business rules:
//   - Invoice cannot be deleted
//   - Cancelled invoice remains visible
//   - Line items immutable once invoice sent
// ---------------------------------------------------------------------------

class InvoiceService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.invoiceRepository = deps.invoiceRepository || new InvoiceRepository();
    this.paymentRepository = deps.paymentRepository || new PaymentRepository();
  }

  async listInvoices(query) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.customer) filter.customer = query.customer;
    if (query.deal) filter.deal = query.deal;
    return this.invoiceRepository.paginate(filter, { page: query.page, limit: query.limit });
  }

  async getInvoiceById(id) {
    return this.invoiceRepository.findByIdOrFail(id, 'Invoice');
  }

  async createInvoice(data, actor) {
    // Calculate totals
    const lineItems = data.lineItems || [];
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const totalGST = lineItems.reduce((sum, item) => sum + (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0), 0);
    const totalAmount = subtotal + totalGST;

    const invoice = await this.invoiceRepository.create({
      ...data,
      subtotal,
      totalGST,
      totalAmount,
      outstandingAmount: totalAmount,
      generatedBy: actor.id,
      createdBy: actor.id,
    });

    await this.publishEvent(EVENTS.INVOICE_GENERATED, { invoiceId: invoice.id });
    await this.logAudit({ action: AUDIT_ACTIONS.CREATE, entity: 'Invoice', entityId: invoice.id, userId: actor.id });

    return invoice;
  }

  async sendInvoice(id, actor) {
    const invoice = await this.invoiceRepository.findByIdOrFail(id, 'Invoice');
    if (invoice.status !== 'draft') {
      throw new BusinessRuleError('Only draft invoices can be sent', 'INVOICE_NOT_DRAFT');
    }
    return this.invoiceRepository.update(id, { status: 'sent', updatedBy: actor.id });
  }

  async cancelInvoice(id, actor) {
    const invoice = await this.invoiceRepository.findByIdOrFail(id, 'Invoice');
    if (invoice.status === 'paid') {
      throw new BusinessRuleError('Paid invoice cannot be cancelled', 'INVOICE_PAID');
    }
    // Business rule: no hard delete — set status to cancelled only
    const updated = await this.invoiceRepository.update(id, { status: 'cancelled', updatedBy: actor.id });
    await this.publishEvent(EVENTS.INVOICE_CANCELLED, { invoiceId: id });
    return updated;
  }

  async recordPayment(invoiceId, paymentData, actor) {
    const invoice = await this.invoiceRepository.findByIdOrFail(invoiceId, 'Invoice');

    if (invoice.status === 'cancelled') {
      throw new BusinessRuleError('Cannot record payment for cancelled invoice', 'INVOICE_CANCELLED');
    }

    const payment = await this.paymentRepository.create({
      ...paymentData,
      invoice: invoiceId,
      deal: invoice.deal,
      customer: invoice.customer,
      createdBy: actor.id,
    });

    // Update invoice paid amount
    const newPaidAmount = (invoice.paidAmount || 0) + paymentData.amount;
    const newStatus = newPaidAmount >= invoice.totalAmount ? 'paid' : 'partially_paid';

    await this.invoiceRepository.update(invoiceId, {
      paidAmount: newPaidAmount,
      outstandingAmount: invoice.totalAmount - newPaidAmount,
      status: newStatus,
      $push: { payments: payment._id },
    });

    await this.publishEvent(EVENTS.PAYMENT_RECEIVED, { paymentId: payment.id, invoiceId, amount: paymentData.amount });
    return payment;
  }
}

module.exports = { InvoiceService };
