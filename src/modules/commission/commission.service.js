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
    const commission = await this.commissionRepository.model
      .findById(id)
      .populate("dealId", "dealNumber dealValue agreedPrice askingPrice status customer project property unit sourcingAgent closingAgent")
      .populate("customerId", "firstName lastName name email mobile phone")
      .populate("projectId", "name code location city")
      .populate("propertyId", "title propertyType configuration location")
      .populate("payments.recordedBy", "firstName lastName email")
      .lean();

    if (!commission || commission.isDeleted) {
      throw new NotFoundError("Commission", id);
    }
    if (commission.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError("Access to this commission is prohibited.");
    }
    // Strict agent visibility boundary
    if (actor.role === "agent") {
      const deal = commission.dealId;
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

  /**
   * 1. Executive Commission & Receivables Summary Metrics
   */
  async getCommissionSummary(query = {}, actor) {
    const orgId = actor.organizationId;
    const filter = { organizationId: orgId, isDeleted: false };

    if (actor.role === "agent") {
      const { Deal } = require("../deal/deal.model");
      const userDeals = await Deal.find({
        organizationId: orgId,
        $or: [
          { sourcingAgent: actor.id },
          { closingAgent: actor.id },
          { assignedTo: actor.id },
          { broker: actor.id },
        ],
      }).select("_id");
      filter.dealId = { $in: userDeals.map((d) => d._id) };
    }

    const commissions = await this.commissionRepository.model
      .find(filter)
      .populate("customerId", "firstName lastName name")
      .populate("projectId", "name")
      .populate("propertyId", "title")
      .lean();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let totalEarned = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let expectedThisMonth = 0;
    let fullyPaidCount = 0;
    let partiallyPaidCount = 0;
    let unpaidCount = 0;
    let overdueCount = 0;

    const aging = {
      notDue: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      days90Plus: 0,
    };

    const upcomingCollections = [];

    for (const comm of commissions) {
      const expected = Number(comm.totalCommissionExpected) || 0;
      const collected = (comm.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const outstanding = Math.max(0, expected - collected);
      const dueDate = comm.expectedPaymentDate ? new Date(comm.expectedPaymentDate) : null;
      const isPastDue = dueDate && dueDate < now && outstanding > 0;

      totalEarned += expected;
      totalCollected += collected;
      totalOutstanding += outstanding;

      if (isPastDue) {
        totalOverdue += outstanding;
        overdueCount++;
      }

      if (dueDate && dueDate >= startOfMonth && dueDate <= endOfMonth && outstanding > 0) {
        expectedThisMonth += outstanding;
      }

      if (collected >= expected && expected > 0) {
        fullyPaidCount++;
      } else if (collected > 0) {
        partiallyPaidCount++;
      } else {
        unpaidCount++;
      }

      // Aging calculation
      if (outstanding > 0) {
        if (!dueDate || dueDate >= now) {
          aging.notDue += outstanding;
        } else {
          const diffDays = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
          if (diffDays <= 30) aging.days1to30 += outstanding;
          else if (diffDays <= 60) aging.days31to60 += outstanding;
          else if (diffDays <= 90) aging.days61to90 += outstanding;
          else aging.days90Plus += outstanding;
        }

        if (dueDate && dueDate >= now) {
          upcomingCollections.push({
            id: comm._id,
            commissionNumber: comm.commissionNumber,
            payablePartyName: comm.payablePartyName || "Builder / Seller",
            payablePartyType: comm.payablePartyType || "builder",
            customerName: comm.customerId?.name || `${comm.customerId?.firstName || ""} ${comm.customerId?.lastName || ""}`.trim() || "Customer",
            projectName: comm.projectId?.name || comm.propertyId?.title || "Property",
            amount: outstanding,
            dueDate: comm.expectedPaymentDate,
          });
        }
      }
    }

    upcomingCollections.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const collectionRate = totalEarned > 0 ? Number(((totalCollected / totalEarned) * 100).toFixed(1)) : 0;

    return {
      totalEarned,
      totalCollected,
      totalOutstanding,
      totalOverdue,
      expectedThisMonth,
      fullyPaidCount,
      partiallyPaidCount,
      unpaidCount,
      overdueCount,
      totalDeals: commissions.length,
      collectionRate,
      aging,
      upcomingCollections: upcomingCollections.slice(0, 6),
    };
  }

  /**
   * 2. Filterable Commissions List
   */
  async getCommissionsList(query = {}, actor) {
    const orgId = actor.organizationId;
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 15));
    const skip = (page - 1) * limit;

    const filter = { organizationId: orgId, isDeleted: false };

    if (actor.role === "agent") {
      const { Deal } = require("../deal/deal.model");
      const userDeals = await Deal.find({
        organizationId: orgId,
        $or: [
          { sourcingAgent: actor.id },
          { closingAgent: actor.id },
          { assignedTo: actor.id },
          { broker: actor.id },
        ],
      }).select("_id");
      filter.dealId = { $in: userDeals.map((d) => d._id) };
    }

    if (query.paymentStatus) {
      filter.paymentStatus = query.paymentStatus.toLowerCase();
    }
    if (query.payablePartyType) {
      filter.payablePartyType = query.payablePartyType;
    }
    if (query.search) {
      const regex = new RegExp(query.search.trim(), "i");
      filter.$or = [
        { commissionNumber: regex },
        { payablePartyName: regex },
        { unitNumber: regex },
        { paymentTerms: regex },
      ];
    }

    const [total, items] = await Promise.all([
      this.commissionRepository.model.countDocuments(filter),
      this.commissionRepository.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("dealId", "dealNumber dealValue agreedPrice status")
        .populate("customerId", "firstName lastName name email mobile phone")
        .populate("projectId", "name location city")
        .populate("propertyId", "title propertyType configuration")
        .lean(),
    ]);

    // Recalculate dynamic payment status & balances for presentation
    const now = new Date();
    const formatted = items.map((comm) => {
      const expected = Number(comm.totalCommissionExpected) || 0;
      const collected = (comm.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const outstanding = Math.max(0, expected - collected);
      const dueDate = comm.expectedPaymentDate ? new Date(comm.expectedPaymentDate) : null;

      let paymentStatus = "unpaid";
      if (collected >= expected && expected > 0) {
        paymentStatus = "fully_paid";
      } else if (collected > 0) {
        paymentStatus = dueDate && dueDate < now && outstanding > 0 ? "overdue" : "partially_paid";
      } else {
        paymentStatus = dueDate && dueDate < now && outstanding > 0 ? "overdue" : "unpaid";
      }

      return {
        ...comm,
        totalCommissionCollected: collected,
        totalCommissionOutstanding: outstanding,
        paymentStatus,
        lastPayment: comm.payments && comm.payments.length > 0 ? comm.payments[comm.payments.length - 1] : null,
      };
    });

    return {
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 3. Record Payment against a Commission
   */
  async recordPayment(commissionId, paymentData, actor) {
    const commission = await this.commissionRepository.model.findById(commissionId);
    if (!commission || commission.isDeleted) {
      throw new NotFoundError("Commission", commissionId);
    }
    if (commission.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError("Access denied.");
    }

    const amount = Number(paymentData.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new BusinessRuleError("Payment amount must be greater than zero.", "INVALID_AMOUNT");
    }

    const newPayment = {
      paymentDate: paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date(),
      amount,
      paymentMethod: paymentData.paymentMethod || "Bank Transfer",
      referenceNumber: paymentData.referenceNumber || paymentData.transactionRef || "",
      receivedFrom: paymentData.receivedFrom || commission.payablePartyName || "",
      bankAccount: paymentData.bankAccount || "",
      tdsDeducted: !!paymentData.tdsDeducted,
      tdsAmount: Number(paymentData.tdsAmount) || 0,
      notes: paymentData.notes || "",
      receiptUrl: paymentData.receiptUrl || "",
      recordedBy: actor.id,
    };

    commission.payments = commission.payments || [];
    commission.payments.push(newPayment);

    // Recalculate totals
    const totalCollected = commission.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    commission.totalCommissionCollected = totalCollected;
    commission.totalCommissionOutstanding = Math.max(0, (commission.totalCommissionExpected || 0) - totalCollected);

    const now = new Date();
    if (commission.totalCommissionCollected >= commission.totalCommissionExpected && commission.totalCommissionExpected > 0) {
      commission.paymentStatus = "fully_paid";
      commission.status = "fully_collected";
    } else if (commission.totalCommissionCollected > 0) {
      if (commission.expectedPaymentDate && new Date(commission.expectedPaymentDate) < now && commission.totalCommissionOutstanding > 0) {
        commission.paymentStatus = "overdue";
      } else {
        commission.paymentStatus = "partially_paid";
      }
      commission.status = "partially_collected";
    }

    await commission.save();

    await this.logAudit({
      action: AUDIT_ACTIONS.PAYMENT || "PAYMENT_RECORDED",
      entity: "Commission",
      entityId: commission._id,
      userId: actor.id,
      description: `Recorded payment of ₹${amount} (${newPayment.paymentMethod}) for Commission ${commission.commissionNumber || commission._id}`,
    });

    return this.getCommissionById(commissionId, actor);
  }

  /**
   * 4. Automatic Commission Creation from Deal Closure
   */
  async autoCreateFromDeal(dealId, commissionData = {}, actor) {
    const { Deal } = require("../deal/deal.model");
    const deal = await Deal.findById(dealId)
      .populate("customer")
      .populate("project")
      .populate("property");

    if (!deal) throw new NotFoundError("Deal", dealId);

    const finalDealValue = Number(deal.agreedPrice || deal.dealValue || deal.askingPrice || 0);
    const commissionRate = Number(commissionData.commissionRate || deal.commissionPercentage || 2);
    const commissionType = commissionData.commissionType || "percentage";
    
    let expectedAmount = 0;
    if (commissionType === "percentage" || commissionType === "Percentage") {
      expectedAmount = Number(commissionData.expectedAmount) || (finalDealValue * (commissionRate / 100));
    } else {
      expectedAmount = Number(commissionData.expectedAmount) || (deal.commissionAmount || 0);
    }

    let payablePartyType = commissionData.payablePartyType || "builder";
    let payablePartyName = commissionData.payablePartyName || (deal.project?.builderName || deal.project?.name || "Developer");

    // Upsert or create Commission record
    let commission = await this.commissionRepository.model.findOne({ dealId, isDeleted: false });
    if (!commission) {
      commission = new this.commissionRepository.model({
        dealId,
        organizationId: actor.organizationId,
        branchId: deal.branchId || null,
        customerId: deal.customer?._id || deal.customer,
        propertyId: deal.property?._id || deal.property || null,
        projectId: deal.project?._id || deal.project || null,
        unitNumber: deal.unit?.unitNumber || commissionData.unitNumber || "",
        payablePartyType,
        payablePartyName,
        payablePartyId: commissionData.payablePartyId || null,
        commissionType,
        commissionRate,
        finalDealValue,
        expectedPaymentDate: commissionData.expectedPaymentDate ? new Date(commissionData.expectedPaymentDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalCommissionExpected: expectedAmount,
        totalCommissionCollected: 0,
        totalCommissionOutstanding: expectedAmount,
        tdsPercentage: Number(commissionData.tdsPercentage) || 5,
        paymentTerms: commissionData.paymentTerms || "Standard Net 30 Days",
        remarks: commissionData.remarks || "",
        createdBy: actor.id,
      });

      // Default Milestones (Booking 30%, Agreement 30%, Registration 30%, Possession 10%)
      commission.milestones = [
        { milestoneName: "Booking Confirmation", expectedAmount: expectedAmount * 0.3, expectedDate: new Date(Date.now() + 7 * 86400000), status: "upcoming" },
        { milestoneName: "Agreement Execution", expectedAmount: expectedAmount * 0.3, expectedDate: new Date(Date.now() + 30 * 86400000), status: "upcoming" },
        { milestoneName: "Registration", expectedAmount: expectedAmount * 0.3, expectedDate: new Date(Date.now() + 60 * 86400000), status: "upcoming" },
        { milestoneName: "Handover / Possession", expectedAmount: expectedAmount * 0.1, expectedDate: new Date(Date.now() + 90 * 86400000), status: "upcoming" },
      ];
    } else {
      commission.finalDealValue = finalDealValue;
      commission.totalCommissionExpected = expectedAmount;
      commission.commissionRate = commissionRate;
      commission.payablePartyType = payablePartyType;
      commission.payablePartyName = payablePartyName;
      if (commissionData.expectedPaymentDate) {
        commission.expectedPaymentDate = new Date(commissionData.expectedPaymentDate);
      }
    }

    await commission.save();
    return commission;
  }

  /**
   * 4b. Automatic Commission Creation from Loan Disbursement
   */
  async autoCreateFromLoan(loanCaseId, commissionData = {}, actor) {
    const { LoanCase } = require("../loan/loan-case.model");
    const loanCase = await LoanCase.findById(loanCaseId)
      .populate("customerId")
      .populate("propertyId")
      .populate("dealId");

    if (!loanCase) throw new NotFoundError("LoanCase", loanCaseId);

    const totalDisbursed = Number(loanCase.disbursedAmount || loanCase.sanctionedAmount || loanCase.requiredAmount || 0);
    const commissionRate = Number(commissionData.commissionRate || loanCase.commissionTerms?.commissionRate || 0.5);
    const expectedAmount = Number(commissionData.expectedAmount) || Math.round((totalDisbursed * commissionRate) / 100);

    const payablePartyType = commissionData.payablePartyType || loanCase.commissionTerms?.payablePartyType || "bank";
    const payablePartyName = commissionData.payablePartyName || loanCase.sanctionDetails?.bankName || loanCase.preferredBank || "Bank / DSA";

    let commission = await this.commissionRepository.model.findOne({
      loanCaseId: loanCase._id,
      organizationId: actor.organizationId,
      isDeleted: false,
    });

    if (!commission) {
      const count = await this.commissionRepository.model.countDocuments({ organizationId: actor.organizationId });
      const year = new Date().getFullYear();
      const commissionNumber = `COM-${year}-${String(count + 1).padStart(4, "0")}`;

      commission = new this.commissionRepository.model({
        commissionNumber,
        sourceType: "LOAN",
        loanCaseId: loanCase._id,
        dealId: loanCase.dealId?._id || null,
        organizationId: actor.organizationId,
        branchId: loanCase.branchId || null,
        customerId: loanCase.customerId?._id || null,
        propertyId: loanCase.propertyId?._id || null,
        unitNumber: loanCase.propertyId?.title || "",
        payablePartyType,
        payablePartyName,
        commissionType: "percentage",
        commissionRate,
        finalDealValue: totalDisbursed,
        totalCommissionExpected: expectedAmount,
        totalCommissionCollected: 0,
        totalCommissionOutstanding: expectedAmount,
        paymentStatus: "unpaid",
        status: "eligible",
        expectedPaymentDate: commissionData.expectedPaymentDate ? new Date(commissionData.expectedPaymentDate) : new Date(Date.now() + 30 * 86400000),
        tdsPercentage: Number(commissionData.tdsPercentage || 5),
        milestones: [
          {
            milestoneName: "Loan Disbursement Settlement",
            expectedAmount,
            expectedDate: new Date(Date.now() + 30 * 86400000),
            status: "upcoming",
          },
        ],
      });
    } else {
      commission.finalDealValue = totalDisbursed;
      commission.totalCommissionExpected = expectedAmount;
      commission.totalCommissionOutstanding = Math.max(0, expectedAmount - (commission.totalCommissionCollected || 0));
      commission.commissionRate = commissionRate;
      commission.payablePartyType = payablePartyType;
      commission.payablePartyName = payablePartyName;
    }

    await commission.save();
    return commission;
  }

  /**
   * 5. Receivables Ledger: Grouped by Paying Party with Aging
   */
  async getReceivablesLedger(query = {}, actor) {
    const orgId = actor.organizationId;
    const filter = { organizationId: orgId, isDeleted: false, totalCommissionOutstanding: { $gt: 0 } };

    if (actor.role === "agent") {
      const { Deal } = require("../deal/deal.model");
      const userDeals = await Deal.find({
        organizationId: orgId,
        $or: [
          { sourcingAgent: actor.id },
          { closingAgent: actor.id },
          { assignedTo: actor.id },
          { broker: actor.id },
        ],
      }).select("_id");
      filter.dealId = { $in: userDeals.map((d) => d._id) };
    }

    const items = await this.commissionRepository.model
      .find(filter)
      .populate("dealId", "dealNumber dealValue agreedPrice status")
      .populate("customerId", "firstName lastName name email mobile")
      .populate("projectId", "name location")
      .populate("propertyId", "title")
      .sort({ expectedPaymentDate: 1 })
      .lean();

    const now = new Date();
    // Group by paying party
    const partyMap = {};

    for (const comm of items) {
      const partyKey = comm.payablePartyName || "Builder / Developer";
      if (!partyMap[partyKey]) {
        partyMap[partyKey] = {
          payablePartyName: partyKey,
          payablePartyType: comm.payablePartyType || "builder",
          totalExpected: 0,
          totalCollected: 0,
          totalOutstanding: 0,
          totalOverdue: 0,
          dealsCount: 0,
          deals: [],
        };
      }

      const expected = Number(comm.totalCommissionExpected) || 0;
      const collected = (comm.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const outstanding = Math.max(0, expected - collected);
      const dueDate = comm.expectedPaymentDate ? new Date(comm.expectedPaymentDate) : null;
      const isPastDue = dueDate && dueDate < now;

      partyMap[partyKey].totalExpected += expected;
      partyMap[partyKey].totalCollected += collected;
      partyMap[partyKey].totalOutstanding += outstanding;
      if (isPastDue) partyMap[partyKey].totalOverdue += outstanding;
      partyMap[partyKey].dealsCount++;

      partyMap[partyKey].deals.push({
        id: comm._id,
        commissionNumber: comm.commissionNumber,
        customerName: comm.customerId?.name || `${comm.customerId?.firstName || ""} ${comm.customerId?.lastName || ""}`.trim(),
        projectOrProperty: comm.projectId?.name || comm.propertyId?.title || "Property Unit",
        dealValue: comm.finalDealValue || comm.dealId?.dealValue || 0,
        expected,
        collected,
        outstanding,
        dueDate: comm.expectedPaymentDate,
        isPastDue,
        paymentStatus: isPastDue ? "overdue" : (collected > 0 ? "partially_paid" : "unpaid"),
      });
    }

    return Object.values(partyMap);
  }

  async createCommission(data, actor) {
    return this.autoCreateFromDeal(data.dealId, data, actor);
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
