/**
 * ==============================================================================
 * CGK MEDICUS FRAMEWORK - TENANT DATABASE TEMPLATE ORCHESTRATOR
 * ==============================================================================
 * @file        tenantOrchestrator.service.js
 * @description Automated multi-tenant provisioner using PostgreSQL native
 *              `CREATE DATABASE ... TEMPLATE` for instant (< 500ms) database cloning.
 * @author      CGK Core Engineering Team
 * @license     Enterprise / Proprietary
 * ==============================================================================
 */

const sequelize = require('../config/db.config');
const { Organization, User, Role } = require('../models');

class TenantOrchestratorService {
  /**
   * Sanitizes tenant name into a safe PostgreSQL database identifier.
   * @param {string} rawName - E.g. "Clínica San Francisco 2026!"
   * @returns {string} E.g. "tenant_clinica_san_francisco_2026_db"
   */
  sanitizeDbName(rawName) {
    if (!rawName || typeof rawName !== 'string') {
      throw new Error('[TenantOrchestrator] El nombre de la clínica/tenant es inválido');
    }
    const cleanSlug = rawName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    return `tenant_${cleanSlug}_db`;
  }

  /**
   * Provisions a new isolated PostgreSQL tenant database from master template
   * in milliseconds using native CREATE DATABASE ... TEMPLATE syntax.
   * 
   * @param {Object} params
   * @param {string} params.tenantName - Display name of the new clinic/hospital
   * @param {string} params.ownerEmail - Email of the primary administrator
   * @param {string} params.planType - Plan type: PROFESSIONAL, CLINIC, HOSPITAL
   * @param {string} [params.templateDbName] - Master template DB name (default: clinica_saas_bd or clinica_saas_template)
   * @returns {Promise<Object>} Result object with metrics, DB name, and status
   */
  async provisionTenantDatabase({ tenantName, ownerEmail, planType = 'CLINIC', templateDbName = null }) {
    const startTime = Date.now();
    const dbName = this.sanitizeDbName(tenantName);
    let masterTemplate = templateDbName || process.env.DB_NAME || 'clinica_saas_bd';
    const dbUser = process.env.DB_USER || 'postgres';

    // Verify masterTemplate exists in pg_database, if not fallback to 'clinica_saas_bd' or 'postgres'
    const [templateCheck] = await sequelize.query(
      `SELECT datname FROM pg_database WHERE datname = '${masterTemplate}';`
    );

    if (!templateCheck || templateCheck.length === 0) {
      const [bdCheck] = await sequelize.query(
        `SELECT datname FROM pg_database WHERE datname = 'clinica_saas_bd';`
      );
      if (bdCheck && bdCheck.length > 0) {
        masterTemplate = 'clinica_saas_bd';
      } else {
        masterTemplate = 'postgres';
      }
    }

    console.log(`[TenantOrchestrator] Aprovisionando nueva BD: "${dbName}" desde plantilla "${masterTemplate}"...`);

    try {
      // 1. Check if database already exists
      const [existingDbs] = await sequelize.query(
        `SELECT datname FROM pg_database WHERE datname = '${dbName}';`
      );

      if (existingDbs && existingDbs.length > 0) {
        return {
          success: true,
          alreadyExisted: true,
          databaseName: dbName,
          executionTimeMs: Date.now() - startTime,
          message: `La base de datos "${dbName}" ya existía en el servidor PostgreSQL.`
        };
      }

      // 2. Terminate active connections to master template to allow cloning if needed
      try {
        await sequelize.query(
          `SELECT pg_terminate_backend(pg_stat_activity.pid)
           FROM pg_stat_activity
           WHERE pg_stat_activity.datname = '${masterTemplate}'
             AND pid <> pg_backend_pid();`
        );
      } catch (termErr) {
        console.warn(`[TenantOrchestrator] Warning non-fatal terminating template connections:`, termErr.message);
      }

      // 3. Execute atomic PostgreSQL CREATE DATABASE ... TEMPLATE query
      const createDbQuery = `CREATE DATABASE "${dbName}" TEMPLATE "${masterTemplate}" OWNER "${dbUser}";`;
      await sequelize.query(createDbQuery);

      const executionTimeMs = Date.now() - startTime;
      console.log(`⚡ [TenantOrchestrator] Base de datos "${dbName}" clonada atómicamente en ${executionTimeMs}ms!`);

      return {
        success: true,
        alreadyExisted: false,
        databaseName: dbName,
        templateUsed: masterTemplate,
        executionTimeMs,
        message: `Base de datos aprovisionada exitosamente por TEMPLATE Postgres en ${executionTimeMs}ms.`
      };
    } catch (error) {
      console.error(`❌ [TenantOrchestrator] Error al aprovisionar BD para "${tenantName}":`, error.message);
      throw new Error(`Falló el aprovisionamiento por TEMPLATE Postgres: ${error.message}`);
    }
  }
}

module.exports = new TenantOrchestratorService();
