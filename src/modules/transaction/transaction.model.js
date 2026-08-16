'use strict';

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    transactionNumber: { type: String, unique: true }, // TXN-2026-0001

    // SaaS Multi-tenancy & Isolation
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

    // References
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },

    // Financial Breakdown
    finalSalePrice: { type: Number, required: true },
    agreementValue: { type: Number, default: 0 },
    bookingAmount: { type: Number, default: 0 },
    customerOwnContribution: { type: Number, default: 0 },
    actualLoanAmount: { type: Number, default: 0 },
    otherFundingAmount: { type: Number, default: 0 },
    discountGiven: { type: Number, default: 0 },
    additionalCharges: { type: Number, default: 0 },
    totalTransactionValue: { type: Number, required: true },

    // Actual Loan Details
    hasLoan: { type: Boolean, default: false },
    loanAmount: Number,
    loanBank: String,
    loanApplicationNumber: String,
    loanSanctionedAmount: Number,
    loanSanctionDate: Date,
    loanDisbursementAmount: Number,
    loanDisbursementDate: Date,
    loanTenure: Number,
    interestRate: Number,
    loanStatus: { type: String, enum: ['Sanctioned', 'Partially Disbursed', 'Fully Disbursed', 'Pending'] },
    loanOfficerName: String,
    loanOfficerPhone: String,
    sanctionLetterDoc: String,
    disbursementLetterDoc: String,

    // Brokerage / Our Commission
    commissionType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    commissionPercentage: Number,
    commissionAmount: Number,
    commissionGst: Number,
    totalCommissionWithGst: Number,
    commissionStatus: { type: String, enum: ['yes', 'no', 'partially'], default: 'no' },
    commissionReceivedAmount: { type: Number, default: 0 },
    commissionPendingAmount: { type: Number, default: 0 },
    commissionDueDate: Date,
    commissionReceivedDate: Date,
    commissionPaymentReference: String,
    commissionNotes: String,

    // Registration Details
    registrationRequired: { type: Boolean, default: false },
    registrationDate: Date,
    registrationNumber: String,
    registrationOffice: String,
    registrationAmount: Number,
    stampDuty: Number,
    registrationCharges: Number,
    otherGovernmentCharges: Number,
    registrationStatus: { type: String, enum: ['not_started', 'scheduled', 'completed', 'delayed'], default: 'not_started' },
    registrationDocument: String,

    // Summary & Audit
    closingDate: { type: Date, default: Date.now },
    closingNotes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

transactionSchema.index({ organizationId: 1, leadId: 1 });
transactionSchema.index({ organizationId: 1, propertyId: 1 });
transactionSchema.index({ organizationId: 1, closingDate: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = { Transaction };
