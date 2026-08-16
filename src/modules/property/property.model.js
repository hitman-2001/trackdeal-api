'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Property Model — Owner: Property Module
// ---------------------------------------------------------------------------

const priceHistorySchema = new mongoose.Schema({
  price: { type: Number, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: String,
  changedAt: { type: Date, default: Date.now },
}, { _id: false });

const propertySchema = new mongoose.Schema(
  {
    // Basic info
    title: { type: String, required: true, trim: true },
    description: String,
    type: { type: String, enum: ['apartment', 'villa', 'plot', 'commercial', 'office', 'shop'], required: true },
    subType: String,

    // Seller
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },

    // Project
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },

    // Location
    location: {
      address: String,
      area: String,
      city: { type: String, required: true },
      state: String,
      pincode: String,
      coordinates: { type: { type: String, enum: ['Point'] }, coordinates: [Number] },
    },

    // Pricing
    price: { type: Number, required: true },
    priceUnit: { type: String, enum: ['total', 'per_sqft'], default: 'total' },
    priceHistory: [priceHistorySchema],
    isNegotiable: { type: Boolean, default: true },

    // Specifications
    area: { carpet: Number, builtUp: Number, superBuiltUp: Number, unit: { type: String, default: 'sqft' } },
    bhk: Number,
    bathrooms: Number,
    floors: Number,
    totalFloors: Number,
    facing: { type: String, enum: ['north', 'south', 'east', 'west', 'north-east', 'north-west', 'south-east', 'south-west'] },
    furnishing: { type: String, enum: ['unfurnished', 'semi-furnished', 'fully-furnished'] },
    possessionStatus: { type: String, enum: ['ready', 'under_construction', 'new_launch'] },
    possessionDate: Date,

    // Availability
    status: {
      type: String,
      enum: ['available', 'reserved', 'sold', 'off_market'],
      default: 'available',
      index: true,
    },

    // Amenities & features
    amenities: [String],
    features: [String],
    tags: [String],

    // Media — referenced from files collection
    gallery: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
    documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],

    // Multitenancy & Audit
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Soft delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

propertySchema.index({ status: 1, type: 1, 'location.city': 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ seller: 1 });
propertySchema.index({ project: 1 });
propertySchema.index({ 'location.coordinates': '2dsphere' }, { sparse: true });
propertySchema.index({ title: 'text', description: 'text', 'location.area': 'text' }, { name: 'property_text_search' });

const Property = mongoose.model('Property', propertySchema);
module.exports = { Property };
