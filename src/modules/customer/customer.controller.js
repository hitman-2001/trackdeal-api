'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { CustomerService } = require('./customer.service');

class CustomerController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.customerService = deps.service || new CustomerService(deps);
  }

  async list(request, reply) {
    const query = { ...request.query, ...this.getPagination(request.query) };
    const { data, pagination } = await this.customerService.listCustomers(query, this.getUser(request));
    return this.paginated(reply, data, pagination);
  }

  async getById(request, reply) {
    return this.ok(reply, await this.customerService.getCustomerById(request.params.id));
  }

  async create(request, reply) {
    const customer = await this.customerService.createCustomer(request.body, this.getUser(request));
    return this.created(reply, customer, 'Customer created successfully');
  }

  async update(request, reply) {
    const customer = await this.customerService.updateCustomer(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, customer, 'Customer updated successfully');
  }

  async remove(request, reply) {
    await this.customerService.deleteCustomer(request.params.id, this.getUser(request));
    return this.noContent(reply);
  }
}

module.exports = { CustomerController };
