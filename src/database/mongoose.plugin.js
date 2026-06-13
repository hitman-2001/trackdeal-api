'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Global Mongoose Plugin
// Applied to ALL schemas via mongoose.plugin() in app.js.
// Adds: soft delete, audit fields, optimistic locking helpers.
// ---------------------------------------------------------------------------

/**
 * Global Mongoose plugin.
 * Automatically adds base fields and utility methods to every schema.
 *
 * @param {mongoose.Schema} schema
 */
function globalMongoosePlugin(schema) {
  // ------------------------------------------------------------------
  // Base audit fields (applied to all collections)
  // ------------------------------------------------------------------
  schema.add({
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

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  });

  // ------------------------------------------------------------------
  // Timestamps (createdAt, updatedAt)
  // Applied via schema option — but we add it as plugin fallback here
  // ------------------------------------------------------------------
  if (!schema.options.timestamps) {
    schema.set('timestamps', true);
  }

  // ------------------------------------------------------------------
  // Instance Methods
  // ------------------------------------------------------------------

  /**
   * Soft-delete a document.
   * @param {string} userId - The user performing the deletion.
   */
  schema.methods.softDelete = function (userId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId;
    return this.save();
  };

  /**
   * Restore a soft-deleted document.
   */
  schema.methods.restore = function () {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };

  // ------------------------------------------------------------------
  // Static Methods
  // ------------------------------------------------------------------

  /**
   * Find a document by ID that is not soft-deleted.
   * @param {string} id
   * @param {object} [projection]
   */
  schema.statics.findActiveById = function (id, projection) {
    return this.findOne({ _id: id, isDeleted: false }, projection);
  };

  // ------------------------------------------------------------------
  // Query Middleware — exclude soft-deleted by default
  // ------------------------------------------------------------------
  const excludeDeleted = function () {
    // Only apply the default filter if not explicitly asked for deleted docs
    if (!this.getQuery().isDeleted && this.getQuery().isDeleted !== false) {
      this.where({ isDeleted: false });
    }
  };

  schema.pre('find', excludeDeleted);
  schema.pre('findOne', excludeDeleted);
  schema.pre('findOneAndUpdate', excludeDeleted);
  schema.pre('countDocuments', excludeDeleted);

  // ------------------------------------------------------------------
  // JSON Transform — remove internal fields from API responses
  // ------------------------------------------------------------------
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    },
  });

  schema.set('toObject', {
    virtuals: true,
    versionKey: false,
  });
}

module.exports = { globalMongoosePlugin };
