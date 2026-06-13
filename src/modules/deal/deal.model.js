"use strict";

const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// 1. Master Deal Model — Owner: Deal Module
// ---------------------------------------------------------------------------

const timelineSchema = new mongoose.Schema(
  {
    event: { type: String, required: true },
    description: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    metadata: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const dealSchema = new mongoose.Schema(
  {
    dealNumber: { type: String, unique: true }, // Auto-generated: DEAL-2024-001

    // SaaS Multi-tenancy & Isolation
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

    // Core references
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    broker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // Creator
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    }, // Current active agent
    sourcingAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // Sourced lead agent
    closingAgent: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Specialist who closed the deal
    teamLeader: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, // Manager-level user (MANAGER or BRANCH_MANAGER role)
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Sourced Inventory
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property" }, // Resale support

    // Related visits
    siteVisit: { type: mongoose.Schema.Types.ObjectId, ref: "SiteVisit" },

    // Financials
    askingPrice: { type: Number, required: true },
    agreedPrice: Number,
    dealValue: Number, // Final agreed deal value

    // Commissions Splits
    commissionPercentage: Number,
    commissionAmount: Number,
    referralShare: { type: Number, default: 0 },
    referralType: { type: String, enum: ["percentage", "flat"], default: "percentage" },
    splits: {
      sourcingAgentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      sourcingAgentPercentage: Number,
      sourcingAgentAmount: Number,
      sourcingAgentTds: Number,
      sourcingAgentNet: Number,
      closingAgentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      closingAgentPercentage: Number,
      closingAgentAmount: Number,
      closingAgentTds: Number,
      closingAgentNet: Number,
      teamLeaderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      teamLeaderPercentage: Number,
      teamLeaderAmount: Number,
      teamLeaderTds: Number,
      teamLeaderNet: Number,
      companyShare: Number,
    },

    // Status (Approved Lifecycle)
    status: {
      type: String,
      enum: [
        "draft",
        "token_received",
        "token_bounced",
        "booking_initiated",
        "booking_confirmed",
        "agreement_executed",
        "registration_completed",
        "loan_disputed",
        "commission_eligible",
        "invoice_raised",
        "commission_received",
        "deal_closed",
        "booking_defaulted",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },

    // Timeline events
    timeline: [timelineSchema],

    // Closure
    closedAt: Date,
    closureNotes: String,

    // Cancellation
    cancelledAt: Date,
    cancellationReason: String,

    isDeleted: { type: Boolean, default: false, index: true },
    notes: String,
  },
  { timestamps: true },
);

// Indexes
dealSchema.index({ customer: 1 });
dealSchema.index({ property: 1 });
dealSchema.index({ project: 1 });
dealSchema.index({ unit: 1 });
dealSchema.index({ broker: 1 });
dealSchema.index({ status: 1, createdAt: -1 });
dealSchema.index({ organizationId: 1, branchId: 1, status: 1 });

// Auto-generate deal number
dealSchema.pre("save", async function (next) {
  if (!this.dealNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.dealNumber = `DEAL-${year}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// ---------------------------------------------------------------------------
// 2. Deal Stage History Model — Owner: Deal Module
// ---------------------------------------------------------------------------

const dealStageHistorySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      required: true,
      index: true,
    },
    previousStage: String,
    newStage: { type: String, required: true },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    durationInMinutes: Number,
    changedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

dealStageHistorySchema.index({ dealId: 1, changedAt: -1 });

// ---------------------------------------------------------------------------
// 3. Deal Reservation Model — Owner: Deal Module
// ---------------------------------------------------------------------------

const dealReservationSchema = new mongoose.Schema(
  {
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
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      required: true,
      index: true,
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
      index: true,
    },
    reservedByLeadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead" },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lockedDurationMinutes: { type: Number, required: true },
    lockedUntil: { type: Date, required: true },
    status: {
      type: String,
      enum: ["temp_locked", "token_locked", "booking_confirmed", "released"],
      default: "temp_locked",
      index: true,
    },
    releasedAt: Date,
    releaseReason: String,
  },
  { timestamps: true },
);

// High-Performance Concurrency lock to prevent double booking conflicts
dealReservationSchema.index(
  { organizationId: 1, unit: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["temp_locked", "token_locked", "booking_confirmed"] },
    },
    name: "unique_active_unit_reservation",
  },
);

// ---------------------------------------------------------------------------
// 4. Deal Document Model — Owner: Deal Module
// ---------------------------------------------------------------------------

const dealDocumentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      required: true,
      index: true,
    },
    docType: {
      type: String,
      enum: [
        "kyc_pan",
        "kyc_aadhaar",
        "booking_form",
        "allotment_letter",
        "ats",
        "sale_deed",
        "receipt",
        "other",
      ],
      required: true,
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      required: true,
    },
    status: {
      type: String,
      enum: ["uploaded", "verified", "rejected"],
      default: "uploaded",
      index: true,
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: Date,
  },
  { timestamps: true },
);

dealDocumentSchema.index({ dealId: 1, docType: 1 }, { unique: true });

// ---------------------------------------------------------------------------
// 5. Deal Payment Model — Owner: Deal Module
// ---------------------------------------------------------------------------

const dealPaymentSchema = new mongoose.Schema(
  {
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
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    paymentType: {
      type: String,
      enum: ["token", "booking_deposit", "builder_installment", "other"],
      required: true,
    },
    paymentMode: {
      type: String,
      enum: ["cheque", "wire", "upi", "cash", "draft"],
      required: true,
    },
    transactionRef: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "cleared", "bounced"],
      default: "pending",
      index: true,
    },
    paidAt: { type: Date, default: Date.now },
    clearedAt: Date,
    receiptUrl: String,

    // Tax structures (Indian Compliance)
    gstAmount: { type: Number, default: 0 },
    tdsAmount: { type: Number, default: 0 },
    netAmount: { type: Number, required: true },
  },
  { timestamps: true },
);

dealPaymentSchema.index({ dealId: 1, status: 1 });

// ---------------------------------------------------------------------------
// 6. Deal Cancellation Model — Owner: Deal Module
// ---------------------------------------------------------------------------

const dealCancellationSchema = new mongoose.Schema(
  {
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
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      required: true,
      index: true,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: { type: String, required: true },
    cancellationType: {
      type: String,
      enum: [
        "customer",
        "builder",
        "loan_rejection",
        "documentation_failure",
        "default",
      ],
      required: true,
      index: true,
    },
    forfeitureAmount: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
    refundStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
      index: true,
    },
    nocUploaded: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const Deal = mongoose.model("Deal", dealSchema);
const DealStageHistory = mongoose.model(
  "DealStageHistory",
  dealStageHistorySchema,
);
const DealReservation = mongoose.model(
  "DealReservation",
  dealReservationSchema,
);
const DealDocument = mongoose.model("DealDocument", dealDocumentSchema);
const DealPayment = mongoose.model("DealPayment", dealPaymentSchema);
const DealCancellation = mongoose.model(
  "DealCancellation",
  dealCancellationSchema,
);

module.exports = {
  Deal,
  DealStageHistory,
  DealReservation,
  DealDocument,
  DealPayment,
  DealCancellation,
};
