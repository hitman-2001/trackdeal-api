"use strict";

const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// 1. Builder Model
// ---------------------------------------------------------------------------

const builderSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    rera: {
      type: String,
      trim: true,
    },
    bankName: {
      type: String,
      trim: true,
    },
    bankIfsc: {
      type: String,
      trim: true,
    },
    bankAccount: {
      type: String,
      trim: true,
    },
    bankHolder: {
      type: String,
      trim: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Compound Unique Indexes for Multi-Tenant Builder Coding
builderSchema.index(
  { organizationId: 1, code: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
builderSchema.index(
  { organizationId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

const Builder = mongoose.model("Builder", builderSchema, "builders");

// ---------------------------------------------------------------------------
// 2. Amenity Model
// ---------------------------------------------------------------------------

const amenitySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Compound Unique Indexes for Amenities
amenitySchema.index(
  { organizationId: 1, code: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
amenitySchema.index(
  { organizationId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

const Amenity = mongoose.model("Amenity", amenitySchema, "amenities");

// ---------------------------------------------------------------------------
// 3. Project Model
// ---------------------------------------------------------------------------

const projectSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
      default: null,
    },
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Builder",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    locality: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    rera: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["upcoming", "under_construction", "ready_to_move", "sold_out"],
      default: "upcoming",
      index: true,
    },
    amenities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Amenity",
      },
    ],
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Compound Unique Indexes for Multi-Tenant Projects
projectSchema.index(
  { organizationId: 1, builderId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
projectSchema.index(
  { organizationId: 1, code: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
projectSchema.index({ organizationId: 1, status: 1 });

const Project = mongoose.model("Project", projectSchema, "projects");

// ---------------------------------------------------------------------------
// 4. Tower Model
// ---------------------------------------------------------------------------

const towerSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
      default: null,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Compound Unique Indexes for Towers
towerSchema.index(
  { organizationId: 1, projectId: 1, code: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
towerSchema.index(
  { organizationId: 1, projectId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

const Tower = mongoose.model("Tower", towerSchema, "towers");

// ---------------------------------------------------------------------------
// 5. Unit Model
// ---------------------------------------------------------------------------

const unitSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
      default: null,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    towerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tower",
      required: true,
      index: true,
    },
    unitNumber: {
      type: String,
      required: true,
      trim: true,
    },
    configuration: {
      type: String,
      enum: [
        "1BHK",
        "2BHK",
        "3BHK",
        "4BHK",
        "5BHK",
        "penthouse",
        "villa",
        "studio",
        "commercial",
        "office",
        "shop",
        "other",
      ],
      required: true,
    },
    carpetArea: {
      type: Number,
      required: true,
    },
    builtUpArea: {
      type: Number,
    },
    price: {
      type: Number,
      required: true,
    },
    availability: {
      type: String,
      enum: ["available", "reserved", "sold", "blocked"],
      default: "available",
      index: true,
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    reservedByLeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },
    soldToCustomerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    soldPrice: {
      type: Number,
    },
    soldDate: {
      type: Date,
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Compound Unique Indexes for Units
unitSchema.index(
  { organizationId: 1, projectId: 1, towerId: 1, unitNumber: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
unitSchema.index({ organizationId: 1, projectId: 1, availability: 1 });
unitSchema.index({ organizationId: 1, availability: 1, price: 1 });

// High-Performance Additional Recommended Indexes
unitSchema.index({ organizationId: 1, branchId: 1, availability: 1 });
unitSchema.index({ organizationId: 1, towerId: 1, availability: 1 });
unitSchema.index({ organizationId: 1, soldToCustomerId: 1 }, { sparse: true });

const Unit = mongoose.model("Unit", unitSchema, "units");

// ---------------------------------------------------------------------------
// 6. UnitStatusHistory Model
// ---------------------------------------------------------------------------

const unitStatusHistorySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
      default: null,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
      index: true,
    },
    previousStatus: {
      type: String,
      enum: ["available", "reserved", "sold", "blocked"],
      required: true,
    },
    newStatus: {
      type: String,
      enum: ["available", "reserved", "sold", "blocked"],
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

unitStatusHistorySchema.index({ organizationId: 1, unitId: 1, changedAt: -1 });

const UnitStatusHistory = mongoose.model(
  "UnitStatusHistory",
  unitStatusHistorySchema,
  "unit_status_history"
);

module.exports = {
  Builder,
  Amenity,
  Project,
  Tower,
  Unit,
  UnitStatusHistory,
};
