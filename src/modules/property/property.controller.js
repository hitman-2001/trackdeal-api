'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { PropertyService } = require('./property.service');

class PropertyController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.propertyService = deps.service || new PropertyService(deps);
  }

  async list(request, reply) {
    const { data, pagination } = await this.propertyService.listProperties({ ...request.query, ...this.getPagination(request.query) });
    return this.paginated(reply, data, pagination);
  }

  async getById(request, reply) {
    return this.ok(reply, await this.propertyService.getPropertyById(request.params.id));
  }

  async create(request, reply) {
    return this.created(reply, await this.propertyService.createProperty(request.body, this.getUser(request)));
  }

  async update(request, reply) {
    return this.ok(reply, await this.propertyService.updateProperty(request.params.id, request.body, this.getUser(request)));
  }

  async remove(request, reply) {
    await this.propertyService.deleteProperty(request.params.id, this.getUser(request));
    return this.noContent(reply);
  }

  async markSold(request, reply) {
    return this.ok(reply, await this.propertyService.markSold(request.params.id, this.getUser(request)));
  }

  async markReserved(request, reply) {
    return this.ok(reply, await this.propertyService.markReserved(request.params.id, this.getUser(request)));
  }
}

module.exports = { PropertyController };
