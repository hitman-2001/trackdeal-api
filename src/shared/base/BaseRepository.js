'use strict';

const { NotFoundError } = require('../errors');
const { PAGINATION } = require('../constants/app.constants');

// ---------------------------------------------------------------------------
// BaseRepository
// Generic Mongoose repository that every domain repository extends.
//
// Responsibilities:
//   - Implicit multi-tenant and branch logical query filtering.
//   - CRUD operations
//   - Soft delete / restore
//   - Pagination
//
// Rules:
//   - NO business logic
//   - NO validation
//   - NO authorization
//   - ONLY database interactions
// ---------------------------------------------------------------------------

class BaseRepository {
  /**
   * @param {import('mongoose').Model} model - The Mongoose model for this repository
   */
  constructor(model) {
    this.model = model;
    this.isTenantScoped = true;  // Default: enforce organizationId on all queries
    this.isBranchScoped = false; // Default: branch isolation is opt-in, not assumed
    // Set this.isBranchScoped = true in sub-repositories that should filter by branchId
    // when the actor is a BRANCH_MANAGER in an ENTERPRISE_AGENCY context.
  }

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------

  /**
   * Create a single document.
   * @param {object} data
   * @returns {Promise<Document>}
   */
  async create(data) {
    const tenantData = this._applyTenantContext(data);
    const doc = new this.model(tenantData);
    return doc.save();
  }

  /**
   * Insert many documents at once.
   * @param {object[]} docs
   * @returns {Promise<Document[]>}
   */
  async createMany(docs) {
    const tenantDocs = docs.map((d) => this._applyTenantContext(d));
    return this.model.insertMany(tenantDocs, { ordered: false });
  }

  // -------------------------------------------------------------------------
  // READ
  // -------------------------------------------------------------------------

  /**
   * Find a document by its _id.
   * Enforces tenant boundaries.
   * @param {string} id
   * @param {object|string} [projection]
   * @param {object} [options]
   * @returns {Promise<Document|null>}
   */
  async findById(id, projection = null, options = {}) {
    const filter = this._applyTenantFilter({ _id: id });
    return this.model.findOne(filter, projection, options);
  }

  /**
   * Find a document by _id and throw NotFoundError if missing.
   * Enforces tenant boundaries.
   * @param {string} id
   * @param {string} [resourceName] - Human-readable name for error message
   * @returns {Promise<Document>}
   */
  async findByIdOrFail(id, resourceName = 'Document') {
    const doc = await this.findById(id);
    if (!doc) throw new NotFoundError(resourceName, id);
    return doc;
  }

  /**
   * Find a single document matching the filter.
   * Enforces tenant boundaries.
   * @param {object} filter
   * @param {object|string} [projection]
   * @param {object} [options]
   * @returns {Promise<Document|null>}
   */
  async findOne(filter, projection = null, options = {}) {
    const tenantFilter = this._applyTenantFilter(filter);
    return this.model.findOne(tenantFilter, projection, options);
  }

  /**
   * Find multiple documents.
   * Enforces tenant boundaries.
   * @param {object} filter
   * @param {object} [options]
   * @param {object|string} [projection]
   * @returns {Promise<Document[]>}
   */
  async findMany(filter = {}, options = {}, projection = null) {
    const { sort, limit, skip, populate } = options;
    const tenantFilter = this._applyTenantFilter(filter);

    let query = this.model.find(tenantFilter, projection);

    if (sort) {
      let finalSort = sort;
      if (typeof sort === 'object' && !Array.isArray(sort)) {
        finalSort = { ...sort };
        for (const key of Object.keys(finalSort)) {
          if (finalSort[key] === '1') finalSort[key] = 1;
          if (finalSort[key] === '-1') finalSort[key] = -1;
        }
      }
      query = query.sort(finalSort);
    }
    if (skip) query = query.skip(skip);
    if (limit) query = query.limit(limit);
    if (populate) query = query.populate(populate);

    return query.exec();
  }

  // -------------------------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------------------------

  /**
   * Find by ID and update, enforcing tenant boundaries.
   * @param {string} id
   * @param {object} update
   * @param {object} [options]
   * @returns {Promise<Document|null>}
   */
  async update(id, update, options = { new: true, runValidators: true }) {
    const filter = this._applyTenantFilter({ _id: id });
    return this.model.findOneAndUpdate(filter, update, options);
  }

  /**
   * Update many documents matching a filter, enforcing tenant boundaries.
   * @param {object} filter
   * @param {object} update
   * @returns {Promise<object>}
   */
  async updateMany(filter, update) {
    const tenantFilter = this._applyTenantFilter(filter);
    return this.model.updateMany(tenantFilter, update);
  }

  /**
   * Find one document matching the filter and update it.
   * Enforces tenant boundaries.
   * @param {object} filter
   * @param {object} update
   * @param {object} [options]
   * @returns {Promise<Document|null>}
   */
  async findOneAndUpdate(filter, update, options = { new: true, runValidators: true }) {
    const tenantFilter = this._applyTenantFilter(filter);
    return this.model.findOneAndUpdate(tenantFilter, update, options);
  }

