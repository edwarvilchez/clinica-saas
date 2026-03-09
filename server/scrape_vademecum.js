/**
 * ============================================================
 *  MEDICUS – Scraper de Vademécum Venezuela (vademecum.es)
 * ============================================================
 *  Estrategia: los IDs de Venezuela tienen el prefijo 770xxxxx
 *  El scraper itera por ID numérico e importa todos los que
 *  respondan con una ficha de medicamento válida.
 *
 *  Uso:
 *    node scrape_vademecum.js                         (completo)
 *    node scrape_vademecum.js --dry-run               (solo muestra)
 *    node scrape_vademecum.js --from 77000001         (desde ID)
 *    node scrape_vademecum.js --to   77001000         (hasta ID)
 *    node scrape_vademecum.js --resume                (continúa)
 *    node scrape_vademecum.js --from 77000001 --to 77000100 --dry-run
 *
 *  El script es IDEMPOTENTE: upsert por (name + presentation).
 * ============================================================
 */

'use strict';
require('dotenv').config();
const axios   = require('axios');
const cheerio = require('cheerio');
const { Drug } = require('./src/models');
const fs   = require('fs');
const path = require('path');

// ── CLI args ──────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const RESUME  = process.argv.includes('--resume');
const getArg  = (flag, def) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? parseInt(process.argv[i + 1]) : def;
};

// Rango de IDs conocido para Venezuela (prefijo 770)
// Los IDs observados van de 77000001 a ~77007000 aprox.
const ID_FROM = getArg('--from', 77000001);
const ID_TO   = getArg('--to',   77007500);

// ── Configuración ─────────────────────────────────────────────────────────
const BASE          = 'https://www.vademecum.es';
const DELAY_MS      = 600;
const TIMEOUT       = 12000;
const MAX_RETRY     = 3;
const BATCH_SAVE    = 20;  // Guardar progreso cada N medicamentos
const PROGRESS_FILE = path.resolve('./scrape_progress.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-VE,es;q=0.9,en-US;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

// ── Logs ──────────────────────────────────────────────────────────────────
const ts  = () => new Date().toLocaleTimeString('es-VE');
const log = (e, m) => console.log(`[${ts()}] ${e}  ${m}`);

// ── Fetch con reintentos ──────────────────────────────────────────────────
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchHtml(url, attempt = 1) {
  try {
    const res = await axios.get(url, {
      headers: HEADERS,
      timeout: TIMEOUT,
      validateStatus: s => s < 500  // aceptar 404, 301, etc.
    });
    if (res.status === 404) return null;   // medicamento no existente
    if (res.status >= 400) return null;
    return res.data;
  } catch (err) {
    if (attempt >= MAX_RETRY) return null;
    await sleep(DELAY_MS * attempt * 2);
    return fetchHtml(url, attempt + 1);
  }
}

// ── Progreso ──────────────────────────────────────────────────────────────
function loadProgress() {
  if (!RESUME || !fs.existsSync(PROGRESS_FILE)) return { lastId: ID_FROM - 1, count: 0 };
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return { lastId: ID_FROM - 1, count: 0 }; }
}
function saveProgress(p) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ── Parsear ficha ─────────────────────────────────────────────────────────
function clean(txt, maxLen = 3000) {
  if (!txt) return '';
  return txt.replace(/\s+/g, ' ').trim().substring(0, maxLen);
}

function extractSection($, ...keywords) {
  for (const kw of keywords) {
    let text = '';
    $('h2, h3, h4, strong, b').each((_, el) => {
      const heading = $(el).text();
      if (heading.toLowerCase().includes(kw.toLowerCase())) {
        // Recoge texto del párrafo/div siguiente
        let next = $(el).parent().next();
        if (!next.length) next = $(el).next();
        let count = 0;
        while (next.length && !next.is('h2, h3, h4') && count < 5) {
          text += ' ' + next.text();
          next = next.next();
          count++;
        }
        if (!text.trim()) {
          // Intenta el texto del contenedor padre
          text = $(el).parent().text().replace(heading, '');
        }
      }
    });
    if (text.trim().length > 20) return clean(text);
  }
  return '';
}

