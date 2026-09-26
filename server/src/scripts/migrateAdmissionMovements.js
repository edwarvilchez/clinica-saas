const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const sequelize = require('../config/db.config');

async function migrate() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Add new columns to Admissions table
    await sequelize.query(`
      ALTER TABLE "Admissions" 
        ADD COLUMN IF NOT EXISTS "hasInsurance" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "insurancePlan" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "insuranceHolderType" VARCHAR(50) DEFAULT 'TITULAR',
        ADD COLUMN IF NOT EXISTS "insuranceCoverageAmountUSD" DECIMAL(12,2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS "insuranceClaimNumber" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "insuranceCartaAval" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "currentArea" VARCHAR(100) DEFAULT 'ADMISIÓN',
        ADD COLUMN IF NOT EXISTS "areaMovements" JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "missingDemographicsWarning" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "missingDemographicsFields" JSONB DEFAULT '[]'::jsonb;
    `);

    // Alter admissionType and status column to VARCHAR if needed to support new string types
    await sequelize.query(`
      ALTER TABLE "Admissions" ALTER COLUMN "admissionType" TYPE VARCHAR(255);
      ALTER TABLE "Admissions" ALTER COLUMN "status" TYPE VARCHAR(255);
    `);

    console.log('Admissions table updated with insurance, area movements and demographics traceability successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();
