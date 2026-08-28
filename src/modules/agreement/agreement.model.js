'use strict';

const mongoose = require('mongoose');

const agreementClauseSchema = new mongoose.Schema(
  {
    clauseId: { type: String, required: true },
    title: { type: String, required: true },
    order: { type: Number, default: 1 },
    content: { type: String, required: true },
    isMandatory: { type: Boolean, default: false },
    isCustom: { type: Boolean, default: false },
  },
  { _id: false }
);

const agreementVersionSchema = new mongoose.Schema(
  {
    versionNumber: { type: Number, required: true },
    clauses: [agreementClauseSchema],
    structuredData: { type: mongoose.Schema.Types.Mixed },
    modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    modifiedAt: { type: Date, default: Date.now },
    changeSummary: { type: String },
  },
  { _id: true }
);

const agreementAuditSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    details: { type: String },
  },
  { _id: false }
);

const agreementSchema = new mongoose.Schema(
  {
    agreementNumber: {
      type: String,
      unique: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentTemplate',
      required: true,
    },
    templateVersion: {
      type: String,
      default: '1.0',
    },
    agreementType: {
      type: String,
      default: 'Agreement for Sale-Deed',
    },
    // Relational Context
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      index: true,
    },
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      index: true,
    },

    // Status Lifecycle
    status: {
      type: String,
      enum: ['draft', 'generated', 'under_review', 'ready_for_print', 'executed', 'cancelled', 'archived'],
      default: 'draft',
      index: true,
    },

    // Structured JSON Fields for Data Recompilation
    structuredData: {
      transferors: [
        {
          name: { type: String },
          age: { type: Number },
          pan: { type: String },
          occupation: { type: String },
          address: { type: String },
          city: { type: String },
          state: { type: String },
          pin: { type: String },
        },
      ],
      transferees: [
        {
          name: { type: String },
          age: { type: Number },
          pan: { type: String },
          occupation: { type: String },
          address: { type: String },
          city: { type: String },
          state: { type: String },
          pin: { type: String },
        },
      ],
      property: {
        flatNumber: { type: String },
        floor: { type: String },
        wing: { type: String },
        buildingName: { type: String },
        projectName: { type: String },
        societyName: { type: String },
        societyRegistrationNumber: { type: String },
        societyRegistrationDate: { type: Date },
        carpetArea: { type: Number },
        builtUpArea: { type: Number },
        surveyNumbers: { type: String },
        hissaNumber: { type: String },
        ctsNumber: { type: String },
        village: { type: String },
        taluka: { type: String },
        district: { type: String, default: 'Pune' },
        city: { type: String, default: 'Pune' },
        municipalCorporation: { type: String },
        subRegistrarOffice: { type: String },
        shareCertificateNumber: { type: String },
        shareNumbersFrom: { type: String },
        shareNumbersTo: { type: String },
        previousAgreementDate: { type: Date },
        previousRegistrationNumber: { type: String },
        developerName: { type: String },
      },
      agreement: {
        agreementDate: { type: Date },
        agreementPlace: { type: String, default: 'Pune' },
        jurisdictionCity: { type: String, default: 'Pune' },
      },
      consideration: {
        totalAmount: { type: Number, default: 0 },
        amountInWords: { type: String },
        advanceAmount: { type: Number, default: 0 },
        balanceAmount: { type: Number, default: 0 },
      },
      payments: [
        {
          date: { type: Date },
          amount: { type: Number, default: 0 },
          mode: { type: String, default: 'Bank Transfer' },
          bankName: { type: String },
          referenceNumber: { type: String },
          branch: { type: String },
          remarks: { type: String },
        },
      ],
      witnesses: [
        {
          name: { type: String },
          address: { type: String },
        },
      ],
    },

    // Page Dimensions and Setup
    pageSettings: {
      pageSize: { type: String, enum: ['a4', 'legal', 'letter'], default: 'a4' },
      orientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' },
      margins: { type: String, enum: ['normal', 'narrow', 'moderate', 'custom'], default: 'normal' },
      marginTop: { type: Number, default: 25.4 },
      marginBottom: { type: Number, default: 25.4 },
      marginLeft: { type: Number, default: 25.4 },
      marginRight: { type: Number, default: 25.4 },
    },

    // Editable Clauses Array
    clauses: [agreementClauseSchema],

    // Final Compiled HTML Document
    compiledHtml: { type: String },

    // Versioning Snapshots
    currentVersionNumber: { type: Number, default: 1 },
    versions: [agreementVersionSchema],

    // Audit Trail
    auditLog: [agreementAuditSchema],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    executedAt: { type: Date },
    printedAt: { type: Date },
  },
  { timestamps: true }
);

// Auto-generate agreement number AGR-YYYY-XXXX
agreementSchema.pre('save', async function (next) {
  if (!this.agreementNumber && this.isNew) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({ organizationId: this.organizationId });
    this.agreementNumber = `AGR-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

const Agreement = mongoose.model('Agreement', agreementSchema);

module.exports = { Agreement };
