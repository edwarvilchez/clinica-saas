'use strict';

const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const isTest = process.env.NODE_ENV === 'test';
const isDevelopment = !isProduction && !isStaging && !isTest;

// Resilient LOG_LEVEL handling to prevent boot failure on invalid strings
const VALID_LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
const envRawLevel = (process.env.LOG_LEVEL || (isTest ? 'warn' : 'info')).trim().toLowerCase();
const currentLevel = VALID_LOG_LEVELS.includes(envRawLevel) ? envRawLevel : 'info';

/**
 * 🔒 ZERO PHI & CREDENTIAL REDACTION LIST
 * Explicit redaction paths to prevent any exposure of sensitive tokens,
 * passwords, keys, or Protected Health Information (PHI) in log streams.
 */
const REDACTION_PATHS = [
  'password',
  '*.password',
  '*.*.password',
  'newPassword',
  '*.newPassword',
  'currentPassword',
  '*.currentPassword',
  'token',
  '*.token',
  'refreshToken',
  '*.refreshToken',
  'tempToken',
  '*.tempToken',
  'resetToken',
  '*.resetToken',
  'twoFactorSecret',
  '*.twoFactorSecret',
  'recoveryCodes',
  '*.recoveryCodes',
  'authorization',
  'headers.authorization',
  'req.headers.authorization',
  'cookie',
  'headers.cookie',
  'req.headers.cookie',
  'creditCard',
  '*.creditCard',
  'cvv',
  '*.cvv',
  'documentId',
  '*.documentId',
  'dni',
  '*.dni',
  'medicalRecordNumber',
  '*.medicalRecordNumber',
  'diagnosis',
  '*.diagnosis',
  'clinicalHistorySummary',
  '*.clinicalHistorySummary',
  'allergies',
  '*.allergies',
  'notes',
  '*.notes'
];

/**
 * Pino Logger Instance
 * - Development: Formatted with pino-pretty for human readability
 * - Test: Direct stream without worker threads to prevent open handles in Jest
 * - Production/Staging: High-performance structured JSON
 */
const logger = pino({
  level: currentLevel,
  base: {
    service: 'clinica-saas-server',
    env: process.env.NODE_ENV || 'development'
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: REDACTION_PATHS,
    censor: '[REDACTED]'
  },
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    : undefined
});

module.exports = logger;
module.exports.REDACTION_PATHS = REDACTION_PATHS;
