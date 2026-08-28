"use strict";

const mongoose = require("mongoose");

const documentChecklistItemSchema = new mongoose.Schema(
  {
    docKey: { type: String, required: true, trim: true }, // e.g. pan, aadhaar, salary_slips, bank_statements, form_16, itr, property_agreement
    name: { type: String, required: true, trim: true }, // e.g. "PAN Card"
    category: { type: String, enum: ["kyc", "income", "property", "other"], default: "kyc" },
    isRequired: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["pending", "received", "verified", "rejected"],
      default: "pending",
    },
    documentUrl: { type: String, trim: true },
    fileName: { type: String, trim: true },
    remarks: { type: String, trim: true },
    verifiedAt: { type: Date },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const bankApplicationSchema = new mongoose.Schema(
  {
    bankName: { type: String, required: true, trim: true },
    bankBranch: { type: String, trim: true },
    dsaName: { type: String, trim: true },
    dsaCompany: { type: String, trim: true },
    bankRmName: { type: String, trim: true },
    bankRmPhone: { type: String, trim: true },
    bankRmEmail: { type: String, trim: true },
    appliedAmount: { type: Number, required: true, min: 0 },
    applicationNumber: { type: String, trim: true },
    submittedDate: { type: Date, default: Date.now },
    stage: {
      type: String,
      enum: [
        "submitted",
        "login_completed",
        "under_review",
        "query_raised",
        "sanctioned",
        "rejected",
        "withdrawn",
      ],
      default: "submitted",
    },
    statusRemarks: { type: String, trim: true },
  },
  { timestamps: true }
);

const bankQuerySchema = new mongoose.Schema(
  {
    queryRaisedBy: { type: String, trim: true }, // e.g. "HDFC Credit Manager"
    bankName: { type: String, required: true, trim: true },
    queryDate: { type: Date, default: Date.now },
    queryDetails: { type: String, required: true, trim: true },
    requiredDocument: { type: String, trim: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    resolution: { type: String, trim: true },
    resolvedDate: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const disbursementTrancheSchema = new mongoose.Schema(
  {
    bankName: { type: String, required: true, trim: true },
    disbursementDate: { type: Date, default: Date.now },
    amount: { type: Number, required: true, min: 1 },
    disbursementType: {
      type: String,
      enum: ["full", "partial", "tranche", "Full", "Partial", "Tranche"],
      default: "partial",
    },
    referenceNumber: { type: String, trim: true }, // UTR / Cheque Ref
    beneficiary: { type: String, trim: true }, // e.g. "Godrej Properties Escrow"
    remarks: { type: String, trim: true },
    documentUrl: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const loanTimelineItemSchema = new mongoose.Schema(
  {
    event: { type: String, required: true },
    title: { type: String, trim: true },
    description: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const loanCaseSchema = new mongoose.Schema(
  {
    loanCaseNumber: {
      type: String,
      unique: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      index: true,
    },
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // Loan Specifications
    loanType: {
      type: String,
      enum: [
        "home_loan",
        "lap",
        "commercial_property_loan",
        "plot_loan",
        "balance_transfer",
        "top_up",
        "other",
      ],
      default: "home_loan",
      index: true,
    },
    requiredAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    appliedAmount: {
      type: Number,
      default: 0,
    },
    sanctionedAmount: {
      type: Number,
      default: 0,
    },
    disbursedAmount: {
      type: Number,
      default: 0,
    },

    // Applicant Profile
    employmentType: {
      type: String,
      enum: [
        "salaried",
        "self_employed_business",
        "self_employed_professional",
        "nri",
        "other",
      ],
      default: "salaried",
    },
    monthlyIncome: { type: Number, default: 0 },
    annualIncome: { type: Number, default: 0 },
    existingEmi: { type: Number, default: 0 },
    cibilScore: { type: String, trim: true },
    preferredBank: { type: String, trim: true },
    alternativeBank: { type: String, trim: true },
    notes: { type: String, trim: true },

    // Primary Lifecycle Pipeline Stage
    stage: {
      type: String,
      enum: [
        "new",
        "documents_pending",
        "documents_collected",
        "submitted_to_bank",
        "under_review",
        "login_completed",
        "query_raised",
        "query_resolved",
        "sanctioned",
        "disbursement_pending",
        "partially_disbursed",
        "fully_disbursed",
        "rejected",
        "cancelled",
      ],
      default: "new",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "sanctioned", "disbursed", "rejected", "cancelled", "closed"],
      default: "active",
      index: true,
    },

    // Sanction Details
    sanctionDetails: {
      bankName: { type: String, trim: true },
      sanctionDate: { type: Date },
      sanctionLetterNumber: { type: String, trim: true },
      appliedAmount: { type: Number, default: 0 },
      sanctionedAmount: { type: Number, default: 0 },
      interestRate: { type: Number, default: 8.5 },
      tenureYears: { type: Number, default: 20 },
      emi: { type: Number, default: 0 },
      processingFee: { type: Number, default: 0 },
      validTill: { type: Date },
      remarks: { type: String, trim: true },
      documentUrl: { type: String, trim: true },
    },

    // Commission Terms for Loan
    commissionTerms: {
      commissionPayableBy: {
        type: String,
        enum: ["bank", "dsa", "financial_institution", "other"],
        default: "bank",
      },
      payablePartyType: { type: String, default: "bank" },
      payablePartyName: { type: String, trim: true },
      commissionType: {
        type: String,
        enum: ["percentage", "fixed", "other"],
        default: "percentage",
      },
      commissionRate: { type: Number, default: 0.5 }, // e.g. 0.5% of disbursed amount
      fixedCommission: { type: Number, default: 0 },
      tdsPercentage: { type: Number, default: 5 },
      expectedAmount: { type: Number, default: 0 },
      expectedPaymentDate: { type: Date },
      triggerEvent: {
        type: String,
        enum: ["full_disbursement", "first_disbursement", "sanction", "manual"],
        default: "full_disbursement",
      },
      commissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Commission" },
    },

    // Embedded Submissions & Checklist
    documents: [documentChecklistItemSchema],
    applications: [bankApplicationSchema],
    queries: [bankQuerySchema],
    disbursements: [disbursementTrancheSchema],
    timeline: [loanTimelineItemSchema],

    nextFollowupDate: { type: Date, index: true },
    nextFollowupTime: { type: String, trim: true },
    nextFollowupNote: { type: String, trim: true },

    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

loanCaseSchema.index({ organizationId: 1, stage: 1, isDeleted: 1 });
loanCaseSchema.index({ organizationId: 1, customerId: 1 });
loanCaseSchema.index({ organizationId: 1, leadId: 1 });

const LoanCase = mongoose.model("LoanCase", loanCaseSchema);

module.exports = { LoanCase };
