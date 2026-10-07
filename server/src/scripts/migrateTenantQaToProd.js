#!/usr/bin/env node
/**
 * ==============================================================================
 * CLÍNICA SAAS - TENANT MIGRATION ENGINE (QA -> PRODUCTION)
 * ==============================================================================
 * Migra una organización (clínica o consultorio) completa desde el ambiente de
 * pruebas/demos (QA/Staging) hacia el ambiente de Producción oficial de forma atómica.
 *
 * USO:
 *   node src/scripts/migrateTenantQaToProd.js --slug <slug-de-la-clinica> [--dry-run] [--include-patients]
 *
 * EJEMPLOS:
 *   # Simular migración de la clínica 'san-rafael' sin escribir cambios en producción:
 *   node src/scripts/migrateTenantQaToProd.js --slug san-rafael --dry-run
 *
 *   # Ejecutar migración real de configuración médica e inventario:
 *   node src/scripts/migrateTenantQaToProd.js --slug san-rafael
 *
 *   # Migrar configuración incluyendo pacientes y registros de prueba convertidos:
 *   node src/scripts/migrateTenantQaToProd.js --slug san-rafael --include-patients
 * ==============================================================================
 */

require('dotenv').config();
const { Sequelize, DataTypes, Op } = require('sequelize');

// --- 1. PARSEO DE PARÁMETROS CLI ---
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const tenantSlug = getArg('--slug');
const tenantId = getArg('--id');
const isDryRun = hasFlag('--dry-run');
const includePatients = hasFlag('--include-patients');

if (!tenantSlug && !tenantId) {
  console.error('\n❌ ERROR: Debes especificar el slug o el ID de la organización a migrar.');
  console.log('   Uso: node src/scripts/migrateTenantQaToProd.js --slug <slug> [--dry-run] [--include-patients]\n');
  process.exit(1);
}

// --- 2. CONFIGURACIÓN DE CONEXIONES (QA vs PROD) ---
const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = process.env.DB_PORT || 5432;
const dbUser = process.env.DB_USER || 'clinica_saas_admin';
const dbPass = process.env.DB_PASSWORD || '';

const qaDbName = process.env.QA_DB_NAME || process.env.DB_NAME_QA || 'clinica_saas_qa';
const prodDbName = process.env.PROD_DB_NAME || process.env.DB_NAME_PROD || 'clinica_saas_prod';

const qaSchema = process.env.QA_DB_SCHEMA || 'public';
const prodSchema = process.env.PROD_DB_SCHEMA || 'public';

console.log('\n=============================================================');
console.log('🚀 INICIANDO MOTOR DE MIGRACIÓN TENANT: QA -> PRODUCCIÓN');
console.log('=============================================================');
console.log(`🔍 Modo: ${isDryRun ? '🧪 SIMULACIÓN (DRY-RUN - Sin escrituras)' : '⚡ EJECUCIÓN REAL (PRODUCCIÓN)'}`);
console.log(`🏢 Origen (QA):     DB [${qaDbName}] Schema [${qaSchema}]`);
console.log(`🏥 Destino (PROD):  DB [${prodDbName}] Schema [${prodSchema}]`);
console.log(`📋 Incluye Pacientes: ${includePatients ? 'SÍ' : 'NO (Solo configuración clínica, staff e inventario)'}`);
console.log('-------------------------------------------------------------\n');

const qaSequelize = new Sequelize(qaDbName, dbUser, dbPass, {
  host: dbHost,
  port: dbPort,
  dialect: 'postgres',
  logging: false,
  dialectOptions: qaSchema !== 'public' ? { searchPath: qaSchema } : {}
});

const prodSequelize = new Sequelize(prodDbName, dbUser, dbPass, {
  host: dbHost,
  port: dbPort,
  dialect: 'postgres',
  logging: false,
  dialectOptions: prodSchema !== 'public' ? { searchPath: prodSchema } : {}
});

