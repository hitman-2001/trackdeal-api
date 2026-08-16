'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { SellerRepository } = require('./seller.repository');
const { ConflictError } = require('../../shared/errors');
const { AUDIT_ACTIONS, EVENTS } = require('../../shared/constants/app.constants');

class SellerService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.sellerRepository = deps.sellerRepository || new SellerRepository();
  }

  async listSellers(query) {
    const filter = { isDeleted: false };
    if (query.search) filter.$text = { $search: query.search };
    return this.sellerRepository.paginate(filter, { page: query.page, limit: query.limit });
  }

  async getSellerById(id) { return this.sellerRepository.findByIdOrFail(id, 'Seller'); }

  async createSeller(data, actor) {
    if (data.mobile) {
      const exists = await this.sellerRepository.findByMobile(data.mobile);
      if (exists) throw new ConflictError(`Seller with mobile '${data.mobile}' already exists`);
    }

    const seller = await this.sellerRepository.create({
      ...data,
      organizationId: data.organizationId || actor.organizationId,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
    await this.publishEvent(EVENTS.SELLER_CREATED, { sellerId: seller.id });
    await this.logAudit({ action: AUDIT_ACTIONS.CREATE, entity: 'Seller', entityId: seller.id, userId: actor.id });
    return seller;
  }

  async updateSeller(id, data, actor) {
    await this.sellerRepository.findByIdOrFail(id, 'Seller');
    return this.sellerRepository.update(id, { ...data, updatedBy: actor.id });
  }

  async deleteSeller(id, actor) {
    await this.sellerRepository.findByIdOrFail(id, 'Seller');
    await this.sellerRepository.softDelete(id, actor.id);
  }
}

module.exports = { SellerService };
