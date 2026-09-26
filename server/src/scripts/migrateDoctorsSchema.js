require('dotenv').config();
const { sequelize } = require('../models');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    await sequelize.query(`
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "additionalSpecialties" JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "university" VARCHAR(255);
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "degreeTitle" VARCHAR(255);
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "mppsNumber" VARCHAR(255);
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "collegeNumber" VARCHAR(255);
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "credentialsIssueDate" DATE;
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "credentialsExpiryDate" DATE;
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "chargesProfessionalFees" BOOLEAN DEFAULT true;
    `);

    console.log('✅ PostgreSQL Doctors table updated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
