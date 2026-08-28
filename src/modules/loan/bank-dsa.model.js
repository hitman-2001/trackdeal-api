"use strict";

const mongoose = require("mongoose");

const bankMasterSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    branch: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    mobile: { type: String, trim: true },
    email: { type: String, trim: true },
    standardCommissionRate: { type: Number, default: 0.5 },
    remarks: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const dsaMasterSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: { type: String, trim: true },
    mobile: { type: String, trim: true },
    email: { type: String, trim: true },
    supportedBanks: [{ type: String, trim: true }],
    commissionTerms: { type: String, trim: true },
    standardCommissionRate: { type: Number, default: 0.6 },
    remarks: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const BankMaster = mongoose.model("BankMaster", bankMasterSchema);
const DsaMaster = mongoose.model("DsaMaster", dsaMasterSchema);

module.exports = { BankMaster, DsaMaster };
