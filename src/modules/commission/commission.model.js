"use strict";

const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// 1. Commission Model — Owner: Commission Module
// ---------------------------------------------------------------------------

const paymentRecordSchema = new mongoose.Schema(
  {
    paymentDate: { type: Date, default: Date.now, required: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["Bank Transfer", "Cheque", "UPI", "Cash", "NEFT", "RTGS", "IMPS", "Other", "bank_transfer", "cheque", "upi", "cash", "neft", "rtgs", "imps", "other"],
      default: "Bank Transfer",
    },
    referenceNumber: { type: String, trim: true }, // UTR / Cheque Ref / Transaction ID
    receivedFrom: { type: String, trim: true },
    bankAccount: { type: String, trim: true },
    tdsDeducted: { type: Boolean, default: false },
    tdsAmount: { type: Number, default: 0 },
    notes: { type: String, trim: true },
    receiptUrl: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const milestoneSchema = new mongoose.Schema(
  {
    milestoneName: { type: String, required: true, trim: true }, // e.g. Booking, Agreement, Registration, Possession
    expectedAmount: { type: Number, required: true, min: 0 },
    expectedDate: { type: Date },
    receivedAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["upcoming", "due", "partially_paid", "paid", "overdue"],
      default: "upcoming",
    },
  },
  { timestamps: true }
);

const documentSchema = new mongoose.Schema(
  {
    docType: { type: String, trim: true }, // Commission Agreement, Invoice, Payment Advice, Bank Receipt, Cheque Copy, TDS Certificate, Other
    fileName: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const commissionSchema = new mongoose.Schema(
  {
    commissionNumber: {
      type: String,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["PROPERTY_DEAL", "LOAN", "CHANNEL_PARTNER", "OTHER", "property_deal", "loan", "channel_partner", "other"],
      default: "PROPERTY_DEAL",
      index: true,
    },
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      required: false,
      default: null,
      index: true,
    },
    loanCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LoanCase",
      required: false,
      default: null,
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
      required: false,
      default: null,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      index: true,
    },
    unitNumber: {
      type: String,
      trim: true,
    },

    // Who owes and pays the commission
    payablePartyType: {
      type: String,
      enum: [
        "builder",
        "seller",
        "customer",
        "channel_partner",
        "broker",
        "bank",
        "dsa",
        "financial_institution",
        "other",
        "Builder / Developer",
        "Property Seller",
        "Customer / Buyer",
        "Channel Partner",
        "Broker",
        "Bank",
        "DSA",
        "Financial Institution",
        "Other",
      ],
      default: "builder",
      index: true,
    },
    payablePartyName: {
      type: String,
      trim: true,
    },
    payablePartyId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Valuation & Rate Calculation
    commissionType: {
      type: String,
      enum: ["percentage", "fixed", "slab", "other", "Percentage", "Fixed Amount", "Slab Based", "Other"],
      default: "percentage",
    },
    commissionRate: {
      type: Number,
      default: 2,
    },
    finalDealValue: {
      type: Number,
      default: 0,
    },
    expectedPaymentDate: {
      type: Date,
      index: true,
    },

    // Financial Balances
    totalCommissionExpected: {
      type: Number,
      required: true,
      default: 0,
    },
    totalCommissionCollected: {
      type: Number,
      default: 0,
    },
    totalCommissionOutstanding: {
      type: Number,
      default: 0,
    },
    tdsPercentage: {
      type: Number,
      default: 5,
    },
    tdsAmount: {
      type: Number,
      default: 0,
    },
    taxGstAmount: {
      type: Number,
      default: 0,
    },

    // Primary High-level Lifecycle Status
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partially_paid", "fully_paid", "overdue", "UNPAID", "PARTIALLY PAID", "FULLY PAID", "OVERDUE"],
      default: "unpaid",
      index: true,
    },
    status: {
      type: String,
      default: "eligible",
      index: true,
    },

    // Embedded Ledgers
    milestones: [milestoneSchema],
    payments: [paymentRecordSchema],
    documents: [documentSchema],

    paymentTerms: String,
    notes: String,
    remarks: String,
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Auto-generate commissionNumber serial (e.g. COM-2026-0001)
commissionSchema.pre("save", async function (next) {
  if (!this.commissionNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      organizationId: this.organizationId,
    });
    this.commissionNumber = `COM-${year}-${String(count + 1).padStart(4, "0")}`;
  }

  // Ensure balance outstanding is in sync
  const collected = (this.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  this.totalCommissionCollected = collected;
  this.totalCommissionOutstanding = Math.max(0, (this.totalCommissionExpected || 0) - collected);

  // Dynamic status computation
  const now = new Date();
  if (this.totalCommissionCollected >= this.totalCommissionExpected && this.totalCommissionExpected > 0) {
    this.paymentStatus = "fully_paid";
    this.status = "fully_collected";
  } else if (this.totalCommissionCollected > 0) {
    if (this.expectedPaymentDate && new Date(this.expectedPaymentDate) < now && this.totalCommissionOutstanding > 0) {
      this.paymentStatus = "overdue";
    } else {
      this.paymentStatus = "partially_paid";
    }
    this.status = "partially_collected";
  } else {
    if (this.expectedPaymentDate && new Date(this.expectedPaymentDate) < now && this.totalCommissionOutstanding > 0) {
      this.paymentStatus = "overdue";
    } else {
      this.paymentStatus = "unpaid";
    }
  }

  next();
});

// High-Performance unique deal lock per organization
commissionSchema.index(
  { organizationId: 1, dealId: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
    name: "unique_active_deal_commission",
  }
);
commissionSchema.index({ organizationId: 1, paymentStatus: 1 });
commissionSchema.index({ organizationId: 1, expectedPaymentDate: 1 });

// ---------------------------------------------------------------------------
// 2. Commission Slab Model — Owner: Commission Module
// ---------------------------------------------------------------------------

const commissionSlabSchema = new mongoose.Schema(
  {
    commissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commission",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    slabNumber: {
      type: Number,
      required: true,
    },
    milestoneName: {
      type: String,
      required: true,
    },
    percentage: {
      type: Number,
      required: true,
    },
    grossAmount: {
      type: Number,
      required: true,
    },
    balanceOutstanding: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["locked", "eligible", "invoiced", "partially_collected", "collected"],
      default: "locked",
      index: true,
    },
  },
  { timestamps: true }
);

