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
  // 1. MIGRACIÓN NO DESTRUCTIVA Y TRIGGER INMUTABLE DE AUDITORÍA
  // =========================================================================
  describe('1. Migración de Auditoría No Destructiva & Trigger Inmutable', () => {
    it('🔒 Debe preservar registros históricos existentes sin DROP ni TRUNCATE', async () => {
      if (!isPostgres) return;

      const existingOrg = await Organization.findOne();
      const testOrgId = existingOrg ? existingOrg.id : null;

      // Insertar un registro de auditoría de prueba
      const initialRecord = await auditService.logEvent({
        organizationId: testOrgId,
        actorUserId: null,
        action: 'MIGRATION_PRESERVATION_TEST',
        entity: 'AuditTest',
        entityId: 'test-101',
        newValues: { status: 'pre-migration-record' }
      });

      expect(initialRecord).toBeDefined();
      expect(initialRecord.id).toBeDefined();
      expect(initialRecord.currentHash).toBeDefined();

      // Ejecutar la migración directamente sin DROP
      const migration = require('../../migrations/20261008000000-create-tamper-evident-audit-logs');
      await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);

      // Verificar que el registro sobrevive con su mismo ID y hash
      const [persisted] = await sequelize.query(
        `SELECT id, action, "currentHash", "timestamp" FROM audit_logs WHERE id = :id;`,
        { replacements: { id: initialRecord.id } }
      );

      expect(persisted.length).toBe(1);
      expect(persisted[0].action).toBe('MIGRATION_PRESERVATION_TEST');
      expect(persisted[0].currentHash).toBe(initialRecord.currentHash);
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
  // 2. CONTEXTO MULTI-TENANT FAIL-CLOSED
  // =========================================================================
  describe('2. Aislamiento Multi-Tenant & Fail-Closed en Middleware', () => {
    it('🔒 contextMiddleware debe abortar con 500 si falla la inicialización del contexto RLS', async () => {
      const tenantRls = require('../../utils/tenantRls');
      const originalSetContext = tenantRls.setTenantContext;

      // Simular fallo crítico de base de datos al configurar tenant
      tenantRls.setTenantContext = jest.fn().mockRejectedValue(new Error('PostgreSQL connection dropped'));

      const req = {
        user: { id: uuidv4(), organizationId: uuidv4(), role: 'DOCTOR' },
        get: () => 'req-test-fail-closed',
        ip: '127.0.0.1'
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        on: jest.fn()
      };

      const next = jest.fn();

      await contextMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'SECURITY_CONTEXT_INITIALIZATION_FAILED' })
      );
      expect(next).not.toHaveBeenCalled();

      // Restaurar
      tenantRls.setTenantContext = originalSetContext;
    });

    it('🔒 req.withTenantTransaction debe estar disponible y proporcionar aislamiento transaccional', async () => {
      const testOrgId = uuidv4();
      const req = {
        user: { id: uuidv4(), organizationId: testOrgId, role: 'DOCTOR' },
        get: () => 'req-tx-test',
        ip: '127.0.0.1'
      };

      const res = { on: jest.fn() };
      const next = jest.fn();

      await contextMiddleware(req, res, next);

      expect(typeof req.withTenantTransaction).toBe('function');

      if (isPostgres) {
        await req.withTenantTransaction(async (t) => {
          const [result] = await sequelize.query(
            `SELECT current_setting('app.current_organization_id', true) AS org;`,
            { transaction: t }
          );
          expect(result[0].org).toBe(testOrgId);
        });
      }
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
        user: { id: uuidv4(), organizationId: 'org-test-1', role: 'ADMIN' }
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
        user: { id: uuidv4(), organizationId: 'org-attacker', role: 'ADMIN' }
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
  // 4. AUDITORÍA: ADVISORY LOCK FAIL-CLOSED & REDACCIÓN
  // =========================================================================
  describe('4. Auditoría: Advisory Lock Fail-Closed, Redacción de Secretos & Rollback', () => {
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

    it('🔒 Si falla la auditoría de una acción crítica, debe lanzar CRITICAL_AUDIT_LOG_FAILED para abortar el negocio', async () => {
      jest.spyOn(auditService, 'getLatestHash').mockRejectedValueOnce(new Error('Simulated database deadlock'));

      await expect(
        auditService.logEvent({
          action: 'MEDICAL_RECORD_SIGN', // Acción crítica
          entity: 'MedicalRecord',
          entityId: 'med-rec-critical',
          isCritical: true
        })
      ).rejects.toThrow(/CRITICAL_AUDIT_LOG_FAILED/);

      auditService.getLatestHash.mockRestore();
    });
  });

  // =========================================================================
  // 5. PRODUCTION CHECK STRICT: BLOQUEO ANTE --skip-db Y RLS DESPROTEGIDO
  // =========================================================================
  describe('5. Production Check Estricto: Bloqueo Ante Omitir BD o RLS Incompleto', () => {
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
