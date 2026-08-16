'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const { AgentRepository } = require('./agent.repository');
const { ConflictError, NotFoundError, BusinessRuleError } = require('../../shared/errors');
const { AUDIT_ACTIONS } = require('../../shared/constants/app.constants');

// ---------------------------------------------------------------------------
// AgentService — Business Service Layer
// ---------------------------------------------------------------------------

class AgentService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.agentRepository = deps.agentRepository || new AgentRepository();
  }

  /**
   * List agents with search, status, agentType, city filtering, and pagination.
   */
  async listAgents(query, actor) {
    const filter = { isDeleted: { $ne: true } };

    if (query.status) filter.status = query.status;
    if (query.agentType) filter.agentType = query.agentType;
    if (query.city) filter.city = new RegExp(query.city, 'i');
    if (query.search) {
      filter.$or = [
        { name: new RegExp(query.search, 'i') },
        { officeName: new RegExp(query.search, 'i') },
        { phone: new RegExp(query.search, 'i') },
        { email: new RegExp(query.search, 'i') },
        { reraNumber: new RegExp(query.search, 'i') },
        { city: new RegExp(query.search, 'i') },
      ];
    }

    return this.agentRepository.paginate(filter, {
      page: query.page,
      limit: query.limit,
      sort: { [query.sort || 'createdAt']: query.order || -1 },
    });
  }

  /**
   * Fast list of active agents for dropdowns across CRM.
   */
  async getActiveAgents(actor) {
    return this.agentRepository.findMany(
      { status: 'active', isDeleted: { $ne: true } },
      { sort: { name: 1 } },
      'name officeName phone email reraNumber agentType city status'
    );
  }

  /**
   * Get single agent by ID with summary stats.
   */
  async getAgentById(id) {
    const agent = await this.agentRepository.findById(id);
    if (!agent || agent.isDeleted) {
      throw new NotFoundError('Agent / Channel Partner', id);
    }
    return agent;
  }

  /**
   * Create a new Agent / Channel Partner.
   */
  async createAgent(data, actor) {
    // 1. Prevent duplicates by Phone / Email / RERA
    const duplicate = await this.agentRepository.findDuplicate({
      phone: data.phone,
      email: data.email,
      reraNumber: data.reraNumber,
    });

    if (duplicate) {
      if (duplicate.phone === data.phone) {
        throw new ConflictError('An agent or channel partner with this phone number already exists.', 'AGENT_PHONE_EXISTS');
      }
      if (data.email && duplicate.email === data.email.toLowerCase()) {
        throw new ConflictError('An agent or channel partner with this email address already exists.', 'AGENT_EMAIL_EXISTS');
      }
      if (data.reraNumber && duplicate.reraNumber === data.reraNumber) {
        throw new ConflictError('An agent or channel partner with this RERA number already exists.', 'AGENT_RERA_EXISTS');
      }
    }

    // 2. Create Agent
    const agent = await this.agentRepository.create({
      ...data,
      organizationId: actor.organizationId,
      branchId: actor.branchId || null,
      status: data.status || 'active',
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Agent',
      entityId: agent.id,
      userId: actor.id,
      description: `Created Agent / Channel Partner '${agent.name}' (${agent.officeName})`,
    });

    return agent;
  }

  /**
   * Update Agent details.
   */
  async updateAgent(id, data, actor) {
    const existing = await this.agentRepository.findById(id);
    if (!existing || existing.isDeleted) {
      throw new NotFoundError('Agent / Channel Partner', id);
    }

    // Duplicate check if phone/email/rera changing
    const duplicate = await this.agentRepository.findDuplicate({
      phone: data.phone || existing.phone,
      email: data.email || existing.email,
      reraNumber: data.reraNumber || existing.reraNumber,
      excludeId: id,
    });

    if (duplicate) {
      if (data.phone && duplicate.phone === data.phone) {
        throw new ConflictError('An agent with this phone number already exists.', 'AGENT_PHONE_EXISTS');
      }
      if (data.email && duplicate.email === data.email.toLowerCase()) {
        throw new ConflictError('An agent with this email address already exists.', 'AGENT_EMAIL_EXISTS');
      }
      if (data.reraNumber && duplicate.reraNumber === data.reraNumber) {
        throw new ConflictError('An agent with this RERA number already exists.', 'AGENT_RERA_EXISTS');
      }
    }

    const updated = await this.agentRepository.update(id, { $set: data });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Agent',
      entityId: id,
      userId: actor.id,
      description: `Updated Agent / Channel Partner '${updated.name}'`,
    });

    return updated;
  }

  /**
   * Toggle Agent status (active / inactive).
   */
  async updateStatus(id, status, actor) {
    const agent = await this.agentRepository.findById(id);
    if (!agent || agent.isDeleted) {
      throw new NotFoundError('Agent / Channel Partner', id);
    }

    const updated = await this.agentRepository.update(id, { $set: { status } });

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Agent',
      entityId: id,
      userId: actor.id,
      description: `Changed Agent '${agent.name}' status to ${status}`,
    });

    return updated;
  }

  /**
   * Soft-delete Agent.
   */
  async deleteAgent(id, actor) {
    const agent = await this.agentRepository.findById(id);
    if (!agent || agent.isDeleted) {
      throw new NotFoundError('Agent / Channel Partner', id);
    }

    // Check if active leads are assigned to agent
    const { Lead } = require('../lead/lead.model');
    const activeLeadsCount = await Lead.countDocuments({
      agentId: id,
      isDeleted: { $ne: true },
      status: { $nin: ['won', 'lost'] },
    });

    if (activeLeadsCount > 0) {
      throw new BusinessRuleError(
        `Cannot delete agent '${agent.name}' because they have ${activeLeadsCount} active assigned leads. Reassign or transfer these leads first.`,
        'AGENT_HAS_ACTIVE_LEADS'
      );
    }

    const deleted = await this.agentRepository.softDelete(id, actor.id);

    await this.logAudit({
      action: AUDIT_ACTIONS.DELETE,
      entity: 'Agent',
      entityId: id,
      userId: actor.id,
      description: `Soft deleted Agent / Channel Partner '${agent.name}'`,
    });

    return deleted;
  }

  /**
   * Get leads assigned/transferred to an Agent.
   */
  async getAgentLeads(agentId, query) {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent || agent.isDeleted) {
      throw new NotFoundError('Agent / Channel Partner', agentId);
    }

    const { Lead } = require('../lead/lead.model');
    const filter = {
      agentId,
      isDeleted: { $ne: true },
    };

    if (query.status) filter.status = query.status;

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('assignedTo', 'firstName lastName email')
        .lean(),
      Lead.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

module.exports = { AgentService };
