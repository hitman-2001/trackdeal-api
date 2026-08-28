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

  async getCustomerWithLeads(id, actor) {
    const customer = await this.customerRepository.findByIdOrFail(id, 'Customer');
    const { Lead } = require('../lead/lead.model');
    
    // Find all leads associated with this customer in current organization
    const leads = await Lead.find({
      organizationId: actor.organizationId,
      $or: [
        { customerId: customer._id },
        { mobile: customer.mobile },
        ...(customer.email ? [{ email: customer.email }] : [])
      ],
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .populate('assignedTo', 'firstName lastName email')
      .populate('agentId', 'name officeName phone')
      .lean();

    return {
      customer,
      leads,
      totalLeads: leads.length,
      activeLeads: leads.filter(l => !['won', 'lost'].includes(l.status)).length,
      wonDeals: leads.filter(l => l.status === 'won').length
    };
  }

  async lookupCustomer(query, actor) {
    const { mobile, email, firstName, lastName } = query;
    const { customer, matchType } = await this.customerRepository.lookupCustomer({
      mobile,
      email,
      firstName,
      lastName
    });

    if (!customer) {
      // Also check in Lead collection if customer document hasn't been created yet (strictly within same org)
      const { Lead } = require('../lead/lead.model');
      const cleanMobile = mobile ? String(mobile).replace(/[\s+-]/g, '') : null;
      let existingLead = null;
      let leadMatchType = null;
      const orgId = actor.organizationId;

      if (cleanMobile) {
        existingLead = await Lead.findOne({
          organizationId: orgId,
          isDeleted: false,
          $or: [
            { mobile: mobile },
            { mobile: { $regex: new RegExp(cleanMobile.slice(-10) + '$', 'i') } }
          ]
        }).sort({ createdAt: -1 });
        if (existingLead) leadMatchType = 'mobile';
      }

      if (!existingLead && email && email.trim()) {
        existingLead = await Lead.findOne({
          organizationId: orgId,
          email: email.trim().toLowerCase(),
          isDeleted: false
        }).sort({ createdAt: -1 });
        if (existingLead) leadMatchType = 'email';
      }

      if (!existingLead && firstName && firstName.trim().length >= 2) {
        existingLead = await Lead.findOne({
          organizationId: orgId,
          firstName: { $regex: new RegExp(`^${firstName.trim()}$`, 'i') },
          isDeleted: false
        }).sort({ createdAt: -1 });
        if (existingLead) leadMatchType = 'name';
      }

      if (existingLead) {
        const matchingLeads = await Lead.find({
          organizationId: orgId,
          $or: [
            { mobile: existingLead.mobile },
            ...(existingLead.email ? [{ email: existingLead.email }] : [])
          ],
          isDeleted: false
        }).sort({ createdAt: -1 }).lean();

        return {
          isDuplicate: true,
          matchType: leadMatchType,
          customer: {
            _id: existingLead.customerId || existingLead._id,
            firstName: existingLead.firstName,
            lastName: existingLead.lastName || '',
            mobile: existingLead.mobile,
            email: existingLead.email || '',
            alternativeMobile: existingLead.alternativeMobile || '',
            createdAt: existingLead.createdAt
          },
          existingLeads: matchingLeads
        };
      }

      return {
        isDuplicate: false,
        matchType: null,
        customer: null,
        existingLeads: []
      };
    }

    const { Lead } = require('../lead/lead.model');
    const existingLeads = await Lead.find({
      $or: [
        { customerId: customer._id },
        { mobile: customer.mobile },
        ...(customer.email ? [{ email: customer.email }] : [])
      ],
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    return {
      isDuplicate: true,
      matchType,
      customer,
      existingLeads
    };
  }

  /**
   * Called by lead.converted event handler — creates customer from lead data.
   */
  async createFromLead(leadData, actor) {
    return this.createCustomer({
      organizationId: actor.organizationId,
      branchId: leadData.branchId || actor.branchId || null,
      firstName: leadData.firstName,
      lastName: leadData.lastName,
      mobile: leadData.mobile,
      email: leadData.email,
      leadId: leadData._id,
      leadIds: [leadData._id],
      requirements: leadData.requirements,
      assignedTo: leadData.assignedTo,
    }, actor);
  }
}

module.exports = { CustomerService };
