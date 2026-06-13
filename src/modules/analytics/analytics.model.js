"use strict";

const mongoose = require("mongoose");

// 1. Lead Summary Model
const leadSummarySchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
      index: true,
    },
    source: {
      type: String,
      default: "unknown",
      index: true,
    },
    status: {
      type: String,
      required: true,
      index: true,
    },
    leadCount: {
      type: Number,
      default: 0,
    },
    totalHoldValue: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

leadSummarySchema.index({ organizationId: 1, branchId: 1, date: 1, source: 1, status: 1 }, { unique: true, name: "unique_lead_summary" });

// 2. Sales Summary Model
const salesSummarySchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      index: true,
      default: null,
    },
    dealsClosedCount: {
      type: Number,
      default: 0,
    },
    grossDealValue: {
      type: Number,
      default: 0,
    },
    reservationsCount: {
      type: Number,
      default: 0,
    },
    reservationsBouncedCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

salesSummarySchema.index({ organizationId: 1, branchId: 1, date: 1, projectId: 1 }, { unique: true, name: "unique_sales_summary" });

// 3. Commission Summary Model
const commissionSummarySchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
      index: true,
    },
    expectedRevenue: {
      type: Number,
      default: 0,
    },
    collectedRevenue: {
      type: Number,
      default: 0,
    },
    outstandingRevenue: {
      type: Number,
      default: 0,
    },
    adjustmentDeductions: {
      type: Number,
      default: 0,
    },
    totalChequesPending: {
      type: Number,
      default: 0,
    },
    totalChequesBounced: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

commissionSummarySchema.index({ organizationId: 1, branchId: 1, date: 1 }, { unique: true, name: "unique_commission_summary" });

// 4. Task Summary Model
const taskSummarySchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
      index: true,
    },
    tasksCompleted: {
      type: Number,
      default: 0,
    },
    tasksPending: {
      type: Number,
      default: 0,
    },
    slaViolations: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

taskSummarySchema.index({ organizationId: 1, branchId: 1, date: 1 }, { unique: true, name: "unique_task_summary" });

// 5. Lead Monthly Summary Model
const leadMonthlySummarySchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
      index: true,
    },
    source: {
      type: String,
      default: "unknown",
      index: true,
    },
    status: {
      type: String,
      required: true,
      index: true,
    },
    leadCount: {
      type: Number,
      default: 0,
    },
    totalHoldValue: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

leadMonthlySummarySchema.index({ organizationId: 1, branchId: 1, date: 1, source: 1, status: 1 }, { unique: true, name: "unique_lead_monthly_summary" });

// 6. Sales Monthly Summary Model
const salesMonthlySummarySchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      index: true,
      default: null,
    },
    dealsClosedCount: {
      type: Number,
      default: 0,
    },
    grossDealValue: {
      type: Number,
      default: 0,
    },
    reservationsCount: {
      type: Number,
      default: 0,
    },
    reservationsBouncedCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

salesMonthlySummarySchema.index({ organizationId: 1, branchId: 1, date: 1, projectId: 1 }, { unique: true, name: "unique_sales_monthly_summary" });

// 7. Commission Monthly Summary Model
const commissionMonthlySummarySchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
      index: true,
    },
    expectedRevenue: {
      type: Number,
      default: 0,
    },
    collectedRevenue: {
      type: Number,
      default: 0,
    },
    outstandingRevenue: {
      type: Number,
      default: 0,
    },
    adjustmentDeductions: {
      type: Number,
      default: 0,
    },
    totalChequesPending: {
      type: Number,
      default: 0,
    },
    totalChequesBounced: {
      type: Number,
      default: 0,
    },
    totalChequesIssued: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

commissionMonthlySummarySchema.index({ organizationId: 1, branchId: 1, date: 1 }, { unique: true, name: "unique_commission_monthly_summary" });

// 8. Agent Performance Summary Model
const agentPerformanceSummarySchema = new mongoose.Schema(
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
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    leadsCreatedCount: {
      type: Number,
      default: 0,
    },
    leadsWonCount: {
      type: Number,
      default: 0,
    },
    leadsLostCount: {
      type: Number,
      default: 0,
    },
    dealsClosedCount: {
      type: Number,
      default: 0,
    },
    grossDealValue: {
      type: Number,
      default: 0,
    },
    tasksCompleted: {
      type: Number,
      default: 0,
    },
    tasksPending: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

agentPerformanceSummarySchema.index({ organizationId: 1, branchId: 1, agentId: 1, date: 1 }, { unique: true, name: "unique_agent_performance_summary" });

const LeadSummary = mongoose.model("LeadSummary", leadSummarySchema, "lead_summaries");
const SalesSummary = mongoose.model("SalesSummary", salesSummarySchema, "sales_summaries");
const CommissionSummary = mongoose.model("CommissionSummary", commissionSummarySchema, "commission_summaries");
const TaskSummary = mongoose.model("TaskSummary", taskSummarySchema, "task_summaries");

const LeadMonthlySummary = mongoose.model("LeadMonthlySummary", leadMonthlySummarySchema, "lead_monthly_summaries");
const SalesMonthlySummary = mongoose.model("SalesMonthlySummary", salesMonthlySummarySchema, "sales_monthly_summaries");
const CommissionMonthlySummary = mongoose.model("CommissionMonthlySummary", commissionMonthlySummarySchema, "commission_monthly_summaries");
const AgentPerformanceSummary = mongoose.model("AgentPerformanceSummary", agentPerformanceSummarySchema, "agent_performance_summaries");

module.exports = {
  LeadSummary,
  SalesSummary,
  CommissionSummary,
  TaskSummary,
  LeadMonthlySummary,
  SalesMonthlySummary,
  CommissionMonthlySummary,
  AgentPerformanceSummary,
};
