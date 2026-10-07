/**
 * Environment Variables Validator
 * Ensures the server doesn't start without critical configuration.
 */
const logger = require('./logger');

const criticalVars = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'CLIENT_URL'
];

const optionalVars = [
  'SMTP_HOST',
  'SMTP_EMAIL',
  'SMTP_PASSWORD'
];

const validateEnv = () => {
  // Check DB configuration (either DATABASE_URL or individual DB params)
  const hasDbUrl = !!process.env.DATABASE_URL;
  const hasIndividualDb = process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD;
  
  const missingCritical = [];
  if (!process.env.JWT_SECRET) missingCritical.push('JWT_SECRET');
  if (!hasDbUrl && !hasIndividualDb) missingCritical.push('DATABASE_URL (or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD)');
  if (!process.env.CLIENT_URL) missingCritical.push('CLIENT_URL');

  const missingOptional = optionalVars.filter(v => !process.env[v]);

  if (missingCritical.length > 0) {
    logger.error({ missing: missingCritical }, '❌ CRITICAL: Missing Critical Environment Variables');

    if (process.env.NODE_ENV === 'production') {
      console.error('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      console.error('!!  SHUTTING DOWN: Missing required variables   !!');
      console.error(`!!  ${missingCritical.join(', ')}`);
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
      process.exit(1);
    } else {
      logger.warn(`⚠️ Server starting with missing critical vars: ${missingCritical.join(', ')}`);
    }
  }

  if (missingOptional.length > 0) {
    logger.warn(`⚠️ Optional variables missing (Email/SMTP will not work): ${missingOptional.join(', ')}`);
  }

  if (missingCritical.length === 0 && missingOptional.length === 0) {
    logger.info('✅ Environment variables validated');
  }
};

module.exports = validateEnv;
