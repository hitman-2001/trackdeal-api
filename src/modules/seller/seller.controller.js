'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { SellerService } = require('./seller.service');

class SellerController extends BaseController {
  constructor(deps = {}) { super(deps); this.sellerService = deps.service || new SellerService(deps); }
  async list(request, reply) { const { data, pagination } = await this.sellerService.listSellers({ ...request.query, ...this.getPagination(request.query) }); return this.paginated(reply, data, pagination); }
  async getById(request, reply) { return this.ok(reply, await this.sellerService.getSellerById(request.params.id)); }
  async create(request, reply) { return this.created(reply, await this.sellerService.createSeller(request.body, this.getUser(request))); }
  async update(request, reply) { return this.ok(reply, await this.sellerService.updateSeller(request.params.id, request.body, this.getUser(request))); }
  async remove(request, reply) { await this.sellerService.deleteSeller(request.params.id, this.getUser(request)); return this.noContent(reply); }
}

module.exports = { SellerController };
