'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Notification Model — Owner: Notification Module
// ---------------------------------------------------------------------------

const notificationSchema = new mongoose.Schema(
  {
    // Recipient
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Content
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['info', 'success', 'warning', 'error', 'lead', 'deal', 'invoice', 'visit', 'system'],
      default: 'info',
    },

    // Channel
    channel: {
      type: String,
      enum: ['in_app', 'email', 'whatsapp', 'sms'],
      default: 'in_app',
    },

    // Delivery tracking
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed'],
      default: 'pending',
    },
    sentAt: Date,
    deliveredAt: Date,
    failureReason: String,
    retryCount: { type: Number, default: 0 },

    // Read tracking (in-app only)
    isRead: { type: Boolean, default: false },
    readAt: Date,

    // Link to related entity
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
    actionUrl: String,

    // Metadata
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ status: 1, channel: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = { Notification };