async function runMigration() {
  try {
    // Verificar conectividad
    await qaSequelize.authenticate();
    console.log('✅ Conexión exitosa a la base de datos de QA.');
    await prodSequelize.authenticate();
    console.log('✅ Conexión exitosa a la base de datos de PRODUCCIÓN.');

    // --- 3. BUSCAR ORGANIZACIÓN EN QA ---
    const orgQuery = tenantSlug
      ? 'SELECT * FROM "Organizations" WHERE slug = :val LIMIT 1'
      : 'SELECT * FROM "Organizations" WHERE id = :val LIMIT 1';

    const [qaOrgs] = await qaSequelize.query(orgQuery, {
      replacements: { val: tenantSlug || tenantId }
    });

    if (!qaOrgs || qaOrgs.length === 0) {
      console.error(`\n❌ Organización no encontrada en QA con ${tenantSlug ? 'slug' : 'ID'}: ${tenantSlug || tenantId}`);
      process.exit(1);
    }

    const sourceOrg = qaOrgs[0];
    console.log(`\n🏢 Organización encontrada en QA: "${sourceOrg.name}" (ID: ${sourceOrg.id}, Slug: ${sourceOrg.slug})`);

    // --- 4. VERIFICAR QUE NO EXISTA PREVIAMENTE EN PROD ---
    const [existingProdOrgs] = await prodSequelize.query(
      'SELECT id, name FROM "Organizations" WHERE id = :id OR slug = :slug LIMIT 1',
      { replacements: { id: sourceOrg.id, slug: sourceOrg.slug } }
    );

    if (existingProdOrgs && existingProdOrgs.length > 0) {
      console.error(`\n⚠️ CONFLICTO: La organización "${existingProdOrgs[0].name}" ya existe en PRODUCCIÓN.`);
      console.error('   Para evitar sobrescribir datos productivos activos, la migración se ha detenido.');
      process.exit(1);
    }

    // --- 5. EXTRAER DATOS VINCULADOS DESDE QA ---
    console.log('\n📦 Extrayendo componentes de la clínica desde QA...');

    const [qaUsers] = await qaSequelize.query(
      'SELECT * FROM "Users" WHERE "organizationId" = :orgId',
      { replacements: { orgId: sourceOrg.id } }
    );
    console.log(`   👥 Usuarios / Personal: ${qaUsers.length}`);

    const [qaDoctors] = await qaSequelize.query(
      'SELECT * FROM "Doctors" WHERE "organizationId" = :orgId',
      { replacements: { orgId: sourceOrg.id } }
    );
    console.log(`   🩺 Médicos Especialistas: ${qaDoctors.length}`);

    const [qaNurses] = await qaSequelize.query(
      'SELECT * FROM "Nurses" WHERE "organizationId" = :orgId',
      { replacements: { orgId: sourceOrg.id } }
    );
    console.log(`   💉 Enfermería: ${qaNurses.length}`);

    const [qaSpecialties] = await qaSequelize.query('SELECT * FROM "Specialties"');
    const [qaInventory] = await qaSequelize.query(
      'SELECT * FROM "InventoryItems" WHERE "organizationId" = :orgId',
      { replacements: { orgId: sourceOrg.id } }
    ).catch(() => [[]]);
    console.log(`   💊 Ítems de Farmacia / Inventario: ${qaInventory.length}`);

    const [qaPackages] = await qaSequelize.query(
      'SELECT * FROM "ClinicalPackages" WHERE "organizationId" = :orgId',
      { replacements: { orgId: sourceOrg.id } }
    ).catch(() => [[]]);
    console.log(`   📑 Combos Clínicos y Baremos: ${qaPackages.length}`);

    let qaPatients = [];
    let qaMedicalRecords = [];
    if (includePatients) {
      [qaPatients] = await qaSequelize.query(
        'SELECT * FROM "Patients" WHERE "organizationId" = :orgId',
        { replacements: { orgId: sourceOrg.id } }
      );
      console.log(`   🏥 Pacientes: ${qaPatients.length}`);
    }

    // --- 6. TRANSACCIÓN ATÓMICA EN PRODUCCIÓN ---
    console.log('\n🔒 Iniciando transacción atómica en PRODUCCIÓN...');
    const t = await prodSequelize.transaction();

    try {
      // 6.1 Mapear Roles de Producción
      const [prodRoles] = await prodSequelize.query('SELECT id, name FROM "Roles"', { transaction: t });
      const roleMap = {};
      prodRoles.forEach(r => { roleMap[r.name] = r.id; });

      const [qaRoles] = await qaSequelize.query('SELECT id, name FROM "Roles"');
      const qaRoleIdToName = {};
      qaRoles.forEach(r => { qaRoleIdToName[r.id] = r.name; });

      // 6.2 Insertar Organización en Producción
      await prodSequelize.query(
        `INSERT INTO "Organizations" (
          "id", "name", "slug", "ownerId", "subscriptionStatus", "maxUsers", "maxPatients", "isActive", "createdAt", "updatedAt"
        ) VALUES (
          :id, :name, :slug, :ownerId, 'ACTIVE', :maxUsers, :maxPatients, true, NOW(), NOW()
        )`,
        {
          replacements: {
            id: sourceOrg.id,
            name: sourceOrg.name,
            slug: sourceOrg.slug,
            ownerId: sourceOrg.ownerId,
            maxUsers: sourceOrg.maxUsers || 10,
            maxPatients: sourceOrg.maxPatients || 500
          },
          transaction: t
        }
      );
      console.log('   ✅ Organización insertada con estado ACTIVE.');

      // 6.3 Insertar Usuarios (Preservando hash de contraseñas)
      for (const u of qaUsers) {
        const roleName = qaRoleIdToName[u.roleId] || 'ADMINISTRATIVE';
        const targetRoleId = roleMap[roleName] || roleMap['ADMINISTRATIVE'];

        await prodSequelize.query(
          `INSERT INTO "Users" (
            "id", "username", "email", "password", "firstName", "lastName", "businessName",
            "accountType", "isActive", "gender", "roleId", "organizationId", "mustChangePassword", "createdAt", "updatedAt"
          ) VALUES (
            :id, :username, :email, :password, :firstName, :lastName, :businessName,
            :accountType, :isActive, :gender, :roleId, :organizationId, false, NOW(), NOW()
          ) ON CONFLICT ("id") DO NOTHING`,
          {
            replacements: {
              id: u.id,
              username: u.username,
              email: u.email,
              password: u.password,
              firstName: u.firstName,
              lastName: u.lastName,
              businessName: u.businessName,
              accountType: u.accountType,
              isActive: u.isActive,
              gender: u.gender,
              roleId: targetRoleId,
              organizationId: sourceOrg.id
            },
            transaction: t
          }
        );
      }
      console.log(`   ✅ ${qaUsers.length} usuarios migrados exitosamente.`);

      // 6.4 Insertar Doctores
      for (const d of qaDoctors) {
        await prodSequelize.query(
          `INSERT INTO "Doctors" (
            "id", "userId", "specialtyId", "organizationId", "licenseNumber", "bio", "createdAt", "updatedAt"
          ) VALUES (
            :id, :userId, :specialtyId, :organizationId, :licenseNumber, :bio, NOW(), NOW()
          ) ON CONFLICT ("id") DO NOTHING`,
          {
            replacements: {
              id: d.id,
              userId: d.userId,
              specialtyId: d.specialtyId,
              organizationId: sourceOrg.id,
              licenseNumber: d.licenseNumber,
              bio: d.bio
            },
            transaction: t
          }
        );
      }
      console.log(`   ✅ ${qaDoctors.length} médicos migrados.`);

      // 6.5 Insertar Enfermería
      for (const n of qaNurses) {
        await prodSequelize.query(
          `INSERT INTO "Nurses" (
            "id", "userId", "organizationId", "licenseNumber", "createdAt", "updatedAt"
          ) VALUES (
            :id, :userId, :organizationId, :licenseNumber, NOW(), NOW()
          ) ON CONFLICT ("id") DO NOTHING`,
          {
            replacements: {
              id: n.id,
              userId: n.userId,
              organizationId: sourceOrg.id,
              licenseNumber: n.licenseNumber
            },
            transaction: t
          }
        );
      }

      // 6.6 Insertar Inventario
      for (const item of qaInventory) {
        await prodSequelize.query(
          `INSERT INTO "InventoryItems" (
            "id", "organizationId", "name", "code", "category", "unit", "priceUSD", "stockCurrent", "createdAt", "updatedAt"
          ) VALUES (
            :id, :organizationId, :name, :code, :category, :unit, :priceUSD, :stockCurrent, NOW(), NOW()
          ) ON CONFLICT ("id") DO NOTHING`,
          {
            replacements: {
              id: item.id,
              organizationId: sourceOrg.id,
              name: item.name,
              code: item.code,
              category: item.category,
              unit: item.unit,
              priceUSD: item.priceUSD,
              stockCurrent: item.stockCurrent
            },
            transaction: t
          }
        );
      }

      // 6.7 Insertar Combos Clínicos
      for (const pkg of qaPackages) {
        await prodSequelize.query(
          `INSERT INTO "ClinicalPackages" (
            "id", "organizationId", "name", "description", "priceUSD", "isActive", "createdAt", "updatedAt"
          ) VALUES (
            :id, :organizationId, :name, :description, :priceUSD, :isActive, NOW(), NOW()
          ) ON CONFLICT ("id") DO NOTHING`,
          {
            replacements: {
              id: pkg.id,
              organizationId: sourceOrg.id,
              name: pkg.name,
              description: pkg.description,
              priceUSD: pkg.priceUSD,
              isActive: pkg.isActive
            },
            transaction: t
          }
        );
      }

      // 6.8 Insertar Pacientes si fue solicitado
      if (includePatients && qaPatients.length > 0) {
        for (const p of qaPatients) {
          await prodSequelize.query(
            `INSERT INTO "Patients" (
              "id", "userId", "organizationId", "documentId", "phoneNumber", "address", "birthDate", "createdAt", "updatedAt"
            ) VALUES (
              :id, :userId, :organizationId, :documentId, :phoneNumber, :address, :birthDate, NOW(), NOW()
            ) ON CONFLICT ("id") DO NOTHING`,
            {
              replacements: {
                id: p.id,
                userId: p.userId,
                organizationId: sourceOrg.id,
                documentId: p.documentId,
                phoneNumber: p.phoneNumber,
                address: p.address,
                birthDate: p.birthDate
              },
              transaction: t
            }
          );
        }
        console.log(`   ✅ ${qaPatients.length} pacientes migrados.`);
      }

      // --- EVALUAR SI ES DRY-RUN O COMMIT ---
      if (isDryRun) {
        await t.rollback();
        console.log('\n🧪 [DRY-RUN EXITOSO] Simulación completada sin errores. Rollback ejecutado.');
        console.log('   La base de datos de producción permanece intacta.');
      } else {
        await t.commit();
        console.log('\n🎉 [MIGRACIÓN EXITOSA] Todos los datos fueron comprometidos en PRODUCCIÓN.');
        console.log(`   La clínica "${sourceOrg.name}" ya puede operar en: https://tu-dominio.com`);
      }

    } catch (innerError) {
      await t.rollback();
      throw innerError;
    }

  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA MIGRACIÓN:', error.message);
    if (error.original) {
      console.error('   Detalle SQL:', error.original.detail || error.original.message);
    }
    process.exit(1);
  } finally {
    await qaSequelize.close();
    await prodSequelize.close();
  }
}

runMigration();
