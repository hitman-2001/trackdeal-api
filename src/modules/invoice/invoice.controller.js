'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { InvoiceService } = require('./invoice.service');

class InvoiceController extends BaseController {
  constructor(deps = {}) { super(deps); this.invoiceService = deps.service || new InvoiceService(deps); }
  async list(req, reply) { const { data, pagination } = await this.invoiceService.listInvoices({ ...req.query, ...this.getPagination(req.query) }); return this.paginated(reply, data, pagination); }
  async getById(req, reply) { return this.ok(reply, await this.invoiceService.getInvoiceById(req.params.id)); }
  async create(req, reply) { return this.created(reply, await this.invoiceService.createInvoice(req.body, this.getUser(req))); }
  async send(req, reply) { return this.ok(reply, await this.invoiceService.sendInvoice(req.params.id, this.getUser(req)), 'Invoice sent'); }
  async cancel(req, reply) { return this.ok(reply, await this.invoiceService.cancelInvoice(req.params.id, this.getUser(req)), 'Invoice cancelled'); }
  async recordPayment(req, reply) { return this.created(reply, await this.invoiceService.recordPayment(req.params.id, req.body, this.getUser(req)), 'Payment recorded'); }
}

module.exports = { InvoiceController };
