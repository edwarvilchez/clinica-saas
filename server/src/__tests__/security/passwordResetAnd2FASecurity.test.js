'use strict';

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const appConfig = require('../../config/app.config');
const cryptoUtils = require('../../utils/crypto.utils');
const totp = require('../../utils/totp.service');
const refreshTokenService = require('../../services/refreshToken.service');
const { User, Role, RefreshToken, sequelize } = require('../../models');
const authController = require('../../controllers/auth.controller');

describe('🛡️ FASE 8: Password Reset Seguro (SHA-256), Cifrado 2FA (AES-256-GCM) & Códigos de Recuperación', () => {
  let app;
  let testRole;
  let testUser;
  let testUserEmail;
  const initialPassword = 'InitialSecurePassword123!';

  beforeAll(async () => {
    await sequelize.authenticate();
    const migration = require('../../migrations/20261008010000-add-2fa-recovery-codes-and-secure-reset');
    try {
      await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
    } catch (migErr) {
      // Column might already exist or table already updated
    }
    await User.sync();
    await RefreshToken.sync();

    testRole = await Role.findOne({ where: { name: 'DOCTOR' } }) ||
      await Role.create({ name: 'DOCTOR', description: 'Médico' });

    testUserEmail = `phase8_user_${Date.now()}@clinica.com`;
    testUser = await User.create({
      id: crypto.randomUUID(),
      username: `phase8_user_${Date.now()}`,
      email: testUserEmail,
      password: initialPassword,
      firstName: 'Roberto',
      lastName: 'Gómez',
      roleId: testRole.id,
      isActive: true,
      mustChangePassword: false
    });

    app = express();
    app.use(express.json());

    // Public auth routes
    app.post('/api/auth/forgot-password', authController.forgotPassword);
    app.post('/api/auth/reset-password', authController.resetPassword);
    app.post('/api/auth/verify-2fa-login', authController.verify2FALogin);

    // Protected auth routes (with simulated user context)
    const attachUser = (req, res, next) => {
      req.user = { id: testUser.id, role: 'DOCTOR' };
      next();
    };

    app.get('/api/auth/2fa/setup', attachUser, authController.setup2FA);
    app.post('/api/auth/2fa/enable', attachUser, authController.enable2FA);
    app.post('/api/auth/2fa/disable', attachUser, authController.disable2FA);
    app.post('/api/auth/change-password', attachUser, authController.changePassword);
  });

  afterAll(async () => {
    try {
      if (testUser) {
        await RefreshToken.destroy({ where: { userId: testUser.id } });
        await User.destroy({ where: { id: testUser.id } });
      }
    } catch (e) {
      // Ignore teardown errors
    }
  });

  // =========================================================================
  // 1. UNIT CRYPTO UTILS TEST SUITE
  // =========================================================================
  describe('1. Criptografía Helper (crypto.utils.js)', () => {
    test('encryptAesGcm cifra datos produciendo formato estricto iv:authTag:ciphertext', () => {
      const plaintext = 'JBSWY3DPEHPK3PXP';
      const encrypted = cryptoUtils.encryptAesGcm(plaintext);

      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toEqual(plaintext);

      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      // IV is 12 bytes = 24 hex characters
      expect(parts[0]).toMatch(/^[0-9a-f]{24}$/);
      // AuthTag is 16 bytes = 32 hex characters
      expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
      // Ciphertext is hex
      expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    });

    test('decryptAesGcm descifra correctamente el texto original', () => {
      const plaintext = 'SECRET_TOTP_SEED_TEST_2026';
      const encrypted = cryptoUtils.encryptAesGcm(plaintext);
      const decrypted = cryptoUtils.decryptAesGcm(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test('decryptAesGcm rechaza datos manipulados (tampering) detectando falla de autenticación GCM', () => {
      const plaintext = 'CONFIDENTIAL_MEDICAL_DATA';
      const encrypted = cryptoUtils.encryptAesGcm(plaintext);
      const parts = encrypted.split(':');

      // Tamper ciphertext
      const tamperedCiphertext = parts[2].substring(0, parts[2].length - 2) + (parts[2].endsWith('a') ? 'b' : 'a');
      const tampered = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

      expect(() => {
        cryptoUtils.decryptAesGcm(tampered);
      }).toThrow('Cryptographic verification failed');
    });

    test('decryptAesGcm provee fallback transparente para textos sin formato cifrado (datos legados)', () => {
      const legacySecret = 'LEGACYPLAINSECRET123';
      const result = cryptoUtils.decryptAesGcm(legacySecret);
      expect(result).toBe(legacySecret);
    });

    test('hashToken produce hashes SHA-256 deterministas de 64 caracteres hex', () => {
      const rawToken = '7f8a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a';
      const hash1 = cryptoUtils.hashToken(rawToken);
      const hash2 = cryptoUtils.hashToken(rawToken);

      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      expect(hash1).toBe(hash2);

      const hashDifferent = cryptoUtils.hashToken('different_token_input');
      expect(hashDifferent).not.toBe(hash1);
    });

    test('generateRecoveryCodes genera códigos legibles en formato XXXX-XXXX y sus correspondientes hashes', () => {
      const { plainCodes, hashedCodes } = cryptoUtils.generateRecoveryCodes(8);

      expect(plainCodes).toHaveLength(8);
      expect(hashedCodes).toHaveLength(8);

      plainCodes.forEach((code, index) => {
        expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
        const normalized = cryptoUtils.normalizeRecoveryCode(code);
        const expectedHash = cryptoUtils.hashToken(normalized);
        expect(hashedCodes[index].hash).toBe(expectedHash);
        expect(hashedCodes[index].used).toBe(false);
      });
    });
  });

  // =========================================================================
  // 2. FORGOT PASSWORD (ANTI-ENUMERATION & SHA-256 STORAGE)
  // =========================================================================
  describe('2. Recuperación de Contraseña Segura (forgotPassword)', () => {
    test('Anti-Enumeración: forgotPassword retorna 200 y mensaje genérico para usuarios inexistentes', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'non_existent_doctor_probe@gmail.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Si el correo electrónico existe en nuestra plataforma');
      expect(res.body.debugToken).toBeUndefined();
    });

    test('forgotPassword genera token aleatorio, guarda su hash SHA-256 en BD y fija expiración estricta a 15 min', async () => {
      const beforeReq = Date.now();
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUserEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Si el correo electrónico existe en nuestra plataforma');
      expect(res.body.debugToken).toBeDefined();

      const rawToken = res.body.debugToken;
      expect(rawToken).toHaveLength(64); // 32 bytes hex = 64 characters

      // Verify what was stored in the database
      const refreshedUser = await User.findByPk(testUser.id);
      expect(refreshedUser.resetToken).not.toBe(rawToken); // MUST NOT be stored in plain text
      expect(refreshedUser.resetToken).toBe(cryptoUtils.hashToken(rawToken)); // MUST be SHA-256 hash

      // Expiration check: should be ~15 minutes (900 seconds)
      const expiryTimestamp = new Date(refreshedUser.resetExpires).getTime();
      const diffMs = expiryTimestamp - beforeReq;
      const diffMinutes = diffMs / (60 * 1000);
      expect(diffMinutes).toBeGreaterThanOrEqual(14.5);
      expect(diffMinutes).toBeLessThanOrEqual(15.5);
    });
  });

  // =========================================================================
  // 3. RESET PASSWORD & SESSION INVALIDATION
  // =========================================================================
  describe('3. Restablecimiento de Contraseña (resetPassword) e Invalidación de Sesiones', () => {
    let activeRawToken;
    const newPassword = 'NewSuperSecurePassword2026!';

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUserEmail });
      activeRawToken = res.body.debugToken;
    });

    test('resetPassword actualiza la contraseña con éxito y anula el token de un solo uso', async () => {
      // Create some active refresh tokens for testUser to verify revocation
      await refreshTokenService.generateTokens(testUser, { req: { ip: '127.0.0.1', headers: {} } });
      await refreshTokenService.generateTokens(testUser, { req: { ip: '127.0.0.2', headers: {} } });

      const activeTokensBefore = await RefreshToken.count({
        where: { userId: testUser.id, isRevoked: false }
      });
      expect(activeTokensBefore).toBeGreaterThanOrEqual(2);

      // Perform reset password
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: activeRawToken,
          password: newPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Contraseña actualizada exitosamente');

      // Verify user in DB: password changed, reset token cleared
      const userAfter = await User.findByPk(testUser.id);
      expect(userAfter.resetToken).toBeNull();
      expect(userAfter.resetExpires).toBeNull();
      const matchesNew = await userAfter.comparePassword(newPassword);
      expect(matchesNew).toBe(true);

      // All prior sessions across all devices MUST be revoked
      const activeTokensAfter = await RefreshToken.count({
        where: { userId: testUser.id, isRevoked: false }
      });
      expect(activeTokensAfter).toBe(0);
    });

    test('Single-Use: reusar el mismo token de restablecimiento falla con 400', async () => {
      // First use should succeed
      const res1 = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: activeRawToken,
          password: 'AnotherPassword123!'
        });
      expect(res1.status).toBe(200);

      // Second use must fail
      const res2 = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: activeRawToken,
          password: 'TamperedPassword123!'
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toContain('Token inválido o expirado');
    });

    test('Rechazo estricto de tokens con fecha de expiración superada (> 15 min)', async () => {
      // Simulate expired token in DB
      const expiredRaw = crypto.randomBytes(32).toString('hex');
      const expiredHash = cryptoUtils.hashToken(expiredRaw);

      await testUser.update({
        resetToken: expiredHash,
        resetExpires: new Date(Date.now() - 5000) // Expired 5 seconds ago
      });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: expiredRaw,
          password: 'PasswordExpired123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Token inválido o expirado');
    });
  });

  // =========================================================================
  // 4. 2FA ENCRYPTION & RECOVERY CODES
  // =========================================================================
  describe('4. Cifrado AES-256-GCM para 2FA y Códigos de Recuperación', () => {
    let generatedSecret;
    let recoveryCodesIssued;

    test('setup2FA genera secreto Base32 y URL de configuración QR', async () => {
      const res = await request(app).get('/api/auth/2fa/setup');

      expect(res.status).toBe(200);
      expect(res.body.secret).toBeDefined();
      expect(res.body.otpauthUrl).toContain(encodeURIComponent(testUserEmail));
      expect(res.body.qrImageUrl).toBeDefined();

      generatedSecret = res.body.secret;
    });

    test('enable2FA cifra twoFactorSecret con AES-256-GCM y genera 8 recovery codes únicos', async () => {
      const validCode = totp.generateTOTP(generatedSecret);

      const res = await request(app)
        .post('/api/auth/2fa/enable')
        .send({
          secret: generatedSecret,
          code: validCode
        });

      expect(res.status).toBe(200);
      expect(res.body.twoFactorEnabled).toBe(true);
      expect(res.body.recoveryCodes).toBeDefined();
      expect(res.body.recoveryCodes).toHaveLength(8);

      recoveryCodesIssued = res.body.recoveryCodes;

      // Inspect DB record directly
      const userInDb = await User.findByPk(testUser.id);
      expect(userInDb.twoFactorEnabled).toBe(true);

      // Confidentiality check: Secret in DB MUST NOT be the plain text Base32 secret!
      expect(userInDb.twoFactorSecret).not.toBe(generatedSecret);
      expect(userInDb.twoFactorSecret).toContain(':'); // iv:authTag:ciphertext format

      // Decryption check: when decrypted, matches original
      const decryptedSecret = cryptoUtils.decryptAesGcm(userInDb.twoFactorSecret);
      expect(decryptedSecret).toBe(generatedSecret);

      // Recovery codes in DB MUST be stored as hashes, never plain text
      expect(userInDb.twoFactorRecoveryCodes).toHaveLength(8);
      userInDb.twoFactorRecoveryCodes.forEach(rc => {
        expect(rc.hash).toHaveLength(64);
        expect(rc.used).toBe(false);
      });
    });

    test('verify2FALogin valida exitosamente el código TOTP descifrando el secreto en vuelo', async () => {
      // Create pending 2FA temp token
      const tempToken = jwt.sign(
        { id: testUser.id, email: testUser.email, is2FAPending: true },
        appConfig.auth.jwtSecret,
        { expiresIn: '5m' }
      );

      const validCode = totp.generateTOTP(generatedSecret);

      const res = await request(app)
        .post('/api/auth/verify-2fa-login')
        .send({
          tempToken,
          code: validCode
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe(testUserEmail);
      expect(res.body.usedRecoveryCode).toBe(false);
    });

    test('verify2FALogin rechaza códigos TOTP erróneos con 401', async () => {
      const tempToken = jwt.sign(
        { id: testUser.id, email: testUser.email, is2FAPending: true },
        appConfig.auth.jwtSecret,
        { expiresIn: '5m' }
      );

      const res = await request(app)
        .post('/api/auth/verify-2fa-login')
        .send({
          tempToken,
          code: '000000' // Wrong code
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Código de autenticación inválido');
    });

    test('verify2FALogin permite autenticación mediante código de recuperación y lo marca como usado', async () => {
      const tempToken = jwt.sign(
        { id: testUser.id, email: testUser.email, is2FAPending: true },
        appConfig.auth.jwtSecret,
        { expiresIn: '5m' }
      );

      const recoveryCodeToUse = recoveryCodesIssued[0];

      const res = await request(app)
        .post('/api/auth/verify-2fa-login')
        .send({
          tempToken,
          code: recoveryCodeToUse
        });

      expect(res.status).toBe(200);
      expect(res.body.usedRecoveryCode).toBe(true);
      expect(res.body.token).toBeDefined();

      // Verify that this code is marked as used in DB
      const userInDb = await User.findByPk(testUser.id);
      const normalized = cryptoUtils.normalizeRecoveryCode(recoveryCodeToUse);
      const targetHash = cryptoUtils.hashToken(normalized);

      const matchedCode = userInDb.twoFactorRecoveryCodes.find(rc => rc.hash === targetHash);
      expect(matchedCode.used).toBe(true);
      expect(matchedCode.usedAt).toBeDefined();
    });

    test('Single-Use Recovery Code: reusar el mismo código de recuperación consumido falla con 401', async () => {
      const tempToken = jwt.sign(
        { id: testUser.id, email: testUser.email, is2FAPending: true },
        appConfig.auth.jwtSecret,
        { expiresIn: '5m' }
      );

      const alreadyUsedCode = recoveryCodesIssued[0];

      const res = await request(app)
        .post('/api/auth/verify-2fa-login')
        .send({
          tempToken,
          code: alreadyUsedCode
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Código de autenticación inválido');
    });

    test('disable2FA valida TOTP descifrado, desactiva 2FA y limpia secreto y recovery codes', async () => {
      const validCode = totp.generateTOTP(generatedSecret);

      const res = await request(app)
        .post('/api/auth/2fa/disable')
        .send({
          code: validCode
        });

      expect(res.status).toBe(200);
      expect(res.body.twoFactorEnabled).toBe(false);

      const userAfter = await User.findByPk(testUser.id);
      expect(userAfter.twoFactorEnabled).toBe(false);
      expect(userAfter.twoFactorSecret).toBeNull();
      expect(userAfter.twoFactorRecoveryCodes).toEqual([]);
    });
  });
});
