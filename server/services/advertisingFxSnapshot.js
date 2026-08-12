"use strict";

const exchangeRateStore = require("./exchangeRateStore");

async function resolveAdvertisingFxSnapshot({
  pricingEngine,
  existingQuote = null,
  supabaseConfig = {},
  effectiveOn,
  getLatestRate,
} = {}) {
  if (pricingEngine !== "bom_v2") return null;
  if (existingQuote?.fxSnapshot?.rate) return structuredClone(existingQuote.fxSnapshot);
  const lookup = getLatestRate || ((base, quote, date) => (
    exchangeRateStore.getLatestExchangeRate(supabaseConfig, base, quote, date)
  ));
  const rate = await lookup("EUR", "RSD", effectiveOn);
  if (!rate || !(Number(rate.rate) > 0)) {
    throw Object.assign(new Error("未找到 EUR/RSD 汇率。"), {
      statusCode: 422,
      code: "NO_EXCHANGE_RATE",
    });
  }
  return {
    baseCurrency: "EUR",
    quoteCurrency: "RSD",
    rate: Number(rate.rate),
    rateDate: rate.rateDate,
    source: rate.source,
  };
}

module.exports = { resolveAdvertisingFxSnapshot };