function parseDrugPage(html, url) {
  const $ = cheerio.load(html);

  // Verificar que es una página de medicamento válida
  const h1 = $('h1').first().text().trim();
  if (!h1 || h1.length < 3) return null;
  if (h1.toLowerCase().includes('página no encontrada')) return null;
  if (h1.toLowerCase().includes('error')) return null;

  // Separar nombre comercial de presentación
  // Patrón: "NOMBRE Forma farmacéutica dosis"
  const formMatch = h1.match(
    /^([A-ZÁÉÍÓÚÑÜA-Z][^a-z]{2,}?)\s+(Comprimido|Cápsula|Jarabe|Solución|Suspensión|Gotas|Crema|Gel|Pomada|Óvulo|Supositorio|Polvo|Tableta|Ampolla|Vial|Granulado|Aerosol|Inhalador|Emulsión|Spray|Colirio|Parche|Film|Implante|Pasta|Grageas|Inyectable|Infusión|Instilación|Concentrado|Liofilizado|Efervescente|Liberación)(.*)/i
  );

  const name         = formMatch ? formMatch[1].trim() : h1.split(' ').slice(0,4).join(' ');
  const presentation = formMatch ? (formMatch[2] + (formMatch[3]||'')).trim() : '';

  // ATC / Principio activo (nombre genérico)
  let genericName = '';
  $('h2, h3').each((_, el) => {
    const txt = $(el).text();
    if (/^ATC:\s*/i.test(txt)) {
      genericName = txt.replace(/^ATC:\s*/i, '').replace(/\s*Embarazo.*$/i, '').trim();
    }
  });
  if (!genericName) {
    // Buscar en breadcrumb o meta
    genericName = $('meta[name="keywords"]').attr('content')?.split(',')[0] || '';
  }

  // Componentes activos: mecanismo de acción o composición
  const activeComponents = extractSection($, 'Mecanismo de acción', 'Composición', 'Principio activo') || genericName;

  // Secciones clínicas
  const indications       = extractSection($, 'Indicaciones terapéuticas', 'Indicaciones', 'Indicado');
  const posology          = extractSection($, 'Posología', 'Dosificación', 'Dosis recomendada');
  const contraindications = extractSection($, 'Contraindicaciones');
  const adverseReactions  = extractSection($, 'Reacciones adversas', 'Efectos adversos', 'Efectos secundarios');
  const precautions       = extractSection($, 'Advertencias y precauciones', 'Advertencias', 'Precauciones');

  // Categoría ATC (2do nivel del árbol ATC)
  let category = '';
  const atcLinks = $('a[href*="atc"]');
  if (atcLinks.length >= 2) {
    category = $(atcLinks.get(1)).text().replace(/^[A-Z0-9]+:\s*/, '').trim().substring(0, 100);
  }
  // Fallback: usar texto entre paréntesis del ATC genérico
  if (!category && genericName) {
    const catMap = {
      'paracetamol': 'Analgesia', 'ibuprofeno': 'Antiinflamatorio',
      'amoxicilina': 'Antibiótico', 'ciprofloxacino': 'Antibiótico',
      'azitromicina': 'Antibiótico', 'metformina': 'Antidiabético',
      'enalapril': 'Antihipertensivo', 'losartán': 'Antihipertensivo',
      'omeprazol': 'Gastrointestinal', 'ranitidina': 'Gastrointestinal',
      'betametasona': 'Antiinflamatorio', 'prednisona': 'Antiinflamatorio',
      'diazepam': 'Neurología', 'lorazepam': 'Neurología',
      'atorvastatina': 'Cardiovascular', 'simvastatina': 'Cardiovascular',
    };
    const lc = genericName.toLowerCase();
    for (const [k, v] of Object.entries(catMap)) {
      if (lc.includes(k)) { category = v; break; }
    }
  }

  return {
    name:              clean(name, 200),
    genericName:       clean(genericName, 200),
    activeComponents:  clean(activeComponents, 1000),
    presentation:      clean(presentation, 300),
    category:          clean(category, 100),
    indications:       clean(indications, 3000),
    posology:          clean(posology, 3000),
    contraindications: clean(contraindications, 3000),
    adverseReactions:  clean(adverseReactions, 3000),
    precautions:       clean(precautions, 3000),
  };
}

