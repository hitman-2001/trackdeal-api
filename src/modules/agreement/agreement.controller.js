'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { AgreementService } = require('./agreement.service');

class AgreementController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.agreementService = deps.service || new AgreementService(deps);
  }

  // Templates
  async listTemplates(req, reply) {
    const pagination = this.getPagination(req.query);
    const { data, pagination: meta } = await this.agreementService.listTemplates(pagination);
    return this.paginated(reply, data, meta);
  }

  async createTemplate(req, reply) {
    const template = await this.agreementService.createTemplate(req.body, this.getUser(req));
    return this.created(reply, template, 'Agreement template created successfully');
  }

  // Generated Agreements
  async list(req, reply) {
    const { data, pagination } = await this.agreementService.listAgreements(
      { ...req.query, ...this.getPagination(req.query) }
    );
    return this.paginated(reply, data, pagination);
  }

  async getById(req, reply) {
    const agreement = await this.agreementService.agreementRepository.findByIdOrFail(req.params.id, 'Agreement');
    return this.ok(reply, agreement);
  }

  async generate(req, reply) {
    const agreement = await this.agreementService.generateAgreement(req.body, this.getUser(req));
    return this.created(reply, agreement, 'Agreement generated successfully');
  }

  async sign(req, reply) {
    const agreement = await this.agreementService.signAgreement(req.params.id, this.getUser(req));
    return this.ok(reply, agreement, 'Agreement signed successfully');
  }

  async void(req, reply) {
    const agreement = await this.agreementService.voidAgreement(req.params.id, this.getUser(req));
    return this.ok(reply, agreement, 'Agreement voided successfully');
  }
}

module.exports = { AgreementController };
