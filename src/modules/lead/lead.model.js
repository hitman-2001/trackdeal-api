"use strict";

const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// 1. Core Lead Model — Owner: Leads Module
// ---------------------------------------------------------------------------

const leadSchema = new mongoose.Schema(
  {
    // SaaS Boundaries
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
      default: null,
    },

    // Basic Info
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    mobile: { type: String, required: true, trim: true },
    alternativeMobile: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },

    // Source
    source: {
      type: String,
      enum: [
        "website",
        "magicbricks",
        "99acres",
        "housing",
        "whatsapp",
        "referral",
        "walk_in",
        "facebook_ads",
        "google_ads",
        "manual_entry"
      ],
      required: true,
    },
    sourceDetails: String,

    // Status
    status: {
      type: String,
      enum: [
        "new",
        "assigned",
        "contacted",
        "qualified",
        "nurturing",
        "site_visit_scheduled",
        "site_visit_completed",
        "negotiation",
        "booking_initiated",
        "booked",
        "won",
        "booking_defaulted",
        "lost"
      ],
      default: "new",
      index: true,
    },

    // Ownership & Collaboration
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      index: true,
      default: null,
    },
    agentIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      index: true,
    }],
    collaborators: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    }],
    transferHistory: [{
      fromType: { type: String, enum: ["user", "agent", "unassigned"], default: "user" },
      fromId: { type: mongoose.Schema.Types.ObjectId },
      fromName: { type: String, trim: true },
      toAgentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent" },
      toAgentName: { type: String, trim: true },
      transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      transferredByName: { type: String, trim: true },
      transferredAt: { type: Date, default: Date.now },
      remarks: { type: String, trim: true }
    }],
    transfers: [{
      fromOrganizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
      toOrganizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
      toAgentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent" },
      toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
      transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      transferredByName: { type: String, trim: true },
      fromOrganizationName: { type: String, trim: true },
      transferredAt: { type: Date, default: Date.now },
      status: { type: String, enum: ["transferred", "accepted", "rejected"], default: "transferred" },
      remarks: { type: String, trim: true }
    }],

    // Requirements & Buyer Preferences
    requirements: {
      propertyType: [{ type: String }],
      budget: { min: Number, max: Number, currency: { type: String, default: "INR" } },
      area: { min: Number, max: Number, unit: { type: String, default: "sqft" } },
      bhk: [mongoose.Schema.Types.Mixed],
      locations: [String],
      notes: String,
    },

    buyerRequirement: {
      propertyType: [{ type: String }],
      preferredLocation: String,
      locality: String,
      preferredProject: String,
      bhk: [String],
      minArea: Number,
      maxArea: Number,
      preferredFloor: String,
      possessionPreference: { type: String, enum: ["ready_to_move", "under_construction", "either"] },
      purpose: { type: String, enum: ["self_use", "investment", "rental", "other"] },
    },

    budget: {
      minBudget: Number,
      maxBudget: Number,
      expectedPurchasePrice: Number,
      budgetFlexibility: { type: String, enum: ["fixed", "negotiable", "highly_flexible"] },
    },

    financialRequirement: {
      loanRequired: { type: String, enum: ["yes", "no", "not_decided"], default: "not_decided" },
      expectedPropertyValue: Number,
      ownContribution: Number,
      loanRequiredAmount: Number,
      loanPercentage: Number,
      preferredLoanTenure: Number,
      preferredEmi: Number,
      loanType: { type: String, enum: ["home_loan", "lap", "commercial_property_loan", "other"] },
      preferredBank: String,
      alternativeBank: String,
      existingLoanEmi: Number,
      monthlyIncome: Number,
      annualIncome: Number,
      employmentType: { type: String, enum: ["salaried", "self_employed", "business_owner", "professional", "other"] },
      companyName: String,
      yearsInEmployment: Number,
      loanStatus: { type: String, enum: ["not_applied", "planning_to_apply", "applied", "under_processing", "sanctioned", "rejected", "disbursed"] },
      isSanctionLetterAvailable: { type: Boolean, default: false },
      sanctionedAmount: Number,
      sanctionDate: Date,
      sanctionBank: String,
      sanctionLetterDoc: String,
    },

    buyerProfile: {
      buyerName: String,
      coApplicantName: String,
      coApplicantPhone: String,
      familySize: Number,
      numberOfDependents: Number,
      occupation: String,
      companyBusiness: String,
      monthlyIncome: Number,
      annualIncome: Number,
      currentResidence: String,
      currentCity: String,
      preferredPurchaseTimeline: { type: String, enum: ["immediate", "within_30_days", "1_3_months", "3_6_months", "6_plus_months"] },
      isFirstTimeBuyer: { type: Boolean, default: false },
      hasExistingProperty: { type: Boolean, default: false },
      numberOfExistingProperties: Number,
      investmentExperience: String,
      sourceOfFunds: { type: String, enum: ["own_funds", "loan", "family_funds", "sale_of_existing_property", "combination", "other"] },
    },

    qualification: {
      leadTemperature: { type: String, enum: ["hot", "warm", "cold"], default: "warm" },
      buyingIntent: { type: String, enum: ["high", "medium", "low"], default: "medium" },
      decisionMaker: { type: String, enum: ["self", "spouse", "parents", "family", "business_partner", "other"] },
      numberOfDecisionMakers: Number,
      siteVisitRequired: { type: Boolean, default: false },
      siteVisitCompleted: { type: Boolean, default: false },
      numberOfSiteVisits: { type: Number, default: 0 },
      interestedProjects: [String],
      interestedProperties: [{ type: mongoose.Schema.Types.ObjectId, ref: "Property" }],
      competitorProjectsConsidered: String,
      expectedDecisionDate: Date,
      reasonForBuying: String,
      keyRequirements: String,
      objectionsConcerns: String,
      notesRemarks: String,
    },

    // Scoring
    score: { type: Number, default: 0, min: 0, max: 100 },

    // Tags
    tags: [String],

    // Custom fields
    customFields: { type: mongoose.Schema.Types.Mixed },

    // Activity & Follow-up Tracking
    lastActivityType: { type: String },
    lastActivityAt: { type: Date },
    nextFollowUpAt: { type: Date },

    // Loss Tracking
    lostReason: String,
    lostNotes: String,
    lostAt: Date,

    // Customer Master Reference
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
      default: null,
    },

    // Conversion
    convertedAt: Date,
    convertedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },

    // Soft Deletion
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// High-Performance Indexes for Leads (Non-unique mobile to allow multiple leads per customer)
leadSchema.index({ organizationId: 1, mobile: 1 });
leadSchema.index({ organizationId: 1, customerId: 1 });
leadSchema.index({ organizationId: 1, status: 1, assignedTo: 1 });
leadSchema.index({ organizationId: 1, branchId: 1, status: 1 });
leadSchema.index({ organizationId: 1, source: 1, createdAt: -1 });
leadSchema.index({ organizationId: 1, score: -1 });
leadSchema.index({ organizationId: 1, tags: 1 });
leadSchema.index({ organizationId: 1, createdAt: -1 });
leadSchema.index(
  { firstName: "text", lastName: "text", mobile: "text", email: "text" },
  { name: "lead_text_search" }
);

