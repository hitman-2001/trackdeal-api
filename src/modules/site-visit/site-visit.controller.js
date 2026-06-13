"use strict";

const { BaseController } = require("../../shared/base/BaseController");
const { SiteVisitService } = require("./site-visit.service");

class SiteVisitController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.siteVisitService = deps.service || new SiteVisitService(deps);
  }
  async list(req, reply) {
    const { data, pagination } = await this.siteVisitService.listVisits(
      { ...req.query, ...this.getPagination(req.query) },
      this.getUser(req),
    );
    return this.paginated(reply, data, pagination);
  }
  async getById(req, reply) {
    return this.ok(
      reply,
      await this.siteVisitRepository?.findByIdOrFail(
        req.params.id,
        "SiteVisit",
      ),
    );
  }
  async schedule(req, reply) {
    return this.created(
      reply,
      await this.siteVisitService.scheduleVisit(req.body, this.getUser(req)),
    );
  }
  async complete(req, reply) {
    return this.ok(
      reply,
      await this.siteVisitService.completeVisit(
        req.params.id,
        req.body,
        this.getUser(req),
      ),
    );
  }
  async cancel(req, reply) {
    return this.ok(
      reply,
      await this.siteVisitService.cancelVisit(
        req.params.id,
        req.body.reason,
        this.getUser(req),
      ),
    );
  }
  async calendar(req, reply) {
    return this.ok(
      reply,
      await this.siteVisitService.getCalendar(
        req.query.agentId || this.getUserId(req),
        req.query.startDate,
        req.query.endDate,
      ),
    );
  }
}

module.exports = { SiteVisitController };
