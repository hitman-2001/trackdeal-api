'use strict';

const mongoose = require('mongoose');
const { AUDIT_ACTIONS } = require('../../shared/constants/app.constants');

// ---------------------------------------------------------------------------
// AuditLog Model
// Append-only log of all significant operations in the system.
// NEVER soft-delete audit logs — they are a permanent compliance record.
// ---------------------------------------------------------------------------

const auditLogSchema = new mongoose.Schema(
  {
    // SaaS Boundaries (Optional for Platform System Administrator logs)
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      default: null,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      index: true,
    },

    // What action was performed
    action: {
      type: String,
      required: true,
      index: true,
    },

    // Which entity type was affected
    entity: {
      type: String,
      required: true,
      index: true,
      // e.g., 'Lead', 'Deal', 'Invoice', 'User'
    },

    // The _id of the affected document
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // Who performed the action
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // User information snapshot (in case user is deleted later)
    userSnapshot: {
      name: String,
      email: String,
      role: String,
    },

    // Previous state of the document (for UPDATE/DELETE)
    oldValues: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // New state of the document (for CREATE/UPDATE)
    newValues: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Human-readable description
    description: {
      type: String,
    },

    // Request metadata for traceability
    requestMetadata: {
      ip: String,
      userAgent: String,
      requestId: String,
      method: String,
      url: String,
    },

    // Module context
    module: {
      type: String,
      // e.g., 'lead', 'deal', 'invoice'
    },
  },
  {
    timestamps: true,
    // Audit logs are append-only — disable update and delete hooks
  },
);

// ------------------------------------------------------------------
// Indexes
// ------------------------------------------------------------------
auditLogSchema.index({ organizationId: 1, entity: 1, entityId: 1, createdAt: -1 }); // Multi-tenant Entity history
auditLogSchema.index({ organizationId: 1, userId: 1, createdAt: -1 });               // Multi-tenant User activity
auditLogSchema.index({ organizationId: 1, action: 1, createdAt: -1 });               // Multi-tenant Action history
auditLogSchema.index({ organizationId: 1, createdAt: -1 });                          // Multi-tenant Time-range queries

// Audit logs should NOT use the global soft-delete plugin filtering
// They are permanent records — no isDeleted / deletedAt fields needed
auditLogSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = { AuditLog };
