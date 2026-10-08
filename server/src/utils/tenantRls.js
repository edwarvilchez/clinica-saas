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
 * Clears PostgreSQL session variables for RLS to prevent leakage in connection pools
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {object} [options]
 * @param {import('sequelize').Transaction} [options.transaction]
 */
async function clearTenantContext(sequelize, { transaction } = {}) {
  const query = `
    SELECT 
      set_config('app.current_organization_id', '', :isLocal),
      set_config('app.is_super_admin', 'false', :isLocal);
  `;

  await sequelize.query(query, {
    replacements: {
      isLocal: !!transaction
    },
    transaction,
    logging: false
  });
}

/**
 * Executes a callback within a tenant-scoped database transaction with RLS guaranteed
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {object|function} optionsOrCallback
 * @param {string} [optionsOrCallback.organizationId]
 * @param {boolean} [optionsOrCallback.isSuperAdmin]
 * @param {function(import('sequelize').Transaction): Promise<any>} [maybeCallback]
 */
async function withTenantTransaction(sequelize, optionsOrCallback, maybeCallback) {
  let options = {};
  let callback;
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
    options = {};
  } else {
    options = optionsOrCallback || {};
    callback = maybeCallback;
  }

  const { organizationId, isSuperAdmin } = options;

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
  clearTenantContext,
  withTenantTransaction
};
