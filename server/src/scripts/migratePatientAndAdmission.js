const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const sequelize = require('../config/db.config');

async function migrate() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // 1. Create documentType enum if not exists
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_Patients_documentType" AS ENUM ('CEDULA', 'PASAPORTE', 'RIF');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Add columns to Patients table
    await sequelize.query(`
      ALTER TABLE "Patients" 
        ADD COLUMN IF NOT EXISTS "medicalRecordNumber" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "documentType" "enum_Patients_documentType" DEFAULT 'CEDULA',
        ADD COLUMN IF NOT EXISTS "documentPrefix" VARCHAR(10) DEFAULT 'V',
        ADD COLUMN IF NOT EXISTS "documentNumber" VARCHAR(50),
        ADD COLUMN IF NOT EXISTS "state" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "city" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "municipality" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "hasInsurance" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "insuranceCompanyId" UUID,
        ADD COLUMN IF NOT EXISTS "familyInfo" JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "beneficiaries" JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "preexistingDiseases" JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "clinicalHistorySummary" TEXT;
    `);

    // Create unique index on medicalRecordNumber
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "patients_medical_record_number_uniq" 
      ON "Patients" ("medicalRecordNumber") 
      WHERE "deletedAt" IS NULL AND "medicalRecordNumber" IS NOT NULL;
    `);

    // 3. Add columns to Admissions table
    await sequelize.query(`
      ALTER TABLE "Admissions" 
        ADD COLUMN IF NOT EXISTS "episodeNumber" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "medicalRecordNumber" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "patientDataSnapshot" JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS "titularData" JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS "guarantorData" JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS "insuredPatientData" JSONB DEFAULT '{}'::jsonb;
    `);

    // 4. Backfill existing Patients with clean medicalRecordNumber based on CI
    const [patients] = await sequelize.query(`SELECT id, "documentId", "medicalRecordNumber" FROM "Patients"`);
    for (const p of patients) {
      const cleanDoc = (p.documentId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const numOnly = (p.documentId || '').replace(/[^0-9]/g, '');
      const prefix = cleanDoc.startsWith('E') ? 'E' : (cleanDoc.startsWith('PAS') ? 'PAS' : (cleanDoc.startsWith('J') ? 'J' : (cleanDoc.startsWith('G') ? 'G' : 'V')));
      const medRec = `HC-${cleanDoc || p.id.substring(0, 8).toUpperCase()}`;

      await sequelize.query(`
        UPDATE "Patients" 
        SET "medicalRecordNumber" = COALESCE("medicalRecordNumber", :medRec),
            "documentNumber" = COALESCE("documentNumber", :numOnly),
            "documentPrefix" = COALESCE("documentPrefix", :prefix)
        WHERE id = :id
      `, {
        replacements: { medRec, numOnly, prefix, id: p.id }
      });
    }

    // 5. Backfill existing Admissions with episodeNumber
    const [admissions] = await sequelize.query(`SELECT id, "admissionNumber", "episodeNumber" FROM "Admissions"`);
    let epCount = 1;
    for (const adm of admissions) {
      if (!adm.episodeNumber) {
        const year = new Date().getFullYear();
        const epNum = `EP-${year}-${String(epCount).padStart(5, '0')}`;
        await sequelize.query(`
          UPDATE "Admissions" 
          SET "episodeNumber" = :epNum 
          WHERE id = :id
        `, {
          replacements: { epNum, id: adm.id }
        });
        epCount++;
      }
    }

    console.log('Patient & Admission schema updated and backfilled successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();