  // -------------------------------------------------------------------------
  // SOFT DELETE / RESTORE
  // -------------------------------------------------------------------------

  /**
   * Soft-delete a document by ID, enforcing tenant boundaries.
   * @param {string} id
   * @param {string} userId - Who performed the deletion
   * @returns {Promise<Document|null>}
   */
  async softDelete(id, userId) {
    const filter = this._applyTenantFilter({ _id: id });
    return this.model.findOneAndUpdate(
      filter,
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
        },
      },
      { new: true },
    );
  }

  /**
   * Restore a soft-deleted document, enforcing tenant boundaries.
   * @param {string} id
   * @returns {Promise<Document|null>}
   */
  async restore(id) {
    const filter = this._applyTenantFilter({ _id: id });
    return this.model.findOneAndUpdate(
      filter,
      {
        $set: {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        },
      },
      { new: true },
    );
  }

  // -------------------------------------------------------------------------
  // AGGREGATE / COUNT / EXISTS
  // -------------------------------------------------------------------------

  /**
   * Count documents matching a filter, enforcing tenant boundaries.
   * @param {object} filter
   * @returns {Promise<number>}
   */
  async count(filter = {}) {
    const tenantFilter = this._applyTenantFilter(filter);
    return this.model.countDocuments(tenantFilter);
  }

  /**
   * Check if a document exists, enforcing tenant boundaries.
   * @param {object} filter
   * @returns {Promise<boolean>}
   */
  async exists(filter) {
    const tenantFilter = this._applyTenantFilter(filter);
    const doc = await this.model.exists(tenantFilter);
    return !!doc;
  }

  /**
   * Run an aggregation pipeline.
   * NOTE: For complex aggregations, tenant filters must be manually added to the pipeline stages.
   * @param {object[]} pipeline
   * @returns {Promise<object[]>}
   */
  async aggregate(pipeline) {
    return this.model.aggregate(pipeline);
  }

  // -------------------------------------------------------------------------
  // PAGINATION
  // -------------------------------------------------------------------------

  /**
   * Paginate query results.
   * Automatically inherits tenant isolation since it routes through findMany and count.
   */
  async paginate(filter = {}, options = {}) {
    const page = Math.max(1, Number(options.page) || PAGINATION.DEFAULT_PAGE);
    const limit = Math.min(
      PAGINATION.MAX_LIMIT,
      Math.max(1, Number(options.limit) || PAGINATION.DEFAULT_LIMIT),
    );
    const skip = (page - 1) * limit;
    const sort = options.sort || { createdAt: -1 };

    const [data, total] = await Promise.all([
      this.findMany(filter, { sort, skip, limit, populate: options.populate }, options.projection),
      this.count(filter),
    ]);

    return {
      data,
      pagination: { page, limit, total },
    };
  }

  // -------------------------------------------------------------------------
  // BULK OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Perform a bulk write operation.
   * @param {object[]} operations
   * @returns {Promise<object>}
   */
  async bulkWrite(operations) {
    return this.model.bulkWrite(operations, { ordered: false });
  }

  // -------------------------------------------------------------------------
  // PRIVATE SAAS FILTERS & CONTEXT SAFEGUARDS
  // -------------------------------------------------------------------------

  /**
   * Extract tenant active parameters from thread context and merge into filter query.
   * @param {object} filter
   * @returns {object} filtered query
   * @private
   */
  _applyTenantFilter(filter = {}) {
    if (!this.isTenantScoped) {
      return filter;
    }

    const { tenantContext } = require('../context/tenant-context');

    // System bypass
    if (tenantContext.isSystemOverride()) {
      return filter;
    }

    const organizationId = tenantContext.getOrganizationId();
    const branchId = tenantContext.getBranchId();

    if (!organizationId) {
      throw new Error(
        `[SecurityError] Multi-tenant isolation failure: organizationId is missing in execution context for model '${this.model.modelName}'.`
      );
    }

    const tenantFilter = { ...filter, organizationId };

    // Branch filter is opt-in: only applied when isBranchScoped=true AND a branchId is active.
    // This prevents INDIVIDUAL_AGENT / AGENCY queries from being silently scoped to a branch.
    if (this.isBranchScoped && branchId) {
      tenantFilter.branchId = branchId;
    }

    return tenantFilter;
  }

  /**
   * Inject active tenant properties to data block on document insertion.
   * @param {object} data
   * @returns {object} tenant-populated data
   * @private
   */
  _applyTenantContext(data = {}) {
    if (!this.isTenantScoped) {
      return data;
    }

    const { tenantContext } = require('../context/tenant-context');
    const organizationId = tenantContext.getOrganizationId();
    const branchId = tenantContext.getBranchId();

    const targetOrgId = data.organizationId || organizationId;

    if (!targetOrgId && !tenantContext.isSystemOverride()) {
      throw new Error(
        `[SecurityError] Multi-tenant write isolation failure: organizationId is missing in execution context for model '${this.model.modelName}'.`
      );
    }

    return {
      ...data,
      ...(targetOrgId ? { organizationId: targetOrgId } : {}),
      branchId: data.branchId || branchId || null,
    };
  }
}

module.exports = { BaseRepository };
