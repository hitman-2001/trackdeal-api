'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { CustomerRepository } = require('./customer.repository');
const { ConflictError } = require('../../shared/errors');
const { AUDIT_ACTIONS, EVENTS } = require('../../shared/constants/app.constants');

// ---------------------------------------------------------------------------
// CustomerService — Owner: Customer Module
// Consumes: lead.converted event
// ---------------------------------------------------------------------------

class CustomerService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.customerRepository = deps.customerRepository || new CustomerRepository();
  }

  async listCustomers(query, actor) {
    const filter = { isDeleted: false };
    if (query.search) filter.$text = { $search: query.search };
    if (query.status) filter.status = query.status;
    return this.customerRepository.paginate(filter, {
      page: query.page, limit: query.limit,
      sort: { [query.sort || 'createdAt']: query.order || -1 },
    });
  }

  async getCustomerById(id) {
    return this.customerRepository.findByIdOrFail(id, 'Customer');
  }

  async createCustomer(data, actor) {
    const existing = await this.customerRepository.findByMobile(data.mobile);
    if (existing) throw new ConflictError(`Customer with mobile '${data.mobile}' already exists`);

    const customer = await this.customerRepository.create({ ...data, createdBy: actor.id, updatedBy: actor.id });

    await this.publishEvent(EVENTS.CUSTOMER_CREATED, { customerId: customer.id });
    await this.logAudit({ action: AUDIT_ACTIONS.CREATE, entity: 'Customer', entityId: customer.id, userId: actor.id });

    return customer;
  }

  async updateCustomer(id, data, actor) {
    await this.customerRepository.findByIdOrFail(id, 'Customer');
    const updated = await this.customerRepository.update(id, { ...data, updatedBy: actor.id });
    await this.publishEvent(EVENTS.CUSTOMER_UPDATED, { customerId: id });
    return updated;
  }

  async deleteCustomer(id, actor) {
    await this.customerRepository.findByIdOrFail(id, 'Customer');
    await this.customerRepository.softDelete(id, actor.id);
    await this.logAudit({ action: AUDIT_ACTIONS.DELETE, entity: 'Customer', entityId: id, userId: actor.id });
  }

  /**
   * Called by lead.converted event handler — creates customer from lead data.
   */
  async createFromLead(leadData, actor) {
    return this.createCustomer({
      firstName: leadData.firstName,
      lastName: leadData.lastName,
      mobile: leadData.mobile,
      email: leadData.email,
      leadId: leadData._id,
      requirements: leadData.requirements,
      assignedTo: leadData.assignedTo,
    }, actor);
  }
}

module.exports = { CustomerService };
