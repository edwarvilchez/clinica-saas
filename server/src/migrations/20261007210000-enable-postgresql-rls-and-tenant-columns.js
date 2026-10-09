'use strict';

/**
 * 🛡️ FASE 1 MIGRATION: PostgreSQL Row Level Security (RLS) & Tenant Columns (Fail-Fast)
 * Enforces hardware-level multi-tenant data isolation directly within the PostgreSQL engine.
 *
 * NOTE: Fails fast on any critical error. Does not swallow exceptions with warnings.
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
      const exists = await queryInterface.tableExists(tableName);
      if (!exists) {
        continue;
      }

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
    }

    // 2. Enable & Force Row Level Security (RLS) on all tenant-scoped tables (Fail-Fast)
    for (const tableName of TENANT_RLS_TABLES) {
      const exists = await queryInterface.tableExists(tableName);
      if (!exists) {
        continue;
      }

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
    }

    // 3. Post-verification: verify that RLS is active on all existing tables
    const [rlsCatalog] = await queryInterface.sequelize.query(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN (${TENANT_RLS_TABLES.map(t => `'${t}'`).join(', ')});
    `);

    const unverified = [];
    for (const row of rlsCatalog) {
      if (!row.relrowsecurity || !row.relforcerowsecurity) {
        unverified.push(row.relname);
      }
    }

    if (unverified.length > 0) {
      throw new Error(`[Migration RLS FATAL] Failed to enforce RLS and FORCE RLS on tables: ${unverified.join(', ')}`);
    }

    console.log(`[Migration RLS] ✅ All ${rlsCatalog.length} tables verified with active RLS and FORCE RLS`);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop RLS policies
    for (const tableName of TENANT_RLS_TABLES) {
      const exists = await queryInterface.tableExists(tableName);
      if (!exists) continue;

      await queryInterface.sequelize.query(`
        DROP POLICY IF EXISTS tenant_isolation_policy ON "${tableName}";
        ALTER TABLE "${tableName}" NO FORCE ROW LEVEL SECURITY;
        ALTER TABLE "${tableName}" DISABLE ROW LEVEL SECURITY;
      `);
    }

    // Remove added columns
    for (const tableName of TABLES_NEEDING_ORG_COLUMN) {
      const exists = await queryInterface.tableExists(tableName);
      if (!exists) continue;

      const desc = await queryInterface.describeTable(tableName);
      if (desc.organizationId) {
        await queryInterface.removeColumn(tableName, 'organizationId');
      }
    }
  }
};
