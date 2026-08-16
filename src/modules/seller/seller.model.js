'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Seller Model — Owner: Seller Module
// ---------------------------------------------------------------------------

const sellerSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    mobile: { type: String, required: true, trim: true },
    alternativeMobile: String,
    email: { type: String, trim: true, lowercase: true },

    // Address
    address: {
      street: String,
      area: String,
      city: String,
      state: String,
      pincode: String,
    },

    // Bank details (sensitive — access controlled)
    bankDetails: {
      accountNumber: { type: String, select: false },
      ifscCode: { type: String, select: false },
      bankName: String,
      accountHolderName: String,
    },

    // KYC
    kyc: {
      panNumber: String,
      aadharNumber: { type: String, select: false },
      gstNumber: String,
      isVerified: { type: Boolean, default: false },
    },

    // Tags & notes
    tags: [String],
    notes: String,

    // Multitenancy & Audit
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Soft delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Status
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
);

sellerSchema.index({ mobile: 1 });
sellerSchema.index({ 'kyc.panNumber': 1 });
sellerSchema.index({ firstName: 'text', lastName: 'text', mobile: 'text' });

const Seller = mongoose.model('Seller', sellerSchema);
module.exports = { Seller };
