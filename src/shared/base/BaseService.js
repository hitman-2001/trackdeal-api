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

  getAuditService() {
    if (this.auditService) return this.auditService;
    try {
      const { auditService } = require('../../modules/audit/audit.service');
      this.auditService = auditService;
      return this.auditService;
    } catch (err) {
      return null;
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
   * @param {string} [auditData.entityId]
   * @param {string} [auditData.userId]
   * @param {object} [auditData.actor]
   * @param {object} [auditData.oldValues]
   * @param {object} [auditData.newValues]
   * @param {string} [auditData.description]
   * @param {string} [auditData.module]
   */
  async logAudit(auditData) {
    const svc = this.getAuditService();
    if (!svc) return;

    try {
      const { tenantContext } = require('../context/tenant-context');
      const richData = {
        ...auditData,
        organizationId: auditData.organizationId || tenantContext.getOrganizationId() || auditData.actor?.organizationId,
        branchId: auditData.branchId || tenantContext.getBranchId() || auditData.actor?.branchId,
      };

      if (!richData.userSnapshot && auditData.actor) {
        richData.userSnapshot = {
          name: [auditData.actor.firstName, auditData.actor.lastName].filter(Boolean).join(' ') || auditData.actor.name || auditData.actor.email || 'Admin',
          email: auditData.actor.email || '',
          role: auditData.actor.role || 'admin',
        };
      }
      if (!richData.userId && auditData.actor) {
        richData.userId = auditData.actor.id || auditData.actor._id;
      }
      if (!richData.module) {
        if (richData.entity === 'User' || (richData.action && richData.action.startsWith('user.'))) {
          richData.module = 'Users';
        } else if (richData.entity === 'Lead' || (richData.action && richData.action.startsWith('lead.'))) {
          richData.module = 'Leads';
        } else if (['Student', 'Class'].includes(richData.entity) || (richData.action && richData.action.startsWith('education.'))) {
          richData.module = 'Education';
        } else {
          richData.module = richData.entity || 'General';
        }
      }

      await svc.log(richData);
    } catch (err) {
      this.logger.error({ err, auditData }, 'Failed to write audit log');
    }
  }
}

module.exports = { BaseService };
