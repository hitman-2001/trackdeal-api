"use strict";

const { BaseService } = require("../../shared/base/BaseService");
const { LoanCaseRepository, BankMasterRepository, DsaMasterRepository } = require("./loan.repository");
const { NotFoundError, BusinessRuleError, ForbiddenError } = require("../../shared/errors");
const { AUDIT_ACTIONS } = require("../../shared/constants/app.constants");

const DEFAULT_LOAN_CHECKLIST = [
  { docKey: "pan", name: "PAN Card", category: "kyc", isRequired: true },
  { docKey: "aadhaar", name: "Aadhaar Card", category: "kyc", isRequired: true },
  { docKey: "photo", name: "Passport Size Photograph", category: "kyc", isRequired: true },
  { docKey: "salary_slips", name: "Latest 3 Months Salary Slips", category: "income", isRequired: true },
  { docKey: "bank_statements", name: "Latest 6 Months Bank Statements", category: "income", isRequired: true },
  { docKey: "form_16", name: "Form 16 / ITR (Past 2 Years)", category: "income", isRequired: true },
  { docKey: "property_agreement", name: "Agreement to Sale / Cost Sheet", category: "property", isRequired: true },
  { docKey: "title_docs", name: "Title Search / Building Approval Plan", category: "property", isRequired: false },
];

