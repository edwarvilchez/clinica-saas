'use strict';

/**
 * 🛡️ FASE 1 MIGRATION: PostgreSQL Row Level Security (RLS) & Tenant Columns
 * Enforces hardware-level multi-tenant data isolation directly within the PostgreSQL engine.
 */

const TABLES_NEEDING_ORG_COLUMN = [
  'Appointments',
  'MedicalRecords',
  'Prescriptions',
  'VideoConsultations',
  'LabResults'
];

const TENANT_RLS_TABLES = [
  'Patients',
  'Appointments',
  'MedicalRecords',
  'Prescriptions',
  'VideoConsultations',
  'LabResults',
  'Doctors',
  'Nurses',
  'Staffs',
  'Payments',
  'Quotes',
  'InsuranceClaims',
  'DoctorFees',
  'EmergencyTriages',
  'Admissions',
  'HospitalStays',
  'HospitalBeds',
  'Surgeries',
  'InventoryItems',
  'InventoryMovements',
  'AccountCharts',
  'JournalEntries',
  'TaxRetentions',
  'ClinicalServices',
  'ClinicalPackages',
  'Employees'
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add organizationId and Index to clinical tables that lacked direct column
    for (const tableName of TABLES_NEEDING_ORG_COLUMN) {
      try {
        const tableDescription = await queryInterface.describeTable(tableName);
        if (!tableDescription.organizationId) {
          console.log(`[Migration RLS] Adding organizationId column to "${tableName}"...`);
          await queryInterface.addColumn(tableName, 'organizationId', {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: 'Organizations',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          });
          
          await queryInterface.addIndex(tableName, ['organizationId'], {
            name: `idx_${tableName.toLowerCase()}_organization_id`
          });
        }
      } catch (err) {
        console.warn(`[Migration RLS] Warning on table "${tableName}":`, err.message);
      }
    }

    // 2. Enable & Force Row Level Security (RLS) on all tenant-scoped tables
    for (const tableName of TENANT_RLS_TABLES) {
      try {
        // Enable RLS
        await queryInterface.sequelize.query(`
          ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;
        `);

        // Force RLS even for table owners (prevents bypass by postgres user in connection pool)
        await queryInterface.sequelize.query(`
          ALTER TABLE "${tableName}" FORCE ROW LEVEL SECURITY;
        `);

        // Drop existing policy if any
        await queryInterface.sequelize.query(`
          DROP POLICY IF EXISTS tenant_isolation_policy ON "${tableName}";
        `);

        // Create Permissive Policy
        // Matches current_setting('app.current_organization_id') or allows SUPERADMIN bypass
        await queryInterface.sequelize.query(`
          CREATE POLICY tenant_isolation_policy ON "${tableName}"
          AS PERMISSIVE
          FOR ALL
          TO PUBLIC
          USING (
            current_setting('app.is_super_admin', true) = 'true'
            OR
            "organizationId"::text = NULLIF(current_setting('app.current_organization_id', true), '')
          )
          WITH CHECK (
            current_setting('app.is_super_admin', true) = 'true'
            OR
            "organizationId"::text = NULLIF(current_setting('app.current_organization_id', true), '')
          );
        `);

        console.log(`[Migration RLS] ✅ RLS policy enforced on "${tableName}"`);
      } catch (err) {
        console.warn(`[Migration RLS] Could not apply RLS to "${tableName}":`, err.message);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Drop RLS policies
    for (const tableName of TENANT_RLS_TABLES) {
      try {
        await queryInterface.sequelize.query(`
          DROP POLICY IF EXISTS tenant_isolation_policy ON "${tableName}";
          ALTER TABLE "${tableName}" NO FORCE ROW LEVEL SECURITY;
          ALTER TABLE "${tableName}" DISABLE ROW LEVEL SECURITY;
        `);
      } catch (err) {
        console.warn(`[Migration RLS Rollback] Error on "${tableName}":`, err.message);
      }
    }

    // Remove added columns
    for (const tableName of TABLES_NEEDING_ORG_COLUMN) {
      try {
        await queryInterface.removeColumn(tableName, 'organizationId');
      } catch (err) {
        console.warn(`[Migration RLS Rollback] Error removing column from "${tableName}":`, err.message);
      }
    }
  }
};
