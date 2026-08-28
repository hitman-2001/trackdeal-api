"use strict";

const { BaseController } = require("../../shared/base/BaseController");
const { LoanService } = require("./loan.service");

class LoanController extends BaseController {
  constructor(deps = {}) {
    const service = deps.loanService || new LoanService();
    super({ service, logger: deps.logger || console });
    this.loanService = service;
  }

  async getLoanCases(request, reply) {
    const result = await this.loanService.getLoanCases(request.query, this.getUser(request));
    return this.paginated(reply, result.data, result.pagination, "Loan cases retrieved successfully");
  }

  async getLoanSummary(request, reply) {
    const result = await this.loanService.getLoanSummary(request.query, this.getUser(request));
    return this.ok(reply, result, "Loan summary metrics retrieved successfully");
  }

  async getLoanCaseById(request, reply) {
    const result = await this.loanService.getLoanCaseById(request.params.id, this.getUser(request));
    return this.ok(reply, result, "Loan case details retrieved successfully");
  }

  async createLoanCase(request, reply) {
    const result = await this.loanService.createLoanCase(request.body, this.getUser(request));
    return this.created(reply, result, "Loan case created successfully");
  }

  async submitBankApplication(request, reply) {
    const result = await this.loanService.submitBankApplication(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, result, "Bank application submitted successfully");
  }

  async updateDocument(request, reply) {
    const result = await this.loanService.updateDocument(
      request.params.id,
      request.params.docId,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, result, "Document status updated successfully");
  }

  async addBankQuery(request, reply) {
    const result = await this.loanService.addBankQuery(request.params.id, request.body, this.getUser(request));
    return this.created(reply, result, "Bank query logged successfully");
  }

  async resolveBankQuery(request, reply) {
    const result = await this.loanService.resolveBankQuery(
      request.params.id,
      request.params.queryId,
      request.body,
      this.getUser(request)
    );
    return this.ok(reply, result, "Bank query resolved successfully");
  }

  async recordSanction(request, reply) {
    const result = await this.loanService.recordSanction(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, result, "Loan sanction recorded successfully");
  }

  async recordDisbursement(request, reply) {
    const result = await this.loanService.recordDisbursement(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, result, "Loan disbursement recorded successfully");
  }

  async addActivity(request, reply) {
    const result = await this.loanService.addActivity(request.params.id, request.body, this.getUser(request));
    return this.ok(reply, result, "Loan activity logged successfully");
  }

  async getBanks(request, reply) {
    const result = await this.loanService.getBanks(this.getUser(request));
    return this.ok(reply, result, "Banks retrieved successfully");
  }

  async createBank(request, reply) {
    const result = await this.loanService.createBank(request.body, this.getUser(request));
    return this.created(reply, result, "Bank created successfully");
  }

  async getDSAs(request, reply) {
    const result = await this.loanService.getDSAs(this.getUser(request));
    return this.ok(reply, result, "DSAs retrieved successfully");
  }

  async createDSA(request, reply) {
    const result = await this.loanService.createDSA(request.body, this.getUser(request));
    return this.created(reply, result, "DSA created successfully");
  }
}

module.exports = { LoanController };
