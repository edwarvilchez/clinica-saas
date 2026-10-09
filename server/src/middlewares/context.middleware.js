'use strict';

const context = require('../utils/context');
const tenantRls = require('../utils/tenantRls');
const sequelize = require('../config/db.config');
const logger = require('../utils/logger');

/**
 * Request Context Middleware
 * Must be executed AFTER auth/verifyToken
 * Guarantees strict fail-closed security: if tenant context fails to initialize, halts request immediately.
 */
const contextMiddleware = (req, res, next) => {
  const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
  const organizationId = req.user?.organizationId || null;

  const data = {
    userId: req.user?.id || null,
    organizationId,
    role: req.user?.role || null,
    isSuperAdmin,
    requestId: req.get('x-request-id') || null,
    ip: req.ip,
    userAgent: req.get('user-agent') || 'system'
  };

  // Attach transaction helper directly to req for routes that require strict transactional RLS isolation
  req.withTenantTransaction = (callback) => {
    return tenantRls.withTenantTransaction(sequelize, { organizationId, isSuperAdmin }, callback);
  };

  return context.storage.run(data, async () => {
    if (organizationId || isSuperAdmin) {
      try {
        await tenantRls.setTenantContext(sequelize, {
          organizationId,
          isSuperAdmin
        });
      } catch (err) {
        logger.error({ error: err.message, organizationId }, '❌ Failed to initialize multi-tenant RLS context');
        return res.status(500).json({
          error: 'SECURITY_CONTEXT_INITIALIZATION_FAILED',
          message: 'Error crítico de aislamiento de seguridad multi-tenant. La solicitud fue abortada.'
        });
      }

      res.on('finish', () => {
        tenantRls.clearTenantContext(sequelize).catch(() => {});
      });
    }

    next();
  });
};

module.exports = contextMiddleware;
