"use strict";

const { BaseService } = require("../../shared/base/BaseService");
const { SiteVisitRepository } = require("./site-visit.repository");
const { BusinessRuleError } = require("../../shared/errors");
const {
  AUDIT_ACTIONS,
  EVENTS,
} = require("../../shared/constants/app.constants");

class SiteVisitService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.siteVisitRepository =
      deps.siteVisitRepository || new SiteVisitRepository();
  }

  async listVisits(query, actor) {
    const filter = { isDeleted: false };
    if (query.agentId) filter.agent = query.agentId;
    if (query.status) filter.status = query.status;
    return this.siteVisitRepository.paginate(filter, {
      page: query.page,
      limit: query.limit,
      sort: { scheduledAt: 1 },
    });
  }

  async scheduleVisit(data, actor) {
    const start = new Date(data.scheduledAt);
    const targetAgent = data.agent || actor.id;

    // 1. Overlapping Agent Visit Safeguard (59 mins buffer)
    const startWindow = new Date(start.getTime() - 59 * 60 * 1000);
    const endWindow = new Date(start.getTime() + 59 * 60 * 1000);

    const overlapExists = await this.siteVisitRepository.exists({
      agent: targetAgent,
      status: 'scheduled',
      isDeleted: false,
      scheduledAt: { $gte: startWindow, $lte: endWindow }
    });

    if (overlapExists) {
      throw new BusinessRuleError('Agent already has a site visit scheduled during this time window.', 'AGENT_OVERLAP_VISIT');
    }

    const visit = await this.siteVisitRepository.create({
      ...data,
      agent: targetAgent,
      createdBy: actor.id,
    });

    // Recalculate Lead Score if lead reference exists
    if (visit.lead) {
      const { LeadService } = require('../lead/lead.service');
      const leadService = new LeadService();
      await leadService.recalculateLeadScore(visit.lead);
    }

    await this.publishEvent(EVENTS.VISIT_SCHEDULED, { visitId: visit.id });
    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: "SiteVisit",
      entityId: visit.id,
      userId: actor.id,
    });
    return visit;
  }

  async completeVisit(id, completionData, actor) {
    const visit = await this.siteVisitRepository.findByIdOrFail(
      id,
      "SiteVisit",
    );
    if (visit.status !== "scheduled") {
      throw new BusinessRuleError(
        "Only scheduled visits can be completed",
        "VISIT_NOT_SCHEDULED",
      );
    }

    // Validation check: feedback and remarks
    if (!completionData || !completionData.feedback) {
      throw new BusinessRuleError("Completion feedback is required to complete a visit", "FEEDBACK_REQUIRED");
    }
    const { rating, remarks } = completionData.feedback;
    if (!rating || rating < 1 || rating > 5) {
      throw new BusinessRuleError("Rating between 1 and 5 is required to complete a visit", "RATING_INVALID");
    }
    if (!remarks || remarks.trim().length < 10) {
      throw new BusinessRuleError("Completion remarks of at least 10 characters are required", "REMARKS_REQUIRED");
    }

    const updated = await this.siteVisitRepository.update(id, {
      status: "completed",
      completedAt: new Date(),
      feedback: completionData.feedback,
      outcome: completionData.outcome,
      followUpDate: completionData.followUpDate,
      updatedBy: actor.id,
    });

    // Recalculate Lead Score
    if (visit.lead) {
      const { LeadService } = require('../lead/lead.service');
      const leadService = new LeadService();
      await leadService.recalculateLeadScore(visit.lead);
    }

    await this.publishEvent(EVENTS.VISIT_COMPLETED, {
      visitId: id,
      outcome: completionData.outcome,
    });
    return updated;
  }

  async cancelVisit(id, reason, actor) {
    const visit = await this.siteVisitRepository.findByIdOrFail(
      id,
      "SiteVisit",
    );
    if (visit.status === "completed") {
      throw new BusinessRuleError(
        "Completed visits cannot be cancelled",
        "VISIT_ALREADY_COMPLETED",
      );
    }

    // Validation check: cancellation reason
    if (!reason || !reason.trim()) {
      throw new BusinessRuleError("Cancellation reason is required to cancel a visit", "CANCELLATION_REASON_REQUIRED");
    }

    const updated = await this.siteVisitRepository.update(id, {
      status: "cancelled",
      cancellationReason: reason,
      cancelledAt: new Date(),
      updatedBy: actor.id,
    });

    // Recalculate Lead Score
    if (visit.lead) {
      const { LeadService } = require('../lead/lead.service');
      const leadService = new LeadService();
      await leadService.recalculateLeadScore(visit.lead);
    }

    await this.publishEvent(EVENTS.VISIT_CANCELLED, { visitId: id });
    return updated;
  }

  async getCalendar(agentId, startDate, endDate) {
    return this.siteVisitRepository.findUpcoming(
      agentId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}

module.exports = { SiteVisitService };
