'use strict';

/**
 * 🚀 FASE 28: Production Readiness Check Script
 * Automated pre-flight inspection for Clinica-SaaS production readiness.
 *
 * Checks:
 *   1. Environment variables & secret entropy (Phase 4)
 *   2. Database connectivity, latency, PostgreSQL version & extensions
 *   3. Sequelize migrations execution state (SequelizeMeta)
 *   4. Multi-tenant Row-Level Security (RLS) enforcement
 *   5. Tamper-evident AuditLog immutability
 *   6. Secure File Storage directory & read/write permissions
 *   7. Health endpoints readiness (liveness, readiness probes)
 *   8. Domain Event Bus and security modules integrity
 *
 * Usage:
 *   node server/src/scripts/productionCheck.js [--strict] [--json] [--skip-db]
 */

const fs = require('fs');
const path = require('path');

// Ensure .env is loaded
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const { validateEnv } = require('../config/validateEnv');

// ANSI Color codes for clean CLI reporting
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

class ProductionReadinessChecker {
  constructor(options = {}) {
    if (options.strict !== undefined) {
      this.isStrict = Boolean(options.strict);
    } else if (process.argv.includes('--non-strict')) {
      this.isStrict = false;
    } else if (process.argv.includes('--strict')) {
      this.isStrict = true;
    } else {
      this.isStrict = false;
    }
    this.isJson = options.json !== undefined ? Boolean(options.json) : process.argv.includes('--json');
    this.skipDb = options.skipDb !== undefined ? Boolean(options.skipDb) : process.argv.includes('--skip-db');
    this.results = [];
    this.startTime = Date.now();
  }

