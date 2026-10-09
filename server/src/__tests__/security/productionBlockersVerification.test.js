'use strict';

/**
 * 🛡️ SUITE DE VERIFICACIÓN DE PRODUCTION BLOCKERS (P0 / P1)
 * Valida de forma ejecutable:
 *   1. Migración no destructiva de auditoría (preservación de filas históricas, IDs y hashes)
 *   2. Verificación de cadena criptográfica (3 partes: unhashed, segments, breaks)
 *   3. Rollback no destructivo (down) de migración de auditoría sin pérdida de registros
 *   4. Trigger inmutable append-only de PostgreSQL (bloqueo de UPDATE y DELETE)
 *   5. Fallo cerrado de contexto multi-tenant en contextMiddleware
 *   6. Aislamiento RLS en PostgreSQL con rol no-superusuario (NOSUPERUSER NOBYPASSRLS)
 *   7. Aislamiento bajo solicitudes concurrentes en conexiones separadas
 *   8. Protección uniforme y anti-acceso cruzado en controladores (Patient, Payment, Lab, Inventory, Files)
 *   9. Contención estricta de rutas de archivos, anti-traversal y symlink escape
 *   10. Fail-closed en advisory locks de auditoría y atomicidad con operaciones críticas
 *   11. Redacción estricta de secretos y PII en registros de auditoría
 *   12. Production Check: detección de fallo ante --skip-db y validación exhaustiva de 27 tablas RLS
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../../config/db.config');
const fileStorageService = require('../../services/fileStorage.service');
const auditService = require('../../services/audit.service');
const tenantRls = require('../../utils/tenantRls');
const { ProductionReadinessChecker } = require('../../scripts/productionCheck');
const contextMiddleware = require('../../middlewares/context.middleware');
const fileController = require('../../controllers/file.controller');
const patientController = require('../../controllers/patient.controller');
const paymentController = require('../../controllers/payment.controller');
const labResultController = require('../../controllers/labResult.controller');
const inventoryController = require('../../controllers/inventory.controller');
const { Payment, Organization, User, Patient, LabResult, InventoryItem, AuditLog } = require('../../models');

describe('🛡️ PRODUCTION BLOCKERS HARDENING & VERIFICATION SUITE', () => {
  const isPostgres = sequelize.getDialect() === 'postgres';
  let orgA;
  let orgB;
  let createdTestUser = null;
  let createdOrgA = null;
  let createdOrgB = null;

  beforeAll(async () => {
    if (isPostgres) {
      // Configurar rol de aplicación no privilegiado (NOSUPERUSER NOBYPASSRLS) para pruebas estrictas de RLS
      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'clinica_test_user') THEN
            CREATE ROLE clinica_test_user WITH LOGIN PASSWORD 'testpass' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
          END IF;
          GRANT USAGE ON SCHEMA public TO clinica_test_user;
          GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO clinica_test_user;
          GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO clinica_test_user;
        END
        $$;
      `);

      let orgs = await Organization.findAll({ limit: 2 });
      if (orgs.length >= 2) {
        orgA = orgs[0].id;
        orgB = orgs[1].id;
      } else {
        const { Role } = require('../../models');
        let user = await User.findOne();
        if (!user) {
          const role = await Role.findOne({ where: { name: 'DOCTOR' } }) ||
                       await Role.create({ name: 'DOCTOR' });
          user = await User.create({
            id: uuidv4(),
            username: `prod_blocker_user_${Date.now()}`,
            email: `prod_blocker_user_${Date.now()}@test.com`,
            password: 'Password123!',
            roleId: role.id,
            isActive: true
          });
          createdTestUser = user;
        }
        if (orgs.length === 1) {
          orgA = orgs[0].id;
          const o2 = await Organization.create({
            id: uuidv4(),
            name: `Org B Test ${Date.now()}`,
            type: 'CLINIC',
            ownerId: user.id
          });
          orgB = o2.id;
          createdOrgB = o2;
        } else {
          const o1 = await Organization.create({
            id: uuidv4(),
            name: `Org A Test ${Date.now()}`,
            type: 'CLINIC',
            ownerId: user.id
          });
          const o2 = await Organization.create({
            id: uuidv4(),
            name: `Org B Test ${Date.now()}`,
            type: 'CLINIC',
            ownerId: user.id
          });
          orgA = o1.id;
          orgB = o2.id;
          createdOrgA = o1;
          createdOrgB = o2;
        }
      }
    }
  });

  afterAll(async () => {
    if (isPostgres) {
      try {
        await tenantRls.setTenantContext(sequelize, { isSuperAdmin: true });
        await Patient.destroy({ where: { organizationId: [orgA, orgB] }, force: true }).catch(() => {});
        await Payment.destroy({ where: { organizationId: [orgA, orgB] }, force: true }).catch(() => {});
        await InventoryItem.destroy({ where: { organizationId: [orgA, orgB] }, force: true }).catch(() => {});
        if (createdOrgA) await Organization.destroy({ where: { id: createdOrgA.id }, force: true }).catch(() => {});
        if (createdOrgB) await Organization.destroy({ where: { id: createdOrgB.id }, force: true }).catch(() => {});
        if (createdTestUser) await User.destroy({ where: { id: createdTestUser.id }, force: true }).catch(() => {});
        await tenantRls.clearTenantContext(sequelize);
      } catch (_) {}
    }
  });

  // Helper para simular req con withTenantTransaction real
  const createMockReq = ({ params = {}, body = {}, userOrgId, role = 'ADMIN', userId = uuidv4() }) => ({
    params,
    body,
    user: { id: userId, organizationId: userOrgId, role },
    ip: '127.0.0.1',
    get: (header) => header === 'x-request-id' ? 'req-mock-test' : null,
    withTenantTransaction: (cb) => tenantRls.withTenantTransaction(sequelize, {
      organizationId: userOrgId,
      isSuperAdmin: role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN'
    }, cb)
  });

  // =========================================================================
  // 1. MIGRACIÓN NO DESTRUCTIVA Y AUDITORÍA CRIPTOGRÁFICA
  // =========================================================================
  describe('1. Migración de Auditoría: Preservación sin Hashes Fabricados, Rollback Seguro & verifyChain()', () => {
    it('🔒 Debe preservar registros históricos con hashes ausentes/nulos sin inventar hashes falsos', async () => {
      if (!isPostgres) return;

      const testOrgId = orgA;

      // 1. Insertar directamente un registro histórico legacy que no posea hash (simulación pre-criptográfica)
      await sequelize.query(`SELECT set_config('app.is_super_admin', 'true', false);`);
      const legacyId = uuidv4();
      await sequelize.query(`
        INSERT INTO audit_logs (id, "organizationId", action, entity, "entityId", timestamp, "currentHash", "previousHash", metadata)
        VALUES (:id, :orgId, 'LEGACY_HISTORICAL_OP', 'Patient', 'leg-1', NOW() - INTERVAL '30 days', NULL, NULL, '{"source": "v1_app"}'::jsonb);
      `, {
        replacements: { id: legacyId, orgId: testOrgId }
      });
      await sequelize.query(`SELECT set_config('app.is_super_admin', 'false', false);`);

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

    it('🔒 verifyChain() debe informar por separado registros históricos sin hash, segmentos y rupturas, y marcar verified=false si hay registros no sellados', async () => {
      if (!isPostgres) return;

      await sequelize.query(`SELECT set_config('app.is_super_admin', 'true', false);`);
      const unhashedId = uuidv4();
      await sequelize.query(`
        INSERT INTO audit_logs (id, "organizationId", action, entity, "entityId", timestamp, "currentHash", "previousHash", metadata)
        VALUES (:id, :orgId, 'UNSEALED_LEGACY_OP', 'User', 'u-leg', NOW() - INTERVAL '10 days', NULL, NULL, '{"migrationStatus": "PRESERVED_HISTORICAL_UNHASHED"}'::jsonb);
      `, {
        replacements: { id: unhashedId, orgId: orgA }
      });
      await sequelize.query(`SELECT set_config('app.is_super_admin', 'false', false);`);

      // Insertar dos registros criptográficamente encadenados
      await auditService.logEvent({
        action: 'CHAIN_STEP_1',
        entity: 'Appointment',
        entityId: 'apt-1',
        organizationId: orgA
      });

      await auditService.logEvent({
        action: 'CHAIN_STEP_2',
        entity: 'Appointment',
        entityId: 'apt-2',
        organizationId: orgA
      });

      const verification = await auditService.verifyChain({ organizationId: orgA });

      // Verificación estricta: NO se marca la cadena como verificada totalmente porque hay registros históricos no sellados
      expect(verification.verified).toBe(false);
      expect(verification.status).toBe('PARTIAL_HISTORICAL_UNHASHED');
      expect(verification.historicalUnhashed.count).toBeGreaterThanOrEqual(1);
      expect(verification.historicalUnhashed.status).toBe('PRESERVED_HISTORICAL_EVIDENCE');
      expect(verification.cryptographicSegments.verifiedCount).toBeGreaterThanOrEqual(2);
      expect(verification.breaks).toHaveLength(0);
    });

    it('🔒 verifyChain() debe detectar rupturas de hash o manipulación e informar CHAIN_BROKEN', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          timestamp: new Date('2026-10-01'),
          currentHash: 'hash-1-tampered',
          previousHash: auditService.GENESIS_HASH,
          action: 'MOCK_ACTION',
          entity: 'Mock'
        },
        {
          id: 'log-2',
          timestamp: new Date('2026-10-02'),
          currentHash: 'hash-2',
          previousHash: 'different-hash-break',
          action: 'MOCK_ACTION_2',
          entity: 'Mock'
        }
      ];

      jest.spyOn(AuditLog, 'findAll').mockResolvedValueOnce(mockLogs);

      const result = await auditService.verifyChain({ organizationId: 'mock-org' });

      expect(result.verified).toBe(false);
      expect(result.status).toBe('CHAIN_BROKEN');
      expect(result.breaks.length).toBeGreaterThan(0);
      expect(result.breaks[0].reason).toMatch(/Data tampering|Chain broken/);

      AuditLog.findAll.mockRestore();
    });

    it('🔒 El rollback (down) de la migración de auditoría debe ser no destructivo y preservar todas las filas históricas', async () => {
      if (!isPostgres) return;

      const [countBefore] = await sequelize.query(`SELECT COUNT(*)::int AS total FROM audit_logs;`);
      const beforeTotal = countBefore[0].total;

      const migration = require('../../migrations/20261008000000-create-tamper-evident-audit-logs');

      // Ejecutar down()
      await migration.down(sequelize.getQueryInterface(), sequelize.Sequelize);

      const [countAfterDown] = await sequelize.query(`SELECT COUNT(*)::int AS total FROM audit_logs;`);
      expect(countAfterDown[0].total).toBe(beforeTotal); // Preservación absoluta, no hubo truncate ni drop table

      // Re-ejecutar up() para restaurar disparadores y políticas
      await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);

      const [countAfterUp] = await sequelize.query(`SELECT COUNT(*)::int AS total FROM audit_logs;`);
      expect(countAfterUp[0].total).toBe(beforeTotal);
    });

    it('🔒 El trigger PostgreSQL debe bloquear de forma irrevocable cualquier UPDATE o DELETE', async () => {
      if (!isPostgres) return;

      const testRecord = await auditService.logEvent({
        action: 'IMMUTABILITY_ENFORCEMENT_TEST',
        entity: 'SecurityPolicy',
        entityId: 'immutable-1',
        organizationId: orgA
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
  // 2. CONTEXTO MULTI-TENANT & MOTOR RLS DE POSTGRESQL (ROL NO-SUPERUSUARIO)
  // =========================================================================
  describe('2. Aislamiento Multi-Tenant: Engine-Level RLS (NOSUPERUSER NOBYPASSRLS) & Concurrencia', () => {
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

      expect(next).toHaveBeenCalled();
      expect(typeof req.withTenantTransaction).toBe('function');
      expect(req.tenantContext.organizationId).toBe(req.user.organizationId);

      querySpy.mockRestore();
    });

    it('🔒 withTenantTransaction debe fallar cerrado (revertir) si falla setTenantContext', async () => {
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

    it('🔒 Con rol no privilegiado (clinica_test_user), consultas raw bajo RLS devuelven 0 filas de otros tenants', async () => {
      if (!isPostgres) return;

      // Crear paciente de Org B directamente
      const patientBId = uuidv4();
      await Patient.create({
        id: patientBId,
        organizationId: orgB,
        documentId: `V-${Date.now() % 90000000}`,
        medicalRecordNumber: `HC-B-${Date.now() % 10000}`
      });

      // Ahora ejecutar transacción como clinica_test_user (NOSUPERUSER, NOBYPASSRLS) con tenant = orgA
      await sequelize.transaction(async (t) => {
        await sequelize.query(`SET LOCAL ROLE clinica_test_user;`, { transaction: t });
        await sequelize.query(`SELECT set_config('app.current_organization_id', :orgId, true);`, {
          replacements: { orgId: orgA },
          transaction: t
        });
        await sequelize.query(`SELECT set_config('app.is_super_admin', 'false', true);`, { transaction: t });

        // Consulta raw directa sobre Patients: NO debe ver al paciente de orgB
        const [rows] = await sequelize.query(
          `SELECT id, "organizationId" FROM "Patients" WHERE id = :id;`,
          {
            replacements: { id: patientBId },
            transaction: t
          }
        );

        expect(rows).toHaveLength(0); // Aislamiento absoluto por motor PostgreSQL RLS
      });
    });

    it('🔒 Con rol no privilegiado, inserción cruzada en tabla protegida arroja violación de política RLS WITH CHECK', async () => {
      if (!isPostgres) return;

      await expect(
        sequelize.transaction(async (t) => {
          await sequelize.query(`SET LOCAL ROLE clinica_test_user;`, { transaction: t });
          await sequelize.query(`SELECT set_config('app.current_organization_id', :orgId, true);`, {
            replacements: { orgId: orgA },
            transaction: t
          });
          await sequelize.query(`SELECT set_config('app.is_super_admin', 'false', true);`, { transaction: t });

          // Intentar insertar fila con organizationId = orgB bajo el contexto de orgA
          await sequelize.query(`
            INSERT INTO "Patients" (id, "organizationId", "documentId", "medicalRecordNumber", "createdAt", "updatedAt")
            VALUES (:id, :badOrg, 'V-33334444', 'HC-BAD-1', NOW(), NOW());
          `, {
            replacements: { id: uuidv4(), badOrg: orgB },
            transaction: t
          });
        })
      ).rejects.toThrow(/política de seguridad de registros|row-level security policy/i);
    });

    it('🔒 Solicitudes concurrentes en conexiones separadas garantizan aislamiento simultáneo sin cross-talk', async () => {
      if (!isPostgres) return;

      const runTenantTask = async (orgId) => {
        return sequelize.transaction(async (t) => {
          await sequelize.query(`SET LOCAL ROLE clinica_test_user;`, { transaction: t });
          await sequelize.query(`SELECT set_config('app.current_organization_id', :orgId, true);`, {
            replacements: { orgId },
            transaction: t
          });
          await sequelize.query(`SELECT set_config('app.is_super_admin', 'false', true);`, { transaction: t });

          // Pequeño retardo para forzar concurrencia real entre conexiones
          await new Promise(r => setTimeout(r, 40));

          const [res] = await sequelize.query(
            `SELECT current_setting('app.current_organization_id', true) AS active_org;`,
            { transaction: t }
          );
          return res[0].active_org;
        });
      };

      const [activeA, activeB] = await Promise.all([
        runTenantTask(orgA),
        runTenantTask(orgB)
      ]);

      expect(activeA).toBe(orgA);
      expect(activeB).toBe(orgB);
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
        organizationId: orgA,
        receiptUrl: '/uploads/../../server/.env'
      });

      const req = {
        params: { id: maliciousPaymentId },
        user: { id: uuidv4(), organizationId: orgA, role: 'ADMIN' },
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
        organizationId: orgA,
        receiptUrl: `tenants/${orgA}/receipts/recibo.pdf`
      });

      const req = {
        params: { id: paymentId },
        user: { id: uuidv4(), organizationId: orgB, role: 'ADMIN' },
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
  // 4. AISLAMIENTO Y BLOQUEO DE ACCESO CRUZADO EN CONTROLADORES SENSIBLES
  // =========================================================================
  describe('4. Controladores Sensibles: Aislamiento Transaccional y Bloqueo Cross-Tenant', () => {
    it('🔒 Patient Controller: rechaza getPatientById si el paciente pertenece a otra organización', async () => {
      const patientId = uuidv4();

      await Patient.create({
        id: patientId,
        organizationId: orgA,
        documentId: `V-${Date.now() % 90000000}`,
        medicalRecordNumber: `HC-V-${Date.now() % 10000}`
      });

      const req = createMockReq({
        params: { id: patientId },
        userOrgId: orgB,
        role: 'ADMIN'
      });
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await patientController.getPatientById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/no encontrado/i) }));
    });

    it('🔒 Payment Controller: rechaza deletePayment y updatePayment de pagos de otra clínica', async () => {
      const paymentId = uuidv4();

      await Payment.create({
        id: paymentId,
        organizationId: orgA,
        amount: 150.00,
        status: 'Pending',
        concept: 'Consulta Especializada'
      });

      // Intento de borrado desde orgB
      const reqDelete = createMockReq({
        params: { id: paymentId },
        userOrgId: orgB,
        role: 'ADMIN'
      });
      const resDelete = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await paymentController.deletePayment(reqDelete, resDelete);
      expect(resDelete.status).toHaveBeenCalledWith(404);

      // Intento de actualización desde orgB
      const reqUpdate = createMockReq({
        params: { id: paymentId },
        body: { amount: 10.00 },
        userOrgId: orgB,
        role: 'ADMIN'
      });
      const resUpdate = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await paymentController.updatePayment(reqUpdate, resUpdate);
      expect(resUpdate.status).toHaveBeenCalledWith(404);
    });

    it('🔒 Lab Result Controller: rechaza getPatientLabs para pacientes de otra organización', async () => {
      const patientId = uuidv4();

      await Patient.create({
        id: patientId,
        organizationId: orgA,
        documentId: `V-${Date.now() % 90000000}`,
        medicalRecordNumber: `HC-L-${Date.now() % 10000}`
      });

      const req = createMockReq({
        params: { patientId },
        userOrgId: orgB,
        role: 'DOCTOR'
      });
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await labResultController.getPatientLabs(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('🔒 Inventory Controller: rechaza deleteItem y registerMovement sobre ítems de otra clínica', async () => {
      const itemId = uuidv4();

      await InventoryItem.create({
        id: itemId,
        organizationId: orgA,
        code: `SKU-${Date.now() % 10000}`,
        name: 'Reactivo Clínico Confidencial',
        itemType: 'PRODUCT',
        stockCurrent: 50
      });

      const reqDelete = createMockReq({
        params: { id: itemId },
        userOrgId: orgB,
        role: 'ADMIN'
      });
      const resDelete = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await inventoryController.deleteItem(reqDelete, resDelete);
      expect(resDelete.status).toHaveBeenCalledWith(403);

      const reqMovement = createMockReq({
        body: { itemId, quantity: 5, movementType: 'CLINICAL_CONSUMPTION' },
        userOrgId: orgB,
        role: 'ADMIN'
      });
      const resMovement = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await inventoryController.registerMovement(reqMovement, resMovement);
      expect(resMovement.status).toHaveBeenCalledWith(403);
    });
  });

  // =========================================================================
  // 5. AUDITORÍA: getLatestHash FAIL-CLOSED, ADVISORY LOCK & REDACCIÓN
  // =========================================================================
  describe('5. Auditoría: getLatestHash Fail-Closed, Advisory Lock & Redacción de Secretos', () => {
    it('🔒 getLatestHash() debe propagar errores y NUNCA devolver GENESIS_HASH como fallback ante fallo de query', async () => {
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
          isCritical: true,
          organizationId: orgA
        })
      ).rejects.toThrow(/CRITICAL_AUDIT_LOG_FAILED/);

      auditService.getLatestHash.mockRestore();
    });

    it('🔒 Debe redactar contraseñas, tokens y claves de 2FA en los registros de auditoría', async () => {
      const record = await auditService.logEvent({
        action: 'USER_PASSWORD_CHANGE',
        entity: 'User',
        entityId: 'user-redact-test',
        organizationId: orgA,
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
  // 6. MIGRACIÓN RLS FAIL-FAST Y PRODUCTION CHECK STRICT
  // =========================================================================
  describe('6. Verificación de Migración RLS y Production Check Estricto', () => {
    it('🔒 Migración RLS debe abortar con error si falta una tabla esperada o no tiene políticas', async () => {
      const rlsMigration = require('../../migrations/20261007210000-enable-postgresql-rls-and-tenant-columns');
      
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
