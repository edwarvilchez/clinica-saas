'use strict';

/**
 * 🛡️ FASE 2 SECURITY TEST SUITE: Tamper-Evident Audit Trail & Append-Only Integrity
 * Verifies SHA-256 cryptographic hash chaining, tamper detection, PostgreSQL trigger immutability,
 * and multi-tenant isolation on audit records.
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const context = require('../../utils/context');
const auditService = require('../../services/audit.service');
const { setTenantContext } = require('../../utils/tenantRls');
const { AuditLog, Organization, User, Role, sequelize } = require('../../models');

describe('🛡️ FASE 2: Audit Integrity & Tamper-Evidence Security Suite', () => {
  let testOrgA;
  let testOrgB;
  let testUserA;

  beforeAll(async () => {
    await sequelize.authenticate();

    // Setup superadmin context for test fixtures
    await setTenantContext(sequelize, { isSuperAdmin: true });

    const role = await Role.findOne({ where: { name: 'DOCTOR' } }) ||
                 await Role.create({ name: 'DOCTOR' });

    testUserA = await User.create({
      id: uuidv4(),
      username: `audit_user_${Date.now()}`,
      email: `audit_user_${Date.now()}@clinica.com`,
      password: 'SecurePassword123!',
      roleId: role.id,
      isActive: true
    });

    testOrgA = await Organization.create({
      id: uuidv4(),
      name: `Audit Clinic Alpha ${Date.now()}`,
      type: 'CLINIC',
      ownerId: testUserA.id,
      subscriptionStatus: 'ACTIVE'
    });

    testOrgB = await Organization.create({
      id: uuidv4(),
      name: `Audit Clinic Beta ${Date.now()}`,
      type: 'CLINIC',
      ownerId: testUserA.id,
      subscriptionStatus: 'ACTIVE'
    });
  });

  afterAll(async () => {
    // Note: audit_logs cannot be deleted due to append-only trigger!
    // We clean up test organizations and users
    await setTenantContext(sequelize, { isSuperAdmin: true });
    try {
      if (testUserA) await User.destroy({ where: { id: testUserA.id }, force: true });
      if (testOrgA) await Organization.destroy({ where: { id: testOrgA.id }, force: true });
      if (testOrgB) await Organization.destroy({ where: { id: testOrgB.id }, force: true });
    } catch (e) {
      // Ignore cleanup error
    }
  });

  // =========================================================================
  // 1. CANONICAL SHA-256 HASH COMPUTATION & UUID STRUCTURE
  // =========================================================================

  test('🔒 Computes reproducible 64-character SHA-256 hash for audit events', async () => {
    const entry = {
      action: 'LOGIN',
      entity: 'Auth',
      entityId: testUserA.id,
      organizationId: testOrgA.id,
      actorUserId: testUserA.id,
      timestamp: new Date('2026-10-08T12:00:00.000Z'),
      changes: { status: { from: 'inactive', to: 'active' } },
      metadata: { ip: '192.168.1.100' }
    };
    const prevHash = '0000000000000000000000000000000000000000000000000000000000000000';

    const hash1 = auditService.computeAuditHash(entry, prevHash);
    const hash2 = auditService.computeAuditHash(entry, prevHash);

    expect(hash1).toBeDefined();
    expect(hash1.length).toBe(64); // Valid SHA-256 hex string length
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2); // Deterministic and reproducible
  });

  // =========================================================================
  // 2. CRYPTOGRAPHIC HASH CHAINING (previousHash -> currentHash)
  // =========================================================================

  test('🔒 Sequential audit records form an unbroken cryptographic chain', async () => {
    const chainOrg = await Organization.create({
      id: uuidv4(),
      name: `Chain Org ${Date.now()}`,
      type: 'CLINIC',
      ownerId: testUserA.id,
      subscriptionStatus: 'ACTIVE'
    });
    const uniqueOrgId = chainOrg.id;

    // Record 1
    const record1 = await auditService.logEvent({
      organizationId: uniqueOrgId,
      actorUserId: testUserA.id,
      action: 'LOGIN',
      entity: 'Auth',
      entityId: testUserA.id
    });

    expect(record1).not.toBeNull();
    expect(record1.previousHash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
    expect(record1.currentHash).toMatch(/^[a-f0-9]{64}$/);

    // Record 2
    const record2 = await auditService.logEvent({
      organizationId: uniqueOrgId,
      actorUserId: testUserA.id,
      action: 'VIEW_MEDICAL_RECORD',
      entity: 'MedicalRecord',
      entityId: uuidv4()
    });

    expect(record2).not.toBeNull();
    // Record 2 must link directly to Record 1's currentHash!
    expect(record2.previousHash).toBe(record1.currentHash);
    expect(record2.currentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(record2.currentHash).not.toBe(record1.currentHash);

    // Record 3
    const record3 = await auditService.logEvent({
      organizationId: uniqueOrgId,
      actorUserId: testUserA.id,
      action: 'LOGOUT',
      entity: 'Auth',
      entityId: testUserA.id
    });

    expect(record3).not.toBeNull();
    // Record 3 must link directly to Record 2's currentHash!
    expect(record3.previousHash).toBe(record2.currentHash);

    // Verify chain using verification method
    const verifyResult = await auditService.verifyChain({ organizationId: uniqueOrgId });
    expect(verifyResult.verified).toBe(true);
    expect(verifyResult.count).toBe(3);
    expect(verifyResult.tipHash).toBe(record3.currentHash);
  });

  // =========================================================================
  // 3. TAMPER DETECTION ENGINE
  // =========================================================================

  test('🔒 Tamper verification detects data alteration or hash manipulation', async () => {
    const entry = {
      action: 'VIEW_MEDICAL_RECORD',
      entity: 'MedicalRecord',
      entityId: uuidv4(),
      organizationId: testOrgA.id,
      actorUserId: testUserA.id,
      timestamp: new Date('2026-10-08T14:00:00.000Z'),
      changes: null,
      metadata: { confidential: true }
    };
    const prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const legitimateHash = auditService.computeAuditHash(entry, prevHash);

    // 1. Modifying action changes the hash completely (Avalanche effect)
    const alteredEntry = { ...entry, action: 'HACKED_ACTION' };
    const alteredHash = auditService.computeAuditHash(alteredEntry, prevHash);
    expect(alteredHash).not.toBe(legitimateHash);

    // 2. Modifying metadata changes the hash
    const alteredMeta = { ...entry, metadata: { confidential: false } };
    const alteredMetaHash = auditService.computeAuditHash(alteredMeta, prevHash);
    expect(alteredMetaHash).not.toBe(legitimateHash);

    // 3. Modifying previousHash breaks chaining
    const wrongPrevHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const brokenChainHash = auditService.computeAuditHash(entry, wrongPrevHash);
    expect(brokenChainHash).not.toBe(legitimateHash);
  });

  // =========================================================================
  // 4. APPEND-ONLY IMMUTABILITY (PostgreSQL Trigger & ORM Defense)
  // =========================================================================

  test('🔒 Sequelize blocks UPDATE operations on AuditLog records', async () => {
    const testRecord = await auditService.logEvent({
      organizationId: testOrgA.id,
      actorUserId: testUserA.id,
      action: 'LOGIN',
      entity: 'Auth',
      entityId: testUserA.id
    });

    await expect(
      AuditLog.update(
        { action: 'ALTERED_LOGIN' },
        { where: { id: testRecord.id } }
      )
    ).rejects.toThrow(/Audit logs are strictly append-only/i);
  });

  test('🔒 Sequelize blocks DELETE operations on AuditLog records', async () => {
    const testRecord = await auditService.logEvent({
      organizationId: testOrgA.id,
      actorUserId: testUserA.id,
      action: 'LOGIN',
      entity: 'Auth',
      entityId: testUserA.id
    });

    await expect(
      AuditLog.destroy({ where: { id: testRecord.id } })
    ).rejects.toThrow(/Audit logs are strictly append-only/i);
  });

  test('🔒 PostgreSQL database trigger blocks raw SQL UPDATE and DELETE on audit_logs', async () => {
    const testRecord = await auditService.logEvent({
      organizationId: testOrgA.id,
      actorUserId: testUserA.id,
      action: 'TEST_TRIGGER_IMMUTABILITY',
      entity: 'AuditTest',
      entityId: testUserA.id
    });

    // Attempt raw SQL UPDATE bypassing ORM
    await expect(
      sequelize.query(`UPDATE audit_logs SET action = 'MALICIOUS_OVERWRITE' WHERE id = '${testRecord.id}'`)
    ).rejects.toThrow(/Audit logs are strictly append-only/i);

    // Attempt raw SQL DELETE bypassing ORM
    await expect(
      sequelize.query(`DELETE FROM audit_logs WHERE id = '${testRecord.id}'`)
    ).rejects.toThrow(/Audit logs are strictly append-only/i);
  });

  // =========================================================================
  // 5. MULTI-TENANT ISOLATION OF AUDIT RECORDS
  // =========================================================================

  test('🔒 Tenant A CANNOT see Tenant B audit log records', async () => {
    // Create audit log for Org A
    const logA = await auditService.logEvent({
      organizationId: testOrgA.id,
      actorUserId: testUserA.id,
      action: 'ALPHA_CONFIDENTIAL_AUDIT',
      entity: 'MedicalRecord',
      entityId: uuidv4()
    });

    // Create audit log for Org B
    const logB = await auditService.logEvent({
      organizationId: testOrgB.id,
      actorUserId: testUserA.id,
      action: 'BETA_SECRET_AUDIT',
      entity: 'MedicalRecord',
      entityId: uuidv4()
    });

    // Run query inside Tenant A context
    await context.storage.run({ organizationId: testOrgA.id, role: 'ADMIN', userId: testUserA.id }, async () => {
      const tenantLogs = await AuditLog.findAll({
        where: {} // Find all in tenant scope
      });

      const logIds = tenantLogs.map(l => l.id);

      expect(logIds).toContain(logA.id);
      expect(logIds).not.toContain(logB.id);

      // Explicit find by Org B's log ID must return null
      const directLogB = await AuditLog.findOne({ where: { id: logB.id } });
      expect(directLogB).toBeNull();
    });
  });

  // =========================================================================
  // 6. AUDIT CHAIN CONCURRENCY & FORK PREVENTION
  // =========================================================================

  test('🔒 Concurrent audit events serialize deterministically without branching forks', async () => {
    const concurrentOrg = await Organization.create({
      id: uuidv4(),
      name: `Concurrent Audit Clinic ${Date.now()}`,
      type: 'CLINIC',
      ownerId: testUserA.id,
      subscriptionStatus: 'ACTIVE'
    });

    const numEvents = 5;
    const promises = [];

    for (let i = 0; i < numEvents; i++) {
      promises.push(
        auditService.logEvent({
          organizationId: concurrentOrg.id,
          actorUserId: testUserA.id,
          action: `CONCURRENT_EVENT_${i}`,
          entity: 'TestEntity',
          entityId: `id_${i}`
        })
      );
    }

    const createdLogs = await Promise.all(promises);
    expect(createdLogs.length).toBe(numEvents);
    expect(createdLogs.every(l => l && l.currentHash)).toBe(true);

    // Retrieve full chain ordered by timestamp, id ASC
    const fullChain = await AuditLog.findAll({
      where: { organizationId: concurrentOrg.id },
      order: [['timestamp', 'ASC'], ['id', 'ASC']]
    });

    expect(fullChain.length).toBe(numEvents);

    // Verify each previousHash is unique except if genesis
    const previousHashes = fullChain.map(l => l.previousHash);
    const uniquePreviousHashes = new Set(previousHashes);
    expect(uniquePreviousHashes.size).toBe(numEvents);

    // Verify each record's previousHash matches the preceding record's currentHash
    for (let i = 1; i < fullChain.length; i++) {
      expect(fullChain[i].previousHash).toBe(fullChain[i - 1].currentHash);
    }
  });
});
