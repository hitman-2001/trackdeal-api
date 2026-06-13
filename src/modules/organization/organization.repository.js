'use strict';

const { Organization } = require('./organization.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

// ---------------------------------------------------------------------------
// OrganizationRepository
// Owner: Organization Module
// ---------------------------------------------------------------------------

class OrganizationRepository extends BaseRepository {
  constructor() {
    super(Organization);
    this.isTenantScoped = false; // Organizations are root tenants, so they bypass multi-tenant sub-filters
  }

  /**
   * Find an organization by its unique code.
   * @param {string} code
   * @returns {Promise<Organization|null>}
   */
  async findByCode(code) {
    return this.model.findOne({ code: code.toLowerCase().trim() });
  }

  /**
   * Find an organization by its email.
   * @param {string} email
   * @returns {Promise<Organization|null>}
   */
  async findByEmail(email) {
    return this.model.findOne({ email: email.toLowerCase().trim() });
  }
}

module.exports = { OrganizationRepository };
