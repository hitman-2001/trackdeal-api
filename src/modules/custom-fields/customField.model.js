'use strict';

const mongoose = require('mongoose');

const customFieldSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    module: {
      type: String,
      enum: ['leads', 'students', 'deals', 'customers'],
      default: 'leads',
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      enum: ['text', 'select', 'number', 'textarea', 'date'],
      default: 'text',
      required: true,
    },
    options: {
      type: [String],
      default: [],
    },
    required: {
      type: Boolean,
      default: false,
    },
    placeholder: {
      type: String,
      default: '',
      trim: true,
    },
    helpText: {
      type: String,
      default: '',
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isStandard: {
      type: Boolean,
      default: false,
    },
    isSystemLocked: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

customFieldSchema.index({ organizationId: 1, module: 1, key: 1 }, { unique: true });

const CustomField = mongoose.model('CustomField', customFieldSchema);

module.exports = { CustomField };

