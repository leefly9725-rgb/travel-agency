'use strict';

const { supabaseRequest } = require('../supabaseClient');
const { loadSeedData, saveSeedData } = require('../dataStore');

function generateExchangeRateId() {
  return `ER-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// If no exchangeRates key exists, seed default EUR/RSD rate.
// If key exists (even empty), leave it alone.
function ensureExchangeRatesData(data) {
  if (!Array.isArray(data.exchangeRates)) {
    data.exchangeRates = [{
      id: 'ER-EUR-RSD-seed',
      baseCurrency: 'EUR',
      quoteCurrency: 'RSD',
      rate: 117.20,
      rateDate: new Date().toISOString().slice(0, 10),
      source: 'manual_seed',
      notes: 'Initial operational EUR/RSD rate for LDS cost conversion; can be updated later.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
  }
}

function normalizeExchangeRateFromSupabase(row) {
  return {
    id: row.id || '',
    baseCurrency: row.base_currency || '',
    quoteCurrency: row.quote_currency || '',
    rate: row.rate != null ? Number(row.rate) : null,
    rateDate: row.rate_date || null,
    source: row.source || 'manual',
    notes: row.notes || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function normalizeLocalExchangeRate(item) {
  return {
    id: item.id || '',
    baseCurrency: item.baseCurrency || '',
    quoteCurrency: item.quoteCurrency || '',
    rate: item.rate != null ? Number(item.rate) : null,
    rateDate: item.rateDate || null,
    source: item.source || 'manual',
    notes: item.notes || '',
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || '',
  };
}

async function listExchangeRates(config, filters = {}) {
  if (config.enabled) {
    try {
      let qs = 'exchange_rates?order=created_at.desc&select=*';
      if (filters.baseCurrency) qs += `&base_currency=eq.${encodeURIComponent(filters.baseCurrency)}`;
      if (filters.quoteCurrency) qs += `&quote_currency=eq.${encodeURIComponent(filters.quoteCurrency)}`;
      const rows = await supabaseRequest(config, qs);
      if (!Array.isArray(rows)) return [];
      return rows.map(normalizeExchangeRateFromSupabase);
    } catch (err) {
      console.error('[exchangeRateStore] listExchangeRates error:', err.message);
      return [];
    }
  }
  const data = loadSeedData();
  ensureExchangeRatesData(data);
  let rates = data.exchangeRates.map(normalizeLocalExchangeRate);
  if (filters.baseCurrency) rates = rates.filter(r => r.baseCurrency === filters.baseCurrency);
  if (filters.quoteCurrency) rates = rates.filter(r => r.quoteCurrency === filters.quoteCurrency);
  return rates.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

// Returns the most recent rate for the given pair (optionally up to a date).
// Returns null if not found.
async function getLatestExchangeRate(config, baseCurrency, quoteCurrency, date) {
  if (config.enabled) {
    try {
      let qs;
      if (date) {
        qs = `exchange_rates?base_currency=eq.${encodeURIComponent(baseCurrency)}&quote_currency=eq.${encodeURIComponent(quoteCurrency)}&rate_date=lte.${encodeURIComponent(date)}&order=rate_date.desc,created_at.desc&limit=1&select=*`;
      } else {
        qs = `exchange_rates?base_currency=eq.${encodeURIComponent(baseCurrency)}&quote_currency=eq.${encodeURIComponent(quoteCurrency)}&order=rate_date.desc,created_at.desc&limit=1&select=*`;
      }
      const rows = await supabaseRequest(config, qs);
      if (Array.isArray(rows) && rows.length > 0) return normalizeExchangeRateFromSupabase(rows[0]);
      return null;
    } catch (err) {
      console.error('[exchangeRateStore] getLatestExchangeRate error:', err.message);
      return null;
    }
  }
  const data = loadSeedData();
  ensureExchangeRatesData(data);
  let rates = data.exchangeRates
    .filter(r => r.baseCurrency === baseCurrency && r.quoteCurrency === quoteCurrency)
    .map(normalizeLocalExchangeRate);
  if (date) rates = rates.filter(r => !r.rateDate || r.rateDate <= date);
  if (rates.length === 0) return null;
  rates.sort((a, b) => {
    const d = (b.rateDate || '').localeCompare(a.rateDate || '');
    return d !== 0 ? d : (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  return rates[0];
}

// Convert amount from one currency to another.
// Returns { convertedAmount, exchangeRate, exchangeRateDate, exchangeRateSource, conversionMethod }.
// Throws 422 with code='NO_EXCHANGE_RATE' if no rate found.
async function convertCurrency(config, amount, fromCurrency, toCurrency, date) {
  if (fromCurrency === toCurrency) {
    return {
      convertedAmount: Math.round(Number(amount) * 100) / 100,
      exchangeRate: 1,
      exchangeRateDate: null,
      exchangeRateSource: 'same_currency',
      conversionMethod: 'same_currency',
    };
  }

  const amt = Number(amount);
  if (isNaN(amt)) {
    const err = new Error('金额无效。');
    err.status = 400;
    throw err;
  }

  // Strategy 1: base=toCurrency, quote=fromCurrency
  // e.g., base=EUR, quote=RSD → 1 EUR = 117.20 RSD → RSD_amount / rate = EUR_amount
  const rateA = await getLatestExchangeRate(config, toCurrency, fromCurrency, date);
  if (rateA && rateA.rate > 0) {
    return {
      convertedAmount: Math.round((amt / rateA.rate) * 100) / 100,
      exchangeRate: rateA.rate,
      exchangeRateDate: rateA.rateDate,
      exchangeRateSource: rateA.source,
      conversionMethod: 'auto',
    };
  }

  // Strategy 2: base=fromCurrency, quote=toCurrency
  // e.g., base=USD, quote=EUR → 1 USD = 0.93 EUR → USD_amount * rate = EUR_amount
  const rateB = await getLatestExchangeRate(config, fromCurrency, toCurrency, date);
  if (rateB && rateB.rate > 0) {
    return {
      convertedAmount: Math.round((amt * rateB.rate) * 100) / 100,
      exchangeRate: rateB.rate,
      exchangeRateDate: rateB.rateDate,
      exchangeRateSource: rateB.source,
      conversionMethod: 'auto',
    };
  }

  const err = new Error(
    `未找到 ${fromCurrency} → ${toCurrency} 的汇率，请手动输入折算金额。`
  );
  err.status = 422;
  err.code = 'NO_EXCHANGE_RATE';
  throw err;
}

async function upsertExchangeRate(config, payload) {
  const { baseCurrency, quoteCurrency, rate, rateDate, source, notes } = payload;
  if (!baseCurrency || !quoteCurrency) {
    const err = new Error('baseCurrency 和 quoteCurrency 不能为空。');
    err.status = 400;
    throw err;
  }
  if (!rate || Number(rate) <= 0) {
    const err = new Error('rate 必须是正数。');
    err.status = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const id = payload.id || generateExchangeRateId();
  const record = {
    id,
    baseCurrency,
    quoteCurrency,
    rate: Number(rate),
    rateDate: rateDate || now.slice(0, 10),
    source: source || 'manual',
    notes: notes || '',
    createdAt: now,
    updatedAt: now,
  };

  if (config.enabled) {
    const supaPayload = {
      id: record.id,
      base_currency: record.baseCurrency,
      quote_currency: record.quoteCurrency,
      rate: record.rate,
      rate_date: record.rateDate,
      source: record.source,
      notes: record.notes,
      created_at: now,
      updated_at: now,
    };
    const rows = await supabaseRequest(config, 'exchange_rates', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify([supaPayload]),
    });
    const raw = Array.isArray(rows) ? rows[0] : rows;
    if (!raw) throw new Error('保存汇率失败。');
    return normalizeExchangeRateFromSupabase(raw);
  }

  const data = loadSeedData();
  ensureExchangeRatesData(data);
  const idx = data.exchangeRates.findIndex(r => r.id === id);
  if (idx >= 0) {
    data.exchangeRates[idx] = { ...data.exchangeRates[idx], ...record };
  } else {
    data.exchangeRates.push(record);
  }
  saveSeedData(data);
  return normalizeLocalExchangeRate(record);
}

module.exports = {
  ensureExchangeRatesData,
  listExchangeRates,
  getLatestExchangeRate,
  convertCurrency,
  upsertExchangeRate,
};
