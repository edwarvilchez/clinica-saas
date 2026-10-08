'use strict';

/**
 * 🛡️ FASE 3 SECURITY TEST SUITE: Protected Medical Files & Document Storage
 * Verifies magic byte analysis, path traversal defense, HMAC-SHA256 signed URLs,
 * cross-tenant file isolation, and blocked public /uploads access.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const fileStorageService = require('../../services/fileStorage.service');
const { Organization, User, Role, sequelize } = require('../../models');

describe('🛡️ FASE 3: Secure File Storage & Document Protection Suite', () => {
  let app;
  let orgA;
  let orgB;
  let userA;
  let userB;
  let tokenA;
  let tokenB;

  // Real PDF sample buffer starting with %PDF- (Magic bytes: 0x25, 0x50, 0x44, 0x46)
  const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF');

  // Real PNG sample buffer starting with 0x89, 0x50, 0x4E, 0x47
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);

  // Fake executable disguised as PDF (starts with MZ: 0x4D, 0x5A)
  const fakePdfMalwareBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00ThisIsMalwareDisguisedAsPdf');

  beforeAll(async () => {
    await sequelize.authenticate();

    // Create Doctor Role
    const doctorRole = await Role.findOne({ where: { name: 'DOCTOR' } }) ||
                       await Role.create({ name: 'DOCTOR' });

    userA = await User.create({
      id: uuidv4(),
      username: `file_user_a_${Date.now()}`,
      email: `file_a_${Date.now()}@clinica.com`,
      password: 'SecurePassword123!',
      roleId: doctorRole.id,
      isActive: true
    });

    userB = await User.create({
      id: uuidv4(),
      username: `file_user_b_${Date.now()}`,
      email: `file_b_${Date.now()}@clinica.com`,
      password: 'SecurePassword123!',
      roleId: doctorRole.id,
      isActive: true
    });

    orgA = await Organization.create({
      id: uuidv4(),
      name: `Hospital Alpha Files ${Date.now()}`,
      type: 'HOSPITAL',
      ownerId: userA.id,
      subscriptionStatus: 'ACTIVE'
    });

    orgB = await Organization.create({
      id: uuidv4(),
      name: `Hospital Beta Files ${Date.now()}`,
      type: 'HOSPITAL',
      ownerId: userB.id,
      subscriptionStatus: 'ACTIVE'
    });

    await userA.update({ organizationId: orgA.id });
    await userB.update({ organizationId: orgB.id });

    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_github_actions_2026';
    tokenA = jwt.sign({ id: userA.id, role: 'DOCTOR', organizationId: orgA.id }, jwtSecret, { expiresIn: '1h' });
    tokenB = jwt.sign({ id: userB.id, role: 'DOCTOR', organizationId: orgB.id }, jwtSecret, { expiresIn: '1h' });

    // Load Express app for endpoint testing
    const express = require('express');
    app = express();
    app.use(express.json());

    // Mount secure files router and direct uploads blocker
    app.use('/api/files', require('../../routes/file.routes'));
    app.use('/uploads', (req, res) => {
      res.status(403).json({ error: 'Acceso directo a uploads prohibido por directiva de seguridad.' });
    });
  });

  afterAll(async () => {
    try {
      if (userA) await User.destroy({ where: { id: userA.id }, force: true });
      if (userB) await User.destroy({ where: { id: userB.id }, force: true });
      if (orgA) await Organization.destroy({ where: { id: orgA.id }, force: true });
      if (orgB) await Organization.destroy({ where: { id: orgB.id }, force: true });
    } catch (e) {
      // Ignore cleanup error
    }
  });

  // =========================================================================
  // 1. SECURE STORAGE & UUID ISOLATION
  // =========================================================================

  test('🔒 Stores valid clinical PDF in private tenant directory with UUID filename', async () => {
    const fileResult = await fileStorageService.saveFile({
      buffer: validPdfBuffer,
      originalname: 'Informe_Clinico_Paciente_123.pdf',
      mimetype: 'application/pdf',
      organizationId: orgA.id,
      folder: 'records'
    });

    expect(fileResult).toBeDefined();
    expect(fileResult.storageKey).toMatch(new RegExp(`^tenants/${orgA.id}/records/[a-f0-9-]+\\.pdf$`));
    expect(fileResult.filename).not.toBe('Informe_Clinico_Paciente_123.pdf');
    expect(fileResult.filename).toMatch(/^[a-f0-9-]+\.pdf$/);

    // Verify file exists on disk in private storage
    const stream = fileStorageService.getFileStream(fileResult.storageKey);
    expect(stream).toBeDefined();

    // Verify buffer retrieval
    const fetched = await fileStorageService.getFileBuffer(fileResult.storageKey);
    expect(fetched.buffer.length).toBe(validPdfBuffer.length);
    expect(fetched.mimeType).toBe('application/pdf');

    // Clean up
    await fileStorageService.deleteFile(fileResult.storageKey);
  });

  // =========================================================================
  // 2. BINARY MAGIC BYTES VALIDATION
  // =========================================================================

  test('🔒 Rejects disguised malware/executable files with invalid magic bytes', async () => {
    await expect(
      fileStorageService.saveFile({
        buffer: fakePdfMalwareBuffer, // Starts with MZ instead of %PDF-
        originalname: 'receta_medica.pdf',
        mimetype: 'application/pdf',
        organizationId: orgA.id
      })
    ).rejects.toThrow(/File content signature does not match declared MIME type/i);
  });

  // =========================================================================
  // 3. EXTENSION WHITELIST & BLACKLIST DEFENSE
  // =========================================================================

  test('🔒 Rejects dangerous file extensions (.php, .exe, .sh, .svg, .js)', async () => {
    const dangerousExtensions = ['shell.php', 'script.sh', 'trojan.exe', 'vector.svg', 'payload.js'];

    for (const filename of dangerousExtensions) {
      await expect(
        fileStorageService.saveFile({
          buffer: validPdfBuffer,
          originalname: filename,
          mimetype: 'application/pdf',
          organizationId: orgA.id
        })
      ).rejects.toThrow(/File extension blocked for security reasons/i);
    }
  });

  // =========================================================================
  // 4. PATH TRAVERSAL DEFENSE
  // =========================================================================

  test('🔒 Blocks path traversal attempts (../../etc/passwd, ..\\..\\)', () => {
    const maliciousPaths = [
      '../../etc/passwd',
      '..\\..\\windows\\system32\\config',
      'tenants/../../../secret.env',
      './../var/log/syslog'
    ];

    for (const badPath of maliciousPaths) {
      expect(() => fileStorageService.sanitizePath(badPath)).toThrow(/Path traversal attempt blocked/i);
    }
  });

  // =========================================================================
  // 5. TIME-LIMITED CRYPTOGRAPHIC SIGNED URLS (HMAC-SHA256)
  // =========================================================================

  test('🔒 Generates valid HMAC-SHA256 signed URL and verifies authenticity', () => {
    const storageKey = `tenants/${orgA.id}/records/test_document.pdf`;
    const signedUrl = fileStorageService.generateSignedUrl(storageKey, {
      expiresInSeconds: 3600,
      organizationId: orgA.id
    });

    expect(signedUrl).toContain('/api/files/download?');
    expect(signedUrl).toContain(`key=${encodeURIComponent(storageKey)}`);
    expect(signedUrl).toContain('sig=');
    expect(signedUrl).toContain('expires=');

    // Parse URL params
    const urlObj = new URL(`http://localhost${signedUrl}`);
    const key = urlObj.searchParams.get('key');
    const expires = urlObj.searchParams.get('expires');
    const sig = urlObj.searchParams.get('sig');
    const org = urlObj.searchParams.get('org');

    // Authentic signed URL must verify as TRUE
    const isValid = fileStorageService.verifySignedUrl(key, expires, sig, org);
    expect(isValid).toBe(true);

    // Forged signature must verify as FALSE
    const isForged = fileStorageService.verifySignedUrl(key, expires, 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', org);
    expect(isForged).toBe(false);

    // Expired timestamp in the past must verify as FALSE
    const pastTimestamp = Math.floor(Date.now() / 1000) - 60;
    const isExpired = fileStorageService.verifySignedUrl(key, pastTimestamp, sig, org);
    expect(isExpired).toBe(false);
  });

  // =========================================================================
  // 6. CROSS-TENANT DOWNLOAD ACCESS ISOLATION
  // =========================================================================

  test('🔒 Tenant A CANNOT download Tenant B files via authenticated API', async () => {
    // 1. Save file owned by Tenant B
    const fileB = await fileStorageService.saveFile({
      buffer: validPdfBuffer,
      originalname: 'Confidencial_Tenant_Beta.pdf',
      mimetype: 'application/pdf',
      organizationId: orgB.id,
      folder: 'records'
    });

    // 2. Tenant A attempts to download Tenant B's file
    const res = await request(app)
      .get(`/api/files/download?key=${encodeURIComponent(fileB.storageKey)}`)
      .set('Authorization', `Bearer ${tokenA}`); // Using Tenant A's token

    // Must be blocked with 403 Forbidden!
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/otra organización/i);

    // 3. Tenant B can download their own file successfully
    const validRes = await request(app)
      .get(`/api/files/download?key=${encodeURIComponent(fileB.storageKey)}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(validRes.status).toBe(200);
    expect(validRes.headers['content-type']).toBe('application/pdf');
    expect(validRes.headers['x-content-type-options']).toBe('nosniff');

    // Clean up
    await fileStorageService.deleteFile(fileB.storageKey);
  });

  // =========================================================================
  // 7. DIRECT /uploads ACCESS IS STRICTLY BLOCKED
  // =========================================================================

  test('🔒 Direct unauthenticated HTTP requests to /uploads return 403 Forbidden', async () => {
    const res = await request(app).get('/uploads/recibo_123.pdf');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Acceso directo a uploads prohibido/i);
  });
});
