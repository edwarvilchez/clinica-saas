'use strict';

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const {
  hashToken,
  generateTokens,
  rotateRefreshToken,
  revokeAllUserTokens,
  revokeToken
} = require('../../services/refreshToken.service');
const { RefreshToken, User, Role, Organization, sequelize } = require('../../models');
const authController = require('../../controllers/auth.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

describe('🛡️ FASE 7: Hardened Authentication, Refresh Tokens & Session Security Suite', () => {
  let testUser;
  let testRole;
  let app;

  beforeAll(async () => {
    // Authenticate database
    await sequelize.authenticate();
    await RefreshToken.sync();

    testRole = await Role.findOne({ where: { name: 'DOCTOR' } }) ||
      await Role.create({ name: 'DOCTOR', description: 'Médico' });

    testUser = await User.create({
      id: crypto.randomUUID(),
      username: `dr_test_${Date.now()}`,
      email: `dr_test_${Date.now()}@clinica.com`,
      password: 'SecurePassword123!',
      roleId: testRole.id,
      isActive: true
    });

    // Express test app for Phase 7 endpoints
    app = express();
    app.use(express.json());

    app.post('/api/auth/login', authController.login);
    app.post('/api/auth/refresh', authController.refreshToken);
    app.post('/api/auth/logout', authController.logout);
    app.post('/api/auth/logout-all-devices', (req, res, next) => {
      // Inject authenticated user
      req.user = { id: testUser.id, role: 'DOCTOR' };
      next();
    }, authController.logoutAllDevices);
  });

  afterAll(async () => {
    try {
      if (testUser) {
        await RefreshToken.destroy({ where: { userId: testUser.id } });
        await User.destroy({ where: { id: testUser.id } });
      }
    } catch (e) {
      // Cleanup error ignored
    }
  });

  describe('1. SHA-256 Token Hashing', () => {
    it('🔒 Produces reproducible 64-character SHA-256 hex hash', () => {
      const rawToken = '4f8a9e1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef';
      const hash1 = hashToken(rawToken);
      const hash2 = hashToken(rawToken);

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(rawToken);
    });

    it('🔒 Throws descriptive error for empty or invalid token inputs', () => {
      expect(() => hashToken(null)).toThrow('Raw token must be a non-empty string');
      expect(() => hashToken('')).toThrow('Raw token must be a non-empty string');
    });
  });

  describe('2. Short-lived Access Token & Rotating Refresh Token Issuance', () => {
    it('🔒 Generates 15-minute access token and 7-day refresh token record', async () => {
      const tokens = await generateTokens(testUser);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.refreshToken.length).toBeGreaterThanOrEqual(64);
      expect(tokens.expiresIn).toBe(900); // 15 minutes

      // Verify JWT expiration window is exactly 15 minutes (900 seconds)
      const decoded = jwt.decode(tokens.accessToken);
      expect(decoded.exp - decoded.iat).toBe(900);
      expect(decoded.id).toBe(testUser.id);

      // Verify RefreshToken stored in DB has hash and 7-day expiration
      const rawHash = hashToken(tokens.refreshToken);
      const stored = await RefreshToken.findOne({ where: { tokenHash: rawHash } });
      expect(stored).not.toBeNull();
      expect(stored.isRevoked).toBe(false);
      expect(stored.family).toBe(tokens.family);
      expect(new Date(stored.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
    });
  });

  describe('3. Strict Rotation & Reuse Anomaly Detection (Theft Prevention)', () => {
    it('🔒 Rotates valid refresh token, revoking the predecessor and linking successor', async () => {
      const initial = await generateTokens(testUser);
      const rotation = await rotateRefreshToken(initial.refreshToken);

      expect(rotation.success).toBe(true);
      expect(rotation.accessToken).toBeDefined();
      expect(rotation.refreshToken).toBeDefined();
      expect(rotation.refreshToken).not.toBe(initial.refreshToken);

      // Verify predecessor is now marked as revoked with replacedByTokenHash set
      const initialHash = hashToken(initial.refreshToken);
      const predecessor = await RefreshToken.findOne({ where: { tokenHash: initialHash } });
      expect(predecessor.isRevoked).toBe(true);
      expect(predecessor.replacedByTokenHash).toBe(hashToken(rotation.refreshToken));

      // Verify successor shares the same family
      const successorHash = hashToken(rotation.refreshToken);
      const successor = await RefreshToken.findOne({ where: { tokenHash: successorHash } });
      expect(successor.isRevoked).toBe(false);
      expect(successor.family).toBe(predecessor.family);
    });

    it('🚨 DETECTS REUSE ANOMALY: Revoking entire family when revoked token is re-submitted', async () => {
      // Step A: Issue Token 1
      const token1 = await generateTokens(testUser);

      // Step B: Rotate Token 1 -> Token 2 (Token 1 is now legitimately revoked)
      const token2 = await rotateRefreshToken(token1.refreshToken);
      expect(token2.success).toBe(true);

      // Step C: An attacker (or replayed request) submits Token 1 AGAIN!
      const anomalyResult = await rotateRefreshToken(token1.refreshToken);

      expect(anomalyResult.success).toBe(false);
      expect(anomalyResult.reason).toBe('REUSE_DETECTED');
      expect(anomalyResult.message).toContain('reutilización anómala');

      // Step D: Verify that Token 2 (and the entire family) is now REVOKED to protect the account!
      const token2Hash = hashToken(token2.refreshToken);
      const token2Record = await RefreshToken.findOne({ where: { tokenHash: token2Hash } });
      expect(token2Record.isRevoked).toBe(true);

      // Step E: Subsequent rotation with Token 2 must now FAIL because family was killed!
      const followUp = await rotateRefreshToken(token2.refreshToken);
      expect(followUp.success).toBe(false);
      expect(followUp.reason).toBe('REUSE_DETECTED');
    });
  });

  describe('4. Logout Across All Devices (Session Invalidation)', () => {
    it('🔒 Revokes all active refresh tokens for the user', async () => {
      // Issue tokens across 3 different simulated devices
      const device1 = await generateTokens(testUser);
      const device2 = await generateTokens(testUser);
      const device3 = await generateTokens(testUser);

      const revokedCount = await revokeAllUserTokens(testUser.id);
      expect(revokedCount).toBeGreaterThanOrEqual(3);

      // Attempting to rotate any of them must fail
      const try1 = await rotateRefreshToken(device1.refreshToken);
      const try2 = await rotateRefreshToken(device2.refreshToken);
      const try3 = await rotateRefreshToken(device3.refreshToken);

      expect(try1.success).toBe(false);
      expect(try2.success).toBe(false);
      expect(try3.success).toBe(false);
    });
  });

  describe('5. Login User Enumeration Prevention', () => {
    it('🔒 Returns identical generic "Credenciales inválidas" for non-existent user and wrong password', async () => {
      // Attempt A: Non-existent user
      const resNonExistent = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'non_existent_ghost_user_99999@clinica.com',
          password: 'SomePassword123!'
        });

      expect(resNonExistent.status).toBe(401);
      expect(resNonExistent.body.message).toBe('Credenciales inválidas');
      expect(resNonExistent.body.message).not.toContain('Usuario no encontrado');

      // Attempt B: Existing user with incorrect password
      const resWrongPassword = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'CompletelyWrongPassword999!'
        });

      expect(resWrongPassword.status).toBe(401);
      expect(resWrongPassword.body.message).toBe('Credenciales inválidas');
      expect(resWrongPassword.body.message).not.toContain('Contraseña incorrecta');

      // Responses must be completely indistinguishable
      expect(resNonExistent.body).toEqual(resWrongPassword.body);
    });
  });

  describe('6. HTTP Endpoints Integration (/api/auth/refresh & /api/auth/logout-all-devices)', () => {
    it('🔒 /api/auth/refresh rotates token via HTTP and responds with fresh pair', async () => {
      const initial = await generateTokens(testUser);

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: initial.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.refreshToken).not.toBe(initial.refreshToken);
      expect(res.body.expiresIn).toBe(900);
    });

    it('🔒 /api/auth/refresh rejects missing token with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Token de refresco requerido');
    });

    it('🔒 /api/auth/logout-all-devices invalidates all user sessions', async () => {
      const token = await generateTokens(testUser);

      const res = await request(app)
        .post('/api/auth/logout-all-devices');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Todas las sesiones activas han sido cerradas');

      // Subsequent refresh fails
      const refreshTry = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: token.refreshToken });

      expect(refreshTry.status).toBe(403);
    });
  });
});
