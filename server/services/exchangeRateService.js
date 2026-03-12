const supportedCurrencies = ["EUR", "RSD", "KM", "ALL", "RMB"];

// V1 固定汇率配置：表示 1 欧元对应多少目标币种。
const exchangeRates = {
  EUR: 1,
  RSD: 117,
  KM: 1.95583,
  ALL: 99,
  RMB: 7.8,
};

const currencyAliases = {
  CNY: "RMB",
};

function normalizeCurrency(value) {
  const raw = String(value || "EUR").trim().toUpperCase();
  return currencyAliases[raw] || raw;
}

function assertSupportedCurrency(value, fieldName) {
  const currency = normalizeCurrency(value);
  if (!supportedCurrencies.includes(currency)) {
    throw new Error(`${fieldName}不在支持范围内。`);
  }
  return currency;
}

function getExchangeRate(currency) {
  const normalized = assertSupportedCurrency(currency, "币种");
  return exchangeRates[normalized];
}

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function convertCurrency(amount, fromCurrency, toCurrency) {
  const source = assertSupportedCurrency(fromCurrency, "原币种");
  const target = assertSupportedCurrency(toCurrency, "目标币种");
  const numericAmount = Number(amount || 0);
  if (numericAmount === 0 || source === target) {
    return roundToTwo(numericAmount);
  }

  const amountInEur = numericAmount / getExchangeRate(source);
  const converted = amountInEur * getExchangeRate(target);
  return roundToTwo(converted);
}

module.exports = {
  assertSupportedCurrency,
  convertCurrency,
  currencyAliases,
  exchangeRates,
  normalizeCurrency,
  roundToTwo,
  supportedCurrencies,
};
