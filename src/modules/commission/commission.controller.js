"use strict";

const { BaseController } = require("../../shared/base/BaseController");
const { CommissionService } = require("./commission.service");

class CommissionController extends BaseController {
  constructor(deps = {}) {
    super(deps);
    this.commissionService = deps.service || new CommissionService(deps);
  }

  async list(request, reply) {
    const query = request.query;
    const actor = this.getUser(request);
    const pagination = this.getPagination(query);

    const filter = { organizationId: actor.organizationId, isDeleted: false };

    if (actor.role === "agent") {
      const deals = await this.commissionService.dealRepository.model.find({
        $or: [
          { sourcingAgent: actor.id },
          { closingAgent: actor.id },
          { teamLeader: actor.id },
          { assignedTo: actor.id },
          { broker: actor.id },
        ],
        organizationId: actor.organizationId,
      }).select("_id");
      const dealIds = deals.map((d) => d._id);
      filter.dealId = { $in: dealIds };
    }

    const { data, pagination: pageInfo } =
      await this.commissionService.commissionRepository.paginate(
        filter,
        {
          ...pagination,
          populate: [{ path: "dealId", select: "dealNumber status sourcingAgent closingAgent teamLeader broker assignedTo" }],
        },
      );

    if (actor.role === "agent") {
      const sanitizedData = data.map((item) => {
        const doc = item.toObject ? item.toObject() : item;
        delete doc.totalCommissionExpected;
        delete doc.totalCommissionCollected;
        delete doc.totalCommissionOutstanding;
        delete doc.commissionPercentage;
        return doc;
      });
      return this.paginated(reply, sanitizedData, pageInfo);
    }

    return this.paginated(reply, data, pageInfo);
  }

  async getById(request, reply) {
    const commission = await this.commissionService.getCommissionById(
      request.params.id,
      this.getUser(request),
    );
    return this.ok(reply, commission);
  }

  async create(request, reply) {
    const commission = await this.commissionService.createCommission(
      request.body,
      this.getUser(request),
    );
    return this.created(reply, commission);
  }

  async createInvoice(request, reply) {
    const { slabId, ...invoiceData } = request.body;
    const invoice = await this.commissionService.createInvoice(
      request.params.id,
      slabId,
      invoiceData,
      this.getUser(request),
    );
    return this.ok(reply, invoice);
  }

  async recordCollection(request, reply) {
    const collection = await this.commissionService.recordCollection(
      request.params.invoiceId,
      request.body,
      this.getUser(request),
    );
    return this.ok(reply, collection);
  }

  async releasePayout(request, reply) {
    const payout = await this.commissionService.releaseAgentPayout(
      request.params.payoutId,
      this.getUser(request),
    );
    return this.ok(reply, payout);
  }

  async processClawback(request, reply) {
    const commission = await this.commissionService.processClawback(
      request.params.id,
      request.body,
      this.getUser(request),
    );
    return this.ok(reply, commission);
  }

  async transition(request, reply) {
    const { status } = request.body;
    const commission = await this.commissionService.transitionStage(
      request.params.id,
      status,
      this.getUser(request),
    );
    return this.ok(reply, commission);
  }

  async clearCollection(request, reply) {
    const collection = await this.commissionService.clearCollection(
      request.params.collectionId,
      this.getUser(request),
    );
    return this.ok(reply, collection);
  }

  async bounceCollection(request, reply) {
    const collection = await this.commissionService.bounceCollection(
      request.params.collectionId,
      this.getUser(request),
    );
    return this.ok(reply, collection);
  }
}

module.exports = { CommissionController };
