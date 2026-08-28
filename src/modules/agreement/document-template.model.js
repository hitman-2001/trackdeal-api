'use strict';

const mongoose = require('mongoose');

const clauseSchema = new mongoose.Schema(
  {
    clauseId: { type: String, required: true },
    title: { type: String, required: true },
    order: { type: Number, default: 1 },
    content: { type: String, required: true },
    isMandatory: { type: Boolean, default: false },
    isRemovable: { type: Boolean, default: true },
    isCustom: { type: Boolean, default: false },
  },
  { _id: false }
);

const documentTemplateSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
      default: null, // null for system defaults
    },
    templateCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['sale_deed', 'resale', 'rental', 'commercial', 'brokerage', 'mou', 'other'],
      default: 'sale_deed',
      index: true,
    },
    version: {
      type: String,
      default: '1.0',
    },
    description: {
      type: String,
      trim: true,
    },
    clauses: [clauseSchema],
    placeholders: [{ type: String }],
    requiredFields: [{ type: String }],
    isSystemDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    pageSettings: {
      pageSize: { type: String, enum: ['a4', 'legal', 'letter'], default: 'a4' },
      orientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' },
      margins: { type: String, enum: ['normal', 'narrow', 'moderate', 'custom'], default: 'normal' },
      marginTop: { type: Number, default: 25.4 },
      marginBottom: { type: Number, default: 25.4 },
      marginLeft: { type: Number, default: 25.4 },
      marginRight: { type: Number, default: 25.4 },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

documentTemplateSchema.index({ organizationId: 1, templateCode: 1, version: 1 });

const DocumentTemplate = mongoose.model('DocumentTemplate', documentTemplateSchema);

module.exports = { DocumentTemplate };
