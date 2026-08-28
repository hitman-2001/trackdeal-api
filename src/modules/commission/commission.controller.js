"use strict";

const { BaseController } = require("../../shared/base/BaseController");
const { CommissionService } = require("./commission.service");

class CommissionController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.commissionService = deps.service || new CommissionService(deps);
  }

  async list(request, reply) {
    const result = await this.commissionService.getCommissionsList(
      request.query,
      this.getUser(request),
    );
    return reply.send({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }

  async summary(request, reply) {
    const summary = await this.commissionService.getCommissionSummary(
      request.query,
      this.getUser(request),
    );
    return this.ok(reply, summary);
  }

  async receivables(request, reply) {
    const ledger = await this.commissionService.getReceivablesLedger(
      request.query,
      this.getUser(request),
    );
    return this.ok(reply, ledger);
  }

  async recordPayment(request, reply) {
    const commission = await this.commissionService.recordPayment(
      request.params.id,
      request.body,
      this.getUser(request),
    );
    return this.ok(reply, commission);
  }

  async getById(request, reply) {
    const commission = await this.commissionService.getCommissionById(
      request.params.id,
      this.getUser(request),
    );
    return this.ok(reply, commission);
  }

  async create(request, reply) {
    const commission = await this.commissionService.createCommission(
      request.body,
      this.getUser(request),
    );
    return this.created(reply, commission);
  }

  async createInvoice(request, reply) {
    const { slabId, ...invoiceData } = request.body;
    const invoice = await this.commissionService.createInvoice(
      request.params.id,
      slabId,
      invoiceData,
      this.getUser(request),
    );
    return this.ok(reply, invoice);
  }

  async recordCollection(request, reply) {
    const collection = await this.commissionService.recordCollection(
      request.params.invoiceId,
      request.body,
      this.getUser(request),
    );
    return this.ok(reply, collection);
  }

  async releasePayout(request, reply) {
    const payout = await this.commissionService.releaseAgentPayout(
      request.params.payoutId,
      this.getUser(request),
    );
    return this.ok(reply, payout);
  }

  async processClawback(request, reply) {
    const commission = await this.commissionService.processClawback(
      request.params.id,
      request.body,
      this.getUser(request),
    );
    return this.ok(reply, commission);
  }

  async transition(request, reply) {
    const { status } = request.body;
    const commission = await this.commissionService.transitionStage(
      request.params.id,
      status,
      this.getUser(request),
    );
    return this.ok(reply, commission);
  }

  async clearCollection(request, reply) {
    const collection = await this.commissionService.clearCollection(
      request.params.collectionId,
      this.getUser(request),
    );
    return this.ok(reply, collection);
  }

  async bounceCollection(request, reply) {
    const collection = await this.commissionService.bounceCollection(
      request.params.collectionId,
      this.getUser(request),
    );
    return this.ok(reply, collection);
  }
}

module.exports = { CommissionController };
