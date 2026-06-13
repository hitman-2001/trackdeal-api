"use strict";

const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// 1. Task Model — Owner: Tasks & Activities Module
// ---------------------------------------------------------------------------

const taskSchema = new mongoose.Schema(
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

    title: { type: String, required: true, trim: true },
    description: String,

    type: {
      type: String,
      enum: ["call", "whatsapp", "email", "site_visit", "meeting", "document", "payment", "general"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "missed", "cancelled"],
      default: "pending",
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      required: true,
    },

    dueDate: { type: Date, required: true, index: true },
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Relationships
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      index: true,
      default: null,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      index: true,
      default: null,
    },
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      index: true,
      default: null,
    },
    commissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commission",
      index: true,
      default: null,
    },

    // SLA Overdue Tracking
    isOverdue: { type: Boolean, default: false },
    escalatedAt: Date,
    escalatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    escalationReason: String,
  },
  { timestamps: true }
);

taskSchema.index({ organizationId: 1, assignedTo: 1, status: 1, dueDate: 1 });
taskSchema.index({ organizationId: 1, status: 1, dueDate: 1 });

const Task = mongoose.model("Task", taskSchema);

// ---------------------------------------------------------------------------
// 2. Activity Model — Tracks Completed Interactions
// ---------------------------------------------------------------------------

const activitySchema = new mongoose.Schema(
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

    type: {
      type: String,
      enum: ["call", "whatsapp", "email", "site_visit", "meeting", "note"],
      required: true,
    },
    description: { type: String, required: true },
    outcome: String,
    duration: Number, // in seconds

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Relationships
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      index: true,
      default: null,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      index: true,
      default: null,
    },
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      index: true,
      default: null,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      index: true,
      default: null,
    },
  },
  { timestamps: true }
);

activitySchema.index({ organizationId: 1, leadId: 1, createdAt: -1 });
activitySchema.index({ organizationId: 1, dealId: 1, createdAt: -1 });
activitySchema.index({ performedBy: 1, createdAt: -1 });

const Activity = mongoose.model("Activity", activitySchema);

// ---------------------------------------------------------------------------
// 3. Reminder Model — Tracks Scheduled Notifications
// ---------------------------------------------------------------------------

const reminderSchema = new mongoose.Schema(
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

    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    remindAt: { type: Date, required: true, index: true },
    frequency: {
      type: String,
      enum: ["one_time", "daily", "weekly", "monthly"],
      default: "one_time",
      required: true,
    },
    channels: {
      type: [String],
      enum: ["in_app", "email", "whatsapp"],
      default: ["in_app"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "triggered", "cancelled"],
      default: "pending",
      required: true,
      index: true,
    },
    triggeredAt: Date,
  },
  { timestamps: true }
);

reminderSchema.index({ status: 1, remindAt: 1 });
reminderSchema.index({ userId: 1, status: 1 });

const Reminder = mongoose.model("Reminder", reminderSchema);

module.exports = {
  Task,
  Activity,
  Reminder,
};