const Lead = mongoose.model("Lead", leadSchema);

// Safe cleanup of legacy unique index if present in existing MongoDB collection
Lead.collection.dropIndex("organizationId_1_mobile_1").catch(() => {});

// ---------------------------------------------------------------------------
// 2. Lead Activity Model — Logs Calls, WhatsApp, Meetings, emails, etc.
// ---------------------------------------------------------------------------

const leadActivitySchema = new mongoose.Schema(
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
      index: true,
      default: null,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "call",
        "phone_call",
        "whatsapp",
        "meeting",
        "email",
        "property_visit",
        "site_visit",
        "follow_up",
        "property_shared",
        "project_presented",
        "quotation",
        "negotiation",
        "booking_discussion",
        "payment_discussion",
        "loan_discussion",
        "registration_discussion",
        "registration",
        "note",
        "reminder",
        "other",
        "stage_change",
        "assignment",
      ],
      required: true,
    },
    activityDate: { type: Date, default: Date.now },
    activityTime: { type: String, trim: true },
    summary: { type: String, trim: true },
    description: { type: String, trim: true },
    customerResponse: { type: String, trim: true },
    nextFollowUpAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["scheduled", "completed", "pending", "cancelled", "missed", "rescheduled", "in_progress"],
      default: "completed",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

leadActivitySchema.index({ organizationId: 1, leadId: 1, activityDate: -1, createdAt: -1 });
leadActivitySchema.index({ organizationId: 1, type: 1, createdAt: -1 });
leadActivitySchema.index({ organizationId: 1, performedBy: 1, createdAt: -1 });

const LeadActivity = mongoose.model("LeadActivity", leadActivitySchema, "lead_activities");

// ---------------------------------------------------------------------------
// 3. Lead Note Model — Internal notes
// ---------------------------------------------------------------------------

const leadNoteSchema = new mongoose.Schema(
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
      index: true,
      default: null,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    content: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPrivate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

leadNoteSchema.index({ organizationId: 1, leadId: 1, createdAt: -1 });

const LeadNote = mongoose.model("LeadNote", leadNoteSchema, "lead_notes");

// ---------------------------------------------------------------------------
// 4. Lead Follow-up Model — Future calendar follow-ups
// ---------------------------------------------------------------------------

const leadFollowUpSchema = new mongoose.Schema(
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
      index: true,
      default: null,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    scheduledAt: { type: Date, required: true, index: true },
    type: {
      type: String,
      enum: ["call", "email", "whatsapp", "visit", "site_visit", "meeting", "general", "other"],
      required: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "missed", "rescheduled", "escalated"],
      default: "scheduled",
    },
    notes: String,
    outcome: String,
    completedAt: Date,
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    escalatedAt: Date,
    escalationReason: String,
  },
  { timestamps: true }
);

