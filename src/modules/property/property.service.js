'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { PropertyRepository } = require('./property.repository');
const { BusinessRuleError } = require('../../shared/errors');
const { AUDIT_ACTIONS, EVENTS } = require('../../shared/constants/app.constants');

// ---------------------------------------------------------------------------
// PropertyService — Owner: Property Module
// Business rules:
//   - Sold property cannot be assigned to new deals
//   - Price changes must be audited
// ---------------------------------------------------------------------------

class PropertyService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.propertyRepository = deps.propertyRepository || new PropertyRepository();
  }

  async listProperties(query) {
    const filters = {
      status: query.status,
      type: query.type,
      city: query.city,
      minPrice: query.minPrice ? Number(query.minPrice) : undefined,
      maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
      bhk: query.bhk ? [].concat(query.bhk).map(Number) : undefined,
    };
    return this.propertyRepository.findAvailable(filters, { page: query.page, limit: query.limit });
  }

  async getPropertyById(id) {
    return this.propertyRepository.findByIdOrFail(id, 'Property');
  }

  async createProperty(data, actor) {
    if (data.location && (!data.location.coordinates || !Array.isArray(data.location.coordinates.coordinates))) {
      delete data.location.coordinates;
    }
    const property = await this.propertyRepository.create({
      ...data,
      organizationId: data.organizationId || actor.organizationId,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await this.publishEvent(EVENTS.PROPERTY_CREATED, { propertyId: property.id });
    await this.logAudit({ action: AUDIT_ACTIONS.CREATE, entity: 'Property', entityId: property.id, userId: actor.id });

    return property;
  }

  async updateProperty(id, data, actor) {
    const property = await this.propertyRepository.findByIdOrFail(id, 'Property');
    if (data.location && (!data.location.coordinates || !Array.isArray(data.location.coordinates.coordinates))) {
      delete data.location.coordinates;
    }

    // Business rule: price changes must be audited
    if (data.price && data.price !== property.price) {
      data.$push = {
        priceHistory: { price: property.price, changedBy: actor.id, changedAt: new Date(), reason: data.priceChangeReason },
      };
      delete data.priceChangeReason;
    }

    const updated = await this.propertyRepository.update(id, { ...data, updatedBy: actor.id });

    await this.publishEvent(EVENTS.PROPERTY_UPDATED, { propertyId: id });
    return updated;
  }

  /**
   * Called by DealService to validate property is available before deal creation.
   */
  async validateAvailability(propertyId) {
    const property = await this.propertyRepository.findByIdOrFail(propertyId, 'Property');
    if (property.status === 'sold') {
      throw new BusinessRuleError('Sold property cannot be assigned to a new deal', 'PROPERTY_SOLD');
    }
    return property;
  }

  async markSold(id, actor) {
    const property = await this.propertyRepository.findByIdOrFail(id, 'Property');
    const updated = await this.propertyRepository.updateStatus(id, 'sold', actor.id);
    await this.publishEvent(EVENTS.PROPERTY_SOLD, { propertyId: id });
    return updated;
  }

  async markReserved(id, actor) {
    await this.propertyRepository.findByIdOrFail(id, 'Property');
    const updated = await this.propertyRepository.updateStatus(id, 'reserved', actor.id);
    await this.publishEvent(EVENTS.PROPERTY_RESERVED, { propertyId: id });
    return updated;
  }

  async deleteProperty(id, actor) {
    await this.propertyRepository.findByIdOrFail(id, 'Property');
    await this.propertyRepository.softDelete(id, actor.id);
    await this.logAudit({ action: AUDIT_ACTIONS.DELETE, entity: 'Property', entityId: id, userId: actor.id });
  }
}

module.exports = { PropertyService };
