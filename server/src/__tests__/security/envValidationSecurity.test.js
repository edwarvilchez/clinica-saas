'use strict';

/**
 * 🛡️ FASE 4 SECURITY TEST SUITE: Secret Validation & Configuration Integrity
 * Verifies that the application fails fast when critical secrets are missing,
 * weak, or default in production, and verifies configuration immutability.
 */

const { validateEnv } = require('../../config/validateEnv');
const appConfig = require('../../config/app.config');

describe('🛡️ FASE 4: Environment Validation & Secret Integrity Suite', () => {
  // Base valid production configuration fixture
  const validProductionEnv = {
    NODE_ENV: 'production',
    PORT: '5000',
    JWT_SECRET: 'd8c47f9a8b1c2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f', // 64 hex chars
    DB_USER: 'clinica_prod_user',
    DB_PASSWORD: 'SuperStrongComplexPassword2026!#$%',
    DB_NAME: 'clinica_saas_prod',
    DB_HOST: '127.0.0.1',
    DB_PORT: '5432',
    INIT_SECRET: 'StrongInitSecretKey2026!#%&',
    ALLOWED_ORIGINS: 'https://clinica.app,https://admin.clinica.app',
    ALLOW_DB_RESET: 'false'
  };

  // =========================================================================
  // 1. VALID PRODUCTION CONFIGURATION
  // =========================================================================

  test('✅ Valid production environment passes all validation checks', () => {
    const result = validateEnv(validProductionEnv, false);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  // =========================================================================
  // 2. JWT SECRET INTEGRITY & ENTROPY CHECKS
  // =========================================================================

  test('🔒 Production fails fast if JWT_SECRET is missing or empty', () => {
    const badEnv = { ...validProductionEnv, JWT_SECRET: '' };
    const result = validateEnv(badEnv, false);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('JWT_SECRET is required'))).toBe(true);

    // Verify exception throwing
    expect(() => validateEnv(badEnv, true)).toThrow(/JWT_SECRET is required/i);
  });

  test('🔒 Production fails fast if JWT_SECRET uses insecure defaults (default, secret, changeme, 123456)', () => {
    const dangerousSecrets = [
      'default',
      'secret',
      'changeme',
      'password',
      '123456',
      'your_jwt_secret_here',
      'clinica-saas-dev-secret'
    ];

    for (const weakSecret of dangerousSecrets) {
      const badEnv = { ...validProductionEnv, JWT_SECRET: weakSecret };
      const result = validateEnv(badEnv, false);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Insecure default JWT_SECRET detected'))).toBe(true);
      expect(() => validateEnv(badEnv, true)).toThrow(/Insecure default JWT_SECRET/i);
    }
  });

  test('🔒 Production fails fast if JWT_SECRET is shorter than 32 characters', () => {
    const shortSecretEnv = { ...validProductionEnv, JWT_SECRET: 'ShortSecretKey_Only20Chars!' };
    const result = validateEnv(shortSecretEnv, false);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('too short'))).toBe(true);
    expect(() => validateEnv(shortSecretEnv, true)).toThrow(/too short/i);
  });

  // =========================================================================
  // 3. DATABASE PASSWORD & CREDENTIAL CHECKS
  // =========================================================================

  test('🔒 Production fails fast if DB_PASSWORD is missing or uses insecure defaults', () => {
    const dangerousDbPasswords = ['postgres', 'password', 'example', 'admin', '123456', ''];

    for (const weakPass of dangerousDbPasswords) {
      const badEnv = { ...validProductionEnv, DB_PASSWORD: weakPass };
      const result = validateEnv(badEnv, false);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('DB_PASSWORD') || e.includes('database password'))).toBe(true);
      expect(() => validateEnv(badEnv, true)).toThrow(/DB_PASSWORD|database password/i);
    }
  });

  // =========================================================================
  // 4. DATABASE RESET PREVENTATIVE SHIELD
  // =========================================================================

  test('🔒 Production strictly blocks ALLOW_DB_RESET=true to prevent data wipeout', () => {
    const dangerousResetEnv = { ...validProductionEnv, ALLOW_DB_RESET: 'true' };
    const result = validateEnv(dangerousResetEnv, false);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('ALLOW_DB_RESET must NEVER be true in production'))).toBe(true);
    expect(() => validateEnv(dangerousResetEnv, true)).toThrow(/ALLOW_DB_RESET must NEVER be true in production/i);
  });

  // =========================================================================
  // 5. CORS ORIGIN CHECKS
  // =========================================================================

  test('🔒 Production rejects wildcard "*" in ALLOWED_ORIGINS', () => {
    const wildcardCorsEnv = { ...validProductionEnv, ALLOWED_ORIGINS: '*' };
    const result = validateEnv(wildcardCorsEnv, false);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('ALLOWED_ORIGINS cannot be "*"'))).toBe(true);
    expect(() => validateEnv(wildcardCorsEnv, true)).toThrow(/ALLOWED_ORIGINS cannot be "\*"/i);
  });

  // =========================================================================
  // 6. DEVELOPMENT ENVIRONMENT RESILIENCE
  // =========================================================================

  test('✅ Development environment logs warnings without throwing exceptions for missing optional keys', () => {
    const devEnv = {
      NODE_ENV: 'development',
      PORT: '5000'
    };

    const result = validateEnv(devEnv, false);
    // In dev, it should not fail fatal
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // 7. CENTRALIZED CONFIGURATION IMMUTABILITY
  // =========================================================================

  test('🔒 app.config object is deeply frozen and cannot be mutated at runtime', () => {
    expect(Object.isFrozen(appConfig)).toBe(true);
    expect(Object.isFrozen(appConfig.server)).toBe(true);
    expect(Object.isFrozen(appConfig.auth)).toBe(true);
    expect(Object.isFrozen(appConfig.database)).toBe(true);

    // Attempting to mutate in strict mode must throw TypeError
    expect(() => {
      appConfig.server.port = 9999;
    }).toThrow(TypeError);

    expect(() => {
      appConfig.auth.jwtSecret = 'hacked_secret';
    }).toThrow(TypeError);
  });
});
