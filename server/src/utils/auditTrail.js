'use strict';

const auditService = require('../services/audit.service');
const logger = require('./logger');

/**
 * Audit Trail Helper & Middleware
 * Delegates to AuditService for SHA-256 tamper-evident append-only logging.
 */
class AuditTrail {
  constructor() {
    this.service = auditService;
    this.ignoredFields = ['createdAt', 'updatedAt', 'password'];
  }

  /**
   * Track changes to an entity
   * @param {string} entity - Entity name (e.g., 'Patient', 'Appointment')
   * @param {string} action - Action type (CREATE, UPDATE, DELETE, etc.)
   * @param {Object} data - Change data
   */
  async log(entity, action, data = {}) {
    return this.service.logEvent({
      entity,
      action,
      entityId: data.entityId || data.resourceId,
      actorUserId: data.userId || data.actorUserId,
      organizationId: data.organizationId,
      oldValues: data.oldValues || null,
      newValues: data.newValues || null,
      changes: data.changes || null,
      metadata: data.details || data.metadata || null,
      ip: data.ip,
      userAgent: data.userAgent,
      requestId: data.requestId
    });
  }

  /**
   * Express middleware to track request context
   */
  middleware() {
    return (req, res, next) => {
      req.audit = {
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get ? req.get('user-agent') : null
      };
      next();
    };
  }

  /**
   * Compare old and new values to find changes
   */
  getChanges(oldValues, newValues) {
    return this.service.calculateDiff(oldValues, newValues);
  }
}

module.exports = new AuditTrail();
