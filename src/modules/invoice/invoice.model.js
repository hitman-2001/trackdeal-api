'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Invoice Model — Owner: Invoice Module
// Business rule: Invoice cannot be deleted. Cancelled invoice remains visible.
// ---------------------------------------------------------------------------

const lineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true },
  amount: { type: Number, required: true },
  hsnCode: String,
  gstRate: { type: Number, default: 18 }, // GST percentage
  cgst: Number,
  sgst: Number,
  igst: Number,
}, { _id: false });

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true }, // INV-2024-001

    // References
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Invoice details
    invoiceDate: { type: Date, default: Date.now },
    dueDate: Date,

    // Line items (embedded — immutable once generated)
    lineItems: [lineItemSchema],

    // Totals
    subtotal: { type: Number, required: true },
    totalGST: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    // GST details
    gstType: { type: String, enum: ['intrastate', 'interstate'], default: 'intrastate' },
    supplierGST: String,
    recipientGST: String,

    // Status
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'],
      default: 'draft',
      index: true,
    },

    // Payment tracking
    paidAmount: { type: Number, default: 0 },
    outstandingAmount: { type: Number },
    payments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],

    // Notes
    notes: String,
    termsAndConditions: String,
  },
  { timestamps: true },
);

invoiceSchema.index({ deal: 1 });
invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ status: 1, dueDate: 1 });

// Auto-generate invoice number
invoiceSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  // Auto-compute outstanding
  this.outstandingAmount = this.totalAmount - (this.paidAmount || 0);
  next();
});

const Invoice = mongoose.model('Invoice', invoiceSchema);
module.exports = { Invoice };
