"use strict";

const { BaseRepository } = require("../../shared/base/BaseRepository");
const { LoanCase } = require("./loan-case.model");
const { BankMaster, DsaMaster } = require("./bank-dsa.model");

class LoanCaseRepository extends BaseRepository {
  constructor() {
    super(LoanCase);
    this.isTenantScoped = true;
    this.isBranchScoped = false;
  }
}

class BankMasterRepository extends BaseRepository {
  constructor() {
    super(BankMaster);
    this.isTenantScoped = true;
  }
}

class DsaMasterRepository extends BaseRepository {
  constructor() {
    super(DsaMaster);
    this.isTenantScoped = true;
  }
}

module.exports = {
  LoanCaseRepository,
  BankMasterRepository,
  DsaMasterRepository,
};
