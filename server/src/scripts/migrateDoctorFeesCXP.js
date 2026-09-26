require('dotenv').config();
const { sequelize } = require('../models');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    await sequelize.query(`
      -- Doctors Table fee rules & baremos
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "feeType" VARCHAR(50) DEFAULT 'PERCENTAGE';
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "doctorPercent" DECIMAL(5, 2) DEFAULT 70.00;
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "fixedFeeUSD" DECIMAL(10, 2) DEFAULT 30.00;
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "insuranceDoctorPercent" DECIMAL(5, 2) DEFAULT 65.00;
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "insuranceFixedFeeUSD" DECIMAL(10, 2) DEFAULT 25.00;
      ALTER TABLE "Doctors" ADD COLUMN IF NOT EXISTS "acceptsInsurance" BOOLEAN DEFAULT true;

      -- DoctorFees Table CXP, receipts, payment tracking & service links
      ALTER TABLE "DoctorFees" ADD COLUMN IF NOT EXISTS "feeType" VARCHAR(50) DEFAULT 'PERCENTAGE';
      ALTER TABLE "DoctorFees" ADD COLUMN IF NOT EXISTS "insuranceCompanyId" UUID REFERENCES "InsuranceCompanies"("id") ON DELETE SET NULL;
      ALTER TABLE "DoctorFees" ADD COLUMN IF NOT EXISTS "clinicalServiceId" UUID REFERENCES "ClinicalServices"("id") ON DELETE SET NULL;
      ALTER TABLE "DoctorFees" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP WITH TIME ZONE;
      ALTER TABLE "DoctorFees" ADD COLUMN IF NOT EXISTS "paidAmountUSD" DECIMAL(10, 2);
      ALTER TABLE "DoctorFees" ADD COLUMN IF NOT EXISTS "paidAmountVES" DECIMAL(14, 2);
      ALTER TABLE "DoctorFees" ADD COLUMN IF NOT EXISTS "paidPaymentMethod" VARCHAR(100);
      ALTER TABLE "DoctorFees" ADD COLUMN IF NOT EXISTS "receiptNumber" VARCHAR(100);
      ALTER TABLE "DoctorFees" ADD COLUMN IF NOT EXISTS "receiptToken" VARCHAR(100);
    `);

    console.log('✅ PostgreSQL DoctorFees and Doctors tables migrated successfully with CXP & Baremo fields!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
