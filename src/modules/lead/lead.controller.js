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
    const lead = await this.leadService.getLeadById(request.params.id, this.getUser(request));
    return this.ok(reply, lead);
  }

  async checkDuplicate(request, reply) {
    const result = await this.leadService.checkDuplicateLead(
      request.query,
      this.getUser(request)
    );
    return this.ok(reply, result);
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

  async transferToAgent(request, reply) {
    const lead = await this.leadService.transferLeadToAgent(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, lead, "Lead transferred to Agent / Channel Partner successfully");
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

  async closeTransaction(request, reply) {
    const result = await this.leadService.closeLeadWithTransaction(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.created(reply, result, "Lead transaction closed successfully");
  }

  async getActivityCenter(request, reply) {
    const data = await this.leadService.getActivityCenter(
      request.params.id,
      this.getUser(request)
    );
    return this.ok(reply, data);
  }

  async addVisit(request, reply) {
    const visit = await this.leadService.addVisit(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.created(reply, visit, "Visit recorded successfully");
  }

  async addQuotation(request, reply) {
    const quotation = await this.leadService.addQuotation(
      request.params.id,
      request.body,
      this.getUser(request)
    );
    return this.created(reply, quotation, "Quotation recorded successfully");
  }

  async updateActivity(request, reply) {
    const activity = await this.leadService.updateActivity(
      request.params.id,
      request.params.activityId,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, activity, "Activity updated successfully");
  }

  async deleteActivity(request, reply) {
    const result = await this.leadService.deleteActivity(
      request.params.id,
      request.params.activityId,
      this.getUser(request)
    );
    return this.ok(reply, result, "Activity deleted successfully");
  }

  async updateVisit(request, reply) {
    const visit = await this.leadService.updateVisit(
      request.params.id,
      request.params.visitId,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, visit, "Visit updated successfully");
  }

  async deleteVisit(request, reply) {
    const result = await this.leadService.deleteVisit(
      request.params.id,
      request.params.visitId,
      this.getUser(request)
    );
    return this.ok(reply, result, "Visit deleted successfully");
  }

  async updateQuotation(request, reply) {
    const quotation = await this.leadService.updateQuotation(
      request.params.id,
      request.params.quotationId,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, quotation, "Quotation updated successfully");
  }

  async deleteQuotation(request, reply) {
    const result = await this.leadService.deleteQuotation(
      request.params.id,
      request.params.quotationId,
      this.getUser(request)
    );
    return this.ok(reply, result, "Quotation deleted successfully");
  }

  async updateNote(request, reply) {
    const note = await this.leadService.updateNote(
      request.params.id,
      request.params.noteId,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, note, "Note updated successfully");
  }

  async deleteNote(request, reply) {
    const result = await this.leadService.deleteNote(
      request.params.id,
      request.params.noteId,
      this.getUser(request)
    );
    return this.ok(reply, result, "Note deleted successfully");
  }

  async updateFollowUp(request, reply) {
    const followUp = await this.leadService.updateFollowUp(
      request.params.id,
      request.params.followUpId,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, followUp, "Follow-up updated successfully");
  }

  async deleteFollowUp(request, reply) {
    const result = await this.leadService.deleteFollowUp(
      request.params.id,
      request.params.followUpId,
      this.getUser(request)
    );
    return this.ok(reply, result, "Follow-up deleted successfully");
  }

  async listVisits(request, reply) {
    const { LeadVisit } = require("./lead.model");
    const visits = await LeadVisit.find({
      leadId: request.params.id,
      isDeleted: false,
    })
      .sort({ visitDate: -1 })
      .populate("propertiesShown", "title unitNumber status")
      .populate("projectId", "name")
      .populate("salesExecutive", "firstName lastName")
      .populate("agentId", "name officeName")
      .populate("createdBy", "firstName lastName")
      .lean();
    return this.ok(reply, visits);
  }

  async listQuotations(request, reply) {
    const { LeadQuotation } = require("./lead.model");
    const quotations = await LeadQuotation.find({
      leadId: request.params.id,
      isDeleted: false,
    })
      .sort({ quotedDate: -1 })
      .populate("propertyId", "title unitNumber")
      .populate("projectId", "name")
      .populate("quotedBy", "firstName lastName")
      .lean();
    return this.ok(reply, quotations);
  }
}

module.exports = { LeadController };
