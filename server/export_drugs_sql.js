/**
 * ============================================================
 *  MEDICUS – Export Drugs Table → SQL para Producción
 * ============================================================
 *  Genera un archivo SQL con todos los medicamentos de la BD
 *  local, listo para importar en EasyPanel / producción.
 *
 *  Uso:
 *    node export_drugs_sql.js
 *    → Genera: drugs_export_FECHA.sql
 * ============================================================
 */

'use strict';
require('dotenv').config();
const { Drug } = require('./src/models');
const fs   = require('fs');
const path = require('path');

function escapeSql(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

async function exportDrugs() {
  console.log('📦 Conectando a BD local...');
  const drugs = await Drug.findAll({ order: [['name', 'ASC']] });
  console.log(`✅ ${drugs.length} medicamentos encontrados`);

  const date     = new Date().toISOString().split('T')[0];
  const filename = `drugs_export_${date}.sql`;
  const outPath  = path.resolve(filename);

  const lines = [];

  lines.push('-- ============================================================');
  lines.push(`-- MEDICUS – Guía Farmacéutica Venezuela`);
  lines.push(`-- Exportado: ${new Date().toLocaleString('es-VE')}`);
  lines.push(`-- Total registros: ${drugs.length}`);
  lines.push('-- ============================================================');
  lines.push('');
  lines.push('-- Crear tabla si no existe (idempotente)');
  lines.push(`CREATE TABLE IF NOT EXISTS "Drugs" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  "genericName" VARCHAR(200),
  "activeComponents" TEXT NOT NULL,
  indications TEXT,
  posology TEXT,
  contraindications TEXT,
  "adverseReactions" TEXT,
  precautions TEXT,
  presentation VARCHAR(300),
  category VARCHAR(100),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);
  lines.push('');
  lines.push('-- Índice único para evitar duplicados por nombre');
  lines.push('CREATE UNIQUE INDEX IF NOT EXISTS drugs_name_unique ON "Drugs" (name);');
  lines.push('');
  lines.push('-- Insertar/actualizar medicamentos (upsert por nombre)');
  lines.push('');

  let count = 0;
  for (const d of drugs) {
    const sql = `INSERT INTO "Drugs" (
  name, "genericName", "activeComponents", indications, posology,
  contraindications, "adverseReactions", precautions, presentation, category,
  "createdAt", "updatedAt"
) VALUES (
  ${escapeSql(d.name)},
  ${escapeSql(d.genericName)},
  ${escapeSql(d.activeComponents)},
  ${escapeSql(d.indications)},
  ${escapeSql(d.posology)},
  ${escapeSql(d.contraindications)},
  ${escapeSql(d.adverseReactions)},
  ${escapeSql(d.precautions)},
  ${escapeSql(d.presentation)},
  ${escapeSql(d.category)},
  NOW(), NOW()
) ON CONFLICT (name) DO UPDATE SET
  "genericName"     = EXCLUDED."genericName",
  "activeComponents"= EXCLUDED."activeComponents",
  indications       = EXCLUDED.indications,
  posology          = EXCLUDED.posology,
  contraindications = EXCLUDED.contraindications,
  "adverseReactions"= EXCLUDED."adverseReactions",
  precautions       = EXCLUDED.precautions,
  presentation      = EXCLUDED.presentation,
  category          = EXCLUDED.category,
  "updatedAt"       = NOW();`;

    lines.push(sql);
    lines.push('');
    count++;

    if (count % 100 === 0) {
      process.stdout.write(`\r⏳ Procesando: ${count}/${drugs.length}...`);
    }
  }

  lines.push('');
  lines.push(`-- ✅ Fin del export: ${count} medicamentos`);

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`\n✅ Archivo generado: ${filename}`);
  console.log(`📁 Tamaño: ${sizeKb} KB`);
  console.log(`📍 Ruta: ${outPath}`);
  console.log('\n📋 Instrucciones para importar en producción (EasyPanel):');
  console.log('  1. Copiar el archivo SQL al servidor de EasyPanel');
  console.log('  2. En EasyPanel → base de datos → Run Query o usar psql:');
  console.log(`     psql -U <usuario> -d <nombre_bd> -f ${filename}`);
  console.log('  3. O bien: en EasyPanel → Terminal del contenedor:');
  console.log(`     cat ${filename} | psql $DATABASE_URL`);

  process.exit(0);
}

exportDrugs().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
