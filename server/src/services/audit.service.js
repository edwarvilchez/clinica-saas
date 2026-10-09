'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');
const context = require('../utils/context');
const AuditLog = require('../models/AuditLog');
const sequelize = require('../config/db.config');

/**
 * 🔒 GENESIS HASH for unchained root records
 */
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const CRITICAL_ACTIONS = new Set([
  'MEDICAL_RECORD_SIGN',
  'PRESCRIPTION_SIGN',
  'ROLE_CHANGE',
  'PERMISSION_CHANGE',
  'FINANCIAL_MODIFICATION',
  'SENSITIVE_DOCUMENT_ACCESS',
  'PATIENT_DATA_DELETION',
  'ORGANIZATION_ADMIN'
]);

const SENSITIVE_FIELDS = new Set([
  'password', 'token', 'refreshtoken', 'resettoken', 'twofactorsecret',
  'recoverycodes', 'secret', 'apikey', 'authorization', 'cookie'
]);

function redactSensitiveData(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(redactSensitiveData);
  const sanitized = {};
  for (const [k, v] of Object.entries(data)) {
    const lowerKey = k.toLowerCase();
    if (SENSITIVE_FIELDS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('token') || lowerKey.includes('secret')) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      sanitized[k] = redactSensitiveData(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

class AuditService {
  constructor() {
    this.ignoredDiffFields = ['createdAt', 'updatedAt', 'password', 'deletedAt', 'token', 'resetToken', 'twoFactorSecret', 'recoveryCodes'];
  }

  /**
   * Deterministically computes the SHA-256 cryptographic hash of an audit event entry.
   * Ensures reproducible canonical hashing across environments.
   * 
   * @param {Object} entry - Audit event attributes
   * @param {string} previousHash - Previous entry's currentHash in the chain
   * @returns {string} SHA-256 hex digest
   */
  computeAuditHash(entry, previousHash) {
    const timestampStr = entry.timestamp instanceof Date
      ? entry.timestamp.toISOString()
      : (entry.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString());

    const canonicalPayload = {
      action: String(entry.action || ''),
      actorUserId: entry.actorUserId ? String(entry.actorUserId) : null,
      changes: entry.changes ? JSON.parse(JSON.stringify(entry.changes)) : null,
      entity: String(entry.entity || ''),
      entityId: entry.entityId ? String(entry.entityId) : null,
      metadata: entry.metadata ? JSON.parse(JSON.stringify(entry.metadata)) : null,
      organizationId: entry.organizationId ? String(entry.organizationId) : null,
      previousHash: String(previousHash || GENESIS_HASH),
      timestamp: timestampStr
    };

    // Recursively sort object keys for deterministic canonical hashing
    const sortKeys = (obj) => {
      if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
      }
      const sorted = {};
      for (const k of Object.keys(obj).sort()) {
        sorted[k] = sortKeys(obj[k]);
      }
      return sorted;
    };

    const canonicalJson = JSON.stringify(sortKeys(canonicalPayload));
    return crypto.createHash('sha256').update(canonicalJson).digest('hex');
  }

  /**
   * Calculates field-level difference between old and new state
   * 
   * @param {Object} oldValues 
   * @param {Object} newValues 
   * @returns {Object|null}
   */
  calculateDiff(oldValues = {}, newValues = {}) {
    if (!oldValues && !newValues) return null;
    const oldObj = oldValues || {};
    const newObj = newValues || {};
    const changes = {};

    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
      if (this.ignoredDiffFields.includes(key)) continue;

      const oldVal = oldObj[key];
      const newVal = newObj[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[key] = {
          from: oldVal !== undefined ? oldVal : null,
          to: newVal !== undefined ? newVal : null
        };
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  }

  /**
   * Retrieves the current tip hash for an organization's audit log chain.
   * Uses lock or latest query to ensure unbroken chaining.
   * 
   * @param {string|null} organizationId 
   * @param {Object} transaction 
   * @returns {Promise<string>}
   */
  async getLatestHash(organizationId = null, transaction = null) {
    try {
      const whereClause = organizationId ? { organizationId } : { organizationId: null };

      // We bypass standard tenant filtering to query the exact audit tip
      const latest = await AuditLog.findOne({
        where: whereClause,
        order: [
          ['timestamp', 'DESC'],
          ['id', 'DESC']
        ],
        attributes: ['id', 'currentHash'],
        transaction,
        // Bypass hooks that might restrict finding the latest entry
        hooks: false
      });

      return latest ? latest.currentHash : GENESIS_HASH;
    } catch (err) {
      logger.warn({ error: err.message, organizationId }, 'Failed to fetch latest audit hash, fallback to GENESIS');
      return GENESIS_HASH;
    }
  }

  /**
   * Main audit logging method. Creates an immutable, hash-chained audit record.
   * Concurrency-safe: utilizes transactional advisory locks to prevent chain branching.
   * 
   * @param {Object} params
   * @returns {Promise<AuditLog>}
   */
  async logEvent(params) {
    if (params?.transaction) {
      return this._executeLogEvent(params, params.transaction);
    }
    return sequelize.transaction(async (t) => {
      return this._executeLogEvent(params, t);
    });
  }

  async _executeLogEvent({
    organizationId,
    actorUserId,
    action,
    entity,
    entityId,
    oldValues = null,
    newValues = null,
    changes = null,
    metadata = null,
    ip = null,
    userAgent = null,
    requestId = null,
    isCritical = false
  }, transaction) {
    try {
      const ctx = context.get() || {};
      const resolvedOrgId = organizationId !== undefined ? organizationId : (ctx.organizationId || null);

      // 🔒 Concurrency lock: Fail-Closed transactional advisory lock in PostgreSQL
      if (sequelize.getDialect() === 'postgres') {
        const lockKeyStr = `audit_chain_${resolvedOrgId || 'global'}`;
        try {
          await sequelize.query(
            `SELECT pg_advisory_xact_lock(hashtext(:lockKey));`,
            {
              replacements: { lockKey: lockKeyStr },
              transaction,
              logging: false
            }
          );
        } catch (lockErr) {
          logger.error({ error: lockErr.message, lockKeyStr }, '❌ Advisory lock acquisition failed (fail-closed)');
          throw lockErr;
        }
      }

      const resolvedActorId = actorUserId !== undefined ? actorUserId : (ctx.userId || null);
      const resolvedIp = ip || ctx.ip || null;
      const resolvedUserAgent = userAgent || ctx.userAgent || null;
      const resolvedRequestId = requestId || ctx.requestId || null;

      let finalChanges = changes;
      if (!finalChanges && (oldValues || newValues)) {
        finalChanges = this.calculateDiff(oldValues, newValues);
      }

      // Redact sensitive data before hashing and storing
      const sanitizedOld = oldValues ? redactSensitiveData(JSON.parse(JSON.stringify(oldValues))) : null;
      const sanitizedNew = newValues ? redactSensitiveData(JSON.parse(JSON.stringify(newValues))) : null;
      const sanitizedChanges = finalChanges ? redactSensitiveData(JSON.parse(JSON.stringify(finalChanges))) : null;
      const sanitizedMetadata = metadata ? redactSensitiveData(JSON.parse(JSON.stringify(metadata))) : null;

      const timestamp = new Date();

      // Retrieve previous hash in this organization's chain (strictly serialized under advisory lock)
      const previousHash = await this.getLatestHash(resolvedOrgId, transaction);

      // Compute current cryptographic SHA-256 hash using sanitized payload
      const currentHash = this.computeAuditHash({
        action,
        actorUserId: resolvedActorId,
        changes: sanitizedChanges,
        entity,
        entityId,
        metadata: sanitizedMetadata,
        organizationId: resolvedOrgId,
        timestamp
      }, previousHash);

      const record = await AuditLog.create({
        organizationId: resolvedOrgId,
        actorUserId: resolvedActorId,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        oldValues: sanitizedOld,
        newValues: sanitizedNew,
        changes: sanitizedChanges,
        ip: resolvedIp,
        userAgent: resolvedUserAgent,
        requestId: resolvedRequestId,
        metadata: sanitizedMetadata,
        timestamp,
        previousHash,
        currentHash
      }, {
        transaction,
        // Bypass user-level create hook check to allow audit insertion
        hooks: false
      });

      logger.debug({
        auditId: record.id,
        action,
        entity,
        organizationId: resolvedOrgId,
        currentHash: currentHash.substring(0, 12) + '...'
      }, '🔒 Tamper-evident audit log recorded');

      return record;
    } catch (error) {
      logger.error({
        error: error.message,
        stack: error.stack,
        action,
        entity,
        entityId
      }, '❌ Failed to record tamper-evident audit log');

      // Failure policy: critical actions roll back the business transaction
      if (isCritical || CRITICAL_ACTIONS.has(action) || transaction) {
        const auditErr = new Error(`[CRITICAL_AUDIT_LOG_FAILED] Critical audit logging failure for ${action}: ${error.message}`);
        auditErr.code = 'CRITICAL_AUDIT_LOG_FAILED';
        throw auditErr;
      }

      return null;
    }
  }

  /**
   * Verifies cryptographic chain integrity and detects any data tampering.
   * 
   * @param {Object} options
   * @param {string|null} options.organizationId - Filter by organization (or null for all)
   * @param {number} options.limit - Max records to verify
   * @returns {Promise<{ verified: boolean, count: number, brokenAt?: string, reason?: string }>}
   */
  async verifyChain({ organizationId = null, limit = 500 } = {}) {
    try {
      const whereClause = {};
      if (organizationId) {
        whereClause.organizationId = organizationId;
      }

      const logs = await AuditLog.findAll({
        where: whereClause,
        order: [
          ['timestamp', 'ASC'],
          ['id', 'ASC']
        ],
        limit,
        hooks: false
      });

      if (logs.length === 0) {
        return { verified: true, count: 0, message: 'No logs found to verify' };
      }

      for (let i = 0; i < logs.length; i++) {
        const currentLog = logs[i];

        // 1. Check previous hash connection
        if (i > 0) {
          const previousLog = logs[i - 1];
          if (currentLog.previousHash !== previousLog.currentHash) {
            return {
              verified: false,
              count: i,
              brokenAt: currentLog.id,
              reason: `Chain broken at log ${currentLog.id}: previousHash does not match predecessor currentHash.`
            };
          }
        }

        // 2. Re-compute hash and verify against stored currentHash
        const recomputedHash = this.computeAuditHash(currentLog, currentLog.previousHash);
        if (recomputedHash !== currentLog.currentHash) {
          return {
            verified: false,
            count: i,
            brokenAt: currentLog.id,
            reason: `Data tampering detected at log ${currentLog.id}: recomputed hash ${recomputedHash} does not match stored currentHash ${currentLog.currentHash}.`
          };
        }
      }

      return {
        verified: true,
        count: logs.length,
        tipHash: logs[logs.length - 1].currentHash
      };
    } catch (err) {
      logger.error({ error: err.message }, 'Failed during audit chain verification');
      return {
        verified: false,
        count: 0,
        reason: `Verification error: ${err.message}`
      };
    }
  }

  // =========================================================================
  // DOMAIN HELPER METHODS
  // =========================================================================

  /**
   * Log authentication and identity events (login, logout, failed login, 2FA, password reset)
   */
  async logAuthEvent({ action, user, req, success = true, reason = null, metadata = {} }) {
    const ip = req?.ip || req?.headers?.['x-forwarded-for'] || null;
    const userAgent = req?.get ? req.get('user-agent') : null;
    const organizationId = user?.organizationId || null;
    const actorUserId = user?.id || null;

    return this.logEvent({
      organizationId,
      actorUserId,
      action,
      entity: 'Auth',
      entityId: actorUserId,
      metadata: {
        success,
        reason,
        email: user?.email,
        username: user?.username,
        role: user?.Role?.name || user?.role,
        ...metadata
      },
      ip,
      userAgent
    });
  }

  /**
   * Log clinical access and modifications (HIPAA / data privacy compliance)
   */
  async logClinicalAccess({
    action,
    actorUserId,
    patientId,
    medicalRecordId,
    organizationId,
    req,
    oldValues = null,
    newValues = null,
    details = {}
  }) {
    const ip = req?.ip || null;
    const userAgent = req?.get ? req.get('user-agent') : null;

    return this.logEvent({
      organizationId,
      actorUserId,
      action,
      entity: 'MedicalRecord',
      entityId: medicalRecordId || patientId,
      oldValues,
      newValues,
      metadata: {
        patientId,
        medicalRecordId,
        ...details
      },
      ip,
      userAgent
    });
  }

  /**
   * Log user lifecycle and permission alterations
   */
  async logUserManagement({
    action,
    actorUserId,
    targetUserId,
    organizationId,
    oldValues = null,
    newValues = null,
    req = null
  }) {
    const ip = req?.ip || null;
    const userAgent = req?.get ? req.get('user-agent') : null;

    return this.logEvent({
      organizationId,
      actorUserId,
      action,
      entity: 'User',
      entityId: targetUserId,
      oldValues,
      newValues,
      ip,
      userAgent
    });
  }
}

module.exports = new AuditService();
