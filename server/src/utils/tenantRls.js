'use strict';

/**
 * 🛡️ TENANT RLS HELPER (PostgreSQL Row Level Security)
 * Manages database session variables for multi-tenant isolation at the engine level.
 */

const context = require('./context');

/**
 * Sets PostgreSQL session variables for RLS on a specific connection or transaction
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {object} options
 * @param {string} [options.organizationId]
 * @param {boolean} [options.isSuperAdmin]
 * @param {import('sequelize').Transaction} [options.transaction]
 */
async function setTenantContext(sequelize, { organizationId, isSuperAdmin = false, transaction } = {}) {
  const orgId = organizationId || context.getOrgId() || '';
  const isSuper = isSuperAdmin !== undefined ? isSuperAdmin : (context.getRole() === 'SUPERADMIN' || context.getRole() === 'PLATFORM_ADMIN');

  const query = `
    SELECT 
      set_config('app.current_organization_id', :orgId, :isLocal),
      set_config('app.is_super_admin', :isSuper, :isLocal);
  `;

  await sequelize.query(query, {
    replacements: {
      orgId: orgId ? String(orgId) : '',
      isSuper: isSuper ? 'true' : 'false',
      isLocal: !!transaction // Local to transaction if transaction exists
    },
    transaction,
    logging: false
  });
}

/**
 * Executes a callback within a tenant-scoped database transaction with RLS guaranteed
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {object} options
 * @param {string} [options.organizationId]
 * @param {boolean} [options.isSuperAdmin]
 * @param {function(import('sequelize').Transaction): Promise<any>} callback
 */
async function withTenantTransaction(sequelize, { organizationId, isSuperAdmin } = {}, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  return sequelize.transaction(async (t) => {
    await setTenantContext(sequelize, {
      organizationId,
      isSuperAdmin,
      transaction: t
    });
    return callback(t);
  });
}

module.exports = {
  setTenantContext,
  withTenantTransaction
};
