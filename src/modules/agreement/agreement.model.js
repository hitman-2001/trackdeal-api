'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Agreement Models — Owner: Agreement Module
// Contains AgreementTemplate and Agreement generated contract schemas.
// ---------------------------------------------------------------------------

const agreementTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    content: { type: String, required: true }, // Markdown or HTML content with variables e.g. {{customerName}}
    variables: [{ type: String }], // Array of allowed variable keys e.g. ['customerName', 'dealValue', 'propertyAddress']
    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const agreementSchema = new mongoose.Schema(
  {
    agreementNumber: { type: String, unique: true }, // Auto-generated: AGR-2024-0001
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgreementTemplate',
      required: true,
    },
    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
    },
    content: { type: String, required: true }, // Fully compiled text with values
    variablesData: { type: mongoose.Schema.Types.Mixed }, // Snapshot of key/values used
    version: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['draft', 'sent', 'signed', 'void'],
      default: 'draft',
      index: true,
    },
    signedAt: { type: Date },
    signedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// Auto-generate agreement number
agreementSchema.pre('save', async function (next) {
  if (!this.agreementNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.agreementNumber = `AGR-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

const AgreementTemplate = mongoose.model('AgreementTemplate', agreementTemplateSchema);
const Agreement = mongoose.model('Agreement', agreementSchema);

module.exports = { AgreementTemplate, Agreement };