// Composite unique slab key
commissionSlabSchema.index(
  { organizationId: 1, commissionId: 1, slabNumber: 1 },
  { unique: true, name: "unique_commission_slab" }
);

// ---------------------------------------------------------------------------
// 3. Commission Invoice Model — Owner: Commission Module
// ---------------------------------------------------------------------------

const commissionInvoiceSchema = new mongoose.Schema(
  {
    commissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commission",
      required: true,
      index: true,
    },
    slabId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommissionSlab",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      index: true,
    },
    grossAmount: {
      type: Number,
      required: true,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    tdsAmount: {
      type: Number,
      default: 0,
    },
    gstType: {
      type: String,
      enum: ["CGST_SGST", "IGST"],
      default: "CGST_SGST",
    },
    tdsPercentage: {
      type: Number,
      default: 5,
    },
    netReceivable: {
      type: Number,
      required: true,
    },
    balanceOutstanding: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["draft", "sent", "partially_paid", "paid", "cancelled"],
      default: "draft",
      index: true,
    },
    sentAt: Date,
    dueDate: Date,
  },
  { timestamps: true }
);

// Ensure invoice numbers are completely unique per organization
commissionInvoiceSchema.index(
  { organizationId: 1, invoiceNumber: 1 },
  { unique: true, sparse: true, name: "unique_tenant_invoice_number" }
);

// Pre-save auto generation hook for organization-unique invoice number serials
commissionInvoiceSchema.pre("save", async function (next) {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      organizationId: this.organizationId,
    });
    const prefix = this.organizationId.toString().slice(-4).toUpperCase();
    this.invoiceNumber = `INV-${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// ---------------------------------------------------------------------------
// 4. Commission Collection Model — Owner: Commission Module
// ---------------------------------------------------------------------------

const commissionCollectionSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommissionInvoice",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    amountCollected: {
      type: Number,
      required: true,
    },
    paymentMode: {
      type: String,
      enum: ["cheque", "wire", "upi", "cash", "draft"],
      required: true,
    },
    transactionReference: {
      type: String,
      required: true,
    },
    clearedAt: {
      type: Date,
    },
    bankEscrowAccount: String,
    deductions: {
      type: Number,
      default: 0,
    },
    adjustmentReasons: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "cleared", "bounced"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

commissionCollectionSchema.index({ organizationId: 1, invoiceId: 1 });
commissionCollectionSchema.index({ organizationId: 1, clearedAt: -1 });

// ---------------------------------------------------------------------------
// 5. Agent Payout Ledger Model — Owner: Commission Module
// ---------------------------------------------------------------------------

const agentPayoutLedgerSchema = new mongoose.Schema(
  {
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      required: true,
      index: true,
    },
    commissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commission",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["sourcing", "closing", "team_leader"],
      required: true,
    },
    payoutType: {
      type: String,
      enum: ["earning", "clawback"],
      default: "earning",
      index: true,
    },
    tdsPercentage: {
      type: Number,
      default: 5,
    },
    slabId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommissionSlab",
      index: true,
    },
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommissionCollection",
      index: true,
    },
    grossAmount: {
      type: Number,
      required: true,
    },
    tdsDeducted: {
      type: Number,
      default: 0,
    },
    netAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "released"],
      default: "pending",
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    releasedAt: Date,
  },
  { timestamps: true }
);

agentPayoutLedgerSchema.index({ organizationId: 1, agentId: 1, status: 1 });
agentPayoutLedgerSchema.index({ organizationId: 1, commissionId: 1 });
agentPayoutLedgerSchema.index({ organizationId: 1, slabId: 1 });
agentPayoutLedgerSchema.index({ organizationId: 1, collectionId: 1 });

// ---------------------------------------------------------------------------
// 6. Commission Stage History Model — Owner: Commission Module
// ---------------------------------------------------------------------------

const commissionStageHistorySchema = new mongoose.Schema(
  {
    commissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commission",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    previousStage: String,
    newStage: {
      type: String,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    durationInMinutes: Number,
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

commissionStageHistorySchema.index({ commissionId: 1, changedAt: -1 });

// Compile and export all models
const Commission = mongoose.model("Commission", commissionSchema);
const CommissionSlab = mongoose.model("CommissionSlab", commissionSlabSchema);
const CommissionInvoice = mongoose.model("CommissionInvoice", commissionInvoiceSchema);
const CommissionCollection = mongoose.model("CommissionCollection", commissionCollectionSchema);
const AgentPayoutLedger = mongoose.model("AgentPayoutLedger", agentPayoutLedgerSchema);
const CommissionStageHistory = mongoose.model("CommissionStageHistory", commissionStageHistorySchema);

module.exports = {
  Commission,
  CommissionSlab,
  CommissionInvoice,
  CommissionCollection,
  AgentPayoutLedger,
  CommissionStageHistory,
};