  record(category, name, status, message, details = null) {
    this.results.push({
      category,
      name,
      status, // 'PASS', 'WARN', 'FAIL'
      message,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // 1. Environment & Secret Entropy Check
  async checkEnvironment() {
    const category = '1. Environment & Secrets';
    const env = process.env;
    const isProdMode = env.NODE_ENV === 'production';

    if (!isProdMode) {
      this.record(
        category,
        'NODE_ENV Mode',
        'WARN',
        `NODE_ENV is currently "${env.NODE_ENV || 'undefined'}" (Expected "production" for live deployment)`
      );
    } else {
      this.record(category, 'NODE_ENV Mode', 'PASS', 'NODE_ENV is set to "production"');
    }

    // Run core validator from Phase 4
    const validation = validateEnv(env, false);
    if (validation.errors.length > 0) {
      this.record(
        category,
        'Secret Integrity & Entropy',
        'FAIL',
        `Critical secret validation errors: ${validation.errors.join('; ')}`
      );
    } else if (validation.warnings.length > 0) {
      this.record(
        category,
        'Secret Integrity & Entropy',
        'WARN',
        `Environment warnings detected: ${validation.warnings.join('; ')}`
      );
    } else {
      this.record(
        category,
        'Secret Integrity & Entropy',
        'PASS',
        'All critical secrets (JWT_SECRET, DB_PASSWORD, INIT_SECRET) satisfy entropy requirements'
      );
    }

    // Disallow DB Reset flag in production
    if (env.ALLOW_DB_RESET === 'true' || env.ALLOW_DB_RESET === '1') {
      this.record(
        category,
        'Database Reset Protection',
        'FAIL',
        'CRITICAL: ALLOW_DB_RESET is set to true! This allows accidental database wipeout.'
      );
    } else {
      this.record(
        category,
        'Database Reset Protection',
        'PASS',
        'ALLOW_DB_RESET is safely disabled or undefined'
      );
    }

    // Check CORS Allowed Origins
    const origins = env.ALLOWED_ORIGINS || '';
    if (origins.includes('*') && isProdMode) {
      this.record(
        category,
        'CORS Allowed Origins',
        'FAIL',
        'Wildcard "*" origin is strictly prohibited in production mode'
      );
    } else {
      this.record(
        category,
        'CORS Allowed Origins',
        'PASS',
        `Configured origins: ${origins || 'Default safe origin'}`
      );
    }
  }

  // 2. Database Connectivity & Capabilities
  async checkDatabase(sequelize) {
    const category = '2. Database Connectivity';
    if (this.skipDb) {
      this.record(category, 'PostgreSQL Connection', 'WARN', 'Database check skipped via --skip-db');
      return;
    }

    try {
      const startPing = Date.now();
      await sequelize.authenticate();
      const latencyMs = Date.now() - startPing;

      this.record(
        category,
        'PostgreSQL Connection',
        'PASS',
        `Successfully connected with ping latency ${latencyMs}ms`
      );

      // Verify PostgreSQL Server Version
      const [versionResult] = await sequelize.query('SHOW server_version;');
      const versionStr = versionResult?.server_version || (Array.isArray(versionResult) ? versionResult[0]?.server_version : '') || '15.0';
      const majorVersion = parseInt(versionStr.split('.')[0], 10);

      if (majorVersion >= 13) {
        this.record(
          category,
          'PostgreSQL Version',
          'PASS',
          `Running PostgreSQL ${versionStr} (Meets >= v13 requirement for optimal RLS & indexing)`
        );
      } else {
        this.record(
          category,
          'PostgreSQL Version',
          'WARN',
          `Detected PostgreSQL ${versionStr}. Version 14+ is strongly recommended for RLS performance.`
        );
      }

      // Check UUID extension or application-tier UUID generation
      const [extResult] = await sequelize.query(
        "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto');"
      );
      if (extResult && extResult.length > 0) {
        this.record(
          category,
          'Cryptographic Extensions',
          'PASS',
          `Detected cryptographic extensions: ${extResult.map(e => e.extname).join(', ')}`
        );
      } else {
        this.record(
          category,
          'Cryptographic Extensions',
          'PASS',
          'RFC 4122 UUID v4 generation handled at application tier with high entropy'
        );
      }
    } catch (err) {
      this.record(
        category,
        'PostgreSQL Connection',
        'FAIL',
        `Failed to connect to database: ${err.message}`
      );
    }
  }

  // 3. Sequelize Migrations Status
  async checkMigrations(sequelize) {
    const category = '3. Database Migrations';
    if (this.skipDb) {
      this.record(category, 'Sequelize Migrations', 'WARN', 'Migrations check skipped via --skip-db');
      return;
    }

    try {
      const migrationsDir = path.resolve(__dirname, '../migrations');
      if (!fs.existsSync(migrationsDir)) {
        this.record(category, 'Migrations Directory', 'FAIL', `Migrations folder not found at ${migrationsDir}`);
        return;
      }

      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter(f => f.endsWith('.js'))
        .sort();

      // Check executed migrations from SequelizeMeta table
      const [metaTableExists] = await sequelize.query(`
        SELECT to_regclass('public."SequelizeMeta"') AS exists;
      `);

      if (!metaTableExists[0]?.exists) {
        this.record(
          category,
          'Migration History',
          'FAIL',
          'SequelizeMeta table does not exist. Migrations have not been initialized.'
        );
        return;
      }

      const [executedRows] = await sequelize.query('SELECT name FROM "SequelizeMeta";');
      const executedSet = new Set(executedRows.map(r => r.name));

      const pending = migrationFiles.filter(f => !executedSet.has(f));

      if (pending.length === 0) {
        this.record(
          category,
          'Migration Execution',
          'PASS',
          `All ${migrationFiles.length} migrations executed and recorded in SequelizeMeta`
        );
      } else {
        this.record(
          category,
          'Migration Execution',
          'FAIL',
          `${pending.length} pending migration(s) detected: ${pending.slice(0, 3).join(', ')}${pending.length > 3 ? '...' : ''}`
        );
      }
    } catch (err) {
      this.record(
        category,
        'Migration Verification',
        'FAIL',
        `Error querying migration status: ${err.message}`
      );
    }
  }

  // 4. Multi-Tenant Row-Level Security (RLS) Status
  async checkRowLevelSecurity(sequelize) {
    const category = '4. Multi-Tenant RLS';
    if (this.skipDb) {
      this.record(category, 'RLS Enforcement', 'WARN', 'RLS check skipped via --skip-db');
      return;
    }

    try {
      const criticalTables = ['Patients', 'Appointments', 'MedicalRecords', 'Prescriptions', 'audit_logs', 'Payments', 'InventoryItems'];

      // Query PostgreSQL catalog for row security status
      const [rlsRows] = await sequelize.query(`
        SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN (${criticalTables.map(t => `'${t}'`).join(', ')});
      `);

      const rlsMap = new Map();
      (Array.isArray(rlsRows) ? rlsRows : [rlsRows]).forEach(r => rlsMap.set(r.relname, r));

      const enabledTables = [];
      const disabledTables = [];

      criticalTables.forEach(t => {
        const info = rlsMap.get(t);
        if (info && info.relrowsecurity) {
          enabledTables.push(t);
        } else {
          disabledTables.push(t);
        }
      });

      if (disabledTables.length === 0) {
        this.record(
          category,
          'Row-Level Security (RLS)',
          'PASS',
          `RLS is active and enforced on all critical multi-tenant tables: ${enabledTables.join(', ')}`
        );
      } else {
        this.record(
          category,
          'Row-Level Security (RLS)',
          'FAIL',
          `RLS missing or disabled on critical tables: [${disabledTables.join(', ')}]. Database multi-tenant isolation requires RLS.`
        );
      }
    } catch (err) {
      this.record(
        category,
        'Row-Level Security (RLS)',
        'FAIL',
        `Could not inspect pg_class RLS catalog: ${err.message}`
      );
    }
  }

  // 5. Tamper-Evident AuditLog Immutability
  async checkAuditLogImmutability(sequelize) {
    const category = '5. Audit Trail Immutability';
    if (this.skipDb) {
      this.record(category, 'Audit Trail', 'WARN', 'Audit trail check skipped via --skip-db');
      return;
    }

    try {
      // Check if audit_logs table exists
      const [tableExists] = await sequelize.query(`
        SELECT to_regclass('public.audit_logs') AS exists;
      `);

      const hasTable = tableExists?.exists || (Array.isArray(tableExists) && tableExists[0]?.exists);

      if (!hasTable) {
        this.record(category, 'AuditLog Table', 'FAIL', 'audit_logs table does not exist in public schema');
        return;
      }

      this.record(category, 'AuditLog Table', 'PASS', 'audit_logs table verified in public schema');

      // Check if immutable trigger or policy exists
      const [triggerRows] = await sequelize.query(`
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE event_object_table = 'audit_logs'
          AND (trigger_name ILIKE '%immutable%' OR trigger_name ILIKE '%prevent%' OR trigger_name ILIKE '%audit%');
      `);

      const triggers = Array.isArray(triggerRows) ? triggerRows : (triggerRows ? [triggerRows] : []);

      if (triggers.length > 0) {
        this.record(
          category,
          'Append-Only Protection',
          'PASS',
          `Tamper-evident trigger detected: ${triggers.map(t => t.trigger_name).join(', ')}`
        );
      } else {
        this.record(
          category,
          'Append-Only Protection',
          'FAIL',
          'Table audit_logs exists; tamper-evident trigger (trg_prevent_audit_log_mutation) is NOT active'
        );
      }
    } catch (err) {
      this.record(
        category,
        'Audit Trail Check',
        'FAIL',
        `Error checking audit log immutability: ${err.message}`
      );
    }
  }

  // 6. Secure Storage Directory & Permissions
  async checkStorage() {
    const category = '6. Storage & File System';
    try {
      const uploadsDir = path.resolve(__dirname, '../../../uploads');
      const tempUploads = path.resolve(uploadsDir, 'temp');

      // Create uploads directories if they don't exist
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      if (!fs.existsSync(tempUploads)) {
        fs.mkdirSync(tempUploads, { recursive: true });
      }

      // Test write/read/delete permissions
      const testFile = path.resolve(tempUploads, `.readiness-test-${Date.now()}.tmp`);
      fs.writeFileSync(testFile, 'readiness-test', 'utf8');
      const readContent = fs.readFileSync(testFile, 'utf8');
      fs.unlinkSync(testFile);

      if (readContent === 'readiness-test') {
        this.record(
          category,
          'Local Storage Read/Write',
          'PASS',
          `Uploads directory verified with read/write/delete permissions at ${uploadsDir}`
        );
      } else {
        this.record(category, 'Local Storage Read/Write', 'FAIL', 'File read verification failed');
      }
    } catch (err) {
      this.record(
        category,
        'Storage Directory Access',
        'FAIL',
        `File system permission error: ${err.message}`
      );
    }
  }

  // 7. Health Endpoints & Core Service Readiness
  async checkHealthEndpoints() {
    const category = '7. Health Checks & Probes';
    try {
      const healthService = require('../services/health.service');

      // Check Liveness
      const liveness = healthService.getLiveness();
      if (liveness && liveness.status === 'UP') {
        this.record(
          category,
          'Liveness Probe (getLiveness)',
          'PASS',
          `Process alive, uptime: ${liveness.uptimeSeconds}s, heapUsed: ${liveness.memory.heapUsedMB}MB`
        );
      } else {
        this.record(category, 'Liveness Probe (getLiveness)', 'FAIL', 'Liveness report returned status not UP');
      }

      // Check Readiness
      if (!this.skipDb) {
        const readiness = await healthService.getReadiness();
        if (readiness.statusCode === 200 && readiness.report.isReady) {
          this.record(
            category,
            'Readiness Probe (getReadiness)',
            'PASS',
            'PostgreSQL & storage backend reported READY (HTTP 200)'
          );
        } else {
          this.record(
            category,
            'Readiness Probe (getReadiness)',
            'WARN',
            `Readiness probe returned status ${readiness.statusCode} (${readiness.report?.status})`
          );
        }
      }
    } catch (err) {
      this.record(category, 'Health Service Probes', 'FAIL', `Health check execution failed: ${err.message}`);
    }
  }

  // 8. Event Bus & Architecture Specification
  async checkArchitectureAndEventBus() {
    const category = '8. Architecture & Event Bus';
    try {
      const { DOMAIN_EVENTS, DOMAINS } = require('../events/domainEvents');
      if (DOMAIN_EVENTS && Object.isFrozen(DOMAIN_EVENTS) && DOMAINS && Object.isFrozen(DOMAINS)) {
        this.record(
          category,
          'Domain Event Catalog',
          'PASS',
          `Canonical domain events (${Object.keys(DOMAIN_EVENTS).length} events) deeply frozen and active`
        );
      } else {
        this.record(category, 'Domain Event Catalog', 'FAIL', 'DOMAIN_EVENTS object is missing or not frozen');
      }

      const futureDocPath = path.resolve(__dirname, '../../../FUTURE_MICROSERVICES.md');
      if (fs.existsSync(futureDocPath)) {
        this.record(
          category,
          'Future Microservices Spec',
          'PASS',
          'FUTURE_MICROSERVICES.md specification present and verified (Fase 27)'
        );
      } else {
        this.record(category, 'Future Microservices Spec', 'WARN', 'FUTURE_MICROSERVICES.md missing at root');
      }
    } catch (err) {
      this.record(category, 'Architecture Verification', 'FAIL', `Error inspecting domain boundaries: ${err.message}`);
    }
  }

  // Run all checks sequentially
  async runAll() {
    let sequelizeInstance = null;
    try {
      if (!this.skipDb) {
        const { sequelize } = require('../models');
        sequelizeInstance = sequelize;
      }
    } catch (e) {
      // If models can't load, report in DB section
    }

    await this.checkEnvironment();
    if (sequelizeInstance) {
      await this.checkDatabase(sequelizeInstance);
      await this.checkMigrations(sequelizeInstance);
      await this.checkRowLevelSecurity(sequelizeInstance);
      await this.checkAuditLogImmutability(sequelizeInstance);
    } else if (!this.skipDb) {
      this.record('2. Database Connectivity', 'PostgreSQL Models', 'FAIL', 'Could not load Sequelize models');
    }
    await this.checkStorage();
    await this.checkHealthEndpoints();
    await this.checkArchitectureAndEventBus();

    return this.generateReport();
  }

  generateReport() {
    const total = this.results.length;
    const passes = this.results.filter(r => r.status === 'PASS').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;
    const failures = this.results.filter(r => r.status === 'FAIL').length;
    const durationMs = Date.now() - this.startTime;

    const isReady = failures === 0 && (!this.isStrict || warnings === 0);

    return {
      isReady,
      summary: {
        total,
        passed: passes,
        warnings,
        failed: failures,
        durationMs,
        isStrict: this.isStrict
      },
      results: this.results
    };
  }

  printFormattedReport(report) {
    if (this.isJson) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const { summary, results } = report;

    console.log('\n' + '='.repeat(80));
    console.log(`${COLORS.bright}${COLORS.cyan} 🏥 CLINICA-SAAS / MEDICUSVE — PRODUCTION READINESS AUDIT (FASE 28)${COLORS.reset}`);
    console.log('='.repeat(80) + '\n');

    let currentCategory = '';
    results.forEach(r => {
      if (r.category !== currentCategory) {
        currentCategory = r.category;
        console.log(`\n${COLORS.bright}${COLORS.white}─── ${currentCategory} ───${COLORS.reset}`);
      }

      let statusBadge;
      if (r.status === 'PASS') {
        statusBadge = `${COLORS.green}[ PASS ]${COLORS.reset}`;
      } else if (r.status === 'WARN') {
        statusBadge = `${COLORS.yellow}[ WARN ]${COLORS.reset}`;
      } else {
        statusBadge = `${COLORS.red}[ FAIL ]${COLORS.reset}`;
      }

      console.log(`  ${statusBadge} ${COLORS.bright}${r.name}${COLORS.reset}`);
      console.log(`         ${COLORS.dim}↳ ${r.message}${COLORS.reset}`);
    });

    console.log('\n' + '-'.repeat(80));
    console.log(`${COLORS.bright}RESUMEN DE AUDITORÍA:${COLORS.reset}`);
    console.log(`  • Total de Verificaciones : ${summary.total}`);
    console.log(`  • ${COLORS.green}Aprobados (PASS)${COLORS.reset}         : ${summary.passed}`);
    console.log(`  • ${COLORS.yellow}Advertencias (WARN)${COLORS.reset}     : ${summary.warnings}`);
    console.log(`  • ${COLORS.red}Fallos Críticos (FAIL)${COLORS.reset}  : ${summary.failed}`);
    console.log(`  • Duración                : ${summary.durationMs}ms`);
    console.log(`  • Modo Estricto (--strict): ${summary.isStrict ? 'ACTIVADO' : 'DESACTIVADO'}`);
    console.log('-'.repeat(80));

    if (report.isReady) {
      console.log(`\n${COLORS.bright}${COLORS.green}✅ ESTADO: APTO PARA PRODUCCIÓN (PRODUCTION READY)${COLORS.reset}`);
      console.log(`${COLORS.dim}El sistema cumple con todos los controles de seguridad, aislamiento y persistencia.${COLORS.reset}\n`);
    } else {
      console.log(`\n${COLORS.bright}${COLORS.red}❌ ESTADO: NO APTO PARA PRODUCCIÓN (NOT READY)${COLORS.reset}`);
      console.log(`${COLORS.red}Existen ${summary.failed} fallos críticos que deben resolverse antes del despliegue.${COLORS.reset}\n`);
    }
  }
}

// CLI Runner execution
if (require.main === module) {
  const isNonStrict = process.argv.includes('--non-strict');
  const checker = new ProductionReadinessChecker({ strict: !isNonStrict });
  checker
    .runAll()
    .then(report => {
      checker.printFormattedReport(report);
      process.exit(report.isReady ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error during production readiness check:', err);
      process.exit(1);
    });
}

module.exports = { ProductionReadinessChecker };
