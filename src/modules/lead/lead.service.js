"use strict";

const { BaseService } = require("../../shared/base/BaseService");
const {
  LeadRepository,
  LeadActivityRepository,
  LeadNoteRepository,
  LeadFollowUpRepository,
  LeadAssignmentRepository,
  LeadStageHistoryRepository,
} = require("./lead.repository");
const {
  NotFoundError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
} = require("../../shared/errors");
const {
  AUDIT_ACTIONS,
  EVENTS,
} = require("../../shared/constants/app.constants");

// ---------------------------------------------------------------------------
// LeadService — Owner: Lead Module
// ---------------------------------------------------------------------------

class LeadService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.leadRepository = deps.leadRepository || new LeadRepository();
    this.leadActivityRepository =
      deps.leadActivityRepository || new LeadActivityRepository();
    this.leadNoteRepository = deps.leadNoteRepository || new LeadNoteRepository();
    this.leadFollowUpRepository =
      deps.leadFollowUpRepository || new LeadFollowUpRepository();
    this.leadAssignmentRepository =
      deps.leadAssignmentRepository || new LeadAssignmentRepository();
    this.leadStageHistoryRepository =
      deps.leadStageHistoryRepository || new LeadStageHistoryRepository();
  }

  /**
   * List all leads within tenant context.
   */
  async listLeads(query, actor) {
    const filter = { isDeleted: false };

    // Agents can only see their own leads unless they have higher role or leads.view_all permission
    const {
      ROLES,
    } = require("../../shared/constants/roles-permissions.constants");
    if (
      actor.role === ROLES.AGENT &&
      !actor.permissions?.includes("leads.view_all")
    ) {
      filter.assignedTo = actor.id;
    }

    if (query.status) filter.status = query.status;
    if (query.assignedTo) filter.assignedTo = query.assignedTo;
    if (query.source) filter.source = query.source;
    if (query.search) {
      filter.$text = { $search: query.search };
    }

    return this.leadRepository.paginate(filter, {
      page: query.page,
      limit: query.limit,
      sort: { [query.sort || "createdAt"]: query.order || -1 },
      populate: {
        path: "assignedTo",
        select: "firstName lastName email branchId",
      },
    });
  }

  /**
   * Fetch lead by ID.
   */
  async getLeadById(id) {
    return this.leadRepository.findByIdOrFail(id, "Lead");
  }

  /**
   * Create a new Lead.
   */
  async createLead(data, actor) {
    // 1. Validate mobile number uniqueness in active tenant context
    const activeLead = await this.leadRepository.findOne({
      mobile: data.mobile,
      isDeleted: false,
    });
    if (activeLead) {
      throw new ConflictError(
        "A lead with this mobile number already exists in your organization",
        "LEAD_MOBILE_EXISTS"
      );
    }

    // 2. Validate branch boundaries and assigned user if provided
    if (data.assignedTo) {
      const { User } = require("../user/user.model");
      const user = await User.findById(data.assignedTo);
      if (!user || user.isDeleted) {
        throw new NotFoundError("User", data.assignedTo);
      }
      if (!user.isActive) {
        throw new BusinessRuleError("Assigned user is inactive", "USER_INACTIVE");
      }
      if (user.organizationId.toString() !== actor.organizationId.toString()) {
        throw new ForbiddenError(
          "Assigned user belongs to a different organization"
        );
      }

      const targetBranchId = data.branchId || actor.branchId;
      if (
        targetBranchId &&
        user.branchId &&
        user.branchId.toString() !== targetBranchId.toString()
      ) {
        throw new ForbiddenError("Assigned user belongs to a different branch");
      }
    }

    // Auto-allocation logic for Portal / Website leads (Least-loaded routing)
    let assigneeId = data.assignedTo || actor.id;
    if (
      !data.assignedTo &&
      ["website", "magicbricks", "99acres", "housing", "whatsapp"].includes(
        data.source
      )
    ) {
      const { User } = require("../user/user.model");
      const {
        ROLES,
      } = require("../../shared/constants/roles-permissions.constants");
      const targetBranchId = data.branchId || actor.branchId || null;

      const agents = await User.find({
        organizationId: actor.organizationId,
        ...(targetBranchId ? { branchId: targetBranchId } : {}),
        isDeleted: false,
        status: "active",
      }).populate("roleId");

      const activeAgents = agents.filter(
        (u) => u.roleId?.code === ROLES.AGENT || u.roleId?.code === ROLES.TEAM_LEADER
      );

      if (activeAgents.length > 0) {
        const counts = await Promise.all(
          activeAgents.map(async (agent) => {
            const count = await this.leadRepository.count({
              assignedTo: agent.id,
              isDeleted: false,
            });
            return { agentId: agent.id, count };
          })
        );

        counts.sort((a, b) => a.count - b.count);
        assigneeId = counts[0].agentId;
      }
    }

    const initialStatus =
      data.status ||
      (assigneeId && assigneeId.toString() !== actor.id.toString()
        ? "assigned"
        : "new");

    const lead = await this.leadRepository.create({
      ...data,
      organizationId: actor.organizationId,
      branchId: data.branchId || actor.branchId || null,
      createdBy: actor.id,
      updatedBy: actor.id,
      ownerId: actor.id,
      assignedTo: assigneeId,
      status: initialStatus,
    });

    // Write assignment log
    await this.leadAssignmentRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: lead.id,
      assignedTo: assigneeId,
      assignedBy: actor.id,
      reason: "Lead Created",
    });

    // Write stage history log
    await this.leadStageHistoryRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: lead.id,
      stageFrom: null,
      stageTo: initialStatus,
      changedBy: actor.id,
    });

    // Write activity log
    await this.leadActivityRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: lead.id,
      type: "stage_change",
      description: `Lead created in stage '${initialStatus}'`,
      performedBy: actor.id,
      metadata: { stageTo: initialStatus },
    });

    // Calculate initial lead score
    await this.recalculateLeadScore(lead.id);

    await this.publishEvent(EVENTS.LEAD_CREATED, { leadId: lead.id, actor });
    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: "Lead",
      entityId: lead.id,
      userId: actor.id,
      newValues: { mobile: lead.mobile, source: lead.source },
      description: `Lead '${lead.firstName} ${lead.lastName || ""}' created`,
    });

    return this.leadRepository.findByIdOrFail(lead.id, "Lead");
  }

  /**
   * Update an existing Lead.
   */
  async updateLead(id, data, actor) {
    const lead = await this.leadRepository.findByIdOrFail(id, "Lead");

    // Business rule: Won lead cannot be modified unless bypass role
    if (
      lead.status === "won" &&
      actor.role !== "super_admin" &&
      actor.role !== "org_admin"
    ) {
      throw new BusinessRuleError("Won lead cannot be modified", "LEAD_WON_IMMUTABLE");
    }

    // Delegate stage transitions to changeStage
    if (data.status && data.status !== lead.status) {
      await this.changeStage(id, data.status, data.lostReason || data.reason, data.lostNotes || data.notes, actor);
      delete data.status;
    }

    // Enforce mobile uniqueness if updated
    if (data.mobile && data.mobile !== lead.mobile) {
      const activeLead = await this.leadRepository.findOne({
        mobile: data.mobile,
        isDeleted: false,
      });
      if (activeLead && activeLead.id.toString() !== id.toString()) {
        throw new ConflictError(
          "A lead with this mobile number already exists in your organization",
          "LEAD_MOBILE_EXISTS"
        );
      }
    }

    // Validate user assignment if updated
    if (data.assignedTo && data.assignedTo !== lead.assignedTo?.toString()) {
      const { User } = require("../user/user.model");
      const user = await User.findById(data.assignedTo);
      if (!user || user.isDeleted) {
        throw new NotFoundError("User", data.assignedTo);
      }
      if (!user.isActive) {
        throw new BusinessRuleError("Assigned user is inactive", "USER_INACTIVE");
      }
      if (user.organizationId.toString() !== actor.organizationId.toString()) {
        throw new ForbiddenError(
          "Assigned user belongs to a different organization"
        );
      }

      const targetBranchId = data.branchId || lead.branchId || actor.branchId;
      if (
        targetBranchId &&
        user.branchId &&
        user.branchId.toString() !== targetBranchId.toString()
      ) {
        throw new ForbiddenError("Assigned user belongs to a different branch");
      }
    }

    const updated = await this.leadRepository.update(id, {
      ...data,
      updatedBy: actor.id,
    });

    // Record update activity log
    await this.leadActivityRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: id,
      type: "note",
      description: "Lead profile attributes updated",
      performedBy: actor.id,
    });

    // Recalculate lead score
    await this.recalculateLeadScore(id);

    await this.publishEvent(EVENTS.LEAD_UPDATED, { leadId: id, actor });
    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Lead",
      entityId: id,
      userId: actor.id,
      oldValues: { firstName: lead.firstName },
      newValues: { firstName: updated.firstName },
    });

    return updated;
  }

  /**
   * Change lead status stage with safeguards.
   */
  async changeStage(id, status, lostReason, lostNotes, actor) {
    const lead = await this.leadRepository.findByIdOrFail(id, "Lead");

    if (lead.status === status) {
      return lead; // Noop
    }

    // Won state locks (unless manager/super_admin bypass or defaults)
    if (
      lead.status === "won" &&
      actor.role !== "super_admin" &&
      actor.role !== "org_admin"
    ) {
      throw new BusinessRuleError("Won lead cannot be modified", "LEAD_WON_IMMUTABLE");
    }

    // Stage transition safeguards
    if (status === "lost") {
      if (!lostReason || !lostReason.trim()) {
        throw new BusinessRuleError(
          "Lost reason is required when status is lost",
          "LOST_REASON_REQUIRED"
        );
      }
      if (!lostNotes || lostNotes.trim().length < 10) {
        throw new BusinessRuleError(
          "Lost notes of at least 10 characters are required when status is lost",
          "LOST_NOTES_REQUIRED"
        );
      }
    }

    if (status === "negotiation") {
      if (!lead.requirements?.budget?.min || !lead.requirements?.budget?.max) {
        throw new BusinessRuleError(
          "Prospect budget requirements (min and max) are required for negotiation stage",
          "BUDGET_REQUIRED"
        );
      }
    }

    if (status === "site_visit_scheduled") {
      const { SiteVisit } = require("../site-visit/site-visit.model");
      const visitExists = await SiteVisit.exists({ lead: id, status: "scheduled" });
      if (!visitExists) {
        throw new BusinessRuleError(
          "An active scheduled site visit must exist to set stage to site_visit_scheduled",
          "NO_SCHEDULED_VISIT"
        );
      }
    }

    // Compute elapsed time in the previous stage
    let timeSpentMinutes = 0;
    const lastHistory = await this.leadStageHistoryRepository.findOne(
      { leadId: id, stageTo: lead.status },
      null,
      { sort: { createdAt: -1 } }
    );
    if (lastHistory) {
      const diffMs = Date.now() - new Date(lastHistory.createdAt).getTime();
      timeSpentMinutes = Math.round(diffMs / (1000 * 60));
    }

    // Record stage history
    await this.leadStageHistoryRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: id,
      stageFrom: lead.status,
      stageTo: status,
      changedBy: actor.id,
      timeSpentMinutes,
    });

    const updated = await this.leadRepository.update(id, {
      status,
      ...(status === "lost" ? { lostReason, lostNotes, lostAt: new Date() } : {}),
      updatedBy: actor.id,
    });

    // Record stage change activity
    await this.leadActivityRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: id,
      type: "stage_change",
      description: `Lead status changed from '${lead.status}' to '${status}'`,
      performedBy: actor.id,
      metadata: { stageFrom: lead.status, stageTo: status },
    });

    // Recalculate lead score
    await this.recalculateLeadScore(id);

    await this.publishEvent(EVENTS.LEAD_UPDATED, { leadId: id, actor });
    if (status === "won") {
      await this.publishEvent(EVENTS.LEAD_WON, { leadId: id, actor });
    } else if (status === "lost") {
      await this.publishEvent(EVENTS.LEAD_LOST, { leadId: id, actor });
    }
    await this.logAudit({
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      entity: "Lead",
      entityId: id,
      userId: actor.id,
      oldValues: { status: lead.status },
      newValues: { status },
      description: `Lead status changed from '${lead.status}' to '${status}'`,
    });

    return updated;
  }

  /**
   * Assign a Lead to a user (with explicit audit log arrays).
   */
  async assignLead(id, assigneeId, actor, reason = "Direct Assignment") {
    const lead = await this.leadRepository.findByIdOrFail(id, "Lead");

    if (
      lead.status === "won" &&
      actor.role !== "super_admin" &&
      actor.role !== "org_admin"
    ) {
      throw new BusinessRuleError("Won lead cannot be modified", "LEAD_WON_IMMUTABLE");
    }

    // Validate assigned user
    const { User } = require("../user/user.model");
    const user = await User.findById(assigneeId);
    if (!user || user.isDeleted) {
      throw new NotFoundError("User", assigneeId);
    }
    if (!user.isActive) {
      throw new BusinessRuleError("Assigned user is inactive", "USER_INACTIVE");
    }
    if (user.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError(
        "Assigned user belongs to a different organization"
      );
    }

    if (
      lead.branchId &&
      user.branchId &&
      user.branchId.toString() !== lead.branchId.toString()
    ) {
      throw new ForbiddenError("Assigned user belongs to a different branch");
    }

    const originalAssignee = lead.assignedTo;

    const updated = await this.leadRepository.update(id, {
      assignedTo: assigneeId,
      status: lead.status === "new" ? "assigned" : lead.status,
      updatedBy: actor.id,
      $push: {
        assignmentHistory: {
          assignedTo: assigneeId,
          assignedBy: actor.id,
          assignedAt: new Date(),
          reason,
        },
      },
    });

    // Record assignment log
    await this.leadAssignmentRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: id,
      assignedTo: assigneeId,
      assignedBy: actor.id,
      reason,
    });

    // Record activity log
    await this.leadActivityRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: id,
      type: "assignment",
      description: `Lead assigned to ${user.firstName} ${user.lastName}`,
      performedBy: actor.id,
      metadata: { originalAssignee, newAssignee: assigneeId, reason },
    });

    await this.publishEvent(EVENTS.LEAD_ASSIGNED, { leadId: id, assigneeId, actor });
    await this.logAudit({
      action: AUDIT_ACTIONS.ASSIGN,
      entity: "Lead",
      entityId: id,
      userId: actor.id,
      description: `Lead assigned to user ${assigneeId}`,
    });

    return updated;
  }

  /**
   * Bulk assign leads.
   */
  async bulkAssign(leadIds, assigneeId, reason, actor) {
    const updatedLeads = [];
    for (const leadId of leadIds) {
      const updated = await this.assignLead(
        leadId,
        assigneeId,
        actor,
        reason || "Bulk Reassignment"
      );
      updatedLeads.push(updated);
    }
    return updatedLeads;
  }

  /**
   * Add a lead internal note.
   */
  async addNote(id, noteData, actor) {
    const lead = await this.leadRepository.findByIdOrFail(id, "Lead");

    const note = await this.leadNoteRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: id,
      content: noteData.content,
      createdBy: actor.id,
      isPrivate: noteData.isPrivate || false,
    });

    await this.leadActivityRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: id,
      type: "note",
      description: `Internal note added: "${noteData.content.substring(
        0,
        60
      )}${noteData.content.length > 60 ? "..." : ""}"`,
      performedBy: actor.id,
      metadata: { noteId: note.id },
    });

    return note;
  }

  /**
   * Log manual activity.
   */
  async logActivity(id, activityData, actor) {
    const lead = await this.leadRepository.findByIdOrFail(id, "Lead");

    const activity = await this.leadActivityRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: id,
      type: activityData.type,
      description: activityData.description,
      performedBy: actor.id,
      metadata: activityData.metadata || {},
    });

    await this.recalculateLeadScore(id);

    return activity;
  }

  /**
   * Schedule a future follow-up outreach.
   */
  async scheduleFollowUp(id, followUpData, actor) {
    const lead = await this.leadRepository.findByIdOrFail(id, "Lead");

    if (new Date(followUpData.scheduledAt) < new Date()) {
      throw new BusinessRuleError(
        "Follow-up date cannot be in the past",
        "FOLLOW_UP_PAST_DATE"
      );
    }

    const followUp = await this.leadFollowUpRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: id,
      scheduledAt: followUpData.scheduledAt,
      type: followUpData.type,
      notes: followUpData.notes,
      createdBy: actor.id,
      assignedTo: followUpData.assignedTo || lead.assignedTo || actor.id,
    });

    await this.leadActivityRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: id,
      type: "whatsapp",
      description: `Outreach follow-up scheduled of type '${followUpData.type}' for ${followUpData.scheduledAt}`,
      performedBy: actor.id,
      metadata: { followUpId: followUp.id },
    });

    // Reopen safety hook: if lost, reset to contacted
    if (lead.status === "lost") {
      await this.changeStage(id, "contacted", null, null, actor);
    }

    await this.recalculateLeadScore(id);

    await this.publishEvent(EVENTS.LEAD_FOLLOWUP_CREATED, { leadId: id, actor });

    return followUp;
  }

  /**
   * Alias for scheduleFollowUp to maintain backward compatibility in tests.
   */
  async addFollowUp(id, followUpData, actor) {
    return this.scheduleFollowUp(id, followUpData, actor);
  }

  /**
   * Manually Reopen a lost lead back to contacted status.
   */
  async reopenLead(id, actor) {
    const lead = await this.leadRepository.findByIdOrFail(id, "Lead");
    if (lead.status !== "lost") {
      throw new BusinessRuleError(
        "Only lost leads can be reopened",
        "LEAD_NOT_LOST"
      );
    }
    return this.changeStage(id, "contacted", null, null, actor);
  }

  /**
   * Mark a Lead as Lost.
   */
  async markLost(id, reason, actor) {
    return this.changeStage(id, "lost", reason, "Lead dropped out", actor);
  }

  /**
   * Soft-delete a Lead.
   */
  async deleteLead(id, actor) {
    await this.leadRepository.findByIdOrFail(id, "Lead");
    await this.leadRepository.softDelete(id, actor.id);
    await this.logAudit({
      action: AUDIT_ACTIONS.DELETE,
      entity: "Lead",
      entityId: id,
      userId: actor.id,
    });
  }

  /**
   * Recalculate dynamic behavioral lead score (0-100).
   * @param {string} id - Lead ID
   */
  async recalculateLeadScore(id) {
    const lead = await this.leadRepository.findById(id);
    if (!lead) return;

    let score = 0;

    // 1. Budget Match (+15)
    if (lead.requirements?.budget?.min && lead.requirements?.budget?.max) {
      score += 15;
    }

    // 2. Outreach follow-ups outcomes (+15)
    const hasCompletedFollowUp = await this.leadFollowUpRepository.exists({
      leadId: id,
      status: "completed",
    });
    if (hasCompletedFollowUp) {
      score += 15;
    }

    // 3. Site Visits checking (query DB)
    const { SiteVisit } = require("../site-visit/site-visit.model");
    const visits = await SiteVisit.find({ lead: id });
    if (visits && visits.length > 0) {
      const hasScheduled = visits.some((v) => v.status === "scheduled");
      const hasCompleted = visits.some((v) => v.status === "completed");

      if (hasScheduled) score += 30;
      if (hasCompleted) score += 20;
    }

    // 4. Lost Reason - Wrong phone number / invalid requirements check (0)
    if (
      lead.status === "lost" &&
      (lead.lostReason === "wrong_number" ||
        lead.lostReason === "invalid_requirement")
    ) {
      score = 0;
    }

    // Cap score between 0 and 100
    score = Math.min(100, Math.max(0, score));

    await this.leadRepository.update(id, { score });
  }
}

module.exports = { LeadService };