class LoanService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.loanCaseRepo = deps.loanCaseRepo || new LoanCaseRepository();
    this.bankMasterRepo = deps.bankMasterRepo || new BankMasterRepository();
    this.dsaMasterRepo = deps.dsaMasterRepo || new DsaMasterRepository();
  }

  /**
   * Helper to generate human-readable case number: LN-YYYY-XXXX
   */
  async _generateCaseNumber(orgId) {
    const count = await this.loanCaseRepo.model.countDocuments({ organizationId: orgId });
    const year = new Date().getFullYear();
    return `LN-${year}-${String(count + 1).padStart(5, "0")}`;
  }

  /**
   * 1. Automatic Loan Case creation triggered by Lead Creation
   */
  async autoCreateFromLead(lead, leadData = {}, actor) {
    if (!lead || !actor?.organizationId) return null;

    const orgId = actor.organizationId;
    const existing = await this.loanCaseRepo.model.findOne({
      organizationId: orgId,
      leadId: lead._id || lead.id,
      isDeleted: false,
    });
    if (existing) return existing;

    const caseNumber = await this._generateCaseNumber(orgId);
    const requiredAmount =
      Number(leadData.loanRequiredAmount || leadData.financialRequirement?.loanRequiredAmount || lead.budgetMax || 5000000);

    const initialDocs = DEFAULT_LOAN_CHECKLIST.map((doc) => ({
      ...doc,
      status: "pending",
    }));

    const loanCase = await this.loanCaseRepo.model.create({
      loanCaseNumber: caseNumber,
      organizationId: orgId,
      branchId: lead.branchId || actor.branchId || null,
      leadId: lead._id || lead.id,
      customerId: lead.convertedTo || lead.customerId || lead.customer || null,
      propertyId: lead.propertyId || null,
      assignedTo: lead.assignedTo || actor.id,
      loanType: leadData.loanType || "home_loan",
      requiredAmount,
      employmentType: leadData.employmentType || leadData.qualification?.employmentType || "salaried",
      monthlyIncome: Number(leadData.monthlyIncome || leadData.qualification?.monthlyIncome || 0),
      cibilScore: leadData.cibilScore || leadData.qualification?.cibilScore || "",
      preferredBank: leadData.preferredBank || leadData.financialRequirement?.preferredBank || "",
      alternativeBank: leadData.alternativeBank || "",
      notes: leadData.loanNotes || leadData.notes || "Auto-created from customer lead requirements.",
      stage: "new",
      status: "active",
      commissionTerms: {
        commissionPayableBy: "bank",
        payablePartyName: leadData.preferredBank || "Bank / DSA",
        commissionType: "percentage",
        commissionRate: 0.5,
        expectedAmount: Math.round((requiredAmount * 0.5) / 100),
        triggerEvent: "full_disbursement",
      },
      documents: initialDocs,
      timeline: [
        {
          event: "case_created",
          title: "Loan Case Created",
          description: `Loan case ${caseNumber} automatically initialized from Lead '${lead.firstName} ${lead.lastName || ""}' for ₹${Number(requiredAmount).toLocaleString("en-IN")}`,
          performedBy: actor.id,
          createdAt: new Date(),
        },
      ],
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: "LoanCase",
      entityId: loanCase._id,
      userId: actor.id,
      description: `Auto-created Loan Case ${caseNumber} from Lead`,
    });

    return loanCase;
  }

  /**
   * 2. Manual Loan Case creation
   */
  async createLoanCase(data, actor) {
    const orgId = actor.organizationId;
    if (!data.customerId) {
      throw new BusinessRuleError("Customer ID is required to create a loan case.", "CUSTOMER_REQUIRED");
    }
    if (!data.requiredAmount || Number(data.requiredAmount) <= 0) {
      throw new BusinessRuleError("A valid required loan amount is required.", "INVALID_LOAN_AMOUNT");
    }

    const caseNumber = await this._generateCaseNumber(orgId);
    const initialDocs = DEFAULT_LOAN_CHECKLIST.map((doc) => ({
      ...doc,
      status: "pending",
    }));

    const requiredAmount = Number(data.requiredAmount);
    const loanCase = await this.loanCaseRepo.model.create({
      loanCaseNumber: caseNumber,
      organizationId: orgId,
      branchId: data.branchId || actor.branchId || null,
      leadId: data.leadId || null,
      customerId: data.customerId,
      propertyId: data.propertyId || null,
      dealId: data.dealId || null,
      assignedTo: data.assignedTo || actor.id,
      loanType: data.loanType || "home_loan",
      requiredAmount,
      employmentType: data.employmentType || "salaried",
      monthlyIncome: Number(data.monthlyIncome || 0),
      annualIncome: Number(data.annualIncome || 0),
      cibilScore: data.cibilScore || "",
      preferredBank: data.preferredBank || "",
      alternativeBank: data.alternativeBank || "",
      notes: data.notes || "",
      stage: "new",
      status: "active",
      commissionTerms: {
        commissionPayableBy: data.commissionPayableBy || "bank",
        payablePartyName: data.preferredBank || "Bank / DSA",
        commissionType: "percentage",
        commissionRate: Number(data.commissionRate || 0.5),
        expectedAmount: Math.round((requiredAmount * (Number(data.commissionRate) || 0.5)) / 100),
        triggerEvent: "full_disbursement",
      },
      documents: initialDocs,
      timeline: [
        {
          event: "case_created",
          title: "Loan Case Created",
          description: `Loan case ${caseNumber} created for ₹${Number(requiredAmount).toLocaleString("en-IN")}`,
          performedBy: actor.id,
          createdAt: new Date(),
        },
      ],
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: "LoanCase",
      entityId: loanCase._id,
      userId: actor.id,
      description: `Created Loan Case ${caseNumber}`,
    });

    return this.getLoanCaseById(loanCase._id, actor);
  }

  /**
   * 3. Paginated Directory Query with Grouping & Search
   */
  async getLoanCases(query = {}, actor) {
    const orgId = actor.organizationId;
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = { organizationId: orgId, isDeleted: false };

    if (query.stage) {
      filter.stage = query.stage;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.assignedTo) {
      filter.assignedTo = query.assignedTo;
    }
    if (query.preferredBank) {
      filter.preferredBank = { $regex: new RegExp(query.preferredBank, "i") };
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      const { Customer } = require("../customer/customer.model");
      const matchedCustomers = await Customer.find({
        organizationId: orgId,
        $or: [
          { firstName: { $regex: s, $options: "i" } },
          { lastName: { $regex: s, $options: "i" } },
          { mobile: { $regex: s, $options: "i" } },
        ],
      }).select("_id");

      filter.$or = [
        { loanCaseNumber: { $regex: s, $options: "i" } },
        { preferredBank: { $regex: s, $options: "i" } },
        { customerId: { $in: matchedCustomers.map((c) => c._id) } },
      ];
    }

    const [cases, total] = await Promise.all([
      this.loanCaseRepo.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("customerId", "firstName lastName name mobile email phone")
        .populate("propertyId", "title price configuration location")
        .populate("leadId", "firstName lastName mobile stage score budgetMax")
        .populate("dealId", "dealNumber dealValue agreedPrice status")
        .populate("assignedTo", "firstName lastName email name")
        .lean(),
      this.loanCaseRepo.model.countDocuments(filter),
    ]);

    return {
      data: cases,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 4. Executive Summary KPIs & Pipeline Breakdown
   */
  async getLoanSummary(query = {}, actor) {
    const orgId = actor.organizationId;
    const allCases = await this.loanCaseRepo.model.find({ organizationId: orgId, isDeleted: false }).lean();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let activeCases = 0;
    let sanctionedCount = 0;
    let disbursedThisMonth = 0;
    let totalSanctionedAmount = 0;
    let totalDisbursedAmount = 0;
    let commissionReceivable = 0;
    let pendingDocumentsCount = 0;
    let rejectedCount = 0;

    const stageCounts = {
      new: 0,
      documents_pending: 0,
      documents_collected: 0,
      submitted_to_bank: 0,
      under_review: 0,
      login_completed: 0,
      query_raised: 0,
      query_resolved: 0,
      sanctioned: 0,
      disbursement_pending: 0,
      partially_disbursed: 0,
      fully_disbursed: 0,
      rejected: 0,
      cancelled: 0,
    };

    for (const c of allCases) {
      if (c.stage && stageCounts[c.stage] !== undefined) {
        stageCounts[c.stage]++;
      }

      if (!["fully_disbursed", "rejected", "cancelled", "closed"].includes(c.stage)) {
        activeCases++;
      }

      if (["sanctioned", "disbursement_pending", "partially_disbursed", "fully_disbursed"].includes(c.stage)) {
        sanctionedCount++;
        totalSanctionedAmount += Number(c.sanctionedAmount || c.sanctionDetails?.sanctionedAmount || 0);
      }

      totalDisbursedAmount += Number(c.disbursedAmount || 0);

      // Disbursed this month check
      for (const d of c.disbursements || []) {
        if (d.disbursementDate && new Date(d.disbursementDate) >= startOfMonth) {
          disbursedThisMonth += Number(d.amount || 0);
        }
      }

      if (c.stage === "documents_pending") {
        pendingDocumentsCount++;
      }
      if (c.stage === "rejected") {
        rejectedCount++;
      }

      // Calculate estimated loan commission receivable
      const commExpected = Number(c.commissionTerms?.expectedAmount || 0);
      if (["sanctioned", "partially_disbursed", "fully_disbursed"].includes(c.stage) && commExpected > 0) {
        commissionReceivable += commExpected;
      }
    }

    return {
      activeCases,
      sanctionedCount,
      disbursedThisMonth,
      totalSanctionedAmount,
      totalDisbursedAmount,
      commissionReceivable,
      pendingDocumentsCount,
      rejectedCount,
      totalCases: allCases.length,
      stageCounts,
    };
  }

  /**
   * 5. Detailed Loan 360° Profile
   */
  async getLoanCaseById(id, actor) {
    const loanCase = await this.loanCaseRepo.model
      .findById(id)
      .populate("customerId", "firstName lastName name mobile email phone pan aadhaar address occupation")
      .populate("propertyId", "title price configuration location carpetArea superBuiltUpArea builderName project")
      .populate("leadId", "firstName lastName mobile email stage score requirements buyerRequirement")
      .populate("dealId", "dealNumber dealValue agreedPrice status closingDate")
      .populate("assignedTo", "firstName lastName email name")
      .populate("documents.verifiedBy", "firstName lastName")
      .populate("queries.assignedTo", "firstName lastName")
      .populate("queries.resolvedBy", "firstName lastName")
      .populate("disbursements.recordedBy", "firstName lastName")
      .populate("timeline.performedBy", "firstName lastName")
      .lean();

    if (!loanCase || loanCase.isDeleted) {
      throw new NotFoundError("LoanCase", id);
    }
    if (loanCase.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError("Access to this loan case is restricted.");
    }

    return loanCase;
  }

  /**
   * 6. Submit Bank Application (Multi-Bank support)
   */
  async submitBankApplication(id, appData, actor) {
    const loanCase = await this.loanCaseRepo.model.findById(id);
    if (!loanCase || loanCase.isDeleted) throw new NotFoundError("LoanCase", id);
    if (loanCase.organizationId.toString() !== actor.organizationId.toString()) throw new ForbiddenError("Access denied");

    const newApp = {
      bankName: appData.bankName,
      bankBranch: appData.bankBranch || "",
      dsaName: appData.dsaName || "",
      dsaCompany: appData.dsaCompany || "",
      bankRmName: appData.bankRmName || "",
      bankRmPhone: appData.bankRmPhone || "",
      bankRmEmail: appData.bankRmEmail || "",
      appliedAmount: Number(appData.appliedAmount || loanCase.requiredAmount),
      applicationNumber: appData.applicationNumber || "",
      submittedDate: appData.submittedDate ? new Date(appData.submittedDate) : new Date(),
      stage: "submitted",
      statusRemarks: appData.statusRemarks || "",
    };

    loanCase.applications = loanCase.applications || [];
    loanCase.applications.push(newApp);

    if (["new", "documents_pending", "documents_collected"].includes(loanCase.stage)) {
      loanCase.stage = "submitted_to_bank";
    }

    loanCase.appliedAmount = Number(newApp.appliedAmount);
    loanCase.preferredBank = newApp.bankName;

    loanCase.timeline.push({
      event: "bank_submitted",
      title: "Application Submitted to Bank",
      description: `Loan application for ₹${Number(newApp.appliedAmount).toLocaleString("en-IN")} submitted to ${newApp.bankName}${newApp.dsaName ? ` via DSA '${newApp.dsaName}'` : ""}`,
      performedBy: actor.id,
      createdAt: new Date(),
    });

    await loanCase.save();
    return this.getLoanCaseById(id, actor);
  }

  /**
   * 7. Update Document Checklist Status
   */
  async updateDocument(id, docId, docUpdate, actor) {
    const loanCase = await this.loanCaseRepo.model.findById(id);
    if (!loanCase || loanCase.isDeleted) throw new NotFoundError("LoanCase", id);
    if (loanCase.organizationId.toString() !== actor.organizationId.toString()) throw new ForbiddenError("Access denied");

    const doc = loanCase.documents.id(docId);
    if (!doc) throw new NotFoundError("Document Checklist Item", docId);

    if (docUpdate.status) doc.status = docUpdate.status;
    if (docUpdate.documentUrl) doc.documentUrl = docUpdate.documentUrl;
    if (docUpdate.fileName) doc.fileName = docUpdate.fileName;
    if (docUpdate.remarks) doc.remarks = docUpdate.remarks;

    if (docUpdate.status === "verified") {
      doc.verifiedAt = new Date();
      doc.verifiedBy = actor.id;
    }

    // Check if all required docs are verified
    const requiredDocs = loanCase.documents.filter((d) => d.isRequired);
    const verifiedRequiredDocs = requiredDocs.filter((d) => d.status === "verified");

    if (requiredDocs.length > 0 && verifiedRequiredDocs.length === requiredDocs.length && loanCase.stage === "new") {
      loanCase.stage = "documents_collected";
    }

    loanCase.timeline.push({
      event: "document_updated",
      title: "Document Updated",
      description: `Document '${doc.name}' marked as '${doc.status}'`,
      performedBy: actor.id,
      createdAt: new Date(),
    });

    await loanCase.save();
    return this.getLoanCaseById(id, actor);
  }

  /**
   * 8. Bank Query Management
   */
  async addBankQuery(id, queryData, actor) {
    const loanCase = await this.loanCaseRepo.model.findById(id);
    if (!loanCase || loanCase.isDeleted) throw new NotFoundError("LoanCase", id);
    if (loanCase.organizationId.toString() !== actor.organizationId.toString()) throw new ForbiddenError("Access denied");

    const newQuery = {
      queryRaisedBy: queryData.queryRaisedBy || "Bank Credit Underwriter",
      bankName: queryData.bankName || loanCase.preferredBank || "Bank",
      queryDate: queryData.queryDate ? new Date(queryData.queryDate) : new Date(),
      queryDetails: queryData.queryDetails,
      requiredDocument: queryData.requiredDocument || "",
      assignedTo: queryData.assignedTo || actor.id,
      dueDate: queryData.dueDate ? new Date(queryData.dueDate) : new Date(Date.now() + 3 * 86400000),
      status: "open",
    };

    loanCase.queries = loanCase.queries || [];
    loanCase.queries.push(newQuery);
    loanCase.stage = "query_raised";

    loanCase.timeline.push({
      event: "query_raised",
      title: "Bank Query Raised",
      description: `Query raised by ${newQuery.bankName}: "${newQuery.queryDetails}"`,
      performedBy: actor.id,
      createdAt: new Date(),
    });

    await loanCase.save();
    return this.getLoanCaseById(id, actor);
  }

  async resolveBankQuery(id, queryId, resolutionData, actor) {
    const loanCase = await this.loanCaseRepo.model.findById(id);
    if (!loanCase || loanCase.isDeleted) throw new NotFoundError("LoanCase", id);
    if (loanCase.organizationId.toString() !== actor.organizationId.toString()) throw new ForbiddenError("Access denied");

    const q = loanCase.queries.id(queryId);
    if (!q) throw new NotFoundError("Bank Query", queryId);

    q.status = "resolved";
    q.resolution = resolutionData.resolution || "Resolved and submitted to bank";
    q.resolvedDate = new Date();
    q.resolvedBy = actor.id;

    // Check if any open queries remain
    const openQueries = loanCase.queries.filter((item) => item.status === "open" || item.status === "in_progress");
    if (openQueries.length === 0) {
      loanCase.stage = "query_resolved";
    }

    loanCase.timeline.push({
      event: "query_resolved",
      title: "Bank Query Resolved",
      description: `Bank query resolved: "${q.resolution}"`,
      performedBy: actor.id,
      createdAt: new Date(),
    });

    await loanCase.save();
    return this.getLoanCaseById(id, actor);
  }

  /**
   * 9. Record Sanction
   */
  async recordSanction(id, sanctionData, actor) {
    const loanCase = await this.loanCaseRepo.model.findById(id);
    if (!loanCase || loanCase.isDeleted) throw new NotFoundError("LoanCase", id);
    if (loanCase.organizationId.toString() !== actor.organizationId.toString()) throw new ForbiddenError("Access denied");

    const sanctionedAmount = Number(sanctionData.sanctionedAmount || 0);
    if (sanctionedAmount <= 0) {
      throw new BusinessRuleError("A valid positive sanction amount is required.", "INVALID_SANCTION_AMOUNT");
    }

    loanCase.sanctionDetails = {
      bankName: sanctionData.bankName || loanCase.preferredBank,
      sanctionDate: sanctionData.sanctionDate ? new Date(sanctionData.sanctionDate) : new Date(),
      sanctionLetterNumber: sanctionData.sanctionLetterNumber || "",
      appliedAmount: Number(sanctionData.appliedAmount || loanCase.appliedAmount || loanCase.requiredAmount),
      sanctionedAmount,
      interestRate: Number(sanctionData.interestRate || 8.5),
      tenureYears: Number(sanctionData.tenureYears || 20),
      emi: Number(sanctionData.emi || 0),
      processingFee: Number(sanctionData.processingFee || 0),
      validTill: sanctionData.validTill ? new Date(sanctionData.validTill) : null,
      remarks: sanctionData.remarks || "",
      documentUrl: sanctionData.documentUrl || "",
    };

    loanCase.sanctionedAmount = sanctionedAmount;
    loanCase.stage = "sanctioned";
    loanCase.status = "sanctioned";

    // Recalculate expected commission
    const commRate = Number(loanCase.commissionTerms?.commissionRate || 0.5);
    loanCase.commissionTerms.expectedAmount = Math.round((sanctionedAmount * commRate) / 100);
    loanCase.commissionTerms.payablePartyName = sanctionData.bankName || loanCase.preferredBank;

    loanCase.timeline.push({
      event: "loan_sanctioned",
      title: "Loan Sanctioned 🎉",
      description: `Loan of ₹${Number(sanctionedAmount).toLocaleString("en-IN")} sanctioned by ${loanCase.sanctionDetails.bankName} (Rate: ${loanCase.sanctionDetails.interestRate}%, Letter No: ${loanCase.sanctionDetails.sanctionLetterNumber || "N/A"})`,
      performedBy: actor.id,
      createdAt: new Date(),
    });

    await loanCase.save();
    return this.getLoanCaseById(id, actor);
  }

  /**
   * 10. Record Disbursement (Single or Multiple Tranches) & Auto-Trigger Commission
   */
  async recordDisbursement(id, disbursementData, actor) {
    const loanCase = await this.loanCaseRepo.model.findById(id);
    if (!loanCase || loanCase.isDeleted) throw new NotFoundError("LoanCase", id);
    if (loanCase.organizationId.toString() !== actor.organizationId.toString()) throw new ForbiddenError("Access denied");

    const amount = Number(disbursementData.amount || 0);
    if (amount <= 0) {
      throw new BusinessRuleError("Disbursement amount must be greater than zero.", "INVALID_DISBURSEMENT_AMOUNT");
    }

    const newTranche = {
      bankName: disbursementData.bankName || loanCase.sanctionDetails?.bankName || loanCase.preferredBank,
      disbursementDate: disbursementData.disbursementDate ? new Date(disbursementData.disbursementDate) : new Date(),
      amount,
      disbursementType: disbursementData.disbursementType || "partial",
      referenceNumber: disbursementData.referenceNumber || "",
      beneficiary: disbursementData.beneficiary || "",
      remarks: disbursementData.remarks || "",
      documentUrl: disbursementData.documentUrl || "",
      recordedBy: actor.id,
    };

    loanCase.disbursements = loanCase.disbursements || [];
    loanCase.disbursements.push(newTranche);

    // Sum total disbursed
    const totalDisbursed = loanCase.disbursements.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    loanCase.disbursedAmount = totalDisbursed;

    const sanctionTarget = Number(loanCase.sanctionedAmount || loanCase.requiredAmount);
    const isFull = totalDisbursed >= sanctionTarget && sanctionTarget > 0;

    if (isFull) {
      loanCase.stage = "fully_disbursed";
      loanCase.status = "disbursed";
    } else {
      loanCase.stage = "partially_disbursed";
      loanCase.status = "active";
    }

    loanCase.timeline.push({
      event: "disbursement_recorded",
      title: isFull ? "Loan Fully Disbursed 🎉" : "Disbursement Tranche Released",
      description: `Disbursement of ₹${Number(amount).toLocaleString("en-IN")} recorded via ${newTranche.bankName} (Ref: ${newTranche.referenceNumber || "N/A"}). Total Disbursed: ₹${Number(totalDisbursed).toLocaleString("en-IN")} / ₹${Number(sanctionTarget).toLocaleString("en-IN")}`,
      performedBy: actor.id,
      createdAt: new Date(),
    });

    await loanCase.save();

    // ── AUTOMATION: Bridge Loan Commission into unified Financials Ledger ──
    try {
      const { CommissionService } = require("../commission/commission.service");
      const commissionService = new CommissionService();

      const commRate = Number(loanCase.commissionTerms?.commissionRate || 0.5);
      const expectedComm = Math.round((totalDisbursed * commRate) / 100);

      const commPayload = {
        sourceType: "LOAN",
        loanCaseId: loanCase._id,
        payablePartyType: loanCase.commissionTerms?.payablePartyType || "bank",
        payablePartyName: newTranche.bankName || loanCase.commissionTerms?.payablePartyName || "Bank / DSA",
        commissionType: "percentage",
        commissionRate: commRate,
        expectedAmount: expectedComm,
        expectedPaymentDate: loanCase.commissionTerms?.expectedPaymentDate || new Date(Date.now() + 30 * 86400000),
        tdsPercentage: Number(loanCase.commissionTerms?.tdsPercentage || 5),
      };

      const commission = await commissionService.autoCreateFromLoan(loanCase._id, commPayload, actor);
      if (commission) {
        loanCase.commissionTerms.commissionId = commission._id;
        loanCase.commissionTerms.expectedAmount = expectedComm;
        await loanCase.save();
      }
    } catch (commErr) {
      console.warn("[LoanService] Notice auto-creating loan commission in financials:", commErr.message);
    }

    return this.getLoanCaseById(id, actor);
  }

  /**
   * 11. Add Generic Activity / Touchpoint
   */
  async addActivity(id, activityData, actor) {
    const loanCase = await this.loanCaseRepo.model.findById(id);
    if (!loanCase || loanCase.isDeleted) throw new NotFoundError("LoanCase", id);
    if (loanCase.organizationId.toString() !== actor.organizationId.toString()) throw new ForbiddenError("Access denied");

    loanCase.timeline.push({
      event: activityData.activityType || "touchpoint",
      title: activityData.title || "Loan Follow-up Logged",
      description: activityData.description || activityData.summary,
      performedBy: actor.id,
      createdAt: activityData.date ? new Date(activityData.date) : new Date(),
    });

    if (activityData.nextFollowupDate) {
      loanCase.nextFollowupDate = new Date(activityData.nextFollowupDate);
      loanCase.nextFollowupTime = activityData.nextFollowupTime || "";
      loanCase.nextFollowupNote = activityData.nextFollowupNote || "";
    }

    if (activityData.stage) {
      loanCase.stage = activityData.stage;
    }

    await loanCase.save();
    return this.getLoanCaseById(id, actor);
  }

  /**
   * 12. Bank & DSA Master Directories CRUD
   */
  async getBanks(actor) {
    return this.bankMasterRepo.model.find({ organizationId: actor.organizationId, isDeleted: false }).sort({ bankName: 1 }).lean();
  }

  async createBank(bankData, actor) {
    return this.bankMasterRepo.model.create({
      ...bankData,
      organizationId: actor.organizationId,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
  }

  async getDSAs(actor) {
    return this.dsaMasterRepo.model.find({ organizationId: actor.organizationId, isDeleted: false }).sort({ companyName: 1 }).lean();
  }

  async createDSA(dsaData, actor) {
    return this.dsaMasterRepo.model.create({
      ...dsaData,
      organizationId: actor.organizationId,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
  }
}

module.exports = { LoanService };
