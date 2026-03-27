/**
 * BCV Exchange Rate Service
 * Fetches official USD rate from Banco Central de Venezuela
 */

const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('./logger');

const BCV_URL = 'https://www.bcv.org.ve/';

const CACHE_KEY = 'bcv_usd_rate';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

let cachedRate = null;
let cacheTimestamp = 0;

const fetchBcvRate = async () => {
  try {
    const response = await axios.get(BCV_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);

    // Find the USD rate in the table
    let usdRate = null;

    $('.currency-table').each((i, table) => {
      $(table).find('tr').each((j, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const currency = $(cells[0]).text().trim();
          const rateText = $(cells[1]).text().trim();
          
          if (currency.includes('Dólar') || currency.includes('USD')) {
            // Clean and parse the rate
            const cleanedRate = rateText.replace(/[^\d,]/g, '').replace(',', '.');
            usdRate = parseFloat(cleanedRate);
          }
        }
      });
    });

    // Alternative: Look for specific element
    if (!usdRate) {
      const rateElement = $('[data-usd]').attr('data-usd');
      if (rateElement) {
        usdRate = parseFloat(rateElement);
      }
    }

    if (usdRate && usdRate > 0) {
      logger.info({ rate: usdRate }, 'BCV rate fetched successfully');
      return usdRate;
    }

    throw new Error('Could not parse USD rate');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to fetch BCV rate');
    return null;
  }
};

const getExchangeRate = async (forceRefresh = false) => {
  const now = Date.now();
  
  // Return cached rate if valid
  if (!forceRefresh && cachedRate && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedRate;
  }

  const rate = await fetchBcvRate();
  
  if (rate) {
    cachedRate = rate;
    cacheTimestamp = now;
    return rate;
  }

  // Return cached rate as fallback, even if expired
  if (cachedRate) {
    logger.warn('Using stale BCV rate due to fetch failure');
    return cachedRate;
  }

  // Last resort: return default rate
  return 30.00;
};

const updateSettingsRate = async (rate) => {
  // Store in database or settings
  const { Setting } = require('../models');
  
  if (Setting) {
    await Setting.upsert({
      key: 'exchange_rate',
      value: JSON.stringify({ rate, source: 'bcv', updatedAt: new Date() })
    });
  }
  
  cachedRate = rate;
  cacheTimestamp = Date.now();
};

module.exports = {
  getExchangeRate,
  fetchBcvRate,
  updateSettingsRate
};