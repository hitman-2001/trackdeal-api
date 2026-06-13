'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// File Model — Owner: File Module
// Tracks all document attachments, user avatars, property pictures, etc.
// ---------------------------------------------------------------------------

const fileSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    filename: { type: String, required: true }, // Saved unique name on disk or cloud
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    storagePath: { type: String, required: true }, // Local path or S3 Key/URL
    storageType: { type: String, enum: ['local', 's3'], default: 'local', required: true },
    
    // Poly-reference linking this file to specific domain entities
    entityType: {
      type: String,
      enum: ['user', 'lead', 'customer', 'seller', 'property', 'deal', 'agreement'],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

fileSchema.index({ entityType: 1, entityId: 1 });

const File = mongoose.model('File', fileSchema);
module.exports = { File };
