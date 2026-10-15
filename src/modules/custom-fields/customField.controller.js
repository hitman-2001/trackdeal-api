'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { CustomFieldService } = require('./customField.service');

class CustomFieldController extends BaseController {
  constructor(deps = {}) {
    const service = deps.service || new CustomFieldService(deps);
    super({ service, ...deps });
    this.service = service;
  }

  async list(request, reply) {
    const { module, includeInactive, includeStandard } = request.query;
    const fields = await this.service.listFields(
      {
        module,
        includeInactive: includeInactive === 'true' || includeInactive === true,
        includeStandard: includeStandard !== 'false' && includeStandard !== false,
      },
      this.getUser(request)
    );
    return this.ok(reply, fields);
  }

  async create(request, reply) {
    const field = await this.service.createField(request.body, this.getUser(request));
    return this.created(reply, field, 'Custom field created successfully');
  }

  async update(request, reply) {
    const field = await this.service.updateField(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, field, 'Custom field updated successfully');
  }

  async remove(request, reply) {
    const result = await this.service.deleteField(request.params.id, this.getUser(request));
    return this.ok(reply, result);
  }
}

module.exports = { CustomFieldController };

