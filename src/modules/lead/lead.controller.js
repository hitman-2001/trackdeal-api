"use strict";

const { BaseController } = require("../../shared/base/BaseController");
const { LeadService } = require("./lead.service");

class LeadController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.leadService = deps.service || new LeadService(deps);
  }

  async list(request, reply) {
    const query = this.getPagination(request.query);
    const { data, pagination } = await this.leadService.listLeads(
      { ...request.query, ...query },
      this.getUser(request)
    );
    return this.paginated(reply, data, pagination);
  }

  async getById(request, reply) {
    const lead = await this.leadService.getLeadById(request.params.id);
    return this.ok(reply, lead);
  }

  async create(request, reply) {
    const lead = await this.leadService.createLead(
      request.body,
      this.getUser(request)
    );
    return this.created(reply, lead, "Lead created successfully");
  }

  async update(request, reply) {
    const lead = await this.leadService.updateLead(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, lead, "Lead updated successfully");
  }

  async remove(request, reply) {
    await this.leadService.deleteLead(request.params.id, this.getUser(request));
    return this.noContent(reply);
  }

  async assign(request, reply) {
    const lead = await this.leadService.assignLead(
      request.params.id,
      request.body.assignedTo,
      this.getUser(request),
      request.body.reason
    );
    return this.ok(reply, lead, "Lead assigned successfully");
  }

  async bulkAssign(request, reply) {
    const leads = await this.leadService.bulkAssign(
      request.body.leadIds,
      request.body.assignedTo,
      request.body.reason,
      this.getUser(request)
    );
    return this.ok(reply, leads, "Leads assigned successfully in bulk");
  }

  async changeStage(request, reply) {
    const lead = await this.leadService.changeStage(
      request.params.id,
      request.body.status,
      request.body.lostReason,
      request.body.lostNotes,
      this.getUser(request)
    );
    return this.ok(reply, lead, "Lead stage changed successfully");
  }

  async addNote(request, reply) {
    const note = await this.leadService.addNote(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.created(reply, note, "Internal note added successfully");
  }

  async logActivity(request, reply) {
    const activity = await this.leadService.logActivity(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.created(reply, activity, "Activity logged successfully");
  }

  async addFollowUp(request, reply) {
    const followUp = await this.leadService.scheduleFollowUp(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.created(reply, followUp, "Follow-up scheduled successfully");
  }

  async reopen(request, reply) {
    const lead = await this.leadService.reopenLead(
      request.params.id,
      this.getUser(request)
    );
    return this.ok(reply, lead, "Lead reopened successfully");
  }

  async markWon(request, reply) {
    const lead = await this.leadService.changeStage(
      request.params.id,
      "won",
      null,
      null,
      this.getUser(request)
    );
    return this.ok(reply, lead, "Lead marked as won");
  }

  async markLost(request, reply) {
    const lead = await this.leadService.changeStage(
      request.params.id,
      "lost",
      request.body.reason,
      request.body.notes || "Lead marked lost by user",
      this.getUser(request)
    );
    return this.ok(reply, lead, "Lead marked as lost");
  }
}

module.exports = { LeadController };
