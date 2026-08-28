"use strict";

const { authenticate } = require("../../shared/middleware/authenticate.middleware");
const { authorize } = require("../../shared/middleware/authorize.middleware");
const { PERMISSIONS } = require("../../shared/constants/roles-permissions.constants");
const { LoanController } = require("./loan.controller");

const controller = new LoanController();

async function loanRoutes(fastify, opts) {
  fastify.addHook("preValidation", authenticate);

  // Directory & Summary KPIs
  fastify.get(
    "/",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_READ || "loans.read")],
      schema: { tags: ["Loans"], summary: "Get paginated loan cases" },
    },
    controller.getLoanCases
  );

  fastify.get(
    "/summary",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_READ || "loans.read")],
      schema: { tags: ["Loans"], summary: "Get loan executive summary KPIs" },
    },
    controller.getLoanSummary
  );

  // Bank & DSA Directories
  fastify.get(
    "/banks",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_READ || "loans.read")],
      schema: { tags: ["Loans"], summary: "Get bank masters" },
    },
    controller.getBanks
  );

  fastify.post(
    "/banks",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_CREATE || "loans.create")],
      schema: { tags: ["Loans"], summary: "Create bank master" },
    },
    controller.createBank
  );

  fastify.get(
    "/dsas",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_READ || "loans.read")],
      schema: { tags: ["Loans"], summary: "Get DSA masters" },
    },
    controller.getDSAs
  );

  fastify.post(
    "/dsas",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_CREATE || "loans.create")],
      schema: { tags: ["Loans"], summary: "Create DSA master" },
    },
    controller.createDSA
  );

  // Loan Case CRUD & Lifecycle
  fastify.get(
    "/:id",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_READ || "loans.read")],
      schema: { tags: ["Loans"], summary: "Get loan case 360 profile" },
    },
    controller.getLoanCaseById
  );

  fastify.post(
    "/",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_CREATE || "loans.create")],
      schema: { tags: ["Loans"], summary: "Create loan case" },
    },
    controller.createLoanCase
  );

  fastify.post(
    "/:id/bank-applications",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_UPDATE || "loans.update")],
      schema: { tags: ["Loans"], summary: "Submit bank application" },
    },
    controller.submitBankApplication
  );

  fastify.patch(
    "/:id/documents/:docId",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_UPDATE || "loans.update")],
      schema: { tags: ["Loans"], summary: "Update document checklist item status" },
    },
    controller.updateDocument
  );

  fastify.post(
    "/:id/queries",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_UPDATE || "loans.update")],
      schema: { tags: ["Loans"], summary: "Add bank query" },
    },
    controller.addBankQuery
  );

  fastify.patch(
    "/:id/queries/:queryId/resolve",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_UPDATE || "loans.update")],
      schema: { tags: ["Loans"], summary: "Resolve bank query" },
    },
    controller.resolveBankQuery
  );

  fastify.post(
    "/:id/sanction",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_UPDATE || "loans.update")],
      schema: { tags: ["Loans"], summary: "Record loan sanction" },
    },
    controller.recordSanction
  );

  fastify.post(
    "/:id/disbursements",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_UPDATE || "loans.update")],
      schema: { tags: ["Loans"], summary: "Record loan disbursement tranche" },
    },
    controller.recordDisbursement
  );

  fastify.post(
    "/:id/activities",
    {
      preHandler: [authorize(PERMISSIONS.LOANS_UPDATE || "loans.update")],
      schema: { tags: ["Loans"], summary: "Add loan activity / touchpoint" },
    },
    controller.addActivity
  );
}

module.exports = loanRoutes;
