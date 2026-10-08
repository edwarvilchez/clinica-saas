'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { validateEnv } = require('./validateEnv');

// Execute validation before building the configuration object
const validationResult = validateEnv(process.env, process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging');

/**
 * Deep freezes an object recursively to guarantee immutability at runtime.
 */
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    deepFreeze(obj[key]);
  }
  return obj;
}

/**
 * Parses comma-separated allowed origins into a clean array
 */
function parseAllowedOrigins(originsStr) {
  if (!originsStr) return ['http://localhost:4200'];
  return originsStr
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
}

const currentEnv = process.env.NODE_ENV || 'development';
const isProd = currentEnv === 'production';
const isStaging = currentEnv === 'staging';
const isDev = currentEnv === 'development';
const isTest = currentEnv === 'test';

const config = {
  env: currentEnv,
  isProduction: isProd,
  isStaging: isStaging,
  isDevelopment: isDev,
  isTest: isTest,

  server: {
    port: parseInt(process.env.PORT || '5000', 10),
    apiUrl: process.env.API_URL || 'http://localhost:5000',
    clientUrl: process.env.CLIENT_URL || 'http://localhost:4200',
    allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS)
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || (isTest ? 'test_jwt_secret_github_actions_2026' : 'dev_jwt_secret_key_clinica_saas_2026_secure'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    initSecret: process.env.INIT_SECRET || (isTest ? 'test_init_secret' : 'clinica-saas-dev-secret'),
    encryptionKey: process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || (isTest ? 'test_aes_encryption_key_2026_gh_actions' : 'dev_aes_encryption_key_clinica_saas_2026'),
    bcryptRounds: 10
  },

  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || (isTest ? 'clinica_saas_test' : (isProd ? 'clinica_saas_prod' : 'clinica_saas_dev')),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || (isTest ? 'postgres' : ''),
    url: process.env.DATABASE_URL || null,
    ssl: process.env.DB_SSL === 'true',
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || (isProd ? '20' : '10'), 10),
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      acquire: 30000,
      idle: 10000
    }
  },

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    dir: process.env.STORAGE_DIR
      ? path.resolve(process.env.STORAGE_DIR)
      : path.resolve(__dirname, '../../storage/secure'),
    signingSecret: process.env.FILE_SIGNING_SECRET || process.env.JWT_SECRET || 'file_signing_secret_clinica_saas_2026',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE_BYTES || '10485760', 10) // 10MB
  },

  security: {
    allowDbReset: !isProd && process.env.ALLOW_DB_RESET === 'true'
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY || null,
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      email: process.env.SMTP_EMAIL || '',
      password: process.env.SMTP_PASSWORD || ''
    },
    fromName: process.env.FROM_NAME || 'Clínica SaaS',
    fromEmail: process.env.FROM_EMAIL || 'no-reply@clinicasaas.app'
  },

  logging: {
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug')
  },

  validation: validationResult
};

// Freeze the entire configuration tree to make it tamper-proof at runtime
module.exports = deepFreeze(config);
