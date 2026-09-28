'use strict';

const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
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
      index: true,
      default: null,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    subject: { type: String, trim: true },
    grade: { type: String, trim: true },
    description: { type: String, trim: true },
    capacity: { type: Number, default: 30, min: 1 },
    fees: { type: Number, default: 0, min: 0 },
    schedule: { type: String, trim: true },
    instructorName: { type: String, trim: true },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
      index: true,
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

classSchema.index({ organizationId: 1, name: 1 });

const studentSchema = new mongoose.Schema(
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
      index: true,
      default: null,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    parentName: { type: String, trim: true },
    parentMobile: { type: String, trim: true },
    schoolName: { type: String, trim: true, default: '' },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EducationClass',
      default: null,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'graduated', 'dropped'],
      default: 'active',
      index: true,
    },
    enrollmentDate: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

studentSchema.index({ organizationId: 1, mobile: 1 });

const EducationClass = mongoose.model('EducationClass', classSchema);
const Student = mongoose.model('Student', studentSchema);

module.exports = { EducationClass, Student };
