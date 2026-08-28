'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { DealService } = require('./deal.service');

class DealController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.dealService = deps.service || new DealService(deps);
  }

  async list(request, reply) {
    const { data, pagination } = await this.dealService.listDeals(
      { ...request.query, ...this.getPagination(request.query) },
      this.getUser(request)
    );
    return this.paginated(reply, data, pagination);
  }

  async getById(request, reply) {
    const deal = await this.dealService.getDealById(request.params.id, this.getUser(request));
    return this.ok(reply, deal);
  }

  async create(request, reply) {
    const deal = await this.dealService.createDeal(request.body, this.getUser(request));
    return this.created(reply, deal);
  }

  async addOffer(request, reply) {
    const deal = await this.dealService.addOffer(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, deal);
  }

  async extendReservation(request, reply) {
    const deal = await this.dealService.extendReservation(
      request.params.id,
      request.body.lockedDurationMinutes,
      this.getUser(request)
    );
    return this.ok(reply, deal);
  }

  async releaseReservation(request, reply) {
    const deal = await this.dealService.releaseReservation(request.params.id, this.getUser(request));
    return this.ok(reply, deal);
  }

  async convertReservation(request, reply) {
    const deal = await this.dealService.convertReservationToBooking(request.params.id, this.getUser(request));
    return this.ok(reply, deal);
  }

  async addPayment(request, reply) {
    const deal = await this.dealService.addPayment(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, deal);
  }

  async addRefund(request, reply) {
    const deal = await this.dealService.addRefund(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, deal);
  }

  async uploadDocument(request, reply) {
    const deal = await this.dealService.uploadDocument(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, deal);
  }

  async verifyDocument(request, reply) {
    const deal = await this.dealService.verifyDocument(request.params.id, request.body.docType, this.getUser(request));
    return this.ok(reply, deal);
  }

  async transition(request, reply) {
    const { status, stage, cancellationReason, ...closingPayload } = request.body || {};
    const targetStatus = status || stage;
    if (targetStatus === 'cancelled' && cancellationReason) {
      this.dealService.cancellationReason = cancellationReason;
    }
    const deal = await this.dealService.transitionStage(
      request.params.id,
      targetStatus,
      this.getUser(request),
      closingPayload
    );
    return this.ok(reply, deal);
  }
}

module.exports = { DealController };
