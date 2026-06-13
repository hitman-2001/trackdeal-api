'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Branch Model — Owner: Branch Module
// ---------------------------------------------------------------------------

const branchSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
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
      lowercase: true,
      trim: true, // e.g. 'mumbai_andheri'
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    
    address: {
      city: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
      },
      postalCode: {
        type: String,
        trim: true,
      },
    },
    
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound Unique Indexes for Multi-Tenant Isolation
// Guarantees branch name/code is unique per organization tenant
branchSchema.index({ organizationId: 1, code: 1 }, { unique: true });
branchSchema.index({ organizationId: 1, name: 1 }, { unique: true });
branchSchema.index({ isActive: 1 });

const Branch = mongoose.model('Branch', branchSchema);
module.exports = { Branch };
