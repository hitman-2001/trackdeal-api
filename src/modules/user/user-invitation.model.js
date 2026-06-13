'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// UserInvitation Model — Owner: User Management Module
// ---------------------------------------------------------------------------

const userInvitationSchema = new mongoose.Schema(
  {
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
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    invitationToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'cancelled'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

// Native TTL Index: automatically delete expired invitation documents
userInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for quota count querying and listing performance
userInvitationSchema.index({ organizationId: 1, status: 1, expiresAt: 1 });

// Compound Unique Index: Only allow one pending invitation per email per organization
userInvitationSchema.index(
  { organizationId: 1, email: 1, status: 1 },
  { 
    unique: true, 
    partialFilterExpression: { status: 'pending' } 
  }
);

const UserInvitation = mongoose.model('UserInvitation', userInvitationSchema);
module.exports = { UserInvitation };
