"use strict";

const { BaseService } = require("../../shared/base/BaseService");
const {
  LeadRepository,
  LeadActivityRepository,
  LeadNoteRepository,
  LeadFollowUpRepository,
  LeadAssignmentRepository,
  LeadStageHistoryRepository,
  LeadVisitRepository,
  LeadQuotationRepository,
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
const { tenantContext } = require("../../shared/context/tenant-context");
const { Agent } = require("../agent/agent.model");
const { User } = require("../user/user.model");
const { Organization } = require("../organization/organization.model");
const { Customer } = require("../customer/customer.model");
const { Lead } = require("./lead.model");

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
    this.leadVisitRepository =
      deps.leadVisitRepository || new LeadVisitRepository();
    this.leadQuotationRepository =
      deps.leadQuotationRepository || new LeadQuotationRepository();
  }

  /**
   * List all leads within tenant context.
   */
  /**
   * Sanitize transferred lead to completely strip customer PII and private data.
   * Only property requirements and non-personal qualification parameters are returned.
   */
  _sanitizeTransferredLead(lead, actor) {
    if (!lead) return null;
    const isTransferred = lead.organizationId && actor && lead.organizationId.toString() !== actor.organizationId.toString();
    if (!isTransferred) return lead;

    // Find the matching transfer record
    const transfer = Array.isArray(lead.transfers)
      ? lead.transfers.find((t) => t.toOrganizationId?.toString() === actor.organizationId.toString())
      : null;

    const fromOrgName = transfer?.fromOrganizationName || "Partner Broker";

    return {
      _id: lead._id || lead.id,
      id: lead._id || lead.id,
      leadType: "TRANSFERRED",
      isTransferred: true,
      receivedFrom: {
        organizationName: fromOrgName,
        transferredAt: transfer?.transferredAt || lead.createdAt,
        transferredByName: transfer?.transferredByName || "Broker Agent",
        remarks: transfer?.remarks || "",
      },
      status: lead.status || "new",
      stage: lead.status || "new",
      score: lead.score || 0,
      source: lead.source || "transferred",
      // Non-PII identifier
      firstName: lead.firstName || "Client Requirement",
      lastName: "",
      // ALL PERSONAL CONTACT PII STRICTLY REMOVED AT BACKEND
      mobile: undefined,
      alternativeMobile: undefined,
      email: undefined,
      customerId: undefined,
      buyerProfile: undefined,
      // Retain full property requirements & qualification
      buyerRequirement: lead.buyerRequirement || lead.requirements || {},
      requirements: lead.requirements || lead.buyerRequirement || {},
      budget: lead.budget || lead.requirements?.budget || {},
      qualification: {
        leadTemperature: lead.qualification?.leadTemperature || "warm",
        buyingIntent: lead.qualification?.buyingIntent || "medium",
        purchaseTimeline: lead.buyerProfile?.preferredPurchaseTimeline || "within_30_days",
        sourceOfFunds: lead.buyerProfile?.sourceOfFunds || "loan",
        isFirstTimeBuyer: lead.buyerProfile?.isFirstTimeBuyer,
        notesRemarks: lead.qualification?.notesRemarks || lead.requirements?.notes || "",
      },
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }

  /**
   * List all leads within tenant context (Own Leads + Transferred Leads).
   */
  async listLeads(query, actor) {
    const { Lead } = require("./lead.model");
    const { ROLES } = require("../../shared/constants/roles-permissions.constants");

    const actorOrgId = actor.organizationId?.toString();

    // Query filter: Own leads in current organization OR leads transferred to current organization
    const orgFilter = {
      $or: [
        { organizationId: actor.organizationId },
        { "transfers.toOrganizationId": actor.organizationId },
      ],
      isDeleted: { $ne: true },
    };

    if (
      actor.role === ROLES.AGENT &&
      !actor.permissions?.includes("leads.view_all")
    ) {
      orgFilter.$or = [
        { organizationId: actor.organizationId, assignedTo: actor.id },
        { "transfers.toOrganizationId": actor.organizationId, "transfers.toUserId": actor.id },
        { "transfers.toOrganizationId": actor.organizationId, assignedTo: actor.id },
      ];
    }

    const filter = { ...orgFilter };
    if (query.status) filter.status = query.status;
    if (query.assignedTo) filter.assignedTo = query.assignedTo;
    if (query.source) filter.source = query.source;
    if (query.search) {
      filter.$text = { $search: query.search };
    }

    const page = parseInt(query.page, 10) || 1;
    const limit = Math.min(parseInt(query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;
    const sortField = query.sort || "createdAt";
    const sortOrder = query.order === "asc" || query.order === 1 ? 1 : -1;

    // Use system override locally to query cross-org transferred records alongside own records
    const [total, rows] = await tenantContext.run({ isSystemOverride: true }, async () => {
      const count = await Lead.countDocuments(filter);
      const docs = await Lead.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate("assignedTo", "firstName lastName email branchId")
        .populate("agentId", "name officeName phone email city agentType")
        .populate("agentIds", "name officeName phone email city agentType")
        .lean();
      return [count, docs];
    });

    // Sanitize any transferred leads to completely strip customer PII
    const sanitizedRows = rows.map((lead) => this._sanitizeTransferredLead(lead, actor));

    return {
      data: sanitizedRows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single Lead by ID with strict multi-tenant authorization.
   */
  async getLeadById(id, actor) {
    const { Lead } = require("./lead.model");
    
    // Fetch lead with system override to evaluate tenant authorization
    const lead = await tenantContext.run({ isSystemOverride: true }, async () => {
      return Lead.findById(id)
        .populate("assignedTo", "firstName lastName email mobile")
        .populate("agentId", "name officeName phone email city reraNumber agentType")
        .populate("agentIds", "name officeName phone email city reraNumber agentType")
        .populate("customerId", "firstName lastName mobile email alternativeMobile address city status")
        .lean();
    });

    if (!lead || lead.isDeleted) {
      throw new NotFoundError("Lead", id);
    }

    // 1. Own Lead: user belongs to the same organization
    if (actor && lead.organizationId && lead.organizationId.toString() === actor.organizationId.toString()) {
      return lead;
    }

    // 2. Transferred Lead: lead was transferred to user's organization
    const isTransferredToMe = actor && Array.isArray(lead.transfers) &&
      lead.transfers.some((t) => t.toOrganizationId?.toString() === actor.organizationId.toString());

    if (isTransferredToMe) {
      return this._sanitizeTransferredLead(lead, actor);
    }

    // 3. Unrelated Organization -> 403 Forbidden / Not Found
    throw new ForbiddenError("You do not have permission to access this lead");
  }

  /**
   * Check duplicate customer / lead strictly scoped in tenant context (Priority: Mobile -> Email -> Name).
   */
  async checkDuplicateLead(query, actor) {
    const { CustomerService } = require("../customer/customer.service");
    const customerService = new CustomerService();
    return customerService.lookupCustomer(query, actor);
  }

  /**
   * Create a new Lead.
   */
  async createLead(data, actor) {
    // 1. Resolve or create Customer master profile (Single Source of Truth)
    const { Customer } = require("../customer/customer.model");
    let customer = null;

    if (data.customerId) {
      customer = await Customer.findOne({
        _id: data.customerId,
        organizationId: actor.organizationId,
        isDeleted: false,
      });
    }

    if (!customer && data.mobile) {
      const cleanMobile = String(data.mobile).replace(/[\s+-]/g, '');
      customer = await Customer.findOne({
        organizationId: actor.organizationId,
        isDeleted: false,
        $or: [
          { mobile: data.mobile },
          { mobile: { $regex: new RegExp(cleanMobile.slice(-10) + '$', 'i') } }
        ]
      });
    }

    if (!customer && data.email && data.email.trim()) {
      customer = await Customer.findOne({
        organizationId: actor.organizationId,
        email: data.email.trim().toLowerCase(),
        isDeleted: false,
      });
    }

    if (!customer) {
      // Create new Customer master document for first-time contacts
      try {
        customer = await Customer.create({
          organizationId: actor.organizationId,
          branchId: data.branchId || actor.branchId || null,
          firstName: data.firstName,
          lastName: data.lastName || '',
          mobile: data.mobile,
          alternativeMobile: data.alternativeMobile || '',
          email: data.email ? data.email.trim().toLowerCase() : '',
          assignedTo: data.assignedTo || actor.id,
          requirements: data.buyerRequirement || data.requirements,
          createdBy: actor.id,
          updatedBy: actor.id,
        });
      } catch (custErr) {
        customer = await Customer.findOne({
          organizationId: actor.organizationId,
          $or: [
            { mobile: data.mobile },
            ...(data.email ? [{ email: data.email.trim().toLowerCase() }] : []),
          ],
        });
      }
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
      customerId: customer ? customer._id : null,
      organizationId: actor.organizationId,
      branchId: data.branchId || actor.branchId || null,
      createdBy: actor.id,
      updatedBy: actor.id,
      ownerId: actor.id,
      assignedTo: assigneeId,
      status: initialStatus,
    });

    // Link lead ID to Customer master record
    if (customer) {
      await Customer.findByIdAndUpdate(customer._id, {
        $addToSet: { leadIds: lead.id }
      });
    }

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
      type: "note",
      title: "Lead Profile Captured",
      description: `Lead profile created for customer ${lead.firstName} ${lead.lastName || ""}`.trim(),
      performedBy: actor.id,
    });

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

    // ── AUTOMATION: Auto-create Loan Case if Loan Required = Yes ──
    const isLoanNeeded =
      data.loanRequired === "yes" ||
      data.financialRequirement?.loanRequired === "yes" ||
      lead.financialRequirement?.loanRequired === "yes";

    if (isLoanNeeded) {
      try {
        const { LoanService } = require("../loan/loan.service");
        const loanService = new LoanService();
        await loanService.autoCreateFromLead(lead, data, actor);
      } catch (loanErr) {
        console.warn("[LeadService] Notice auto-creating loan case:", loanErr.message);
      }
    }

    await this.publishEvent(EVENTS.LEAD_CREATED, {
      leadId: lead.id,
      customerId: customer ? customer._id : null,
      assignedTo: assigneeId,
      actorId: actor.id,
    });

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
   * Transfer lead to an Agent / Channel Partner.
   */
  async transferLeadToAgent(leadId, { agentId, agentIds, toOrganizationId, remarks }, actor) {
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const lead = await this.leadRepository.findByIdOrFail(leadId, "Lead");

      const targetAgentIds = Array.isArray(agentIds) && agentIds.length > 0 
        ? agentIds 
        : (agentId ? [agentId] : []);

      if (targetAgentIds.length === 0) {
        throw new BusinessRuleError("At least one Agent / Channel Partner must be selected for transfer", "AGENT_REQUIRED");
      }

      const agents = await Agent.find({ _id: { $in: targetAgentIds }, isDeleted: { $ne: true } });
      if (agents.length !== targetAgentIds.length) {
        throw new NotFoundError("One or more selected Agents / Channel Partners were not found");
      }

      const inactiveAgent = agents.find(a => a.status !== 'active');
      if (inactiveAgent) {
        throw new BusinessRuleError(`Cannot transfer to inactive Channel Partner '${inactiveAgent.name}'`, "AGENT_INACTIVE");
      }

      let fromName = "Unassigned";
      if (lead.agentId) {
        const prevAgent = await Agent.findById(lead.agentId);
        if (prevAgent) fromName = `${prevAgent.name} (${prevAgent.officeName})`;
      } else if (lead.assignedTo) {
        const prevUser = await User.findById(lead.assignedTo);
        if (prevUser) fromName = `${prevUser.firstName} ${prevUser.lastName || ""}`.trim();
      }

      lead.transferHistory = lead.transferHistory || [];
      lead.transfers = lead.transfers || [];
      lead.agentIds = lead.agentIds || [];

      const fromOrg = await Organization.findById(actor.organizationId);
      const fromOrgName = fromOrg ? fromOrg.name : "Partner Broker";

      for (const agent of agents) {
        if (!lead.agentIds.some(id => id.toString() === agent._id.toString())) {
          lead.agentIds.push(agent._id);
        }

        const transferEntry = {
          fromType: lead.agentId ? "agent" : (lead.assignedTo ? "user" : "unassigned"),
          fromId: lead.agentId || lead.assignedTo || null,
          fromName,
          toAgentId: agent._id,
          toAgentName: `${agent.name} (${agent.officeName})`,
          transferredBy: actor.id,
          transferredByName: `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email,
          transferredAt: new Date(),
          remarks: remarks || "",
        };
        lead.transferHistory.push(transferEntry);

        // Check if target agent/broker belongs to a registered organization or user in the platform
        let targetOrgId = agent.targetOrganizationId || null;
        let targetUserId = agent.userId || null;
        if (!targetOrgId && agent.email) {
          const matchingUser = await User.findOne({ email: agent.email.toLowerCase().trim(), isDeleted: { $ne: true } });
          if (matchingUser) {
            targetOrgId = matchingUser.organizationId;
            targetUserId = matchingUser._id;
          } else {
            const matchingOrg = await Organization.findOne({ email: agent.email.toLowerCase().trim() });
            if (matchingOrg) {
              targetOrgId = matchingOrg._id;
            }
          }
        }

        if (targetOrgId) {
          if (!lead.transfers.some(t => t.toOrganizationId?.toString() === targetOrgId.toString() && t.status === "transferred")) {
            lead.transfers.push({
              fromOrganizationId: actor.organizationId,
              toOrganizationId: targetOrgId,
              toAgentId: agent._id,
              toUserId: targetUserId,
              transferredBy: actor.id,
              transferredByName: `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email,
              fromOrganizationName: fromOrgName,
              transferredAt: new Date(),
              status: "transferred",
              remarks: remarks || "",
            });
          }
        }

        agent.totalLeadsAssigned = (agent.totalLeadsAssigned || 0) + 1;
        agent.activeLeadsCount = (agent.activeLeadsCount || 0) + 1;
        agent.lastTransferredAt = new Date();
        await agent.save();
      }

      if (toOrganizationId && !lead.transfers.some(t => t.toOrganizationId?.toString() === toOrganizationId.toString() && t.status === "transferred")) {
        lead.transfers.push({
          fromOrganizationId: actor.organizationId,
          toOrganizationId: toOrganizationId,
          toAgentId: agents[0]?._id || null,
          transferredBy: actor.id,
          transferredByName: `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email,
          fromOrganizationName: fromOrgName,
          transferredAt: new Date(),
          status: "transferred",
          remarks: remarks || "",
        });
      }

      lead.agentId = agents[0]._id;
      await lead.save();

      const agentNamesStr = agents.map(a => `${a.name} (${a.officeName})`).join(', ');

      await this.leadActivityRepository.create({
        organizationId: actor.organizationId,
        branchId: lead.branchId,
        leadId: lead.id,
        type: "assignment",
        description: `Transferred lead to ${agents.length} Channel Partner(s): ${agentNamesStr}`,
        performedBy: actor.id,
        metadata: { agentIds: targetAgentIds, remarks },
      });

      await this.logAudit({
        action: AUDIT_ACTIONS.UPDATE,
        entity: "Lead",
        entityId: lead.id,
        userId: actor.id,
        description: `Transferred lead to ${agents.length} Agent(s) / Channel Partner(s): ${agentNamesStr}`,
      });

      return Lead.findById(lead.id)
        .populate("assignedTo")
        .populate("agentId", "name officeName phone email city reraNumber agentType")
        .populate("agentIds", "name officeName phone email city reraNumber agentType")
        .lean();
    });
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
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const lead = await this.leadRepository.findByIdOrFail(id, "Lead");

      const activityDate = activityData.activityDate ? new Date(activityData.activityDate) : new Date();
      const summaryText = activityData.summary || activityData.description || `${activityData.type} recorded`;

      const activity = await this.leadActivityRepository.create({
        organizationId: actor.organizationId,
        branchId: lead.branchId,
        leadId: id,
        type: activityData.type,
        activityDate,
        activityTime: activityData.activityTime || null,
        summary: summaryText,
        description: activityData.description || summaryText,
        customerResponse: activityData.customerResponse || "",
        nextFollowUpAt: activityData.nextFollowUpAt ? new Date(activityData.nextFollowUpAt) : null,
        status: activityData.status || "completed",
        assignedTo: activityData.assignedTo || lead.assignedTo || null,
        performedBy: actor.id,
        metadata: activityData.metadata || {},
      });

      // Auto-schedule follow-up if nextFollowUpAt is provided
      if (activityData.nextFollowUpAt) {
        const nextFollowUpDate = new Date(activityData.nextFollowUpAt);
        if (nextFollowUpDate > new Date()) {
          let followUpType = "call";
          if (activityData.type === "whatsapp") followUpType = "whatsapp";
          else if (activityData.type === "meeting") followUpType = "meeting";
          else if (activityData.type === "site_visit" || activityData.type === "property_visit") followUpType = "site_visit";
          else if (activityData.type === "email") followUpType = "email";

          await this.leadFollowUpRepository.create({
            organizationId: actor.organizationId,
            branchId: lead.branchId,
            leadId: id,
            scheduledAt: nextFollowUpDate,
            type: followUpType,
            notes: `Follow-up after ${activityData.type}: ${summaryText}`,
            assignedTo: activityData.assignedTo || lead.assignedTo || actor.id,
            createdBy: actor.id,
          });
        }
      }

      // Update lead last activity and next follow up
      lead.lastActivityType = activityData.type;
      lead.lastActivityAt = activityDate;
      if (activityData.nextFollowUpAt) {
        lead.nextFollowUpAt = new Date(activityData.nextFollowUpAt);
      }
      await lead.save();

      await this.recalculateLeadScore(id);

      return activity;
    });
  }

  /**
   * Update an existing lead activity.
   */
  async updateActivity(leadId, activityId, activityData, actor) {
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const { LeadActivity } = require("./lead.model");
      const activity = await LeadActivity.findOne({
        _id: activityId,
        leadId,
        organizationId: actor.organizationId,
        isDeleted: { $ne: true },
      });

      if (!activity) {
        throw new NotFoundError("Activity not found or already deleted");
      }

      if (activityData.summary !== undefined) activity.summary = activityData.summary;
      if (activityData.description !== undefined) activity.description = activityData.description;
      if (activityData.customerResponse !== undefined) activity.customerResponse = activityData.customerResponse;
      if (activityData.activityDate !== undefined) activity.activityDate = new Date(activityData.activityDate);
      if (activityData.activityTime !== undefined) activity.activityTime = activityData.activityTime;
      if (activityData.status !== undefined) activity.status = activityData.status;
      if (activityData.nextFollowUpAt !== undefined) {
        activity.nextFollowUpAt = activityData.nextFollowUpAt ? new Date(activityData.nextFollowUpAt) : null;
      }
      if (activityData.metadata) {
        activity.metadata = { ...(activity.metadata || {}), ...activityData.metadata };
      }

      await activity.save();
      return activity;
    });
  }

  /**
   * Delete an existing lead activity (Soft Delete).
   */
  async deleteActivity(leadId, activityId, actor) {
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const { LeadActivity } = require("./lead.model");
      const activity = await LeadActivity.findOne({
        _id: activityId,
        leadId,
        organizationId: actor.organizationId,
        isDeleted: { $ne: true },
      });

      if (!activity) {
        throw new NotFoundError("Activity not found");
      }

      activity.isDeleted = true;
      activity.deletedAt = new Date();
      activity.deletedBy = actor.id;
      await activity.save();

      return { success: true, message: "Activity deleted successfully" };
    });
  }

  /**
   * Update an existing property visit.
   */
  async updateVisit(leadId, visitId, data, actor) {
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const { LeadVisit } = require("./lead.model");
      const visit = await LeadVisit.findOne({
        _id: visitId,
        leadId,
        organizationId: actor.organizationId,
        isDeleted: false,
      });

      if (!visit) throw new NotFoundError("Visit record not found");

      if (data.visitDate) visit.visitDate = new Date(data.visitDate);
      if (data.visitTime !== undefined) visit.visitTime = data.visitTime;
      if (data.visitStatus !== undefined) visit.visitStatus = data.visitStatus;
      if (data.propertiesShown !== undefined) visit.propertiesShown = data.propertiesShown;
      if (data.customerAttended !== undefined) visit.customerAttended = data.customerAttended;
      if (data.interestLevel !== undefined) {
        visit.interestLevel = data.interestLevel && String(data.interestLevel).trim() ? String(data.interestLevel).trim() : null;
      }
      if (data.customerFeedback !== undefined) visit.customerFeedback = data.customerFeedback;
      if (data.likes !== undefined) visit.likes = data.likes;
      if (data.dislikes !== undefined) visit.dislikes = data.dislikes;
      if (data.objections !== undefined) visit.objections = data.objections;
      if (data.competitorPropertyMentioned !== undefined) visit.competitorPropertyMentioned = data.competitorPropertyMentioned;
      if (data.nextAction !== undefined) visit.nextAction = data.nextAction;
      if (data.followUpDate !== undefined) visit.followUpDate = data.followUpDate ? new Date(data.followUpDate) : null;
      if (data.internalNotes !== undefined) visit.internalNotes = data.internalNotes;

      await visit.save();
      return visit;
    });
  }

  /**
   * Delete a property visit.
   */
  async deleteVisit(leadId, visitId, actor) {
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const { LeadVisit } = require("./lead.model");
      const visit = await LeadVisit.findOne({
        _id: visitId,
        leadId,
        organizationId: actor.organizationId,
        isDeleted: false,
      });

      if (!visit) throw new NotFoundError("Visit record not found");

      visit.isDeleted = true;
      await visit.save();
      return { success: true, message: "Visit deleted successfully" };
    });
  }

  /**
   * Update quotation.
   */
  async updateQuotation(leadId, quotationId, data, actor) {
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const { LeadQuotation } = require("./lead.model");
      const quote = await LeadQuotation.findOne({
        _id: quotationId,
        leadId,
        organizationId: actor.organizationId,
        isDeleted: false,
      });

      if (!quote) throw new NotFoundError("Quotation not found");

      if (data.quotedPrice !== undefined) quote.quotedPrice = data.quotedPrice;
      if (data.listPrice !== undefined) quote.listPrice = data.listPrice;
      if (data.discount !== undefined) quote.discount = data.discount;
      if (data.discountAmount !== undefined) quote.discountAmount = data.discountAmount;
      if (data.totalEstimatedCost !== undefined) quote.totalEstimatedCost = data.totalEstimatedCost;
      if (data.offerValidUntil !== undefined) quote.offerValidUntil = data.offerValidUntil ? new Date(data.offerValidUntil) : null;
      if (data.customerInterest !== undefined) quote.customerInterest = data.customerInterest;
      if (data.customerFeedback !== undefined) quote.customerFeedback = data.customerFeedback;
      if (data.notes !== undefined) quote.notes = data.notes;

      await quote.save();
      return quote;
    });
  }

  /**
   * Delete quotation.
   */
  async deleteQuotation(leadId, quotationId, actor) {
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const { LeadQuotation } = require("./lead.model");
      const quote = await LeadQuotation.findOne({
        _id: quotationId,
        leadId,
        organizationId: actor.organizationId,
        isDeleted: false,
      });

      if (!quote) throw new NotFoundError("Quotation not found");

      quote.isDeleted = true;
      await quote.save();
      return { success: true, message: "Quotation deleted successfully" };
    });
  }

  /**
   * Update internal note.
   */
  async updateNote(leadId, noteId, data, actor) {
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const { LeadNote } = require("./lead.model");
      const note = await LeadNote.findOne({
        _id: noteId,
        leadId,
        organizationId: actor.organizationId,
        isDeleted: { $ne: true },
      });

      if (!note) throw new NotFoundError("Note not found");

      if (data.content !== undefined) note.content = data.content;
      if (data.title !== undefined) note.title = data.title;
      if (data.isPrivate !== undefined) note.isPrivate = data.isPrivate;

      await note.save();
      return note;
    });
  }

  /**
   * Delete internal note.
   */
  async deleteNote(leadId, noteId, actor) {
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const { LeadNote } = require("./lead.model");
      const note = await LeadNote.findOne({
        _id: noteId,
        leadId,
        organizationId: actor.organizationId,
        isDeleted: { $ne: true },
      });

      if (!note) throw new NotFoundError("Note not found");

      note.isDeleted = true;
      await note.save();
      return { success: true, message: "Note deleted successfully" };
    });
  }

  /**
   * Update follow-up status or schedule.
   */
  async updateFollowUp(leadId, followUpId, data, actor) {
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const { LeadFollowUp } = require("./lead.model");
      const followUp = await LeadFollowUp.findOne({
        _id: followUpId,
        leadId,
        organizationId: actor.organizationId,
        isDeleted: { $ne: true },
      });

      if (!followUp) throw new NotFoundError("Follow-up not found");

      if (data.status !== undefined) {
        followUp.status = data.status;
        if (data.status === "completed") {
          followUp.completedAt = new Date();
          followUp.completedBy = actor.id;
        }
      }
      if (data.scheduledAt !== undefined) followUp.scheduledAt = new Date(data.scheduledAt);
      if (data.type !== undefined) followUp.type = data.type;
      if (data.notes !== undefined) followUp.notes = data.notes;
      if (data.outcome !== undefined) followUp.outcome = data.outcome;
      if (data.assignedTo !== undefined) followUp.assignedTo = data.assignedTo;

      await followUp.save();
      return followUp;
    });
  }

  /**
   * Delete follow-up.
   */
  async deleteFollowUp(leadId, followUpId, actor) {
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const { LeadFollowUp } = require("./lead.model");
      const followUp = await LeadFollowUp.findOne({
        _id: followUpId,
        leadId,
        organizationId: actor.organizationId,
        isDeleted: { $ne: true },
      });

      if (!followUp) throw new NotFoundError("Follow-up not found");

      followUp.isDeleted = true;
      await followUp.save();
      return { success: true, message: "Follow-up deleted successfully" };
    });
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

  /**
   * Close a lead with mandatory real estate transaction details.
   */
  async closeLeadWithTransaction(id, transactionData, actor) {
    const lead = await this.leadRepository.findByIdOrFail(id, "Lead");

    if (lead.status === "won" && actor.role !== "super_admin" && actor.role !== "org_admin") {
      throw new BusinessRuleError("Lead has already been closed/won", "LEAD_ALREADY_CLOSED");
    }

    if (!transactionData.propertyId) {
      throw new BusinessRuleError("Property selection is required to close a lead", "PROPERTY_REQUIRED");
    }

    const { Property } = require("../property/property.model");
    const property = await Property.findById(transactionData.propertyId);
    if (!property || property.isDeleted) {
      throw new NotFoundError("Property", transactionData.propertyId);
    }

    if (property.status === "sold") {
      throw new BusinessRuleError(
        `Property '${property.title}' is already marked as Sold and cannot be selected.`,
        "PROPERTY_ALREADY_SOLD"
      );
    }

    const { TransactionRepository } = require("../transaction/transaction.repository");
    const transactionRepo = new TransactionRepository();

    const count = await transactionRepo.count({ organizationId: actor.organizationId });
    const txnNum = `TXN-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const finalSalePrice = Number(transactionData.finalSalePrice || 0);
    const ownContribution = Number(transactionData.customerOwnContribution || 0);
    const loanAmount = Number(transactionData.actualLoanAmount || 0);
    const otherFunding = Number(transactionData.otherFundingAmount || 0);
    const totalTransactionValue = finalSalePrice || (ownContribution + loanAmount + otherFunding);

    const transaction = await transactionRepo.create({
      transactionNumber: txnNum,
      organizationId: actor.organizationId,
      branchId: lead.branchId || actor.branchId || null,
      leadId: lead.id,
      customerId: lead.convertedTo || null,
      propertyId: property.id,
      projectId: property.project || transactionData.projectId || null,
      closedBy: actor.id,
      agentId: lead.agentId || (lead.agentIds && lead.agentIds[0]) || null,
      ...transactionData,
      finalSalePrice,
      totalTransactionValue,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    // Create / provision Deal record
    const { Deal } = require("../deal/deal.model");
    const { Customer } = require("../customer/customer.model");

    let customerId = lead.convertedTo || lead.customerId;
    if (!customerId) {
      let customer = await Customer.findOne({ organizationId: actor.organizationId, mobile: lead.mobile });
      if (!customer) {
        customer = await Customer.create({
          organizationId: actor.organizationId,
          firstName: lead.firstName,
          lastName: lead.lastName || "",
          mobile: lead.mobile,
          email: lead.email || "",
          createdBy: actor.id,
        });
      }
      customerId = customer._id;
      lead.convertedTo = customer._id;
    }

    const dealCount = await Deal.countDocuments({ organizationId: actor.organizationId });
    const dealNumber = `DEAL-${new Date().getFullYear()}-${String(dealCount + 1).padStart(4, "0")}`;

    const deal = await Deal.create({
      dealNumber,
      organizationId: actor.organizationId,
      branchId: lead.branchId || actor.branchId || null,
      customer: customerId,
      property: property._id,
      project: property.project || transactionData.projectId || null,
      broker: actor.id,
      assignedTo: lead.assignedTo || actor.id,
      sourcingAgent: lead.assignedTo || actor.id,
      askingPrice: property.price || finalSalePrice,
      agreedPrice: finalSalePrice,
      dealValue: finalSalePrice,
      commissionPercentage: Number(transactionData.commissionPercentage || 2),
      commissionAmount: Number(transactionData.commissionAmount || 0),
      status: "deal_closed",
      closedAt: new Date(),
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    lead.dealId = deal._id;
    transaction.dealId = deal._id;
    await transaction.save();

    // Auto-create Commission record and link
    let commission = null;
    try {
      const { CommissionService } = require("../commission/commission.service");
      const commissionService = new CommissionService();
      const commissionExpected = Number(transactionData.commissionAmount) || Math.round((finalSalePrice * Number(transactionData.commissionPercentage || 2)) / 100);
      const commissionPayload = {
        commissionType: transactionData.commissionType || "percentage",
        commissionRate: Number(transactionData.commissionPercentage || 2),
        expectedAmount: commissionExpected,
        payablePartyType: transactionData.payablePartyType || (property.builderName ? "builder" : "seller"),
        payablePartyName: transactionData.payablePartyName || property.builderName || property.developer || "Builder / Developer",
        expectedPaymentDate: transactionData.expectedPaymentDate || new Date(Date.now() + 30 * 86400000),
        tdsPercentage: 5,
      };

      commission = await commissionService.autoCreateFromDeal(deal._id, commissionPayload, actor);

      if (Number(transactionData.commissionReceivedAmount) > 0 || transactionData.commissionStatus === "yes") {
        await commissionService.recordPayment(commission._id, {
          amount: Number(transactionData.commissionReceivedAmount) || commission.totalCommissionExpected,
          paymentMethod: transactionData.commissionPaymentMethod || "Bank Transfer",
          referenceNumber: transactionData.commissionPaymentReference || "CLOSING-REC",
          receivedFrom: commissionPayload.payablePartyName,
          notes: "Initial commission payment received upon lead closing",
        }, actor);
      }
    } catch (commErr) {
      console.warn("[LeadService] Notice provisioning commission from closed lead transaction:", commErr.message);
    }

    // Mark property inventory status as Sold
    property.status = "sold";
    property.updatedBy = actor.id;
    await property.save();

    // Mark lead status as Won
    lead.status = "won";
    lead.convertedAt = new Date();
    lead.updatedBy = actor.id;
    await lead.save();

    // Record stage history
    await this.leadStageHistoryRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: lead.id,
      stageFrom: lead.status,
      stageTo: "won",
      changedBy: actor.id,
    });

    // Record activity log
    await this.leadActivityRepository.create({
      organizationId: actor.organizationId,
      branchId: lead.branchId,
      leadId: lead.id,
      type: "stage_change",
      description: `Lead closed as Won with Transaction #${txnNum} for Property '${property.title}'`,
      performedBy: actor.id,
      metadata: { transactionId: transaction.id, propertyId: property.id, finalSalePrice },
    });

    await this.publishEvent(EVENTS.LEAD_WON, { leadId: lead.id, transactionId: transaction.id, actor });
    await this.logAudit({
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      entity: "Lead",
      entityId: lead.id,
      userId: actor.id,
      oldValues: { status: lead.status },
      newValues: { status: "won", transactionId: transaction.id, propertyId: property.id },
      description: `Lead closed with transaction ${txnNum}`,
    });

    return { lead, transaction, property };
  }

  // ---------------------------------------------------------------------------
  // Activity Center Methods
  // ---------------------------------------------------------------------------

  /**
   * Get the complete 360° Activity Center data for a lead.
   * Returns: activities, notes, follow-ups, visits, quotations, summary stats.
   */
  async getActivityCenter(leadId, actor) {
    const { Lead } = require("./lead.model");
    const lead = await tenantContext.run({ isSystemOverride: true }, async () => {
      return Lead.findById(leadId).lean();
    });

    if (!lead || lead.isDeleted) {
      throw new NotFoundError("Lead", leadId);
    }

    const isOwnLead = actor && lead.organizationId && lead.organizationId.toString() === actor.organizationId.toString();
    const isTransferredToMe = actor && Array.isArray(lead.transfers) &&
      lead.transfers.some((t) => t.toOrganizationId?.toString() === actor.organizationId.toString());

    if (!isOwnLead && !isTransferredToMe) {
      throw new ForbiddenError("You do not have permission to access this lead activity center");
    }

    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      require("../property/property.model");
      require("../project/project.model");

      const [activities, notes, followUps, visits, quotations, activitySummaryRaw] =
        await Promise.all([
          this.leadActivityRepository.findMany(
            { leadId, isDeleted: { $ne: true } },
            { sort: { createdAt: -1 }, populate: [{ path: "performedBy", select: "firstName lastName" }] }
          ),
          this.leadNoteRepository.findMany(
            { leadId, isDeleted: { $ne: true } },
            { sort: { createdAt: -1 }, populate: [{ path: "createdBy", select: "firstName lastName" }] }
          ),
          this.leadFollowUpRepository.findMany(
            { leadId, isDeleted: { $ne: true } },
            { sort: { scheduledAt: 1 }, populate: [{ path: "assignedTo", select: "firstName lastName" }, { path: "createdBy", select: "firstName lastName" }] }
          ),
          this.leadVisitRepository.findMany(
            { leadId, isDeleted: false },
            {
              sort: { visitDate: -1 },
              populate: [
                { path: "propertiesShown", select: "title unitNumber status" },
                { path: "projectId", select: "name" },
                { path: "salesExecutive", select: "firstName lastName" },
                { path: "agentId", select: "name officeName" },
                { path: "createdBy", select: "firstName lastName" },
              ],
            }
          ),
          this.leadQuotationRepository.findMany(
            { leadId, isDeleted: false },
            {
              sort: { quotedDate: -1 },
              populate: [
                { path: "propertyId", select: "title unitNumber" },
                { path: "projectId", select: "name" },
                { path: "quotedBy", select: "firstName lastName" },
              ],
            }
          ),
          this.leadActivityRepository.getActivitySummary(leadId),
        ]);

      // Build summary map
      const summaryMap = {};
      for (const entry of activitySummaryRaw) {
        summaryMap[entry._id] = entry.count;
      }

      // Compute next upcoming follow-up
      const now = new Date();
      const nextFollowUp = followUps
        .filter((f) => f.status === "scheduled" && new Date(f.scheduledAt) > now)
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0] || null;

      // Lead age in days
      const leadAgeDays = Math.floor(
        (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      const summary = {
        totalCalls: summaryMap["call"] || 0,
        totalWhatsApp: summaryMap["whatsapp"] || 0,
        totalMeetings: summaryMap["meeting"] || 0,
        totalPropertyVisits: (summaryMap["property_visit"] || 0) + visits.length,
        totalSiteVisits: summaryMap["site_visit"] || 0,
        totalQuotations: quotations.length,
        totalPropertiesShown: visits.reduce((acc, v) => acc + (v.numberOfPropertiesShown || 0), 0),
        totalProjectsShown: visits.reduce((acc, v) => acc + (v.numberOfProjectsShown || 0), 0),
        totalFollowUps: followUps.length,
        pendingFollowUps: followUps.filter((f) => f.status === "scheduled").length,
        overdueFollowUps: followUps.filter(
          (f) => f.status === "scheduled" && new Date(f.scheduledAt) < now
        ).length,
        nextFollowUp,
        leadAgeDays,
        currentStage: lead.status,
        lastActivity:
          activities.length > 0 ? activities[0].createdAt : null,
      };

      return {
        lead: {
          _id: lead._id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          mobile: lead.mobile,
          status: lead.status,
        },
        summary,
        activities,
        notes,
        followUps,
        visits,
        quotations,
      };
    });
  }

  /**
   * Add a structured property/site visit record for a lead.
   * Automatically creates a LeadActivity entry in the timeline.
   */
  async addVisit(leadId, data, actor) {
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const lead = await this.leadRepository.findByIdOrFail(leadId, "Lead");

      const visit = await this.leadVisitRepository.create({
        organizationId: actor.organizationId,
        branchId: lead.branchId,
        leadId: lead.id,
        visitDate: data.visitDate,
        visitTime: data.visitTime,
        projectId: data.projectId || null,
        propertiesShown: data.propertiesShown || [],
        projectsShown: data.projectsShown || [],
        salesExecutive: data.salesExecutive || actor.id,
        agentId: data.agentId || null,
        visitStatus: data.visitStatus || "scheduled",
        customerAttended: data.customerAttended || false,
        whoAttended: data.whoAttended,
        interestLevel: data.interestLevel && String(data.interestLevel).trim() ? String(data.interestLevel).trim() : null,
        customerFeedback: data.customerFeedback,
        likes: data.likes,
        dislikes: data.dislikes,
        objections: data.objections,
        competitorPropertyMentioned: data.competitorPropertyMentioned,
        nextAction: data.nextAction,
        followUpDate: data.followUpDate,
        numberOfPropertiesShown: (data.propertiesShown || []).length || data.numberOfPropertiesShown || 0,
        numberOfProjectsShown: (data.projectsShown || []).length || data.numberOfProjectsShown || 0,
        internalNotes: data.internalNotes,
        createdBy: actor.id,
      });

      // Auto-create follow-up if followUpDate is provided
      if (data.followUpDate) {
        await this.leadFollowUpRepository.create({
          organizationId: actor.organizationId,
          branchId: lead.branchId,
          leadId: lead.id,
          scheduledAt: data.followUpDate,
          type: "visit",
          notes: data.nextAction || `Follow-up after visit on ${new Date(data.visitDate).toDateString()}`,
          assignedTo: data.salesExecutive || actor.id,
          createdBy: actor.id,
        });
      }

      // Record in activity timeline
      await this.leadActivityRepository.create({
        organizationId: actor.organizationId,
        branchId: lead.branchId,
        leadId: lead.id,
        type: "property_visit",
        description: `Property/Site visit ${data.visitStatus || 'scheduled'} on ${new Date(data.visitDate).toDateString()}. Properties shown: ${(data.propertiesShown || []).length}. Interest: ${data.interestLevel || 'not specified'}.`,
        performedBy: actor.id,
        metadata: {
          visitId: visit._id,
          visitStatus: data.visitStatus,
          interestLevel: data.interestLevel,
          numberOfPropertiesShown: (data.propertiesShown || []).length,
          nextAction: data.nextAction,
        },
      });

      return visit;
    });
  }

  /**
   * Add a new quotation/rate record for a lead.
   * IMPORTANT: Always creates a NEW record — never overwrites historical quotations.
   */
  async addQuotation(leadId, data, actor) {
    return tenantContext.run({ organizationId: actor.organizationId, branchId: actor.branchId }, async () => {
      const lead = await this.leadRepository.findByIdOrFail(leadId, "Lead");

      // Auto-compute total estimated cost if not provided
      const totalEstimatedCost =
        data.totalEstimatedCost ||
        (data.quotedPrice || 0) +
        (data.otherCharges || 0) +
        (data.parkingCharges || 0) +
        (data.floorRise || 0) +
        (data.maintenance || 0) +
        (data.stampDutyEstimate || 0) +
        (data.registrationEstimate || 0);

      const quotation = await this.leadQuotationRepository.create({
        organizationId: actor.organizationId,
        branchId: lead.branchId,
        leadId: lead.id,
        projectId: data.projectId || null,
        propertyId: data.propertyId || null,
        quotedDate: data.quotedDate || new Date(),
        listPrice: data.listPrice,
        quotedPrice: data.quotedPrice,
        pricePerSqFt: data.pricePerSqFt,
        carpetArea: data.carpetArea,
        builtUpArea: data.builtUpArea,
        configuration: data.configuration,
        discount: data.discount || 0,
        discountAmount: data.discountAmount || 0,
        otherCharges: data.otherCharges || 0,
        parkingCharges: data.parkingCharges || 0,
        floorRise: data.floorRise || 0,
        maintenance: data.maintenance || 0,
        stampDutyEstimate: data.stampDutyEstimate || 0,
        registrationEstimate: data.registrationEstimate || 0,
        totalEstimatedCost,
        paymentPlan: data.paymentPlan,
        offerValidUntil: data.offerValidUntil,
        quotedBy: actor.id,
        customerInterest: data.customerInterest,
        customerFeedback: data.customerFeedback,
        notes: data.notes,
      });

      // Record in activity timeline
      const priceStr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact" }).format(data.quotedPrice);
      await this.leadActivityRepository.create({
        organizationId: actor.organizationId,
        branchId: lead.branchId,
        leadId: lead.id,
        type: "quotation",
        description: `Quotation given: ${priceStr}${data.discount ? ` (${data.discount}% discount, saving ₹${(data.discountAmount || 0).toLocaleString("en-IN")})` : ''}. Valid until: ${data.offerValidUntil ? new Date(data.offerValidUntil).toDateString() : 'Not specified'}.`,
        performedBy: actor.id,
        metadata: {
          quotationId: quotation._id,
          quotedPrice: data.quotedPrice,
          totalEstimatedCost,
        },
      });

      return quotation;
    });
  }
}

module.exports = { LeadService };
