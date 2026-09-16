'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Tenant Model — platform-level workspace (e.g. Swarajya)
// Organizations, users, and domain data belong to a tenant.
// Current product domain for Swarajya is realEstate; UI/flow is unchanged.
// ---------------------------------------------------------------------------

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    domain: {
      type: String,
      enum: ['realEstate', 'education'],
      default: 'realEstate',
      required: true,
      index: true,
    },
    enabledModules: {
      type: [String],
      default: () => [
        'leads',
        'tasks',
        'agents',
        'properties',
        'projects',
        'deals',
        'loans',
        'agreements',
        'commissions',
        'reports',
        'settings',
      ],
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

tenantSchema.index({ name: 1 });

const Tenant = mongoose.model('Tenant', tenantSchema);
module.exports = { Tenant };