leadFollowUpSchema.index({ organizationId: 1, leadId: 1, scheduledAt: 1 });
leadFollowUpSchema.index({ organizationId: 1, assignedTo: 1, scheduledAt: 1, status: 1 });
leadFollowUpSchema.index({ organizationId: 1, status: 1, scheduledAt: 1 });

const LeadFollowUp = mongoose.model("LeadFollowUp", leadFollowUpSchema, "lead_followups");

// ---------------------------------------------------------------------------
// 5. Lead Assignment Model — Reassignment tracking
// ---------------------------------------------------------------------------

const leadAssignmentSchema = new mongoose.Schema(
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
      index: true,
      default: null,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedAt: { type: Date, default: Date.now, required: true },
    reason: String,
  },
  { timestamps: true }
);

leadAssignmentSchema.index({ organizationId: 1, leadId: 1, assignedAt: -1 });

const LeadAssignment = mongoose.model("LeadAssignment", leadAssignmentSchema, "lead_assignments");

// ---------------------------------------------------------------------------
// 6. Lead Stage History Model — Stage velocity funnels
// ---------------------------------------------------------------------------

const leadStageHistorySchema = new mongoose.Schema(
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
      index: true,
      default: null,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    stageFrom: String,
    stageTo: { type: String, required: true },
    changedAt: { type: Date, default: Date.now, required: true },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    timeSpentMinutes: Number,
  },
  { timestamps: true }
);

leadStageHistorySchema.index({ organizationId: 1, leadId: 1, changedAt: -1 });
leadStageHistorySchema.index({ organizationId: 1, stageTo: 1, changedAt: -1 });

const LeadStageHistory = mongoose.model("LeadStageHistory", leadStageHistorySchema, "lead_stage_history");

// ---------------------------------------------------------------------------
// 7. Lead Visit Model — Rich structured visit record (multi-property)
// ---------------------------------------------------------------------------

const leadVisitSchema = new mongoose.Schema(
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
      index: true,
      default: null,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    visitDate: { type: Date, required: true },
    visitTime: { type: String },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    propertiesShown: [{ type: mongoose.Schema.Types.ObjectId, ref: "Property" }],
    salesExecutive: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", default: null },
    visitStatus: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "no_show", "rescheduled"],
      default: "scheduled",
    },
    customerAttended: { type: Boolean, default: false },
    whoAttended: { type: String },
    interestLevel: {
      type: String,
      enum: ["very_interested", "interested", "maybe", "not_interested", "not_assessed", null],
      default: null,
    },
    customerFeedback: { type: String },
    likes: { type: String },
    dislikes: { type: String },
    objections: { type: String },
    competitorPropertyMentioned: { type: String },
    nextAction: { type: String },
    followUpDate: { type: Date },
    numberOfPropertiesShown: { type: Number, default: 0 },
    numberOfProjectsShown: { type: Number, default: 0 },
    projectsShown: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
    internalNotes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

leadVisitSchema.index({ organizationId: 1, leadId: 1, visitDate: -1 });
leadVisitSchema.index({ organizationId: 1, visitStatus: 1, visitDate: -1 });

const LeadVisit = mongoose.model("LeadVisit", leadVisitSchema, "lead_visits");

// ---------------------------------------------------------------------------
// 8. Lead Quotation Model — Immutable historical rate records (NEVER overwrite)
// ---------------------------------------------------------------------------

const leadQuotationSchema = new mongoose.Schema(
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
      index: true,
      default: null,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", default: null },
    quotedDate: { type: Date, required: true, default: Date.now },
    listPrice: { type: Number },
    quotedPrice: { type: Number, required: true },
    pricePerSqFt: { type: Number },
    carpetArea: { type: Number },
    builtUpArea: { type: Number },
    configuration: { type: String },
    discount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    parkingCharges: { type: Number, default: 0 },
    floorRise: { type: Number, default: 0 },
    maintenance: { type: Number, default: 0 },
    stampDutyEstimate: { type: Number, default: 0 },
    registrationEstimate: { type: Number, default: 0 },
    totalEstimatedCost: { type: Number },
    paymentPlan: { type: String },
    offerValidUntil: { type: Date },
    quotedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerInterest: {
      type: String,
      enum: ["very_interested", "interested", "maybe", "not_interested"],
    },
    customerFeedback: { type: String },
    notes: { type: String },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

leadQuotationSchema.index({ organizationId: 1, leadId: 1, quotedDate: -1 });
leadQuotationSchema.index({ organizationId: 1, propertyId: 1, quotedDate: -1 });

const LeadQuotation = mongoose.model("LeadQuotation", leadQuotationSchema, "lead_quotations");

module.exports = {
  Lead,
  LeadActivity,
  LeadNote,
  LeadFollowUp,
  LeadAssignment,
  LeadStageHistory,
  LeadVisit,
  LeadQuotation,
};
