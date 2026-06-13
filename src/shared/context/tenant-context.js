'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

// ---------------------------------------------------------------------------
// TenantContext
// Manages thread-local request context for multi-tenant isolation.
// Leverages Node.js AsyncLocalStorage to pass tenant ID downward implicitly.
// ---------------------------------------------------------------------------

class TenantContext {
  constructor() {
    this._storage = new AsyncLocalStorage();
  }

  /**
   * Run a function within a specified tenant context.
   * @param {object} context - { organizationId, branchId, isSystemOverride }
   * @param {function} callback
   */
  run(context, callback) {
    return this._storage.run(context, callback);
  }

  /**
   * Get the current store context.
   * @returns {object|undefined}
   */
  getStore() {
    return this._storage.getStore();
  }

  /**
   * Get current active organization ID.
   * @returns {string|undefined}
   */
  getOrganizationId() {
    const store = this.getStore();
    return store?.organizationId;
  }

  /**
   * Get current active branch ID.
   * @returns {string|undefined}
   */
  getBranchId() {
    const store = this.getStore();
    return store?.branchId;
  }

  /**
   * Check if a system override is active (bypasses tenant enforcement).
   * Used for platform operations, server-to-server background actions, or seeds.
   * @returns {boolean}
   */
  isSystemOverride() {
    const store = this.getStore();
    return !!store?.isSystemOverride;
  }

  /**
   * Get the current organization type for the active context.
   * @returns {string|null} e.g. 'INDIVIDUAL_AGENT' | 'AGENCY' | 'ENTERPRISE_AGENCY'
   */
  getOrganizationType() {
    const store = this.getStore();
    return store?.organizationType || null;
  }

  /**
   * Returns true if the current context is an ENTERPRISE_AGENCY organization.
   * Used to gate branch-level features and data filters.
   * @returns {boolean}
   */
  isEnterpriseAgency() {
    return this.getOrganizationType() === 'ENTERPRISE_AGENCY';
  }

  /**
   * Returns true if the current context is an INDIVIDUAL_AGENT organization.
   * @returns {boolean}
   */
  isIndividualAgent() {
    return this.getOrganizationType() === 'INDIVIDUAL_AGENT';
  }
}

// Global Singleton Instance
const tenantContext = new TenantContext();

module.exports = { tenantContext };
