'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Permission Model — Owner: Authorization Module
// ---------------------------------------------------------------------------

const permissionSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      trim: true, // e.g. 'users', 'deals'
    },
    action: {
      type: String,
      required: true,
      trim: true, // e.g. 'create', 'approve'
    },
    permissionKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true, // e.g. 'users.create', 'deals.approve'
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true, // e.g. 'User Management', 'Deals Management'
    },
    isSystemPermission: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

permissionSchema.index({ module: 1 });

const Permission = mongoose.model('Permission', permissionSchema);
module.exports = { Permission };
