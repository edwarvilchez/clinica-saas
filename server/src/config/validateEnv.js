'use strict';

/**
 * 🛡️ FASE 4: Strict Environment Variable Validator & Secret Integrity Guard
 * Fails fast on application startup if required secrets are missing, weak, or insecure in production/staging.
 */

const INSECURE_JWT_SECRETS = new Set([
  'default', 'secret', 'changeme', 'password', '123456', '12345678',
  'your_jwt_secret_here', 'clinica-saas', 'test_secret', 'clinica-saas-dev-secret',
  'clinica_saas_prescription_secret_2026'
]);

const INSECURE_DB_PASSWORDS = new Set([
  'default', 'password', 'example', 'postgres', 'admin', '123456',
  'root', 'your_secure_db_password_here', 'clinica_admin'
]);

const INSECURE_INIT_SECRETS = new Set([
  'default', 'clinica-saas-dev-secret', 'your_secure_init_secret_here',
  'admin', '123456', 'secret'
]);

/**
 * Validates environment configuration according to current deployment mode.
 * 
 * @param {Object} [env=process.env] - Environment variables map
 * @param {boolean} [throwOnError=true] - Whether to throw an Error on failure
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateEnv(env = process.env, throwOnError = true) {
  const currentEnv = env.NODE_ENV || 'development';
  const isProduction = currentEnv === 'production';
  const isStaging = currentEnv === 'staging';
  const isStrictEnv = isProduction || isStaging;

  const errors = [];
  const warnings = [];

  // =========================================================================
  // 1. JWT SECRET VALIDATION
  // =========================================================================
  const jwtSecret = env.JWT_SECRET ? env.JWT_SECRET.trim() : '';

  if (!jwtSecret) {
    if (isStrictEnv) {
      errors.push('CRITICAL: JWT_SECRET is required and cannot be empty in production/staging.');
    } else {
      warnings.push('WARN: JWT_SECRET is not set. A random ephemeral secret will be used in development.');
    }
  } else {
    const lowerSecret = jwtSecret.toLowerCase();
    if (INSECURE_JWT_SECRETS.has(lowerSecret)) {
      errors.push(`CRITICAL: Insecure default JWT_SECRET detected ("${jwtSecret}"). You must define a unique, high-entropy secret.`);
    }

    if (isStrictEnv && jwtSecret.length < 32) {
      errors.push(`CRITICAL: JWT_SECRET is too short (${jwtSecret.length} chars). Production requires at least 32 characters for HMAC-SHA256 integrity.`);
    }
  }

  // =========================================================================
  // 2. DATABASE CREDENTIALS VALIDATION
  // =========================================================================
  const dbPassword = env.DB_PASSWORD ? env.DB_PASSWORD.trim() : '';
  const databaseUrl = env.DATABASE_URL ? env.DATABASE_URL.trim() : '';

  if (isStrictEnv) {
    if (!databaseUrl) {
      if (!dbPassword) {
        errors.push('CRITICAL: DB_PASSWORD is required in production/staging.');
      } else if (INSECURE_DB_PASSWORDS.has(dbPassword.toLowerCase())) {
        errors.push(`CRITICAL: Insecure database password detected ("${dbPassword}"). Change to a strong database password.`);
      }

      if (!env.DB_USER) {
        errors.push('CRITICAL: DB_USER is required in production/staging.');
      }
      if (!env.DB_NAME) {
        errors.push('CRITICAL: DB_NAME is required in production/staging.');
      }
    }
  }

  // =========================================================================
  // 3. DATABASE RESET SAFETY GUARD
  // =========================================================================
  if (isProduction && env.ALLOW_DB_RESET === 'true') {
    errors.push('CRITICAL SECURITY VIOLATION: ALLOW_DB_RESET must NEVER be true in production. Emergency reset routes are strictly forbidden.');
  }

  // =========================================================================
  // 4. INIT_SECRET GUARD
  // =========================================================================
  const initSecret = env.INIT_SECRET ? env.INIT_SECRET.trim() : '';
  if (isProduction && initSecret && INSECURE_INIT_SECRETS.has(initSecret.toLowerCase())) {
    errors.push(`CRITICAL: Insecure INIT_SECRET detected ("${initSecret}") in production.`);
  }

  // =========================================================================
  // 5. CORS & ORIGIN VALIDATION
  // =========================================================================
  const allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.trim() : '';
  if (isProduction) {
    if (!allowedOrigins) {
      warnings.push('WARN: ALLOWED_ORIGINS is not set in production. CORS may reject legitimate frontend requests.');
    } else if (allowedOrigins === '*') {
      errors.push('CRITICAL: ALLOWED_ORIGINS cannot be "*" in production with authenticated sessions.');
    }
  }

  const valid = errors.length === 0;

  if (!valid && throwOnError) {
    const errorMessages = [
      '',
      '================================================================================',
      '🚨 FATAL CONFIGURATION ERROR - STARTUP ABORTED (FASE 4 ENVIRONMENT CHECK)',
      '================================================================================',
      ...errors.map(err => `❌ ${err}`),
      '================================================================================',
      'Please update your .env file or deployment environment variables before starting.',
      '================================================================================',
      ''
    ].join('\n');

    throw new Error(errorMessages);
  }

  return {
    valid,
    errors,
    warnings
  };
}

module.exports = {
  validateEnv,
  INSECURE_JWT_SECRETS,
  INSECURE_DB_PASSWORDS,
  INSECURE_INIT_SECRETS
};
