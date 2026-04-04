const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

// In-memory cache — helps concurrent requests within the same instance.
// On Vercel serverless, instances are ephemeral; this won't survive cold starts.
let cachedRate = { rate: 0, timestamp: 0 };
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const FALLBACK_RATE = 36.50;

// Hard cap so we never exceed Vercel's 10s function timeout
const TOTAL_BUDGET_MS = 8000;

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    )
  ]);

const fetchFromBcv = () =>
  axios
    .get('https://www.bcv.org.ve/', {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    .then(({ data }) => {
      const $ = cheerio.load(data);
      for (const selector of ['#dolar .valor', '#dolar strong', '.valorIndicador']) {
        const text = $(selector).first().text().trim();
        const match = text.match(/[\d]+[.,][\d]+/);
        if (match) {
          const rate = parseFloat(match[0].replace(',', '.'));
          if (rate > 20 && rate < 1000) return rate;
        }
      }
      throw new Error('BCV: tasa no encontrada en la página');
    });

const fetchFromAlternativeApi = () =>
  axios
    .get('https://open.er-api.com/v6/latest/USD', { timeout: 4000 })
    .then(({ data }) => {
      const ves = data?.rates?.VES;
      if (ves && ves > 20) return ves;
      throw new Error('er-api: sin tasa VES');
    });

router.get('/bcv-rate', async (req, res) => {
  const now = Date.now();

  if (cachedRate.rate && now - cachedRate.timestamp < CACHE_DURATION) {
    return res.json({ rate: cachedRate.rate, source: 'cache', timestamp: cachedRate.timestamp });
  }

  let usdRate = null;
  let source = 'fallback';
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  // Intento 1: BCV oficial
  try {
    const remaining = deadline - Date.now();
    usdRate = await withTimeout(fetchFromBcv(), remaining);
    source = 'bcv';
  } catch (e) {
    logger.warn({ err: e.message }, 'BCV fetch failed, trying alternative API');
  }

  // Intento 2: API alternativa (solo si queda tiempo)
  if (!usdRate) {
    const remaining = deadline - Date.now();
    if (remaining > 1000) {
      try {
        usdRate = await withTimeout(fetchFromAlternativeApi(), remaining);
        source = 'er-api';
      } catch (e) {
        logger.warn({ err: e.message }, 'Alternative API also failed');
      }
    }
  }

  // Siempre retornar 200 — este es un servicio secundario, nunca debe bloquear el cliente
  if (!usdRate || usdRate < 20) {
    usdRate = cachedRate.rate > 0 ? cachedRate.rate : FALLBACK_RATE;
    source = cachedRate.rate > 0 ? 'stale-cache' : 'fallback';
    logger.warn({ usdRate, source }, 'Using fallback exchange rate');
  } else {
    cachedRate = { rate: usdRate, timestamp: now };
    logger.info({ usdRate, source }, 'Exchange rate fetched successfully');
  }

  return res.json({ rate: usdRate, source, timestamp: now });
});

module.exports = router;