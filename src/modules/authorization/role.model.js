"use strict";

const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// Role Model — Owner: Authorization Module
// ---------------------------------------------------------------------------

const roleSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: false, // null for system-wide global roles
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true, // e.g. 'super_admin', 'branch_manager'
    },
    description: {
      type: String,
      trim: true,
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    permissions: [
      {
        type: String, // References 'permissionKey' in the Permission schema
      },
    ],
    // Org types that may use this role. Empty array = no restriction (platform-level or all).
    availableForTiers: [
      {
        type: String,
        enum: ["INDIVIDUAL_AGENT", "AGENCY", "ENTERPRISE_AGENCY"],
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound Unique Indexes for Multi-Tenant Isolation
// Ensure that code and name are unique within the same organization (or globally for system roles)
roleSchema.index({ organizationId: 1, code: 1 }, { unique: true });
roleSchema.index({ organizationId: 1, name: 1 }, { unique: true });
roleSchema.index({ isActive: 1 });

const Role = mongoose.model("Role", roleSchema);
module.exports = { Role };
