'use strict';

const crypto = require('crypto');
const appConfig = require('../config/app.config');

/**
 * Derives a strict 32-byte Buffer key suitable for AES-256-GCM.
 * Uses SHA-256 over the input key string/buffer to guarantee exactly 256 bits of entropy.
 * 
 * @param {string|Buffer} [key] - Encryption key passphrase or raw secret
 * @returns {Buffer} 32-byte binary key
 */
function deriveKey(key) {
  const secret = key || (appConfig.auth && appConfig.auth.encryptionKey) || process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'clinica_saas_default_encryption_fallback_2026';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM authenticated symmetric encryption.
 * Format output: `${ivHex}:${authTagHex}:${ciphertextHex}`
 * 
 * @param {string} plainText - Data to encrypt
 * @param {string|Buffer} [customKey] - Optional custom key
 * @returns {string} Encrypted string serialized as iv:authTag:ciphertext
 */
function encryptAesGcm(plainText, customKey) {
  if (plainText === null || plainText === undefined) {
    return plainText;
  }

  const stringVal = String(plainText);
  if (!stringVal) return '';

  const keyBuffer = deriveKey(customKey);
  // 12-byte IV is NIST recommended standard for GCM mode
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  const encrypted = Buffer.concat([
    cipher.update(stringVal, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string serialized as `${ivHex}:${authTagHex}:${ciphertextHex}`.
 * If data does not match the 3-part hex format, it falls back gracefully to the original string
 * to provide transparent backward compatibility with unencrypted legacy records.
 * 
 * @param {string} cipherString - Encrypted string to decrypt
 * @param {string|Buffer} [customKey] - Optional custom key
 * @returns {string} Decrypted plaintext string
 */
function decryptAesGcm(cipherString, customKey) {
  if (!cipherString || typeof cipherString !== 'string') {
    return cipherString;
  }

  const parts = cipherString.split(':');
  if (parts.length !== 3) {
    // Legacy unencrypted plaintext fallback
    return cipherString;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (!/^[0-9a-fA-F]+$/.test(ivHex) || !/^[0-9a-fA-F]+$/.test(authTagHex) || !/^[0-9a-fA-F]+$/.test(encryptedHex)) {
    // Malformed format, return as is
    return cipherString;
  }

  try {
    const keyBuffer = deriveKey(customKey);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (err) {
    // If decryption or authTag verification fails, throw cryptographic integrity error
    const error = new Error('Cryptographic verification failed: data may have been tampered with or invalid encryption key');
    error.code = 'ERR_CRYPTO_INTEGRITY';
    throw error;
  }
}

/**
 * Computes a deterministic SHA-256 hex hash of a raw token.
 * Used for secure single-use token storage (password reset, email verification, etc.).
 * 
 * @param {string} rawToken - Plaintext high-entropy token
 * @returns {string} 64-character lowercase hex SHA-256 digest
 */
function hashToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Token must be a non-empty string');
  }
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Normalizes a recovery code by stripping hyphens and spaces and uppercasing.
 * 
 * @param {string} code 
 * @returns {string}
 */
function normalizeRecoveryCode(code) {
  if (!code || typeof code !== 'string') return '';
  return code.replace(/[-\s]/g, '').toUpperCase();
}

/**
 * Generates an array of single-use recovery backup codes.
 * Returns both user-friendly formatted plain text codes (e.g., "ABCD-EFGH")
 * and secure SHA-256 hashes for storage in the database.
 * 
 * @param {number} [count=8] - Number of recovery codes to generate
 * @returns {{ plainCodes: string[], hashedCodes: Array<{ hash: string, used: boolean, usedAt: string|null }> }}
 */
function generateRecoveryCodes(count = 8) {
  // Unambiguous character set (no 0/O, 1/I/L)
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const plainCodes = [];
  const hashedCodes = [];

  for (let i = 0; i < count; i++) {
    const randomBytes = crypto.randomBytes(8);
    let codeStr = '';
    for (let b = 0; b < 8; b++) {
      codeStr += charset[randomBytes[b] % charset.length];
    }
    const formatted = `${codeStr.substring(0, 4)}-${codeStr.substring(4, 8)}`;
    plainCodes.push(formatted);

    const normalized = normalizeRecoveryCode(formatted);
    hashedCodes.push({
      hash: hashToken(normalized),
      used: false,
      usedAt: null
    });
  }

  return {
    plainCodes,
    hashedCodes
  };
}

module.exports = {
  deriveKey,
  encryptAesGcm,
  decryptAesGcm,
  hashToken,
  normalizeRecoveryCode,
  generateRecoveryCodes
};
