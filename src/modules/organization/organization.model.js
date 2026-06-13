'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Organization Model — Owner: Organization Module
// ---------------------------------------------------------------------------

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true, // e.g. 'acme_realestate'
    },
    // Primary control variable governing roles, features, branch availability, and data scoping
    organizationType: {
      type: String,
      enum: ['INDIVIDUAL_AGENT', 'AGENCY', 'ENTERPRISE_AGENCY'],
      required: true,
      default: 'AGENCY',
      index: true,
    },
    // The ORG_ADMIN user who created / owns this organization
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    legalName: {
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
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    logo: {
      type: String, // Logo file path or URL
    },
    address: {
      type: String,
      trim: true,
    },
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
    
    // SaaS Subscription Config
    subscription: {
      plan: {
        type: String,
        enum: ['individual', 'starter', 'growth', 'enterprise'],
        default: 'starter',
      },
      status: {
        type: String,
        enum: ['active', 'suspended', 'cancelled', 'trial'],
        default: 'trial',
      },
      maxUsers: {
        type: Number,
        default: 5,
      },
      maxBranches: {
        type: Number,
        default: 0, // 0 = branches disabled (INDIVIDUAL_AGENT and AGENCY)
      },
      storageLimit: {
        type: Number,
        default: 5368709120, // 5GB in bytes
      },
    },
    
    // Custom Portal Branding
    branding: {
      primaryColor: {
        type: String,
        default: '#0f172a',
      },
      secondaryColor: {
        type: String,
        default: '#3b82f6',
      },
      logoUrl: {
        type: String,
      },
      faviconUrl: {
        type: String,
      },
    },
    
    // Organization-level defaults
    settings: {
      timezone: {
        type: String,
        default: 'Asia/Kolkata',
      },
      currency: {
        type: String,
        default: 'INR',
      },
      dateFormat: {
        type: String,
        default: 'DD/MM/YYYY',
      },
    },
  },
  { timestamps: true }
);

// Indexes
organizationSchema.index({ email: 1 });
organizationSchema.index({ 'subscription.status': 1 });
organizationSchema.index({ ownerId: 1 });

const Organization = mongoose.model('Organization', organizationSchema);
module.exports = { Organization };
