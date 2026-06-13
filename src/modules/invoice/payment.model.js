'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Payment Model — Owner: Invoice Module
// ---------------------------------------------------------------------------

const paymentSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },

    // Payment details
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentDate: { type: Date, required: true, default: Date.now },

    // Method
    method: {
      type: String,
      enum: ['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'other'],
      required: true,
    },

    // Reference
    referenceNumber: String,
    transactionId: String,
    bankName: String,
    chequeNumber: String,
    chequeDate: Date,

    // Status
    status: {
      type: String,
      enum: ['pending', 'verified', 'failed', 'refunded'],
      default: 'pending',
    },

    // Verification
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,

    // Notes
    notes: String,
  },
  { timestamps: true },
);

paymentSchema.index({ invoice: 1 });
paymentSchema.index({ customer: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ status: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = { Payment };
