const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

let cachedRate = { rate: 0, timestamp: 0 };
const CACHE_DURATION = 60 * 60 * 1000;

const ALTERNATIVE_APIS = [
  'https://api.exchangerate-api.com/v4/latest/USD',
  'https://open.er-api.com/v6/latest/USD'
];

router.get('/bcv-rate', async (req, res) => {
  const now = Date.now();
  
  if (cachedRate.rate && (now - cachedRate.timestamp) < CACHE_DURATION) {
    return res.json({ 
      rate: cachedRate.rate, 
      source: 'cache',
      timestamp: cachedRate.timestamp 
    });
  }

  let usdRate = null;
  let errorMsg = '';

  // Método 1: Intentar BCV oficial
  try {
    const bcvResponse = await axios.get('https://www.bcv.org.ve/', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(bcvResponse.data);
    
    // Buscar en múltiples formatos de la página
    const selectors = [
      '#dolar .valor',
      '#dolar strong',
      '.paridad-box .valor',
      '[id*="dolar"] .valor',
      '.valorIndicador',
      'table.currency-table td:nth-child(2)',
      '.divWrapper td'
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        const text = elements.first().text().trim();
        // Extract number like "36,89450000" or similar
        const match = text.match(/[\d]+[.,][\d]+/);
        if (match) {
          const rate = parseFloat(match[0].replace(',', '.'));
          if (rate > 20 && rate < 1000) {
            usdRate = rate;
            logger.info({ selector, matchedText: text, parsedRate: rate }, 'BCV rate found via selector');
            break;
          }
        }
      }
    }

    // Método 1.1: Búsqueda por texto si los selectores fallan
    if (!usdRate) {
      $('strong, span, div, td').each((i, el) => {
        const text = $(el).text().trim();
        if (text.includes('USD') || text.includes('Dólar')) {
          const nextText = $(el).parent().text().trim();
          const match = nextText.match(/[\d]{2,}[.,][\d]{2,}/);
          if (match) {
            usdRate = parseFloat(match[0].replace(',', '.'));
            if (usdRate > 20) return false; // stop each
          }
        }
      });
    }
  } catch (e) {
    errorMsg += ' BCV error: ' + e.message;
  }

  // Método 2: APIs alternativas (USD a VES)
  if (!usdRate) {
    for (const apiUrl of ALTERNATIVE_APIS) {
      try {
        const altResponse = await axios.get(apiUrl, { timeout: 5000 });
        if (altResponse.data && altResponse.data.rates && altResponse.data.rates.VES) {
          usdRate = altResponse.data.rates.VES;
          break;
        }
      } catch (e) {
        errorMsg += ` ${apiUrl.split('/')[2]} error`;
      }
    }
  }

  // Método 3: Scraping de sitio alternativo
  if (!usdRate) {
    try {
      const altResponse = await axios.get('https://www.dolarvzla.com/', { timeout: 8000 });
      const $ = cheerio.load(altResponse.data);
      const text = $('body').text();
      const matches = text.match(/Bs\.\s*([\d.,]+)/);
      if (matches) {
        usdRate = parseFloat(matches[1].replace(',', '.'));
      }
    } catch (e) {
      errorMsg += ' DolarVzla error';
    }
  }

  // Método 4: Usar tasa de último recurso si todo falla
  if (!usdRate || usdRate < 20) {
    usdRate = 36.50;
    errorMsg = 'Usando tasa por defecto';
  }

  if (usdRate && usdRate > 20) {
    cachedRate = { rate: usdRate, timestamp: now };
    logger.info({ bcvRate: usdRate, source: 'bcv' }, 'Exchange rate fetched');
    
    return res.json({ 
      rate: usdRate, 
      source: 'bcv',
      timestamp: now 
    });
  }

  if (cachedRate.rate > 0) {
    return res.json({ 
      rate: cachedRate.rate, 
      source: 'fallback',
      timestamp: cachedRate.timestamp
    });
  }

  res.status(500).json({ error: 'No se pudo obtener la tasa' });
});

module.exports = router;