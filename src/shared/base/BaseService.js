'use strict';

// ---------------------------------------------------------------------------
// BaseService
// All domain services extend this class.
//
// Responsibilities:
//   - Orchestrate business logic
//   - Call repositories
//   - Publish domain events
//   - Log audit trails
//   - Trigger notifications (via event bus)
//
// Rules:
//   - NEVER access database directly
//   - NEVER contain HTTP-specific logic
//   - NEVER access req/reply objects
// ---------------------------------------------------------------------------

class BaseService {
  /**
   * @param {object} deps                  - Injected dependencies
   * @param {import('./BaseRepository')}  deps.repository    - Primary repository
   * @param {import('../events/EventBus')} deps.eventBus      - Domain event bus
   * @param {import('../audit/AuditService')} deps.auditService - Audit service
   * @param {import('pino').Logger}        deps.logger        - Logger
   */
  constructor({ repository = null, eventBus = null, auditService = null, logger = console } = {}) {
    this.repository = repository;
    this.eventBus = eventBus;
    this.auditService = auditService;
    this.logger = logger;
  }

  // -------------------------------------------------------------------------
  // Event Publishing Helpers
  // -------------------------------------------------------------------------

  /**
   * Publish a domain event to the event bus.
   * Fails silently (logs error) to avoid cascading failures.
   *
   * @param {string} eventName
   * @param {object} payload
   */
  async publishEvent(eventName, payload) {
    if (!this.eventBus) return;

    try {
      await this.eventBus.emit(eventName, payload);
    } catch (err) {
      this.logger.error({ err, eventName }, 'Failed to publish domain event');
    }
  }

  // -------------------------------------------------------------------------
  // Audit Logging Helpers
  // -------------------------------------------------------------------------

  /**
   * Log an audit event.
   * Fails silently to avoid blocking the main operation.
   *
   * @param {object} auditData
   * @param {string} auditData.action
   * @param {string} auditData.entity
   * @param {string} auditData.entityId
   * @param {string} auditData.userId
   * @param {object} [auditData.oldValues]
   * @param {object} [auditData.newValues]
   * @param {string} [auditData.description]
   */
  async logAudit(auditData) {
    if (!this.auditService) return;

    try {
      const { tenantContext } = require('../context/tenant-context');
      const richData = {
        ...auditData,
        organizationId: auditData.organizationId || tenantContext.getOrganizationId(),
        branchId: auditData.branchId || tenantContext.getBranchId(),
      };
      await this.auditService.log(richData);
    } catch (err) {
      this.logger.error({ err, auditData }, 'Failed to write audit log');
    }
  }
}

module.exports = { BaseService };
