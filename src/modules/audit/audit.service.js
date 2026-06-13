'use strict';

const { AuditLog } = require('./audit.model');
const { AuditRepository } = require('./audit.repository');
const { tenantContext } = require('../../shared/context/tenant-context');

// ---------------------------------------------------------------------------
// AuditService
// Centralized logging processor. Integrates with BullMQ for 100% async processing.
// ---------------------------------------------------------------------------

class AuditService {
  constructor() {
    this.auditRepository = new AuditRepository();
  }

  /**
   * Enqueue an audit log entry inside the BullMQ 'audit' queue.
   * Runs in milliseconds and never blocks the client HTTP thread.
   *
   * @param {object} data
   */
  async log(data) {
    try {
      const { getQueue } = require('../../queues/queue-manager');
      const { QUEUES } = require('../../shared/constants/app.constants');

      const queue = getQueue(QUEUES.AUDIT);
      await queue.add('write-audit-log', data, { removeOnComplete: true });
    } catch (err) {
      console.error('[AuditService] Failed to enqueue audit log to BullMQ queue, falling back to direct write:', err.message);
      // Fallback to direct DB write if queue is temporarily offline (fail-safety)
      await this.saveDirect(data);
    }
  }

  /**
   * Direct database write.
   * Executed by the asynchronous BullMQ worker process.
   * Runs in system bypass context.
   *
   * @param {object} data
   */
  async saveDirect(data) {
    return tenantContext.run({ isSystemOverride: true }, async () => {
      const auditLog = new AuditLog({
        organizationId: data.organizationId,
        branchId: data.branchId || null,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        userId: data.userId,
        userSnapshot: data.userSnapshot,
        oldValues: data.oldValues,
        newValues: data.newValues,
        description: data.description,
        requestMetadata: data.requestMetadata,
        module: data.module,
      });

      await auditLog.save();
    });
  }

  /**
   * Get audit history for a specific entity document.
   * @param {string} entity
   * @param {string} entityId
   * @param {object} pagination
   */
  async getEntityHistory(entity, entityId, pagination) {
    return this.auditRepository.findByEntity(entity, entityId, pagination);
  }

  /**
   * Get all audit logs for a specific user.
   * @param {string} userId
   * @param {object} pagination
   */
  async getUserActivity(userId, pagination) {
    return this.auditRepository.findByUser(userId, pagination);
  }

  /**
   * Query audit logs with filters.
   * @param {object} filters
   * @param {object} pagination
   */
  async queryLogs(filters, pagination) {
    const query = {};

    if (filters.entity) query.entity = filters.entity;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.userId) query.userId = filters.userId;
    if (filters.action) query.action = filters.action;
    if (filters.module) query.module = filters.module;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    return this.auditRepository.paginate(query, {
      sort: { createdAt: -1 },
      ...pagination,
    });
  }
}

// Singleton instance — shared across the application via dependency injection
const auditService = new AuditService();

module.exports = { AuditService, auditService };
