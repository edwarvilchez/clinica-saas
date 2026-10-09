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
  // Guarantees RLS context is established strictly on the transaction's connection and fails closed
  req.withTenantTransaction = (callback) => {
    return tenantRls.withTenantTransaction(sequelize, { organizationId, isSuperAdmin }, callback);
  };

  req.tenantContext = {
    organizationId,
    isSuperAdmin,
    userId: data.userId
  };

  return context.storage.run(data, () => {
    next();
  });
};

module.exports = contextMiddleware;
