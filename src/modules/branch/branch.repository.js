'use strict';

const { Branch } = require('./branch.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

// ---------------------------------------------------------------------------
// BranchRepository
// Owner: Branch Module
// ---------------------------------------------------------------------------

class BranchRepository extends BaseRepository {
  constructor() {
    super(Branch);
    this.isTenantScoped = true; // Branches are strictly scoped within an organization
  }

  /**
   * Find a branch by its unique code per organization.
   * @param {string} code
   * @returns {Promise<Branch|null>}
   */
  async findByCode(code) {
    return this.findOne({ code: code.toLowerCase().trim() });
  }

  /**
   * Find a branch by its name per organization.
   * @param {string} name
   * @returns {Promise<Branch|null>}
   */
  async findByName(name) {
    return this.findOne({ name: name.trim() });
  }
}

module.exports = { BranchRepository };
