'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Brokerage Model — Owner: Brokerage Module
// Tracks agent commissions, calculations, adjustments, and settlements.
// ---------------------------------------------------------------------------

const brokerageAdjustmentSchema = new mongoose.Schema({
  amount: { type: Number, required: true }, // Can be positive or negative
  reason: { type: String, required: true, trim: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt: { type: Date, default: Date.now },
}, { _id: false });

const brokerageSchema = new mongoose.Schema(
  {
    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      required: true,
      index: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    commissionType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
      required: true,
    },
    rate: {
      type: Number, // e.g. 2.0 (for 2% percentage) or 50000 (fixed amount)
      required: true,
    },
    amountCalculated: {
      type: Number,
      required: true,
    },
    adjustments: [brokerageAdjustmentSchema],
    amountFinal: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['calculated', 'approved', 'settled'],
      default: 'calculated',
      index: true,
      required: true,
    },
    settledAt: { type: Date },
    settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    settlementReference: { type: String, trim: true },
  },
  { timestamps: true },
);

// Indexes
brokerageSchema.index({ agent: 1, status: 1 });
brokerageSchema.index({ deal: 1, agent: 1 }, { unique: true });

const Brokerage = mongoose.model('Brokerage', brokerageSchema);
module.exports = { Brokerage };
