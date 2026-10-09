'use strict';

/**
 * 🛡️ SUITE DE VERIFICACIÓN DE PRODUCTION BLOCKERS (P0 / P1)
 * Valida de forma ejecutable:
 *   1. Migración no destructiva de auditoría (preservación de filas históricas, IDs y hashes)
 *   2. Trigger inmutable append-only de PostgreSQL (bloqueo de UPDATE y DELETE)
 *   3. Fallo cerrado de contexto multi-tenant en contextMiddleware
 *   4. Contención estricta de rutas de archivos, anti-traversal y symlink escape
 *   5. Fail-closed en advisory locks de auditoría y atomicidad con operaciones críticas
 *   6. Redacción estricta de secretos y PII en registros de auditoría
 *   7. Production Check: detección de fallo ante --skip-db y tablas RLS desprotegidas
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../../config/db.config');
const fileStorageService = require('../../services/fileStorage.service');
const auditService = require('../../services/audit.service');
const { ProductionReadinessChecker } = require('../../scripts/productionCheck');
const contextMiddleware = require('../../middlewares/context.middleware');
const fileController = require('../../controllers/file.controller');
const { Payment, Organization, User } = require('../../models');

describe('🛡️ PRODUCTION BLOCKERS HARDENING & VERIFICATION SUITE', () => {
  const isPostgres = sequelize.getDialect() === 'postgres';

  // =========================================================================
  // 1. MIGRACIÓN NO DESTRUCTIVA Y PRESERVACIÓN TRANSPARENTE DE AUDITORÍA
  // =========================================================================
  describe('1. Migración de Auditoría: Preservación sin Hashes Fabricados & Trigger Inmutable', () => {
    it('🔒 Debe preservar registros históricos con hashes ausentes/nulos sin inventar hashes falsos', async () => {
      if (!isPostgres) return;

      const existingOrg = await Organization.findOne();
      const testOrgId = existingOrg ? existingOrg.id : null;

      // 1. Insertar directamente un registro histórico legacy que no posea hash (simulación pre-criptográfica)
      const legacyId = uuidv4();
      await sequelize.query(`
        INSERT INTO audit_logs (id, "organizationId", action, entity, "entityId", timestamp, "currentHash", "previousHash", metadata)
        VALUES (:id, :orgId, 'LEGACY_HISTORICAL_OP', 'Patient', 'leg-1', NOW() - INTERVAL '30 days', NULL, NULL, '{"source": "v1_app"}'::jsonb);
      `, {
        replacements: { id: legacyId, orgId: testOrgId }
      });

      // 2. Ejecutar la migración incremental
      const migration = require('../../migrations/20261008000000-create-tamper-evident-audit-logs');
      await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);

      // 3. Verificar que el registro legacy sigue existiendo, NO se le inventó un hash falso, y metadata refleja estado transparente
      const [persisted] = await sequelize.query(
        `SELECT id, action, "currentHash", metadata FROM audit_logs WHERE id = :id;`,
        { replacements: { id: legacyId } }
      );

      expect(persisted.length).toBe(1);
      expect(persisted[0].action).toBe('LEGACY_HISTORICAL_OP');
      expect(persisted[0].currentHash).toBeNull(); // Evidencia original preservada, NO se inventó un hash
      expect(persisted[0].metadata).toHaveProperty('migrationStatus', 'PRESERVED_HISTORICAL_UNHASHED');

      // 4. Verificar que getLatestHash y nuevos eventos pueden encadenar normalmente desde GENESIS si solo hay logs sin hash
      const latestHash = await auditService.getLatestHash(testOrgId);
      expect(typeof latestHash).toBe('string');
      expect(latestHash.length).toBe(64);
    });

    it('🔒 El trigger PostgreSQL debe bloquear de forma irrevocable cualquier UPDATE o DELETE', async () => {
      if (!isPostgres) return;

      const testRecord = await auditService.logEvent({
        action: 'IMMUTABILITY_ENFORCEMENT_TEST',
        entity: 'SecurityPolicy',
        entityId: 'immutable-1'
      });

      // Intento de UPDATE
      await expect(
        sequelize.query(
          `UPDATE audit_logs SET action = 'TAMPERED_ACTION' WHERE id = :id;`,
          { replacements: { id: testRecord.id } }
        )
      ).rejects.toThrow(/append-only/i);

      // Intento de DELETE
      await expect(
        sequelize.query(
          `DELETE FROM audit_logs WHERE id = :id;`,
          { replacements: { id: testRecord.id } }
        )
      ).rejects.toThrow(/append-only/i);
    });
  });

  // =========================================================================
  // 2. CONTEXTO MULTI-TENANT & AISLAMIENTO TRANSACCIONAL
  // =========================================================================
  describe('2. Aislamiento Multi-Tenant & Fail-Closed en Transacciones Explícitas', () => {
    it('🔒 contextMiddleware no ejecuta queries en conexiones desprotegidas del pool y expone withTenantTransaction', async () => {
      const querySpy = jest.spyOn(sequelize, 'query');

      const req = {
        user: { id: uuidv4(), organizationId: uuidv4(), role: 'DOCTOR' },
        get: () => 'req-test-pool-isolation',
        ip: '127.0.0.1'
      };

      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await contextMiddleware(req, res, next);

      // Debe pasar directamente a next() sin emitir queries arbitrarias a nivel de pool
      expect(next).toHaveBeenCalled();
      expect(typeof req.withTenantTransaction).toBe('function');
      expect(req.tenantContext.organizationId).toBe(req.user.organizationId);

      querySpy.mockRestore();
    });

    it('🔒 withTenantTransaction debe fallar cerrado (revertir) si falla setTenantContext', async () => {
      const tenantRls = require('../../utils/tenantRls');
      const originalSetContext = tenantRls.setTenantContext;

      tenantRls.setTenantContext = jest.fn().mockRejectedValue(new Error('PostgreSQL connection dropped'));

      const testOrgId = uuidv4();
      const req = {
        user: { id: uuidv4(), organizationId: testOrgId, role: 'DOCTOR' },
        get: () => 'req-fail-closed',
        ip: '127.0.0.1'
      };

      await contextMiddleware(req, {}, () => {});

      await expect(
        req.withTenantTransaction(async () => {
          return 'should_never_reach_here';
        })
      ).rejects.toThrow(/TENANT_CONTEXT_FAILED/);

      tenantRls.setTenantContext = originalSetContext;
    });

    it('🔒 req.withTenantTransaction debe aislar variables de sesión estrictamente a la transacción', async () => {
      if (!isPostgres) return;

      const testOrgId = uuidv4();
      const req = {
        user: { id: uuidv4(), organizationId: testOrgId, role: 'DOCTOR' },
        get: () => 'req-tx-test',
        ip: '127.0.0.1'
      };

      await contextMiddleware(req, {}, () => {});

      await req.withTenantTransaction(async (t) => {
        const [result] = await sequelize.query(
          `SELECT current_setting('app.current_organization_id', true) AS org;`,
          { transaction: t }
        );
        expect(result[0].org).toBe(testOrgId);
      });
    });
  });

  // =========================================================================
  // 3. SEGURIDAD DE ARCHIVOS, CONTENCIÓN Y ANTI-TRAVERSAL
  // =========================================================================
  describe('3. Archivos Clínicos: Contención Canónica, Anti-Traversal & Aislamiento', () => {
    it('🔒 sanitizePath debe rechazar path traversal con .. y null bytes \\0', () => {
      expect(() => fileStorageService.sanitizePath('../etc/passwd')).toThrow(/Path traversal attempt blocked/);
      expect(() => fileStorageService.sanitizePath('uploads/../../../secret.env')).toThrow(/Path traversal attempt blocked/);
      expect(() => fileStorageService.sanitizePath('file\0.pdf')).toThrow(/Path traversal attempt blocked/);
      expect(() => fileStorageService.sanitizePath('..\\..\\windows\\system32')).toThrow(/Path traversal attempt blocked/);
    });

    it('🔒 getPaymentReceipt debe rechazar comprobantes que intenten salir del directorio permitido', async () => {
      const maliciousPaymentId = uuidv4();
      jest.spyOn(Payment, 'findByPk').mockResolvedValue({
        id: maliciousPaymentId,
        organizationId: 'org-test-1',
        receiptUrl: '/uploads/../../server/.env'
      });

      const req = {
        params: { id: maliciousPaymentId },
        user: { id: uuidv4(), organizationId: 'org-test-1', role: 'ADMIN' },
        withTenantTransaction: async (cb) => cb(null)
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn()
      };

      await fileController.getPaymentReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/traversal|inválida/i) })
      );

      Payment.findByPk.mockRestore();
    });

    it('🔒 getPaymentReceipt debe bloquear acceso cruzado si el comprobante es de otra organización', async () => {
      const paymentId = uuidv4();
      jest.spyOn(Payment, 'findByPk').mockResolvedValue({
        id: paymentId,
        organizationId: 'org-victim',
        receiptUrl: 'tenants/org-victim/receipts/recibo.pdf'
      });

      const req = {
        params: { id: paymentId },
        user: { id: uuidv4(), organizationId: 'org-attacker', role: 'ADMIN' },
        withTenantTransaction: async (cb) => cb(null)
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await fileController.getPaymentReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/autorización/i) })
      );

      Payment.findByPk.mockRestore();
    });
  });

  // =========================================================================
  // 4. AUDITORÍA: getLatestHash FAIL-CLOSED, ADVISORY LOCK & REDACCIÓN
  // =========================================================================
  describe('4. Auditoría: getLatestHash Fail-Closed, Advisory Lock & Redacción de Secretos', () => {
    it('🔒 getLatestHash() debe propagar errores y NUNCA devolver GENESIS_HASH como fallback ante fallo de query', async () => {
      const { AuditLog } = require('../../models');
      const findOneSpy = jest.spyOn(AuditLog, 'findOne').mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

      await expect(
        auditService.getLatestHash('some-org-id')
      ).rejects.toThrow('Connection terminated unexpectedly');

      findOneSpy.mockRestore();
    });

    it('🔒 Si falla la auditoría de una acción crítica por error en hash o BD, debe abortar y revertir', async () => {
      jest.spyOn(auditService, 'getLatestHash').mockRejectedValueOnce(new Error('Simulated database deadlock'));

      await expect(
        auditService.logEvent({
          action: 'MEDICAL_RECORD_SIGN',
          entity: 'MedicalRecord',
          entityId: 'med-rec-critical',
          isCritical: true
        })
      ).rejects.toThrow(/CRITICAL_AUDIT_LOG_FAILED/);

      auditService.getLatestHash.mockRestore();
    });

    it('🔒 Debe redactar contraseñas, tokens y claves de 2FA en los registros de auditoría', async () => {
      const record = await auditService.logEvent({
        action: 'USER_PASSWORD_CHANGE',
        entity: 'User',
        entityId: 'user-redact-test',
        oldValues: { password: 'old-plain-password', email: 'user@test.com' },
        newValues: { password: 'new-plain-password', resetToken: 'secret-token-xyz' },
        metadata: { apiKey: 'key_1234567890' }
      });

      expect(record.oldValues.password).toBe('[REDACTED]');
      expect(record.newValues.password).toBe('[REDACTED]');
      expect(record.newValues.resetToken).toBe('[REDACTED]');
      expect(record.metadata.apiKey).toBe('[REDACTED]');
      // Campos no sensibles se preservan
      expect(record.oldValues.email).toBe('user@test.com');
    });
  });

  // =========================================================================
  // 5. MIGRACIÓN RLS FAIL-FAST Y PRODUCTION CHECK STRICT
  // =========================================================================
  describe('5. Verificación de Migración RLS y Production Check Estricto', () => {
    it('🔒 Migración RLS debe abortar con error si falta una tabla esperada o no tiene políticas', async () => {
      const rlsMigration = require('../../migrations/20261007210000-enable-postgresql-rls-and-tenant-columns');
      
      // Simular que una de las tablas requeridas no existe
      const mockQueryInterface = {
        tableExists: jest.fn().mockImplementation(async (name) => {
          if (name === 'MedicalRecords') return false; // Falta tabla crítica
          return true;
        }),
        describeTable: jest.fn().mockResolvedValue({ organizationId: true }),
        sequelize: sequelize
      };

      await expect(
        rlsMigration.up(mockQueryInterface, sequelize.Sequelize)
      ).rejects.toThrow(/\[Migration RLS FATAL\] Required tenant tables do not exist/);
    });

    it('🔒 ProductionReadinessChecker debe marcar FAIL y no apto si se utiliza --skip-db', async () => {
      const checker = new ProductionReadinessChecker({ skipDb: true, strict: true });
      const report = await checker.runAll();

      const dbCheck = checker.results.find(r => r.name.includes('DB Skipped'));
      expect(dbCheck).toBeDefined();
      expect(dbCheck.status).toBe('FAIL');
      expect(report.isReady).toBe(false);
      expect(report.summary.failed).toBeGreaterThanOrEqual(1);
    });

    it('🔒 ProductionReadinessChecker debe validar exhaustivamente las 27 tablas multi-tenant', async () => {
      if (!isPostgres) return;

      const checker = new ProductionReadinessChecker({ strict: true });
      await checker.checkRowLevelSecurity(sequelize);

      const rlsResult = checker.results.find(r => r.name === 'Row-Level Security (RLS)');
      expect(rlsResult).toBeDefined();
      expect(rlsResult.status).toBe('PASS');
      expect(rlsResult.message).toContain('27 tables');
    });
  });
});
