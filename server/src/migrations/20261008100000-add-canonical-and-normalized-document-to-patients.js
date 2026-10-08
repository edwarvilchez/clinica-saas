'use strict';

/**
 * 🆔 MIGRATION: Formato Canónico y Normalización de Cédula de Identidad Venezolana en Patients
 * 
 * - Agrega la columna documentNumberNormalized a la tabla Patients.
 * - Normaliza y canonicaliza todos los registros existentes ('V-########' / 'E-########').
 * - Crea restricciones UNIQUE scoped por organizationId respetando el aislamiento multi-tenant y soft-deletes.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('Patients');

    // 1. Agregar columna documentNumberNormalized si no existe
    if (!tableDescription.documentNumberNormalized) {
      console.log('Adding "documentNumberNormalized" column to Patients...');
      await queryInterface.addColumn('Patients', 'documentNumberNormalized', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Documento normalizado (ej: V85397898) para unicidad e indexación rápida'
      });
    }

    // 2. Normalizar y canonicalizar registros existentes
    const [existingPatients] = await queryInterface.sequelize.query(
      `SELECT id, "documentId", "documentPrefix", "documentNumber", "organizationId" FROM "Patients"`
    );

    console.log(`Processing and canonicalizing ${existingPatients.length} existing patient records...`);

    for (const p of existingPatients) {
      const raw = p.documentId || (p.documentPrefix && p.documentNumber ? `${p.documentPrefix}${p.documentNumber}` : 'V-0');
      const cleanUpper = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
      let prefix = cleanUpper.startsWith('E') ? 'E' : 'V';
      const digits = cleanUpper.replace(/[^0-9]/g, '') || '0';
      const canonical = `${prefix}-${digits}`;
      const normalized = `${prefix}${digits}`;

      await queryInterface.sequelize.query(
        `UPDATE "Patients" 
         SET "documentId" = :canonical,
             "documentPrefix" = :prefix,
             "documentNumber" = :digits,
             "documentNumberNormalized" = :normalized
         WHERE id = :id`,
        {
          replacements: { canonical, prefix, digits, normalized, id: p.id }
        }
      );
    }

    // 3. Remover constraints UNIQUE legacy sobre documentId que no contemplaban multi-tenancy ni variantes
    const [constraints] = await queryInterface.sequelize.query(`
      SELECT conname 
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = '"Patients"'::regclass
        AND contype = 'u'
        AND conname ILIKE '%documentId%';
    `);

    for (const c of constraints) {
      try {
        console.log(`Dropping legacy constraint: ${c.conname}...`);
        await queryInterface.sequelize.query(`ALTER TABLE "Patients" DROP CONSTRAINT IF EXISTS "${c.conname}";`);
      } catch (err) {
        console.warn(`Could not drop constraint ${c.conname}:`, err.message);
      }
    }

    // Remover índices legacy redundantes sobre documentId
    const legacyIndexes = [
      'idx_patients_documentId',
      'patients_document_id'
    ];

    for (const idxName of legacyIndexes) {
      try {
        await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${idxName}";`);
      } catch (err) {
        console.warn(`Could not drop index ${idxName}:`, err.message);
      }
    }

    // 4. Crear índices UNIQUE con soporte Multi-Tenant y Soft-Deletes
    // A. Para pacientes asociados a una organización específica
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_org_doc_normalized 
      ON "Patients" ("organizationId", "documentNumberNormalized") 
      WHERE ("deletedAt" IS NULL AND "organizationId" IS NOT NULL);
    `);

    // B. Para pacientes globales (organizationId IS NULL)
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_global_doc_normalized 
      ON "Patients" ("documentNumberNormalized") 
      WHERE ("deletedAt" IS NULL AND "organizationId" IS NULL);
    `);

    // C. Índice de búsqueda rápida sobre el valor normalizado y el canónico
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_doc_normalized 
      ON "Patients" ("documentNumberNormalized");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_doc_canonical 
      ON "Patients" ("documentId");
    `);

    console.log('✅ Canonical & normalized identity document migration completed successfully.');
  },

  down: async (queryInterface, Sequelize) => {
    // Revertir índices
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS uq_patients_org_doc_normalized;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS uq_patients_global_doc_normalized;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_patients_doc_normalized;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_patients_doc_canonical;`);

    // Remover columna
    try {
      await queryInterface.removeColumn('Patients', 'documentNumberNormalized');
    } catch (err) {
      console.warn('Error removing documentNumberNormalized:', err.message);
    }
  }
};
