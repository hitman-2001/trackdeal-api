"use strict";

const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// 1. Commission Model — Owner: Commission Module
// ---------------------------------------------------------------------------

const commissionSchema = new mongoose.Schema(
  {
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      required: true,
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
      required: false, // Optional: not required for INDIVIDUAL_AGENT / AGENCY tiers
      default: null,
      index: true,
    },
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
    commissionPercentage: {
      type: Number,
      default: 3,
    },
    status: {
      type: String,
      enum: [
        "eligible",
        "invoice_draft",
        "invoice_raised",
        "invoice_sent",
        "payment_expected",
        "partially_collected",
        "fully_collected",
        "payout_calculated",
        "payout_eligible",
        "payout_authorized",
        "payout_released",
        "closed",
        "cancelled",
        "clawed_back",
      ],
      default: "eligible",
      index: true,
    },
    notes: String,
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// High-Performance unique deal lock per organization
commissionSchema.index(
  { organizationId: 1, dealId: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
    name: "unique_active_deal_commission",
  }
);

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
