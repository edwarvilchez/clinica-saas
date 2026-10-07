const context = require('../utils/context');
const { setTenantContext } = require('../utils/tenantRls');
const sequelize = require('../config/db.config');

/**
 * Request Context Middleware
 * Must be executed AFTER auth/verifyToken
 */
const contextMiddleware = (req, res, next) => {
  const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
  const data = {
    userId: req.user?.id || null,
    organizationId: req.user?.organizationId || null,
    role: req.user?.role || null,
    isSuperAdmin,
    requestId: req.get('x-request-id') || null,
    ip: req.ip,
    userAgent: req.get('user-agent') || 'system'
  };

  context.storage.run(data, async () => {
    if (req.user?.organizationId || isSuperAdmin) {
      try {
        await setTenantContext(sequelize, {
          organizationId: req.user?.organizationId,
          isSuperAdmin
        });
      } catch (err) {
        // Silently continue if session config encounters an error
      }
    }
    next();
  });
};

module.exports = contextMiddleware;
