'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Agent / Channel Partner Model — Master Data Entity
// ---------------------------------------------------------------------------

const agentSchema = new mongoose.Schema(
  {
    // Tenant Boundaries
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      index: true,
      default: null,
    },

    // Basic Information
    name: {
      type: String,
      required: true,
      trim: true,
    },
    officeName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    profilePhoto: {
      type: String,
      trim: true,
    },

    // Business & Registration Information
    reraNumber: {
      type: String,
      trim: true,
    },
    registrationNumber: {
      type: String,
      trim: true,
    },
    gstNumber: {
      type: String,
      trim: true,
    },
    panNumber: {
      type: String,
      trim: true,
    },
    agentType: {
      type: String,
      enum: ['individual', 'company', 'channel_partner', 'broker', 'other'],
      default: 'channel_partner',
      index: true,
    },
    specialization: {
      type: String,
      enum: ['residential', 'commercial', 'plot', 'rental', 'other'],
      default: 'residential',
    },

    // Address Information
    address: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
      index: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      default: 'India',
      trim: true,
    },

    // Additional Contact & Notes
    contactPersonName: {
      type: String,
      trim: true,
    },
    contactPersonPhone: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },

    // Operational Status
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },

    // Performance & Lead Stats (auto-updated on transfers)
    totalLeadsAssigned: {
      type: Number,
      default: 0,
    },
    activeLeadsCount: {
      type: Number,
      default: 0,
    },
    convertedLeadsCount: {
      type: Number,
      default: 0,
    },
    lostLeadsCount: {
      type: Number,
      default: 0,
    },
    lastTransferredAt: {
      type: Date,
    },

    // Soft Deletion
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Tenant-scoped indexes
agentSchema.index({ organizationId: 1, phone: 1 }, { partialFilterExpression: { isDeleted: false } });
agentSchema.index({ organizationId: 1, status: 1, agentType: 1 });
agentSchema.index(
  { name: 'text', officeName: 'text', phone: 'text', email: 'text', city: 'text', reraNumber: 'text' },
  { name: 'agent_text_search' }
);

const Agent = mongoose.model('Agent', agentSchema);
module.exports = { Agent };
