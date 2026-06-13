"use strict";

const { BaseService } = require("../../shared/base/BaseService");
const { tenantContext } = require("../../shared/context/tenant-context");
const {
  CommissionRepository,
  CommissionSlabRepository,
  CommissionInvoiceRepository,
  CommissionCollectionRepository,
  AgentPayoutLedgerRepository,
  CommissionStageHistoryRepository,
} = require("./commission.repository");
const { DealRepository } = require("../deal/deal.repository");
const { UserRepository } = require("../user/user.repository");
const {
  NotFoundError,
  BusinessRuleError,
  ForbiddenError,
} = require("../../shared/errors");
const {
  AUDIT_ACTIONS,
  EVENTS,
} = require("../../shared/constants/app.constants");

class CommissionService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.commissionRepository =
      deps.commissionRepository || new CommissionRepository();
    this.commissionSlabRepository =
      deps.commissionSlabRepository || new CommissionSlabRepository();
    this.commissionInvoiceRepository =
      deps.commissionInvoiceRepository || new CommissionInvoiceRepository();
    this.commissionCollectionRepository =
      deps.commissionCollectionRepository ||
      new CommissionCollectionRepository();
    this.agentPayoutLedgerRepository =
      deps.agentPayoutLedgerRepository || new AgentPayoutLedgerRepository();
    this.commissionStageHistoryRepository =
      deps.commissionStageHistoryRepository ||
      new CommissionStageHistoryRepository();
    this.dealRepository = deps.dealRepository || new DealRepository();
    this.userRepository = deps.userRepository || new UserRepository();
  }

  async getCommissionById(id, actor) {
    const commission = await this.commissionRepository.findByIdOrFail(
      id,
      "Commission",
    );
    if (
      commission.organizationId.toString() !== actor.organizationId.toString()
    ) {
      throw new ForbiddenError("Access to this commission is prohibited.");
    }
    // Strict agent visibility boundary
    if (actor.role === "agent") {
      const deal = await this.dealRepository.model.findById(commission.dealId);
      const isParticipant =
        deal &&
        (deal.sourcingAgent?.toString() === actor.id.toString() ||
          deal.closingAgent?.toString() === actor.id.toString() ||
          deal.teamLeader?.toString() === actor.id.toString() ||
          deal.assignedTo?.toString() === actor.id.toString() ||
          deal.broker?.toString() === actor.id.toString());
      if (!isParticipant) {
        throw new ForbiddenError("Access to this commission is prohibited.");
      }
    }
    return commission;
  }

  async createCommission(data, actor) {
    const organizationId = actor.organizationId;

    // Validate Deal exists under organization boundaries
    const deal = await this.dealRepository.findByIdOrFail(data.dealId, "Deal");
    if (deal.organizationId.toString() !== organizationId.toString()) {
      throw new ForbiddenError("Deal belongs to a different organization.");
    }

    // Prevent duplicate active parent commission profiles
    const existing = await this.commissionRepository.findOne({
      dealId: data.dealId,
      isDeleted: false,
    });
    if (existing) {
      throw new BusinessRuleError(
        "An active commission profile already exists for this deal.",
        "COMMISSION_EXISTS",
      );
    }

    const commission = await this.commissionRepository.create({
      dealId: data.dealId,
      organizationId,
      branchId: deal.branchId,
      totalCommissionExpected: data.totalCommissionExpected,
      commissionPercentage: data.commissionPercentage || 3,
      totalCommissionCollected: 0,
      totalCommissionOutstanding: data.totalCommissionExpected,
      status: "eligible",
      notes: data.notes,
    });

    // Auto-seed the 4 default RERA-standard milestones (30%, 30%, 30%, 10%)
    const milestones = [
      { name: "Agreement Executed", pct: 30, num: 1 },
      { name: "Plinth Construction Slabs", pct: 30, num: 2 },
      { name: "Registration Completed", pct: 30, num: 3 },
      { name: "Handover & Possession", pct: 10, num: 4 },
    ];

    for (const m of milestones) {
      const grossAmount = commission.totalCommissionExpected * (m.pct / 100);
      await this.commissionSlabRepository.create({
        commissionId: commission.id,
        organizationId,
        slabNumber: m.num,
        milestoneName: m.name,
        percentage: m.pct,
        grossAmount,
        balanceOutstanding: grossAmount,
        status: "locked",
      });
    }

    // Log initial eligible stage history
    await this.commissionStageHistoryRepository.create({
      organizationId,
      commissionId: commission.id,
      newStage: "eligible",
      changedBy: actor.id,
      durationInMinutes: 0,
    });

    await this.publishEvent(EVENTS.COMMISSION_CREATED || "commission.created", {
      commissionId: commission.id,
    });
    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: "Commission",
      entityId: commission.id,
      userId: actor.id,
      description: `Commission profile created for Deal ID '${deal.id}' expected ₹${commission.totalCommissionExpected}`,
    });

    return commission;
  }

  async createInvoice(commissionId, slabId, invoiceData, actor) {
    const commission = await this.getCommissionById(commissionId, actor);

    if (["closed", "cancelled"].includes(commission.status)) {
      throw new BusinessRuleError(
        "Cannot raise invoice on a closed or cancelled commission profile.",
        "COMMISSION_LOCKED",
      );
    }

    const slab = await this.commissionSlabRepository.findByIdOrFail(
      slabId,
      "CommissionSlab",
    );
    if (slab.commissionId.toString() !== commissionId.toString()) {
      throw new BusinessRuleError(
        "Milestone slab does not belong to this commission profile.",
        "SLAB_MISMATCH",
      );
    }

    if (slab.status === "collected") {
      throw new BusinessRuleError(
        "Invoices cannot be generated on already collected milestones.",
        "SLAB_COLLECTED",
      );
    }

    // Query associated Deal, Branch, and Project or Property for GST Location Determination
    const deal = await this.dealRepository.model.findById(commission.dealId)
      .populate("branchId")
      .populate("project")
      .populate("property");

    let branchState = deal?.branchId?.address?.state || "";
    let dealState = "";

    if (deal?.project) {
      dealState = deal.project.state || deal.project.city || "";
    } else if (deal?.property) {
      dealState = deal.property.state || "";
    }

    branchState = branchState.trim().toLowerCase();
    dealState = dealState.trim().toLowerCase();

    let gstType = "CGST_SGST";
    if (branchState && dealState && branchState !== dealState) {
      gstType = "IGST";
    }

    const determinedGstType = invoiceData.gstType || gstType;
    const tdsPercentage = invoiceData.tdsPercentage !== undefined ? invoiceData.tdsPercentage : 5;

    const grossAmount = slab.grossAmount;
    const gstAmount = grossAmount * 0.18;
    const tdsAmount = grossAmount * (tdsPercentage / 100);
    const netReceivable = grossAmount + gstAmount - tdsAmount;

    const invoice = await this.commissionInvoiceRepository.create({
      commissionId,
      slabId,
      organizationId: actor.organizationId,
      grossAmount,
      gstAmount,
      gstType: determinedGstType,
      tdsAmount,
      tdsPercentage,
      netReceivable,
      balanceOutstanding: netReceivable,
      status: invoiceData.status || "draft",
      sentAt: invoiceData.sentAt ? new Date(invoiceData.sentAt) : null,
      dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
    });

    // Update slab status to invoiced
    await this.commissionSlabRepository.update(slabId, {
      status: "invoiced",
      updatedBy: actor.id,
    });

    // Transition commission status to raised/sent
    const newStage =
      invoice.status === "sent" ? "invoice_sent" : "invoice_raised";
    await this.transitionStage(commissionId, newStage, actor);

    return invoice;
  }

  async recordCollection(invoiceId, collectionData, actor) {
    const invoice = await this.commissionInvoiceRepository.findByIdOrFail(
      invoiceId,
      "CommissionInvoice",
    );
    if (invoice.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError("Access to this invoice is prohibited.");
    }

    if (["paid", "partially_paid"].includes(invoice.status) && invoice.balanceOutstanding <= 0) {
      throw new BusinessRuleError(
        "This invoice has already been fully paid and collected.",
        "INVOICE_ALREADY_PAID",
      );
    }

    const clearedAt = collectionData.clearedAt
      ? new Date(collectionData.clearedAt)
      : null;

    const collectionStatus = collectionData.status || "pending";

    const collection = await this.commissionCollectionRepository.create({
      invoiceId,
      organizationId: actor.organizationId,
      amountCollected: collectionData.amountCollected,
      paymentMode: collectionData.paymentMode,
      transactionReference: collectionData.transactionReference,
      clearedAt: collectionStatus === "cleared" ? (clearedAt || new Date()) : null,
      bankEscrowAccount: collectionData.bankEscrowAccount,
      deductions: collectionData.deductions || 0,
      adjustmentReasons: collectionData.adjustmentReasons || "",
      status: collectionStatus,
    });

    // Underpayment reconciliation outstanding calculations
    const amountCollected = collection.amountCollected !== undefined && collection.amountCollected !== null
      ? collection.amountCollected
      : collectionData.amountCollected;
    const deductions = collection.deductions !== undefined && collection.deductions !== null
      ? collection.deductions
      : (collectionData.deductions || 0);
    const totalPaid = amountCollected + deductions;
    const currentInvoiceOutstanding = (invoice.balanceOutstanding !== undefined && invoice.balanceOutstanding !== null)
      ? invoice.balanceOutstanding
      : invoice.netReceivable;
    const newInvoiceOutstanding = Math.max(0, currentInvoiceOutstanding - totalPaid);
    
    const invoiceStatus = newInvoiceOutstanding <= 0 ? "paid" : "partially_paid";

    await this.commissionInvoiceRepository.update(invoiceId, {
      balanceOutstanding: newInvoiceOutstanding,
      status: invoiceStatus,
      updatedBy: actor.id,
    });

    // Update slab outstanding
    const slab = await this.commissionSlabRepository.findByIdOrFail(
      invoice.slabId,
      "CommissionSlab",
    );
    const prevSlabOutstanding = (slab.balanceOutstanding !== undefined && slab.balanceOutstanding !== null)
      ? slab.balanceOutstanding
      : slab.grossAmount;
    const proportionalGross = (totalPaid / invoice.netReceivable) * slab.grossAmount;
    const newSlabOutstanding = Math.max(0, prevSlabOutstanding - proportionalGross);
    const slabStatus = newSlabOutstanding <= 0 ? "collected" : "partially_collected";

    await this.commissionSlabRepository.update(invoice.slabId, {
      balanceOutstanding: newSlabOutstanding,
      status: slabStatus,
      updatedBy: actor.id,
    });

    const commission = await this.getCommissionById(
      invoice.commissionId,
      actor,
    );
    const prevCollected = commission.totalCommissionCollected || 0;
    const totalCollected = prevCollected + amountCollected;
    const prevOutstanding = commission.totalCommissionOutstanding !== undefined && commission.totalCommissionOutstanding !== null
      ? commission.totalCommissionOutstanding
      : (commission.totalCommissionExpected || 0);
    const outstanding = Math.max(0, prevOutstanding - totalPaid);

    const isFullyCollected = outstanding <= 0;
    const newStage = isFullyCollected
      ? "fully_collected"
      : "partially_collected";

    await this.commissionRepository.update(commission.id, {
      totalCommissionCollected: totalCollected,
      totalCommissionOutstanding: outstanding,
      status: newStage,
      updatedBy: actor.id,
    });

    // Write stage transition history
    await this.transitionStage(commission.id, newStage, actor);

    // Splits are ONLY calculated and logged if status is transitioned to 'cleared'
    if (collectionStatus === "cleared") {
      await this.calculateAndCreatePayoutSplits(collection, actor, collectionData);
      await this.transitionStage(commission.id, "payout_calculated", actor);
    }

    return collection;
  }

  async calculateAndCreatePayoutSplits(collection, actor, collectionData = null) {
    const invoice = await this.commissionInvoiceRepository.findByIdOrFail(
      collection.invoiceId,
      "CommissionInvoice",
    );
    const commission = await this.getCommissionById(
      invoice.commissionId,
      actor,
    );
    const deal = await this.dealRepository.findByIdOrFail(
      commission.dealId,
      "Deal",
    );

    // Apply Referral exclusions first
    const grossBase = (collection.amountCollected !== undefined && collection.amountCollected !== null && !isNaN(collection.amountCollected))
      ? collection.amountCollected
      : (collectionData && collectionData.amountCollected !== undefined ? collectionData.amountCollected : 0);
    const referralShare = deal.referralShare || 0;
    const referralType = deal.referralType || "percentage";

    let referralDeduction = 0;
    if (referralType === "percentage") {
      referralDeduction = grossBase * (referralShare / 100);
    } else {
      referralDeduction = Math.min(grossBase, referralShare);
    }

    const netDistributableBase = Math.max(0, grossBase - referralDeduction);

    // Sourcing splits (30% Sourcing Split, check custom TDS percentage override or default 5%)
    if (deal.sourcingAgent) {
      const grossSplit = netDistributableBase * 0.3;
      const agentUser = await tenantContext.run({ isSystemOverride: true }, () =>
        this.userRepository.findOne({ _id: deal.sourcingAgent })
      );
      const agentTdsPercentage = agentUser && agentUser.tdsPercentage !== undefined ? agentUser.tdsPercentage : 5;
      const tds = grossSplit * (agentTdsPercentage / 100);
      const net = grossSplit - tds;

      await this.agentPayoutLedgerRepository.create({
        dealId: deal.id,
        commissionId: commission.id,
        slabId: invoice.slabId,
        collectionId: collection.id,
        organizationId: actor.organizationId,
        agentId: deal.sourcingAgent,
        role: "sourcing",
        payoutType: "earning",
        grossAmount: grossSplit,
        tdsPercentage: agentTdsPercentage,
        tdsDeducted: tds,
        netAmount: net,
        status: "pending",
        createdBy: actor.id,
      });
    }

    // Closing splits (10% Closing Split, check custom TDS percentage override or default 5%)
    const closingAgentId = deal.closingAgent || deal.broker;
    if (closingAgentId) {
      const grossSplit = netDistributableBase * 0.1;
      const agentUser = await tenantContext.run({ isSystemOverride: true }, () =>
        this.userRepository.findOne({ _id: closingAgentId })
      );
      const agentTdsPercentage = agentUser && agentUser.tdsPercentage !== undefined ? agentUser.tdsPercentage : 5;
      const tds = grossSplit * (agentTdsPercentage / 100);
      const net = grossSplit - tds;

      await this.agentPayoutLedgerRepository.create({
        dealId: deal.id,
        commissionId: commission.id,
        slabId: invoice.slabId,
        collectionId: collection.id,
        organizationId: actor.organizationId,
        agentId: closingAgentId,
        role: "closing",
        payoutType: "earning",
        grossAmount: grossSplit,
        tdsPercentage: agentTdsPercentage,
        tdsDeducted: tds,
        netAmount: net,
        status: "pending",
        createdBy: actor.id,
      });
    }

    // Team Leader Override (2% Split override, check custom TDS percentage override or default 5%)
    if (deal.teamLeader) {
      const grossSplit = netDistributableBase * 0.02;
      const agentUser = await tenantContext.run({ isSystemOverride: true }, () =>
        this.userRepository.findOne({ _id: deal.teamLeader })
      );
      const agentTdsPercentage = agentUser && agentUser.tdsPercentage !== undefined ? agentUser.tdsPercentage : 5;
      const tds = grossSplit * (agentTdsPercentage / 100);
      const net = grossSplit - tds;

      await this.agentPayoutLedgerRepository.create({
        dealId: deal.id,
        commissionId: commission.id,
        slabId: invoice.slabId,
        collectionId: collection.id,
        organizationId: actor.organizationId,
        agentId: deal.teamLeader,
        role: "team_leader",
        payoutType: "earning",
        grossAmount: grossSplit,
        tdsPercentage: agentTdsPercentage,
        tdsDeducted: tds,
        netAmount: net,
        status: "pending",
        createdBy: actor.id,
      });
    }
  }

  async clearCollection(collectionId, actor) {
    const collection = await this.commissionCollectionRepository.findByIdOrFail(
      collectionId,
      "CommissionCollection",
    );
    if (collection.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError("Access to this collection is prohibited.");
    }

    if (collection.status !== "pending") {
      throw new BusinessRuleError(
        "Only pending collections can be cleared.",
        "COLLECTION_NOT_PENDING",
      );
    }

    // Update status to cleared
    const updated = await this.commissionCollectionRepository.update(collectionId, {
      status: "cleared",
      clearedAt: new Date(),
      updatedBy: actor.id,
    });

    // Compute splits
    await this.calculateAndCreatePayoutSplits(updated, actor);

    // Re-transition parent commission to payout_calculated
    const invoice = await this.commissionInvoiceRepository.findByIdOrFail(
      collection.invoiceId,
      "CommissionInvoice",
    );
    await this.transitionStage(invoice.commissionId, "payout_calculated", actor);

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: "CommissionCollection",
      entityId: collectionId,
      userId: actor.id,
      description: `Banking collection ID '${collectionId}' cleared successfully. Splits distributed.`,
    });

    return updated;
  }

  async bounceCollection(collectionId, actor) {
    const collection = await this.commissionCollectionRepository.findByIdOrFail(
      collectionId,
      "CommissionCollection",
    );
    if (collection.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError("Access to this collection is prohibited.");
    }

    if (collection.status !== "pending") {
      throw new BusinessRuleError(
        "Only pending collections can be marked as bounced.",
        "COLLECTION_NOT_PENDING",
      );
    }

    // Update status to bounced
    const updated = await this.commissionCollectionRepository.update(collectionId, {
      status: "bounced",
      updatedBy: actor.id,
    });

    // Rollback outstanding balances
    const invoice = await this.commissionInvoiceRepository.findByIdOrFail(
      collection.invoiceId,
      "CommissionInvoice",
    );
    const slab = await this.commissionSlabRepository.findByIdOrFail(
      invoice.slabId,
      "CommissionSlab",
    );
    const commission = await this.getCommissionById(
      invoice.commissionId,
      actor,
    );

    const totalBounced = collection.amountCollected + (collection.deductions || 0);

    // Rollback invoice
    const newInvoiceBalance = (invoice.balanceOutstanding || 0) + totalBounced;
    await this.commissionInvoiceRepository.update(invoice.id, {
      balanceOutstanding: newInvoiceBalance,
      status: "sent", // restore status to sent
      updatedBy: actor.id,
    });

    // Rollback slab
    const proportionalGross = (totalBounced / invoice.netReceivable) * slab.grossAmount;
    const newSlabBalance = (slab.balanceOutstanding || 0) + proportionalGross;
    await this.commissionSlabRepository.update(slab.id, {
      balanceOutstanding: newSlabBalance,
      status: "invoiced", // restore status to invoiced
      updatedBy: actor.id,
    });

    // Rollback commission
    const newCommissionCollected = Math.max(0, commission.totalCommissionCollected - collection.amountCollected);
    const newCommissionOutstanding = commission.totalCommissionOutstanding + totalBounced;
    
    await this.commissionRepository.update(commission.id, {
      totalCommissionCollected: newCommissionCollected,
      totalCommissionOutstanding: newCommissionOutstanding,
      status: "invoice_sent",
      updatedBy: actor.id,
    });

    await this.transitionStage(commission.id, "invoice_sent", actor);

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: "CommissionCollection",
      entityId: collectionId,
      userId: actor.id,
      description: `Banking collection ID '${collectionId}' marked as bounced. Outstanding balances rolled back.`,
    });

    return updated;
  }

  async releaseAgentPayout(payoutId, actor) {
    // Escrow split release auth gated strictly to org admins or super admins
    const authorized = ["org_admin", "super_admin"].includes(actor.role);
    if (!authorized) {
      throw new ForbiddenError(
        "Only corporate administrators or finance controllers are authorized to release payouts.",
      );
    }

    const payout = await this.agentPayoutLedgerRepository.findByIdOrFail(
      payoutId,
      "AgentPayoutLedger",
    );
    if (payout.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError("Access to this payout entry is prohibited.");
    }

    if (payout.status === "released") {
      throw new BusinessRuleError(
        "This split commission has already been released.",
        "PAYOUT_ALREADY_RELEASED",
      );
    }

    const updated = await this.agentPayoutLedgerRepository.update(payoutId, {
      status: "released",
      approvedBy: actor.id,
      releasedAt: new Date(),
    });

    // Check if all ledger payouts for this parent commission are released
    const { data: allPayouts } =
      await this.agentPayoutLedgerRepository.paginate(
        {
          commissionId: payout.commissionId,
          payoutType: "earning",
        },
        { limit: 1000 },
      );

    const allReleased = (allPayouts || []).every(
      (p) => p.status === "released",
    );
    if (allReleased) {
      await this.transitionStage(payout.commissionId, "payout_released", actor);
    }

    return updated;
  }

  async processClawback(commissionId, clawbackData, actor) {
    const commission = await this.getCommissionById(commissionId, actor);

    if (actor.role === "agent") {
      throw new ForbiddenError("Agents are not authorized to perform clawback reversals.");
    }

    const query = {
      commissionId,
      status: "released",
      payoutType: "earning",
    };

    if (clawbackData?.slabId) {
      query.slabId = clawbackData.slabId;
    }

    // Fetch released split commission disbursements
    const { data: releasedPayouts } =
      await this.agentPayoutLedgerRepository.paginate(
        query,
        { limit: 1000 },
      );

    if (!releasedPayouts || releasedPayouts.length === 0) {
      throw new BusinessRuleError(
        "No released commission payouts found to perform clawback reversals.",
        "NO_PAYOUTS_TO_CLAWBACK",
      );
    }

    const clawbackAmount = clawbackData?.clawbackAmount;
    let totalReleasedGross = 0;
    if (clawbackAmount) {
      totalReleasedGross = releasedPayouts.reduce((sum, p) => sum + p.grossAmount, 0);
    }

    // Generate double-entry negative reversal payout ledger entries
    for (const p of releasedPayouts) {
      let grossRev = p.grossAmount;
      let tdsRev = p.tdsDeducted;
      let netRev = p.netAmount;

      if (clawbackAmount && totalReleasedGross > 0) {
        const ratio = clawbackAmount / totalReleasedGross;
        grossRev = p.grossAmount * ratio;
        tdsRev = p.tdsDeducted * ratio;
        netRev = p.netAmount * ratio;
      }

      await this.agentPayoutLedgerRepository.create({
        dealId: p.dealId,
        commissionId: p.commissionId,
        slabId: p.slabId,
        collectionId: p.collectionId,
        organizationId: actor.organizationId,
        agentId: p.agentId,
        role: p.role,
        payoutType: "clawback",
        grossAmount: -grossRev,
        tdsPercentage: p.tdsPercentage || 5,
        tdsDeducted: -tdsRev,
        netAmount: -netRev,
        status: "released", // Clawbacks are cleared instantly
        approvedBy: actor.id,
        releasedAt: new Date(),
      });
    }

    // Transition commission stage to clawed_back
    const updated = await this.transitionStage(
      commissionId,
      "clawed_back",
      actor,
    );

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Commission",
      entityId: commissionId,
      userId: actor.id,
      description: `Reversal clawback executed successfully on Commission ID '${commissionId}' reversing agent splits`,
    });

    return updated;
  }

  async transitionStage(id, newStatus, actor) {
    const commission = await this.getCommissionById(id, actor);

    if (commission.status === newStatus) {
      return commission;
    }

    const latestHistory = await this.commissionStageHistoryRepository.findOne(
      { commissionId: id },
      { sort: { changedAt: -1 } },
    );
    const durationInMinutes = latestHistory
      ? Math.round((Date.now() - latestHistory.changedAt.getTime()) / 60000)
      : 0;

    await this.commissionStageHistoryRepository.create({
      organizationId: actor.organizationId,
      commissionId: id,
      previousStage: commission.status,
      newStage: newStatus,
      changedBy: actor.id,
      durationInMinutes,
    });

    const updated = await this.commissionRepository.update(id, {
      status: newStatus,
      updatedBy: actor.id,
    });

    await this.publishEvent("commission.stage_changed", {
      commissionId: id,
      status: newStatus,
    });

    return updated;
  }
}

module.exports = { CommissionService };
