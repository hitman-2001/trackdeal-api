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
    collaborators: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    }],

    // Requirements
    requirements: {
      propertyType: [{ type: String, enum: ["apartment", "villa", "plot", "commercial", "office"] }],
      budget: { min: Number, max: Number, currency: { type: String, default: "INR" } },
      area: { min: Number, max: Number, unit: { type: String, default: "sqft" } },
      bhk: [Number],
      locations: [String],
      notes: String,
    },

    // Scoring
    score: { type: Number, default: 0, min: 0, max: 100 },

    // Tags
    tags: [String],

    // Custom fields
    customFields: { type: mongoose.Schema.Types.Mixed },

    // Loss Tracking
    lostReason: String,
    lostNotes: String,
    lostAt: Date,

    // Conversion
    convertedAt: Date,
    convertedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  },
  { timestamps: true }
);

// High-Performance Indexes for Leads
leadSchema.index(
  { organizationId: 1, mobile: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
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
      enum: ["call", "whatsapp", "meeting", "email", "site_visit", "note", "stage_change", "assignment"],
      required: true,
    },
    description: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

leadActivitySchema.index({ organizationId: 1, leadId: 1, createdAt: -1 });
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
      enum: ["call", "email", "whatsapp", "visit", "meeting"],
      required: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "missed", "rescheduled", "escalated"],
      default: "scheduled",
      required: true,
      index: true,
    },
    notes: String,
    completedAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
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

module.exports = {
  Lead,
  LeadActivity,
  LeadNote,
  LeadFollowUp,
  LeadAssignment,
  LeadStageHistory,
};
