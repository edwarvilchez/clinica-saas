const { AsyncLocalStorage } = require('async_hooks');

/**
 * Context Utility for Multi-tenant Data Isolation
 * Uses Node.js AsyncLocalStorage to maintain request context
 */
class RequestContext {
  constructor() {
    this.storage = new AsyncLocalStorage();
  }

  /**
   * Run a function within a context
   * @param {Object} context - Request context data (userId, organizationId, etc.)
   * @param {Function} next - Function to execute
   */
  run(context, next) {
    return this.storage.run(context, next);
  }

  /**
   * Get the current context
   * @returns {Object|null}
   */
  get() {
    return this.storage.getStore();
  }

  /**
   * Safe getter for organizationId
   * @returns {number|null}
   */
  getOrgId() {
    return this.get()?.organizationId || null;
  }

  /**
   * Safe getter for userRole
   * @returns {string|null}
   */
  getRole() {
    return this.get()?.role || null;
  }

  /**
   * Check if current context is Super Admin or Platform Admin
   * @returns {boolean}
   */
  isSuperAdmin() {
    return this.get()?.isSuperAdmin || this.getRole() === 'SUPERADMIN' || this.getRole() === 'PLATFORM_ADMIN';
  }
}

module.exports = new RequestContext();
