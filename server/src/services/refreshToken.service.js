'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { RefreshToken, User, Role, Organization, sequelize } = require('../models');
const appConfig = require('../config/app.config');
const auditService = require('./audit.service');

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Computes deterministic SHA-256 hash of a raw token string.
 */
function hashToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Raw token must be a non-empty string');
  }
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generates an access token and a cryptographically secure refresh token.
 *
 * @param {object} user - User model instance.
 * @param {object} options - Generation options { req, family }.
 * @returns {Promise<object>} { accessToken, refreshToken, expiresIn, family }
 */
async function generateTokens(user, options = {}) {
  const { req, family = null } = options;
  const jwtSecret = appConfig.auth.jwtSecret;
  const jwtExpiresIn = appConfig.auth.jwtExpiresIn || '15m';

  const roleName = user.Role ? user.Role.name : (user.role || 'PATIENT');

  // Short-lived Access Token (15 minutes by default)
  const accessToken = jwt.sign(
    {
      id: user.id,
      role: roleName,
      organizationId: user.organizationId,
      mustChangePassword: Boolean(user.mustChangePassword)
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );

  // High-entropy 256-bit random hex string for Refresh Token
  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawRefreshToken);
  const tokenFamily = family || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  const ip = req ? (req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null) : null;
  const userAgent = req ? (req.headers['user-agent'] || null) : null;

  await RefreshToken.create({
    userId: user.id,
    tokenHash,
    family: tokenFamily,
    isRevoked: false,
    expiresAt,
    ip,
    userAgent
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: 900, // 15 minutes in seconds
    family: tokenFamily
  };
}

/**
 * Rotates a refresh token:
 * 1. Validates the raw token's hash against the database.
 * 2. If the token was already revoked, triggers REUSE ANOMALY DETECTION:
 *    invalidates the ENTIRE token family and raises a security event.
 * 3. Otherwise, revokes the current token and issues a new pair in the same family.
 *
 * @param {string} rawRefreshToken - Incoming raw refresh token.
 * @param {object} options - Execution options { req }.
 * @returns {Promise<object>} Rotation outcome.
 */
async function rotateRefreshToken(rawRefreshToken, options = {}) {
  const { req } = options;
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    return { success: false, reason: 'INVALID_TOKEN', message: 'Token de refresco no proporcionado' };
  }

  const tokenHash = hashToken(rawRefreshToken);
  const tokenRecord = await RefreshToken.findOne({ where: { tokenHash } });

  if (!tokenRecord) {
    return { success: false, reason: 'INVALID_TOKEN', message: 'Token de refresco inexistente o inválido' };
  }

  // 🚨 REUSE ANOMALY DETECTION: Token already revoked!
  // Someone is replaying an already consumed token. Immediate family revocation!
  if (tokenRecord.isRevoked) {
    console.warn(`🚨 [SECURITY ALERT] Refresh token reuse detected for family: ${tokenRecord.family}! Revoking family.`);

    await RefreshToken.update(
      { isRevoked: true },
      { where: { family: tokenRecord.family } }
    );

    auditService.logAuthEvent({
      action: 'REFRESH_TOKEN_REUSE_DETECTED',
      user: { id: tokenRecord.userId },
      req,
      success: false,
      reason: 'Revoked refresh token was re-submitted. Possible theft attempt.'
    }).catch(err => console.error('Audit refresh token reuse error:', err));

    return {
      success: false,
      reason: 'REUSE_DETECTED',
      message: 'Violación de seguridad: reutilización anómala de token detectada. Sesión invalidada.'
    };
  }

  // Check expiration
  if (new Date(tokenRecord.expiresAt) < new Date()) {
    await tokenRecord.update({ isRevoked: true });
    return { success: false, reason: 'TOKEN_EXPIRED', message: 'Token de refresco expirado' };
  }

  // Find user
  const user = await User.findByPk(tokenRecord.userId, {
    include: [Role, Organization]
  });

  if (!user || user.isActive === false) {
    await tokenRecord.update({ isRevoked: true });
    return { success: false, reason: 'USER_INACTIVE', message: 'Usuario no encontrado o inactivo' };
  }

  // Generate successor refresh token within the same family
  const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
  const newTokenHash = hashToken(newRawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  const ip = req ? (req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null) : null;
  const userAgent = req ? (req.headers['user-agent'] || null) : null;

  // Atomic rotation transaction
  await sequelize.transaction(async (t) => {
    // 1. Mark existing token as revoked and record its successor
    await tokenRecord.update(
      {
        isRevoked: true,
        replacedByTokenHash: newTokenHash
      },
      { transaction: t }
    );

    // 2. Create the successor token
    await RefreshToken.create(
      {
        userId: user.id,
        tokenHash: newTokenHash,
        family: tokenRecord.family,
        isRevoked: false,
        expiresAt,
        ip,
        userAgent
      },
      { transaction: t }
    );
  });

  const jwtSecret = appConfig.auth.jwtSecret;
  const jwtExpiresIn = appConfig.auth.jwtExpiresIn || '15m';
  const roleName = user.Role ? user.Role.name : (user.role || 'PATIENT');

  const newAccessToken = jwt.sign(
    {
      id: user.id,
      role: roleName,
      organizationId: user.organizationId,
      mustChangePassword: Boolean(user.mustChangePassword)
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );

  auditService.logAuthEvent({
    action: 'TOKEN_REFRESH',
    user,
    req,
    success: true
  }).catch(err => console.error('Audit token refresh error:', err));

  return {
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
    expiresIn: 900,
    user: {
      id: user.id,
      email: user.email,
      role: roleName,
      organizationId: user.organizationId
    }
  };
}

/**
 * Revokes all active refresh tokens for a user across all devices.
 *
 * @param {string} userId - Target user ID.
 * @returns {Promise<number>} Number of tokens revoked.
 */
async function revokeAllUserTokens(userId) {
  if (!userId) return 0;
  const [affectedCount] = await RefreshToken.update(
    { isRevoked: true },
    { where: { userId, isRevoked: false } }
  );
  return affectedCount;
}

/**
 * Revokes a single refresh token by raw value.
 *
 * @param {string} rawRefreshToken - The token to revoke.
 * @returns {Promise<boolean>} True if revoked, false if not found.
 */
async function revokeToken(rawRefreshToken) {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') return false;
  const tokenHash = hashToken(rawRefreshToken);
  const [affectedCount] = await RefreshToken.update(
    { isRevoked: true },
    { where: { tokenHash, isRevoked: false } }
  );
  return affectedCount > 0;
}

module.exports = {
  hashToken,
  generateTokens,
  rotateRefreshToken,
  revokeAllUserTokens,
  revokeToken
};