// ── Guardar en BD ─────────────────────────────────────────────────────────
async function saveDrug(data) {
  if (DRY_RUN) {
    log('🔍', `[DRY] ${data.name} | ${data.genericName} | ${data.presentation}`);
    return 'dry';
  }

  const where = { name: data.name };
  if (data.presentation) where.presentation = data.presentation;

  const [drug, created] = await Drug.findOrCreate({ where, defaults: data });
  if (!created) await drug.update(data);
  return created ? 'created' : 'updated';
}

// ── Main ──────────────────────────────────────────────────────────────────
async function run() {
  const t0 = Date.now();
  const progress = loadProgress();
  const stats = { found: 0, created: 0, updated: 0, notFound: 0, errors: 0 };

  const startId = RESUME ? Math.max(progress.lastId + 1, ID_FROM) : ID_FROM;

  console.log('\n' + '='.repeat(62));
  log('🚀', 'MEDICUS — Scraper Vademécum Venezuela');
  log('📋', `Rango de IDs: ${startId.toLocaleString()} → ${ID_TO.toLocaleString()}`);
  log('📊', `Total a consultar: ${(ID_TO - startId + 1).toLocaleString()} fichas`);
  if (DRY_RUN) log('🔍', 'MODO DRY-RUN — sin escritura en BD');
  if (RESUME)  log('⏭', `Continuando desde ID ${startId.toLocaleString()}`);
  console.log('='.repeat(62) + '\n');

  let batchSince = 0;

  for (let id = startId; id <= ID_TO; id++) {
    const url  = `${BASE}/venezuela/medicamento/${id}/`;
    await sleep(DELAY_MS);

    try {
      const html = await fetchHtml(url);

      if (!html) {
        stats.notFound++;
        // No loguear cada 404 para no saturar consola
        if (id % 100 === 0) log('📍', `ID ${id} — progreso ${Math.round((id - startId) / (ID_TO - startId) * 100)}%`);
        continue;
      }

      const data = parseDrugPage(html, url);

      if (!data) {
        stats.notFound++;
        continue;
      }

      stats.found++;
      const result = await saveDrug(data);
      stats[result]++;
      batchSince++;

      log('💊', `[${result.toUpperCase()}] ID:${id} | ${data.name} | ${data.genericName} | ${data.presentation}`);

      // Guardar progreso periódicamente
      if (!DRY_RUN && batchSince >= BATCH_SAVE) {
        progress.lastId = id;
        progress.count  = (progress.count || 0) + batchSince;
        saveProgress(progress);
        batchSince = 0;
      }

    } catch (err) {
      stats.errors++;
      log('❌', `ID ${id} — ${err.message}`);
    }
  }

  // Guardar progreso final
  if (!DRY_RUN) {
    progress.lastId = ID_TO;
    progress.count  = (progress.count || 0) + batchSince;
    saveProgress(progress);
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  console.log('\n' + '='.repeat(62));
  log('🏁', `Scraping finalizado en ${elapsed} min`);
  log('📊', `Encontrados: ${stats.found} | Creados: ${stats.created} | Actualizados: ${stats.updated}`);
  log('📊', `Sin ficha: ${stats.notFound} | Errores: ${stats.errors}`);
  console.log('='.repeat(62));
  process.exit(0);
}

run().catch(err => { console.error('Error fatal:', err); process.exit(1); });
