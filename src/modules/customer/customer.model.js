'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Customer Model — Owner: Customer Module
// ---------------------------------------------------------------------------

const requirementSchema = new mongoose.Schema({
  propertyType: [String],
  budget: { min: Number, max: Number },
  area: { min: Number, max: Number },
  bhk: [mongoose.Schema.Types.Mixed],
  locations: [String],
  notes: String,
  updatedAt: Date,
}, { _id: false, strict: false });

const customerSchema = new mongoose.Schema(
  {
    // SaaS Boundaries
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

    // Profile
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    mobile: { type: String, required: true, trim: true },
    alternativeMobile: String,
    email: { type: String, trim: true, lowercase: true },
    avatar: String,

    // References
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }, // Source lead
    leadIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }], // All associated leads

    // Requirements (embedded — changes over time, track in this doc)
    requirements: requirementSchema,

    // Tags
    tags: [String],

    // Status
    status: {
      type: String,
      enum: ['active', 'inactive', 'blacklisted'],
      default: 'active',
    },

    // Assigned agent
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Preferences
    preferences: {
      communicationChannel: { type: String, enum: ['call', 'whatsapp', 'email'], default: 'call' },
      bestTimeToContact: String,
    },

    // Custom fields
    customFields: { type: mongoose.Schema.Types.Mixed },

    // Soft Deletion & Audit
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

customerSchema.index({ organizationId: 1, mobile: 1 });
customerSchema.index({ organizationId: 1, email: 1 });
customerSchema.index({ organizationId: 1, isDeleted: 1 });
customerSchema.index({ mobile: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ leadId: 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ assignedTo: 1 });
customerSchema.index(
  { firstName: 'text', lastName: 'text', mobile: 'text', email: 'text' },
  { name: 'customer_text_search' },
);

const Customer = mongoose.model('Customer', customerSchema);
module.exports = { Customer };
