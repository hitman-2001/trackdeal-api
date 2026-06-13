'use strict';

const { AuditLog } = require('./audit.model');
const { BaseRepository } = require('../../shared/base/BaseRepository');

// ---------------------------------------------------------------------------
// AuditRepository
// Read-only repository for audit log queries.
// Writes go through AuditService directly (not via base update methods).
// ---------------------------------------------------------------------------

class AuditRepository extends BaseRepository {
  constructor() {
    super(AuditLog);
  }

  /**
   * Find all audit logs for a specific entity document.
   * @param {string} entity     - Entity type (e.g., 'Lead')
   * @param {string} entityId   - Document ID
   * @param {object} pagination
   * @returns {Promise<object>}
   */
  async findByEntity(entity, entityId, pagination = {}) {
    return this.paginate(
      { entity, entityId },
      { sort: { createdAt: -1 }, ...pagination },
    );
  }

  /**
   * Find all audit logs for a specific user.
   * @param {string} userId
   * @param {object} pagination
   * @returns {Promise<object>}
   */
  async findByUser(userId, pagination = {}) {
    return this.paginate(
      { userId },
      { sort: { createdAt: -1 }, ...pagination },
    );
  }

  /**
   * Find audit logs by action type.
   * @param {string} action
   * @param {object} pagination
   * @returns {Promise<object>}
   */
  async findByAction(action, pagination = {}) {
    return this.paginate(
      { action },
      { sort: { createdAt: -1 }, ...pagination },
    );
  }

  /**
   * Find audit logs within a date range.
   * @param {Date} startDate
   * @param {Date} endDate
   * @param {object} pagination
   * @returns {Promise<object>}
   */
  async findByDateRange(startDate, endDate, pagination = {}) {
    return this.paginate(
      { createdAt: { $gte: startDate, $lte: endDate } },
      { sort: { createdAt: -1 }, ...pagination },
    );
  }
}

module.exports = { AuditRepository };
