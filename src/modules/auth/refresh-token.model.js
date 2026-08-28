'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Refresh Token Model — Owner: Authentication Module
// Used for secure token rotation, reuse detection, and session revocation.
// ---------------------------------------------------------------------------

const refreshTokenSchema = new mongoose.Schema(
  {
    // SaaS Boundaries
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      default: null,
      index: true,
    },

    // The SHA-256 hash of the refresh token
    token: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    device: {
      type: String,
      trim: true,
    },
    ip: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // MongoDB native TTL index — auto-cleanup on expiry
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    replacedByToken: {
      type: String,
    },
  },
  { timestamps: true }
);

// Compound Index for high-concurrency token checks
refreshTokenSchema.index({ token: 1, isUsed: 1, isRevoked: 1 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
module.exports = { RefreshToken };
