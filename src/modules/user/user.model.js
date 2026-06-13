'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// User Model — Owner: Authentication & User Management
// ---------------------------------------------------------------------------

const deviceSchema = new mongoose.Schema({
  deviceId: String,
  deviceType: { type: String, enum: ['web', 'mobile', 'tablet'] },
  userAgent: String,
  lastSeen: Date,
}, { _id: false });

const userSchema = new mongoose.Schema(
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

    // Identity
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    mobile: { type: String, trim: true }, // Keeping mobile for legacy compatibility

    // Employment
    employeeCode: { type: String, trim: true },
    designation: { type: String, trim: true },
    joiningDate: { type: Date },

    // Role & Permissions
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
      index: true,
    },
    // Permission overrides — specific permissions added/removed for this user
    permissionOverrides: {
      added: [{ type: String }],
      removed: [{ type: String }],
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'invited'],
      default: 'invited',
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },

    // Authentication
    password: { type: String, required: true, select: false },
    forcePasswordChange: { type: Boolean, default: false },
    passwordChangedAt: { type: Date },
    loginAttempts: { type: Number, default: 0, required: true },
    lockoutUntil: { type: Date },

    // Session tracking
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    loginCount: { type: Number, default: 0 },

    // Device tracking
    devices: [deviceSchema],

    // Password reset
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // Preferences
    preferences: {
      timezone: { type: String, default: 'Asia/Kolkata' },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      currency: { type: String, default: 'INR' },
      language: { type: String, default: 'en' },
      notifications: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
        whatsapp: { type: Boolean, default: false },
      },
    },

    // Profile notes
    notes: { type: String, trim: true },
    avatar: { type: String },
    tdsPercentage: { type: Number, default: 5 },
  },
  { timestamps: true }
);

// Indexes for Multi-Tenant Isolation and Search performance
userSchema.index({ organizationId: 1, email: 1 }, { unique: true });
userSchema.index({ status: 1, roleId: 1 });

// Full-text search
userSchema.index(
  { firstName: 'text', lastName: 'text', email: 'text', employeeCode: 'text' },
  { name: 'user_text_search' }
);

// Virtual: full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual: backward compatibility alias for 'roleId'
userSchema.virtual('role').get(function () {
  return this.roleId;
}).set(function (v) {
  this.roleId = v;
});

// Virtual: backward compatibility alias for 'isActive'
userSchema.virtual('isActive').get(function () {
  return this.status === 'active';
}).set(function (v) {
  this.status = v ? 'active' : 'inactive';
});

// Ensure virtuals are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);
module.exports = { User };
