const {
  assertSupportedCurrency,
  convertCurrency,
  exchangeRates,
  normalizeCurrency,
  roundToTwo,
} = require("./exchangeRateService");

const supportedQuoteItemTypes = [
  "hotel",
  "vehicle",
  "guide",
  "interpreter",
  "dining",
  "tickets",
  "meeting",
  "parking",
  "misc",
];

function normalizeQuoteDates(quote) {
  const startDate = String(quote.startDate || quote.tripDate || "").slice(0, 10);
  const fallbackDays = Math.max(Number(quote.travelDays || 1), 1);
  const endDate = quote.endDate
    ? String(quote.endDate).slice(0, 10)
    : addDays(startDate, fallbackDays - 1);
  const travelDays = calculateInclusiveDays(startDate, endDate);

  return {
    startDate,
    endDate,
    tripDate: startDate,
    travelDays,
  };
}

function addDays(dateValue, days) {
  const date = new Date(dateValue);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function calculateInclusiveDays(startDate, endDate) {
  if (!startDate || !endDate) {
    return 1;
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const diff = end.getTime() - start.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(days, 1);
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return fallback;
}

function calculateMealCounts(detail) {
  const mealPeople = Math.max(Number(detail.mealPeople || 0), 0);
  const tripDays = Math.max(Number(detail.tripDays || 0), 0);
  const includeLunch = toBoolean(detail.includeLunch, true);
  const includeDinner = toBoolean(detail.includeDinner, true);
  const lunchPrice = Math.max(Number(detail.lunchPrice || 0), 0);
  const dinnerPrice = Math.max(Number(detail.dinnerPrice || 0), 0);
  const firstDayLunch = toBoolean(detail.firstDayLunch, true);
  const firstDayDinner = toBoolean(detail.firstDayDinner, true);
  const lastDayLunch = toBoolean(detail.lastDayLunch, true);
  const lastDayDinner = toBoolean(detail.lastDayDinner, true);

  let lunchCount = 0;
  if (includeLunch) {
    lunchCount = tripDays;
    if (!firstDayLunch) {
      lunchCount -= 1;
    }
    if (!lastDayLunch) {
      lunchCount -= 1;
    }
    lunchCount = Math.max(lunchCount, 0);
  }

  let dinnerCount = 0;
  if (includeDinner) {
    dinnerCount = tripDays;
    if (!firstDayDinner) {
      dinnerCount -= 1;
    }
    if (!lastDayDinner) {
      dinnerCount -= 1;
    }
    dinnerCount = Math.max(dinnerCount, 0);
  }

  const lunchTotal = roundToTwo(mealPeople * lunchCount * lunchPrice);
  const dinnerTotal = roundToTwo(mealPeople * dinnerCount * dinnerPrice);
  const totalAmount = roundToTwo(lunchTotal + dinnerTotal);

  return {
    mealPeople,
    tripDays,
    includeLunch,
    lunchPrice,
    includeDinner,
    dinnerPrice,
    firstDayLunch,
    firstDayDinner,
    lastDayLunch,
    lastDayDinner,
    lunchCount,
    dinnerCount,
    lunchTotal,
    dinnerTotal,
    totalAmount,
  };
}

function normalizeHotelDetails(hotelDetails, baseCurrency) {
  return (hotelDetails || []).map((detail) => {
    const roomCount = Number(detail.roomCount || 0);
    const nights = Number(detail.nights || 0);
    const costNightlyRate = Number(detail.costNightlyRate ?? detail.nightlyRate ?? 0);
    const priceNightlyRate = Number(detail.priceNightlyRate ?? detail.nightlyRate ?? 0);
    const currency = normalizeCurrency(detail.currency || baseCurrency);
    const costNightlyRateConverted = convertCurrency(costNightlyRate, currency, baseCurrency);
    const priceNightlyRateConverted = convertCurrency(priceNightlyRate, currency, baseCurrency);
    const costSubtotalOriginal = roundToTwo(roomCount * nights * costNightlyRate);
    const priceSubtotalOriginal = roundToTwo(roomCount * nights * priceNightlyRate);
    const costSubtotal = roundToTwo(roomCount * nights * costNightlyRateConverted);
    const priceSubtotal = roundToTwo(roomCount * nights * priceNightlyRateConverted);

    return {
      ...detail,
      currency,
      roomCount,
      nights,
      costNightlyRate,
      priceNightlyRate,
      costNightlyRateConverted,
      priceNightlyRateConverted,
      costSubtotalOriginal,
      priceSubtotalOriginal,
      costSubtotal,
      priceSubtotal,
      convertedCurrency: baseCurrency,
    };
  });
}

function normalizeVehicleDetails(vehicleDetails, baseCurrency) {
  return (vehicleDetails || []).map((detail) => {
    const vehicleCount = Number(detail.vehicleCount || 0);
    const billingQuantity = Number(detail.billingQuantity || 1);
    const costUnitPrice = Number(detail.costUnitPrice || 0);
    const priceUnitPrice = Number(detail.priceUnitPrice || 0);
    const currency = normalizeCurrency(detail.currency || baseCurrency);
    const costUnitPriceConverted = convertCurrency(costUnitPrice, currency, baseCurrency);
    const priceUnitPriceConverted = convertCurrency(priceUnitPrice, currency, baseCurrency);
    const costSubtotalOriginal = roundToTwo(vehicleCount * billingQuantity * costUnitPrice);
    const priceSubtotalOriginal = roundToTwo(vehicleCount * billingQuantity * priceUnitPrice);
    const costSubtotal = roundToTwo(vehicleCount * billingQuantity * costUnitPriceConverted);
    const priceSubtotal = roundToTwo(vehicleCount * billingQuantity * priceUnitPriceConverted);

    return {
      ...detail,
      currency,
      vehicleCount,
      billingQuantity,
      costUnitPrice,
      priceUnitPrice,
      costUnitPriceConverted,
      priceUnitPriceConverted,
      costSubtotalOriginal,
      priceSubtotalOriginal,
      costSubtotal,
      priceSubtotal,
      convertedCurrency: baseCurrency,
    };
  });
}

function normalizeServiceDetails(serviceDetails, baseCurrency) {
  return (serviceDetails || []).map((detail) => {
    const quantity = Number(detail.quantity || 0);
    const costUnitPrice = Number(detail.costUnitPrice || 0);
    const priceUnitPrice = Number(detail.priceUnitPrice || 0);
    const currency = normalizeCurrency(detail.currency || baseCurrency);
    const costUnitPriceConverted = convertCurrency(costUnitPrice, currency, baseCurrency);
    const priceUnitPriceConverted = convertCurrency(priceUnitPrice, currency, baseCurrency);
    const costSubtotalOriginal = roundToTwo(quantity * costUnitPrice);
    const priceSubtotalOriginal = roundToTwo(quantity * priceUnitPrice);
    const costSubtotal = roundToTwo(quantity * costUnitPriceConverted);
    const priceSubtotal = roundToTwo(quantity * priceUnitPriceConverted);

    return {
      ...detail,
      currency,
      quantity,
      costUnitPrice,
      priceUnitPrice,
      costUnitPriceConverted,
      priceUnitPriceConverted,
      costSubtotalOriginal,
      priceSubtotalOriginal,
      costSubtotal,
      priceSubtotal,
      convertedCurrency: baseCurrency,
    };
  });
}

function normalizeMealDetails(mealDetails, itemCurrency, baseCurrency) {
  if (!mealDetails || typeof mealDetails !== "object") {
    return null;
  }

  const currency = normalizeCurrency(mealDetails.currency || itemCurrency || baseCurrency);
  const normalized = calculateMealCounts(mealDetails);
  const lunchTotal = convertCurrency(normalized.lunchTotal, currency, baseCurrency);
  const dinnerTotal = convertCurrency(normalized.dinnerTotal, currency, baseCurrency);
  const totalAmount = convertCurrency(normalized.totalAmount, currency, baseCurrency);

  return {
    ...mealDetails,
    ...normalized,
    currency,
    lunchTotalOriginal: normalized.lunchTotal,
    dinnerTotalOriginal: normalized.dinnerTotal,
    totalAmountOriginal: normalized.totalAmount,
    lunchTotal: roundToTwo(lunchTotal),
    dinnerTotal: roundToTwo(dinnerTotal),
    totalAmount: roundToTwo(totalAmount),
    convertedCurrency: baseCurrency,
  };
}

function calculateQuoteTotals(items, baseCurrency = "EUR") {
  const normalizedBaseCurrency = assertSupportedCurrency(baseCurrency, "报价币种");
  const normalizedItems = (items || []).map((item) => {
    const quantity = Number(item.quantity || 0);
    const cost = Number(item.cost || 0);
    const price = Number(item.price || 0);
    const itemCurrency = normalizeCurrency(item.currency || normalizedBaseCurrency);
    const hotelDetails = item.type === "hotel" ? normalizeHotelDetails(item.hotelDetails, normalizedBaseCurrency) : [];
    const vehicleDetails = item.type === "vehicle" ? normalizeVehicleDetails(item.vehicleDetails, normalizedBaseCurrency) : [];
    const serviceDetails = ["guide", "interpreter"].includes(item.type) ? normalizeServiceDetails(item.serviceDetails, normalizedBaseCurrency) : [];
    const mealDetails = item.type === "dining" ? normalizeMealDetails(item.mealDetails, itemCurrency, normalizedBaseCurrency) : null;

    if (hotelDetails.length > 0) {
      const hotelTotalCost = roundToTwo(hotelDetails.reduce((sum, detail) => sum + detail.costSubtotal, 0));
      const hotelTotalPrice = roundToTwo(hotelDetails.reduce((sum, detail) => sum + detail.priceSubtotal, 0));
      const hotelOriginalCost = roundToTwo(hotelDetails.reduce((sum, detail) => sum + detail.costSubtotalOriginal, 0));
      const hotelOriginalPrice = roundToTwo(hotelDetails.reduce((sum, detail) => sum + detail.priceSubtotalOriginal, 0));
      return {
        ...item,
        currency: normalizedBaseCurrency,
        quantity: 1,
        unit: item.unit || "酒店",
        cost: hotelTotalCost,
        price: hotelTotalPrice,
        convertedCost: hotelTotalCost,
        convertedPrice: hotelTotalPrice,
        totalCostOriginal: hotelOriginalCost,
        totalPriceOriginal: hotelOriginalPrice,
        totalCost: hotelTotalCost,
        totalPrice: hotelTotalPrice,
        convertedCurrency: normalizedBaseCurrency,
        hotelDetails,
        vehicleDetails: [],
        serviceDetails: [],
        mealDetails: null,
      };
    }

    if (vehicleDetails.length > 0) {
      const vehicleTotalCost = roundToTwo(vehicleDetails.reduce((sum, detail) => sum + detail.costSubtotal, 0));
      const vehicleTotalPrice = roundToTwo(vehicleDetails.reduce((sum, detail) => sum + detail.priceSubtotal, 0));
      const vehicleOriginalCost = roundToTwo(vehicleDetails.reduce((sum, detail) => sum + detail.costSubtotalOriginal, 0));
      const vehicleOriginalPrice = roundToTwo(vehicleDetails.reduce((sum, detail) => sum + detail.priceSubtotalOriginal, 0));
      return {
        ...item,
        currency: normalizedBaseCurrency,
        quantity: 1,
        unit: item.unit || "用车",
        cost: vehicleTotalCost,
        price: vehicleTotalPrice,
        convertedCost: vehicleTotalCost,
        convertedPrice: vehicleTotalPrice,
        totalCostOriginal: vehicleOriginalCost,
        totalPriceOriginal: vehicleOriginalPrice,
        totalCost: vehicleTotalCost,
        totalPrice: vehicleTotalPrice,
        convertedCurrency: normalizedBaseCurrency,
        hotelDetails: [],
        vehicleDetails,
        serviceDetails: [],
        mealDetails: null,
      };
    }

    if (serviceDetails.length > 0) {
      const serviceTotalCost = roundToTwo(serviceDetails.reduce((sum, detail) => sum + detail.costSubtotal, 0));
      const serviceTotalPrice = roundToTwo(serviceDetails.reduce((sum, detail) => sum + detail.priceSubtotal, 0));
      const serviceOriginalCost = roundToTwo(serviceDetails.reduce((sum, detail) => sum + detail.costSubtotalOriginal, 0));
      const serviceOriginalPrice = roundToTwo(serviceDetails.reduce((sum, detail) => sum + detail.priceSubtotalOriginal, 0));
      return {
        ...item,
        currency: normalizedBaseCurrency,
        quantity: 1,
        unit: item.unit || "服务",
        cost: serviceTotalCost,
        price: serviceTotalPrice,
        convertedCost: serviceTotalCost,
        convertedPrice: serviceTotalPrice,
        totalCostOriginal: serviceOriginalCost,
        totalPriceOriginal: serviceOriginalPrice,
        totalCost: serviceTotalCost,
        totalPrice: serviceTotalPrice,
        convertedCurrency: normalizedBaseCurrency,
        hotelDetails: [],
        vehicleDetails: [],
        serviceDetails,
        mealDetails: null,
      };
    }

    if (mealDetails) {
      return {
        ...item,
        currency: mealDetails.currency,
        quantity: 1,
        unit: item.unit || "用餐",
        cost: mealDetails.totalAmountOriginal,
        price: mealDetails.totalAmountOriginal,
        convertedCost: mealDetails.totalAmount,
        convertedPrice: mealDetails.totalAmount,
        totalCostOriginal: mealDetails.totalAmountOriginal,
        totalPriceOriginal: mealDetails.totalAmountOriginal,
        totalCost: mealDetails.totalAmount,
        totalPrice: mealDetails.totalAmount,
        convertedCurrency: normalizedBaseCurrency,
        hotelDetails: [],
        vehicleDetails: [],
        serviceDetails: [],
        mealDetails,
      };
    }

    const convertedCost = convertCurrency(cost, itemCurrency, normalizedBaseCurrency);
    const convertedPrice = convertCurrency(price, itemCurrency, normalizedBaseCurrency);

    return {
      ...item,
      currency: itemCurrency,
      hotelDetails,
      vehicleDetails,
      serviceDetails,
      mealDetails: null,
      quantity,
      cost,
      price,
      convertedCost,
      convertedPrice,
      totalCostOriginal: roundToTwo(cost * quantity),
      totalPriceOriginal: roundToTwo(price * quantity),
      totalCost: roundToTwo(convertedCost * quantity),
      totalPrice: roundToTwo(convertedPrice * quantity),
      convertedCurrency: normalizedBaseCurrency,
    };
  });

  const totalCost = roundToTwo(normalizedItems.reduce((sum, item) => sum + item.totalCost, 0));
  const totalPrice = roundToTwo(normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0));
  const grossProfit = roundToTwo(totalPrice - totalCost);
  const grossMargin = totalPrice === 0 ? 0 : roundToTwo((grossProfit / totalPrice) * 100);

  return {
    baseCurrency: normalizedBaseCurrency,
    exchangeRates,
    items: normalizedItems,
    totalCost,
    totalPrice,
    grossProfit,
    grossMargin,
  };
}

function summarizeQuoteItems(items) {
  return supportedQuoteItemTypes.reduce((summary, type) => {
    summary[type] = items
      .filter((item) => item.type === type)
      .reduce((sum, item) => sum + item.totalPrice, 0);
    return summary;
  }, {});
}

function enrichQuote(quote) {
  const normalizedCurrency = normalizeCurrency(quote.currency || "EUR");
  const dateFields = normalizeQuoteDates(quote);

  // project_based 模式：用存储的汇总值，不再从 items 计算
  if (quote.pricingMode === "project_based") {
    const totalCost = Number(quote.totalCost || 0);
    const totalPrice = Number(quote.totalSales || 0);
    const grossProfit = roundToTwo(totalPrice - totalCost);
    const grossMargin = totalPrice === 0 ? 0 : roundToTwo((grossProfit / totalPrice) * 100);
    return {
      ...quote,
      currency: normalizedCurrency,
      ...dateFields,
      totalCost,
      totalPrice,
      totalSales: totalPrice,
      grossProfit,
      grossMargin,
      baseCurrency: normalizedCurrency,
      exchangeRates,
      items: [],
      itemSummary: {},
      projectGroups: quote.projectGroups || [],
    };
  }

  const totals = calculateQuoteTotals(quote.items || [], normalizedCurrency);

  return {
    ...quote,
    currency: normalizedCurrency,
    ...dateFields,
    ...totals,
    itemSummary: summarizeQuoteItems(totals.items),
  };
}

module.exports = {
  addDays,
  calculateInclusiveDays,
  calculateQuoteTotals,
  enrichQuote,
  normalizeQuoteDates,
  roundToTwo,
  supportedQuoteItemTypes,
};
