'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// SystemSettings Model — Owner: Settings Module
// Singleton document — one settings document per system.
// ---------------------------------------------------------------------------

const systemSettingsSchema = new mongoose.Schema(
  {
    // Singleton key
    key: { type: String, default: 'system', unique: true },

    // Company settings
    company: {
      name: { type: String, required: true },
      logo: String,
      address: String,
      city: String,
      state: String,
      pincode: String,
      phone: String,
      email: String,
      website: String,
      gstNumber: String,
      panNumber: String,
      reraNumber: String,
    },

    // CRM settings
    crm: {
      defaultLeadSource: String,
      autoAssignment: { type: Boolean, default: false },
      leadScoringEnabled: { type: Boolean, default: false },
      followUpReminderDays: { type: Number, default: 3 },
    },

    // Invoice settings
    invoice: {
      prefix: { type: String, default: 'INV' },
      startNumber: { type: Number, default: 1 },
      defaultGSTRate: { type: Number, default: 18 },
      termsAndConditions: String,
      paymentTerms: { type: Number, default: 30 }, // days
    },

    // Brokerage settings
    brokerage: {
      defaultCommissionRate: Number,
      commissionType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    },

    // Notification settings
    notifications: {
      emailEnabled: { type: Boolean, default: true },
      whatsappEnabled: { type: Boolean, default: false },
      smsEnabled: { type: Boolean, default: false },
    },

    // Workflow settings
    workflow: {
      requireSiteVisitBeforeDeal: { type: Boolean, default: false },
      autoCreateCustomerOnConversion: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
module.exports = { SystemSettings };
