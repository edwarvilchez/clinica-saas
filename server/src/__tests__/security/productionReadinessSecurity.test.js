'use strict';

/**
 * 🛡️ FASE 28: Automated Production Readiness Audit Security Suite
 * Verifies that the production readiness check programmatically validates
 * environment secrets, database health, RLS, migrations, storage and health probes.
 */

const { ProductionReadinessChecker } = require('../../scripts/productionCheck');
const { sequelize } = require('../../models');

describe('🚀 FASE 28: Production Readiness Automated Pre-Flight Suite', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  describe('1. Programmatic Checker Execution', () => {
    it('debe ejecutar todas las categorías de auditoría y retornar un reporte estructurado', async () => {
      const checker = new ProductionReadinessChecker({ strict: false });
      const report = await checker.runAll();

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.total).toBeGreaterThanOrEqual(15);
      expect(report.summary.failed).toBe(0);
      expect(report.isReady).toBe(true);
      expect(Array.isArray(report.results)).toBe(true);
    });

    it('debe verificar las 8 categorías de auditoría requeridas por el estándar', async () => {
      const checker = new ProductionReadinessChecker();
      const report = await checker.runAll();

      const categories = new Set(report.results.map(r => r.category));
      expect(categories.has('1. Environment & Secrets')).toBe(true);
      expect(categories.has('2. Database Connectivity')).toBe(true);
      expect(categories.has('3. Database Migrations')).toBe(true);
      expect(categories.has('4. Multi-Tenant RLS')).toBe(true);
      expect(categories.has('5. Audit Trail Immutability')).toBe(true);
      expect(categories.has('6. Storage & File System')).toBe(true);
      expect(categories.has('7. Health Checks & Probes')).toBe(true);
      expect(categories.has('8. Architecture & Event Bus')).toBe(true);
    });
  });

  describe('2. Fast-Failure on Insecure Security Configurations', () => {
    it('debe marcar FAIL crítico si ALLOW_DB_RESET está activo', async () => {
      const originalVal = process.env.ALLOW_DB_RESET;
      try {
        process.env.ALLOW_DB_RESET = 'true';
        const checker = new ProductionReadinessChecker();
        await checker.checkEnvironment();

        const dbResetCheck = checker.results.find(r => r.name === 'Database Reset Protection');
        expect(dbResetCheck).toBeDefined();
        expect(dbResetCheck.status).toBe('FAIL');
        expect(dbResetCheck.message).toMatch(/ALLOW_DB_RESET is set to true/i);
      } finally {
        if (originalVal === undefined) {
          delete process.env.ALLOW_DB_RESET;
        } else {
          process.env.ALLOW_DB_RESET = originalVal;
        }
      }
    });

    it('debe marcar FAIL si se detecta un JWT_SECRET débil o con secretos prohibidos en producción', async () => {
      const originalSecret = process.env.JWT_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'changeme';
        const checker = new ProductionReadinessChecker();
        await checker.checkEnvironment();

        const secretCheck = checker.results.find(r => r.name === 'Secret Integrity & Entropy');
        expect(secretCheck).toBeDefined();
        expect(secretCheck.status).toBe('FAIL');
        expect(secretCheck.message).toMatch(/Insecure default JWT_SECRET/i);
      } finally {
        process.env.JWT_SECRET = originalSecret;
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('3. Multi-Tenant RLS & Immutability Verification', () => {
    it('debe verificar que las tablas principales de pacientes y registros clínicos tengan RLS activo', async () => {
      const checker = new ProductionReadinessChecker();
      await checker.checkRowLevelSecurity(sequelize);

      const rlsCheck = checker.results.find(r => r.name === 'Row-Level Security (RLS)');
      expect(rlsCheck).toBeDefined();
      expect(rlsCheck.status).toBe('PASS');
      expect(rlsCheck.message).toMatch(/RLS is active and enforced/i);
    });

    it('debe validar la existencia y protección inmutable append-only de audit_logs', async () => {
      const checker = new ProductionReadinessChecker();
      await checker.checkAuditLogImmutability(sequelize);

      const auditCheck = checker.results.find(r => r.name === 'AuditLog Table');
      expect(auditCheck).toBeDefined();
      expect(auditCheck.status).toBe('PASS');

      const triggerCheck = checker.results.find(r => r.name === 'Append-Only Protection');
      expect(triggerCheck).toBeDefined();
      expect(triggerCheck.status).toBe('PASS');
    });
  });

  describe('4. JSON Output & Strict Mode Options', () => {
    it('debe generar salida formateada JSON cuando se especifica la opción json', async () => {
      const checker = new ProductionReadinessChecker({ json: true });
      const report = await checker.runAll();

      expect(typeof report).toBe('object');
      expect(report.summary.isStrict).toBe(false);
    });

    it('debe marcar isReady=false en modo estricto si existen advertencias (WARN)', async () => {
      const checker = new ProductionReadinessChecker({ strict: true });
      checker.record('Test', 'Test Warning', 'WARN', 'Test warning message');
      const report = checker.generateReport();

      expect(report.summary.warnings).toBeGreaterThanOrEqual(1);
      expect(report.isReady).toBe(false);
    });
  });
});
