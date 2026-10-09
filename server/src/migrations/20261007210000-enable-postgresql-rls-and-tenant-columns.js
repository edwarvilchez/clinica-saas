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
    // 1. Strict table pre-flight check: all expected tenant tables must exist (no silent skips)
    const missingTables = [];
    for (const tableName of TENANT_RLS_TABLES) {
      const exists = await queryInterface.tableExists(tableName);
      if (!exists) {
        missingTables.push(tableName);
      }
    }

    if (missingTables.length > 0) {
      throw new Error(`[Migration RLS FATAL] Required tenant tables do not exist in database: ${missingTables.join(', ')}. Aborting migration.`);
    }

    // 2. Add organizationId and Index to clinical tables that lacked direct column
    for (const tableName of TABLES_NEEDING_ORG_COLUMN) {
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

    // 3. Verify that EVERY table in TENANT_RLS_TABLES has the tenant column (fail-fast)
    const missingOrgColTables = [];
    for (const tableName of TENANT_RLS_TABLES) {
      const desc = await queryInterface.describeTable(tableName);
      if (!desc.organizationId) {
        missingOrgColTables.push(tableName);
      }
    }

    if (missingOrgColTables.length > 0) {
      throw new Error(`[Migration RLS FATAL] Tables missing required tenant column "organizationId": ${missingOrgColTables.join(', ')}. Aborting migration.`);
    }

    // 4. Enable & Force Row Level Security (RLS) and apply policy on all tenant-scoped tables
    for (const tableName of TENANT_RLS_TABLES) {
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

    // 5. Post-verification: verify that RLS, FORCE RLS, and policy are active on ALL 26 tables
    const [rlsCatalog] = await queryInterface.sequelize.query(`
      SELECT 
        c.relname,
        c.relrowsecurity,
        c.relforcerowsecurity,
        pol.polname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_policy pol ON pol.polrelid = c.oid AND pol.polname = 'tenant_isolation_policy'
      WHERE n.nspname = 'public'
        AND c.relname IN (${TENANT_RLS_TABLES.map(t => `'${t}'`).join(', ')});
    `);

    const catalogMap = new Map();
    for (const row of rlsCatalog) {
      catalogMap.set(row.relname, row);
    }

    const failedTables = [];
    for (const tableName of TENANT_RLS_TABLES) {
      const entry = catalogMap.get(tableName);
      if (!entry) {
        failedTables.push(`${tableName} (missing in PostgreSQL catalog)`);
      } else if (!entry.relrowsecurity) {
        failedTables.push(`${tableName} (relrowsecurity is false)`);
      } else if (!entry.relforcerowsecurity) {
        failedTables.push(`${tableName} (relforcerowsecurity is false)`);
      } else if (entry.polname !== 'tenant_isolation_policy') {
        failedTables.push(`${tableName} (tenant_isolation_policy missing)`);
      }
    }

    if (failedTables.length > 0) {
      throw new Error(`[Migration RLS FATAL] Row Level Security verification failed on tables:\n  - ${failedTables.join('\n  - ')}`);
    }

    console.log(`[Migration RLS] ✅ All ${TENANT_RLS_TABLES.length} tables verified with active RLS, FORCE RLS, and tenant_isolation_policy`);
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
