"use strict";

const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// SiteVisit Model — Owner: Site Visit Module
// ---------------------------------------------------------------------------

const siteVisitSchema = new mongoose.Schema(
  {
    // References
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead" },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Scheduling
    scheduledAt: { type: Date, required: true },
    duration: { type: Number, default: 60 }, // minutes

    // Status
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "no_show"],
      default: "scheduled",
      index: true,
    },

    // Completion
    completedAt: Date,
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      interested: { type: Boolean },
      remarks: String,
    },
    outcome: {
      type: String,
      enum: [
        "interested",
        "not_interested",
        "revisit_required",
        "deal_initiated",
      ],
    },

    // Follow-up
    followUpDate: Date,
    followUpNotes: String,

    // Cancellation
    cancelledAt: Date,
    cancellationReason: String,

    // Notes
    notes: String,
  },
  { timestamps: true },
);

siteVisitSchema.index({ agent: 1, scheduledAt: 1 });
siteVisitSchema.index({ property: 1 });
siteVisitSchema.index({ lead: 1 });
siteVisitSchema.index({ customer: 1 });
siteVisitSchema.index({ status: 1, scheduledAt: 1 });
siteVisitSchema.index({ agent: 1, status: 1, scheduledAt: 1 });

const SiteVisit = mongoose.model("SiteVisit", siteVisitSchema);
module.exports = { SiteVisit };
