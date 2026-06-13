'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { BrokerageService } = require('./brokerage.service');

class BrokerageController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.brokerageService = deps.service || new BrokerageService(deps);
  }

  async list(req, reply) {
    const { data, pagination } = await this.brokerageService.listBrokerages(
      { ...req.query, ...this.getPagination(req.query) },
      this.getUser(req),
    );
    return this.paginated(reply, data, pagination);
  }

  async getById(req, reply) {
    const brokerage = await this.brokerageService.brokerageRepository.findByIdOrFail(req.params.id, 'Brokerage');
    return this.ok(reply, brokerage);
  }

  async calculate(req, reply) {
    const brokerage = await this.brokerageService.calculateBrokerage(req.body.dealId, this.getUser(req));
    return this.created(reply, brokerage, 'Brokerage calculated successfully');
  }

  async adjust(req, reply) {
    const brokerage = await this.brokerageService.addAdjustment(req.params.id, req.body, this.getUser(req));
    return this.ok(reply, brokerage, 'Brokerage adjustment added successfully');
  }

  async approve(req, reply) {
    const brokerage = await this.brokerageService.approveBrokerage(req.params.id, this.getUser(req));
    return this.ok(reply, brokerage, 'Brokerage approved successfully');
  }

  async settle(req, reply) {
    const brokerage = await this.brokerageService.settleBrokerage(req.params.id, req.body, this.getUser(req));
    return this.ok(reply, brokerage, 'Brokerage settled successfully');
  }
}

module.exports = { BrokerageController };
