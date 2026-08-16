'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { AgentService } = require('./agent.service');

class AgentController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.agentService = deps.service || new AgentService(deps);
  }

  async list(request, reply) {
    const query = this.getPagination(request.query);
    const { data, pagination } = await this.agentService.listAgents(
      { ...request.query, ...query },
      this.getUser(request)
    );
    return this.paginated(reply, data, pagination);
  }

  async getActive(request, reply) {
    const agents = await this.agentService.getActiveAgents(this.getUser(request));
    return this.ok(reply, agents);
  }

  async getById(request, reply) {
    const agent = await this.agentService.getAgentById(request.params.id);
    return this.ok(reply, agent);
  }

  async create(request, reply) {
    const agent = await this.agentService.createAgent(
      request.body,
      this.getUser(request)
    );
    return this.created(reply, agent, 'Agent / Channel Partner created successfully');
  }

  async update(request, reply) {
    const agent = await this.agentService.updateAgent(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, agent, 'Agent / Channel Partner updated successfully');
  }

  async updateStatus(request, reply) {
    const agent = await this.agentService.updateStatus(
      request.params.id,
      request.body.status,
      this.getUser(request)
    );
    return this.ok(reply, agent, `Agent status updated to ${request.body.status}`);
  }

  async remove(request, reply) {
    await this.agentService.deleteAgent(request.params.id, this.getUser(request));
    return this.noContent(reply);
  }

  async getLeads(request, reply) {
    const { data, pagination } = await this.agentService.getAgentLeads(
      request.params.id,
      request.query
    );
    return this.paginated(reply, data, pagination);
  }
}

module.exports = { AgentController };
