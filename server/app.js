const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { loadSeedData, saveSeedData } = require('./dataStore');
const { getSupabaseConfig } = require('./supabaseConfig');
const {
  addDays,
  calculateInclusiveDays,
  calculateQuoteTotals,
  enrichQuote,
  supportedQuoteItemTypes,
} = require("./services/quoteService");
const { buildDocumentPreviews, supportedDocumentPreviewTypes } = require("./services/documentPreviewService");
const {
  assertSupportedCurrency,
  exchangeRates,
  normalizeCurrency,
  supportedCurrencies,
} = require("./services/exchangeRateService");
const { defaultQuoteTemplates } = require("./services/templateService");
const { createTemplateStore } = require("./services/templateStore");

const publicDir = path.join(process.cwd(), "web");
const supportedLanguages = ["zh-CN", "en", "sr"];
const supportedReceptionStatuses = ["pending", "in_progress", "done"];
const supportedReceptionTaskTypes = ["airport_pickup", "hotel_checkin", "vehicle_service", "guide_support", "business_meeting", "document_delivery", "misc"];
const supportedProjectStatuses = ["planning", "confirmed", "running", "completed"];
const supportedVehicleDetailTypes = ["pickup", "dropoff", "full_day"];
const supportedVehiclePricingUnits = ["trip", "full_day"];
const supportedServiceRoles = ["guide", "interpreter"];
const supportedServiceLanguages = ["zh", "zh-sr", "zh-en"];
const supportedServiceDurations = ["full_day", "hour"];

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function sendFile(response, filePath) {
  if (!fs.existsSync(filePath)) {
    sendJson(response, 404, { error: "Ò³ï¿½æ²»ï¿½ï¿½ï¿½Ú¡ï¿½" });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentTypeMap = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  };

  response.writeHead(200, { "Content-Type": contentTypeMap[ext] || "text/plain; charset=utf-8" });
  fs.createReadStream(filePath).pipe(response);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function parseJsonBody(rawBody) {
  return rawBody ? JSON.parse(rawBody) : {};
}

function notEmpty(value, fieldName) {
  if (!value || String(value).trim() === "") {
    throw new Error(`ï¿½ï¿½ï¿½ï¿½Ð´${fieldName}ï¿½ï¿½`);
  }
  return String(value).trim();
}

function assertOneOf(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    throw new Error(`${fieldName}ï¿½ï¿½ï¿½ï¿½Ö§ï¿½Ö·ï¿½Î§ï¿½Ú¡ï¿½`);
  }
  return value;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}`;
}

function generateQuoteNumber() {
  return `QT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Date.now()).slice(-4)}`;
}

function formatDate(dateValue) {
  return String(dateValue || "").slice(0, 10);
}

function ensureTemplateData(data) {
  if (!Array.isArray(data.templates)) {
    data.templates = defaultQuoteTemplates.map((template) => ({ ...template }));
  }
  return data.templates;
}

function getDashboard(data) {
  const quotes = data.quotes.map(enrichQuote);
  const totalRevenue = quotes.reduce((sum, quote) => sum + quote.totalPrice, 0);
  const totalCost = quotes.reduce((sum, quote) => sum + quote.totalCost, 0);
  const totalGrossProfit = quotes.reduce((sum, quote) => sum + quote.grossProfit, 0);

  return {
    project: "ï¿½ï¿½ï¿½É¹ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ÓªÏµÍ³ V1.0",
    uiLanguage: "zh-CN",
    supportedOutputLanguages: supportedLanguages,
    defaultCurrency: "EUR",
    metrics: {
      quoteCount: quotes.length,
      receptionTaskCount: data.receptions.length,
      documentCount: data.documents.length,
      templateCount: ensureTemplateData(data).length,
      totalRevenue,
      totalCost,
      totalGrossProfit,
    },
  };
}

function normalizeHotelDetails(hotelDetails, index, baseCurrency) {
  if (!Array.isArray(hotelDetails) || hotelDetails.length === 0) {
    throw new Error(`ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½Æµï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Â¼ï¿½ï¿½Ò»ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½ï¿½`);
  }

  return hotelDetails.map((detail, detailIndex) => {
    const roomCount = Number(detail.roomCount || 0);
    const nights = Number(detail.nights || 0);
    const costNightlyRate = Number(detail.costNightlyRate ?? detail.nightlyRate ?? 0);
    const priceNightlyRate = Number(detail.priceNightlyRate ?? detail.nightlyRate ?? 0);
    const currency = assertSupportedCurrency(detail.currency || baseCurrency, `ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½Æµï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½Ä±ï¿½ï¿½ï¿½`);

    if (!detail.roomType || String(detail.roomType).trim() === "") {
      throw new Error(`ï¿½ï¿½ï¿½ï¿½Ð´ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½Æµï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½Ä·ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Æ¡ï¿½`);
    }
    if (roomCount <= 0 || nights <= 0) {
      throw new Error(`ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½Æµï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½Ä·ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿?0ï¿½ï¿½`);
    }
    if (costNightlyRate < 0 || priceNightlyRate < 0) {
      throw new Error(`ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½Æµï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½ï¿½Ã¿ï¿½ï¿½ï¿½É±ï¿½ï¿½ï¿½ï¿½Ûºï¿½ï¿½ï¿½ï¿½Ûµï¿½ï¿½Û²ï¿½ï¿½ï¿½Îªï¿½ï¿½ï¿½ï¿½ï¿½ï¿½`);
    }

    return {
      roomType: String(detail.roomType).trim(),
      roomCount,
      nights,
      costNightlyRate,
      priceNightlyRate,
      currency,
      notes: String(detail.notes || "").trim(),
    };
  });
}

function normalizeVehicleDetails(vehicleDetails, index, baseCurrency) {
  if (!Array.isArray(vehicleDetails) || vehicleDetails.length === 0) {
    throw new Error(`ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½Ã³ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Â¼ï¿½ï¿½Ò»ï¿½ï¿½ï¿½Ã³ï¿½ï¿½ï¿½Ï¸ï¿½ï¿½`);
  }

  return vehicleDetails.map((detail, detailIndex) => {
    const vehicleCount = Number(detail.vehicleCount || 0);
    const costUnitPrice = Number(detail.costUnitPrice || 0);
    const priceUnitPrice = Number(detail.priceUnitPrice || 0);
    const detailType = assertOneOf(detail.detailType || "pickup", supportedVehicleDetailTypes, `ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½Ã³ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½ï¿½ï¿½Ã³ï¿½ï¿½ï¿½ï¿½ï¿½`);
    const pricingUnit = assertOneOf(detail.pricingUnit || "trip", supportedVehiclePricingUnits, `ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½Ã³ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½Ä¼Æ¼Ûµï¿½Î»`);
    const currency = assertSupportedCurrency(detail.currency || baseCurrency, `ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½Ã³ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½Ä±ï¿½ï¿½ï¿½`);

    if (!detail.vehicleModel || String(detail.vehicleModel).trim() === "") {
      throw new Error(`ï¿½ï¿½ï¿½ï¿½Ð´ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½Ã³ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½Ä³ï¿½ï¿½Í¡ï¿½`);
    }
    if (vehicleCount <= 0) {
      throw new Error(`ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½Ã³ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½Ä³ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿?0ï¿½ï¿½`);
    }
    if (costUnitPrice < 0 || priceUnitPrice < 0) {
      throw new Error(`ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½Ã³ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½Ä³É±ï¿½ï¿½ï¿½ï¿½Ûºï¿½ï¿½ï¿½ï¿½Ûµï¿½ï¿½Û²ï¿½ï¿½ï¿½Îªï¿½ï¿½ï¿½ï¿½ï¿½ï¿½`);
    }

    return {
      detailType,
      vehicleModel: String(detail.vehicleModel).trim(),
      vehicleCount,
      pricingUnit,
      costUnitPrice,
      priceUnitPrice,
      currency,
      notes: String(detail.notes || "").trim(),
    };
  });
}
function normalizeServiceDetails(serviceDetails, index, baseCurrency) {
  if (!Array.isArray(serviceDetails) || serviceDetails.length === 0) {
    throw new Error(`ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½/ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Â¼ï¿½ï¿½Ò»ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½ï¿½`);
  }

  return serviceDetails.map((detail, detailIndex) => {
    const quantity = Number(detail.quantity || 0);
    const costUnitPrice = Number(detail.costUnitPrice || 0);
    const priceUnitPrice = Number(detail.priceUnitPrice || 0);
    const serviceRole = assertOneOf(detail.serviceRole || "guide", supportedServiceRoles, `ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½/ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½Ä·ï¿½ï¿½ï¿½ï¿½É«`);
    const serviceLanguage = assertOneOf(detail.serviceLanguage || "zh", supportedServiceLanguages, `ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½/ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½`);
    const serviceDuration = assertOneOf(detail.serviceDuration || "full_day", supportedServiceDurations, `ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½/ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½Ä·ï¿½ï¿½ï¿½Ê±ï¿½ï¿½`);
    const currency = assertSupportedCurrency(detail.currency || baseCurrency, `ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½/ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½Ä±ï¿½ï¿½ï¿½`);

    if (quantity <= 0) {
      throw new Error(`ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½/ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿?0ï¿½ï¿½`);
    }
    if (costUnitPrice < 0 || priceUnitPrice < 0) {
      throw new Error(`ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½/ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ ${detailIndex + 1} ï¿½ï¿½ï¿½ï¿½Ï¸ï¿½Ä³É±ï¿½ï¿½ï¿½ï¿½Ûºï¿½ï¿½ï¿½ï¿½Ûµï¿½ï¿½Û²ï¿½ï¿½ï¿½Îªï¿½ï¿½ï¿½ï¿½ï¿½ï¿½`);
    }

    return {
      serviceRole,
      serviceLanguage,
      serviceDuration,
      quantity,
      costUnitPrice,
      priceUnitPrice,
      currency,
      notes: String(detail.notes || "").trim(),
    };
  });
}

function normalizeQuoteItems(items, baseCurrency) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Â¼ï¿½ï¿½Ò»ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½");
  }

  return items.map((item, index) => {
    const itemType = assertOneOf(item.type, supportedQuoteItemTypes, `ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½Ä·ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½`);
    const hasHotelDetails = itemType === "hotel" && Array.isArray(item.hotelDetails) && item.hotelDetails.length > 0;
    const hasVehicleDetails = itemType === "vehicle" && Array.isArray(item.vehicleDetails) && item.vehicleDetails.length > 0;
    const hasServiceDetails = ["guide", "interpreter"].includes(itemType) && Array.isArray(item.serviceDetails) && item.serviceDetails.length > 0;
    const hotelDetails = hasHotelDetails ? normalizeHotelDetails(item.hotelDetails, index, baseCurrency) : [];
    const vehicleDetails = hasVehicleDetails ? normalizeVehicleDetails(item.vehicleDetails, index, baseCurrency) : [];
    const serviceDetails = hasServiceDetails ? normalizeServiceDetails(item.serviceDetails, index, baseCurrency) : [];
    const quantity = hasHotelDetails || hasVehicleDetails || hasServiceDetails ? 1 : Number(item.quantity || 0);
    const cost = hasHotelDetails || hasVehicleDetails || hasServiceDetails ? 0 : Number(item.cost || 0);
    const price = hasHotelDetails || hasVehicleDetails || hasServiceDetails ? 0 : Number(item.price || 0);
    const currency = assertSupportedCurrency(item.currency || baseCurrency, `ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½Ä±ï¿½ï¿½ï¿½`);

    if (!hasHotelDetails && !hasVehicleDetails && !hasServiceDetails) {
      if (quantity <= 0) {
        throw new Error(`ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿?0ï¿½ï¿½`);
      }
      if (cost < 0 || price < 0) {
        throw new Error(`ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½Ä½ï¿½î²»ï¿½ï¿½Îªï¿½ï¿½ï¿½ï¿½ï¿½ï¿½`);
      }
    }

    return {
      type: itemType,
      name: notEmpty(item.name, `ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½Ä·ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½`),
      unit: hasHotelDetails ? "ï¿½Æµï¿½" : hasVehicleDetails ? "ï¿½Ã³ï¿½" : notEmpty(item.unit || "ï¿½ï¿½", `ï¿½ï¿½ ${index + 1} ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½Äµï¿½Î»`),
      supplier: String(item.supplier || "").trim(),
      currency,
      cost,
      price,
      quantity,
      notes: String(item.notes || "").trim(),
      hotelDetails,
      vehicleDetails,
      serviceDetails,
    };
  });
}

function normalizeQuotePayload(payload, existingId) {
  const currency = assertSupportedCurrency(payload.currency || "EUR", "±¨¼Û±ÒÖÖ");
  const language = assertOneOf(payload.language || "zh-CN", supportedLanguages, "ÎÄµµÊä³öÓïÑÔ");
  const startDate = formatDate(notEmpty(payload.startDate || payload.tripDate, "ÐÐ³Ì¿ªÊ¼ÈÕÆÚ"));
  const endDate = formatDate(notEmpty(payload.endDate || payload.tripDate, "ÐÐ³Ì½áÊøÈÕÆÚ"));

  if (endDate < startDate) {
    throw new Error("ÐÐ³Ì½áÊøÈÕÆÚ²»ÄÜÔçÓÚÐÐ³Ì¿ªÊ¼ÈÕÆÚ¡£");
  }

  return {
    id: existingId || payload.id || createId("Q"),
    quoteNumber: payload.quoteNumber ? String(payload.quoteNumber).trim() : generateQuoteNumber(),
    projectId: payload.projectId ? String(payload.projectId).trim() : "",
    clientName: notEmpty(payload.clientName, "¿Í»§Ãû³Æ"),
    projectName: notEmpty(payload.projectName, "ÏîÄ¿Ãû³Æ"),
    contactName: notEmpty(payload.contactName, "ÁªÏµÈËÐÕÃû"),
    contactPhone: String(payload.contactPhone || "").trim(),
    language,
    currency,
    startDate,
    endDate,
    tripDate: startDate,
    travelDays: calculateInclusiveDays(startDate, endDate),
    destination: notEmpty(payload.destination || "Belgrade", "Ö÷ÒªÄ¿µÄµØ"),
    paxCount: Number(payload.paxCount || 0),
    notes: String(payload.notes || "").trim(),
    items: normalizeQuoteItems(payload.items, currency),
  };
}

function normalizeTemplateItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("Ä£ï¿½å±¨ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½Ê½ï¿½ï¿½ï¿½ï¿½È·ï¿½ï¿½");
  }

  return items.map((item, index) => ({
    type: assertOneOf(item.type, supportedQuoteItemTypes, `ï¿½ï¿½ ${index + 1} ï¿½ï¿½Ä£ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½Ä·ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½`),
    name: notEmpty(item.name, `ï¿½ï¿½ ${index + 1} ï¿½ï¿½Ä£ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½ï¿½Ä¬ï¿½Ï·ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½`),
    unit: notEmpty(item.unit || "ï¿½ï¿½", `ï¿½ï¿½ ${index + 1} ï¿½ï¿½Ä£ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½Äµï¿½Î»`),
    currency: assertSupportedCurrency(item.currency || "EUR", `ï¿½ï¿½ ${index + 1} ï¿½ï¿½Ä£ï¿½ï¿½ï¿½ï¿½Ä¿ï¿½Ä±ï¿½ï¿½ï¿½`),
    quantity: Math.max(Number(item.quantity || 1), 1),
    notes: String(item.notes || "").trim(),
  }));
}

function normalizeTemplatePayload(payload, existingTemplate) {
  return {
    id: existingTemplate?.id || payload.id || createId("TPL"),
    name: notEmpty(payload.name, "Ä£ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½"),
    description: String(payload.description || "").trim(),
    isBuiltIn: Boolean(existingTemplate?.isBuiltIn),
    items: normalizeTemplateItems(payload.items || []),
  };
}

function normalizeReceptionPayload(payload, existingId) {
  return {
    id: existingId || payload.id || createId("R"),
    projectId: payload.projectId ? String(payload.projectId).trim() : "",
    taskType: assertOneOf(payload.taskType || "airport_pickup", supportedReceptionTaskTypes, "ÈÎÎñÀàÐÍ"),
    title: notEmpty(payload.title, "ÈÎÎñ±êÌâ"),
    assignee: notEmpty(payload.assignee, "¸ºÔðÈË"),
    dueTime: notEmpty(payload.dueTime, "½ØÖ¹Ê±¼ä"),
    status: assertOneOf(payload.status || "pending", supportedReceptionStatuses, "ÈÎÎñ×´Ì¬"),
    location: notEmpty(payload.location, "µØµã"),
    notes: String(payload.notes || "").trim(),
  };
}

function normalizeDocumentPayload(payload, existingId) {
  return {
    id: existingId || payload.id || createId("D"),
    title: notEmpty(payload.title, "ÎÄµµ±êÌâ"),
    category: notEmpty(payload.category, "ÎÄµµ·ÖÀà"),
    language: assertOneOf(payload.language || "zh-CN", supportedLanguages, "ÎÄµµÓïÑÔ"),
    updatedAt: notEmpty(payload.updatedAt, "¸üÐÂÊ±¼ä"),
  };
}

function upsertById(list, id, item) {
  const index = list.findIndex((entry) => entry.id === id);
  if (index === -1) {
    list.unshift(item);
  } else {
    list[index] = item;
  }
}

function removeById(list, id) {
  const index = list.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return false;
  }
  list.splice(index, 1);
  return true;
}

function matchIdRoute(pathname, collection) {
  const match = pathname.match(new RegExp(`^/api/${collection}/([^/]+)$`));
  return match ? decodeURIComponent(match[1]) : null;
}

function findById(list, id, label) {
  const item = list.find((entry) => entry.id === id);
  if (!item) {
    throw new Error(`${label}ï¿½ï¿½ï¿½ï¿½ï¿½Ú¡ï¿½`);
  }
  return item;
}

function deriveProjectStatus(quote, linkedReceptions) {
  if (linkedReceptions.some((item) => item.status === "in_progress")) {
    return "running";
  }
  if (linkedReceptions.length > 0 && linkedReceptions.every((item) => item.status === "done")) {
    return "completed";
  }
  if (linkedReceptions.length > 0) {
    return "confirmed";
  }
  return quote.startDate < new Date().toISOString().slice(0, 10) ? "completed" : "planning";
}

function deriveProjects(data) {
  const quotes = data.quotes.map(enrichQuote);
  return quotes.map((quote) => {
    const startDate = formatDate(quote.startDate || quote.tripDate);
    const endDate = formatDate(quote.endDate || addDays(startDate, Math.max(quote.travelDays - 1, 0)));
    const linkedReceptions = data.receptions.filter((item) => {
      const dueDate = formatDate(item.dueTime);
      const matchProjectId = quote.projectId && item.projectId && quote.projectId === item.projectId;
      const matchDateRange = dueDate >= startDate && dueDate <= endDate;
      return matchProjectId || matchDateRange;
    });

    return {
      id: quote.projectId || quote.id,
      projectName: quote.projectName,
      client: quote.clientName,
      dateRange: `${startDate} ~ ${endDate}`,
      startDate,
      endDate,
      paxCount: quote.paxCount || quote.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      status: deriveProjectStatus(quote, linkedReceptions),
      specialRequirements: quote.notes || "ï¿½ï¿½",
      linkedQuoteIds: [quote.id],
      linkedReceptionIds: linkedReceptions.map((item) => item.id),
      linkedDocumentPreviewTypes: supportedDocumentPreviewTypes,
    };
  });
}

function getProjectDetail(data, projectId) {
  const projects = deriveProjects(data);
  const project = findById(projects, projectId, "ï¿½ï¿½Ä¿ï¿½ï¿½ï¿½ï¿½");
  const linkedQuotes = data.quotes.map(enrichQuote).filter((item) => project.linkedQuoteIds.includes(item.id));
  const linkedReceptions = data.receptions.filter((item) => project.linkedReceptionIds.includes(item.id));
  const primaryQuote = linkedQuotes[0] || null;
  const primaryReception = linkedReceptions[0] || null;

  return {
    ...project,
    linkedQuotes,
    linkedReceptions,
    linkedDocumentPreviews: primaryQuote ? buildDocumentPreviews({ quote: primaryQuote, reception: primaryReception }) : [],
  };
}

function getMetaPayload(data) {
  const supabase = getSupabaseConfig();

  return {
    supportedLanguages,
    supportedCurrencies,
    supportedQuoteItemTypes,
    supportedReceptionStatuses,
    supportedReceptionTaskTypes,
    supportedDocumentPreviewTypes,
    supportedProjectStatuses,
    exchangeRates,
    nextQuoteNumber: generateQuoteNumber(),
    defaultQuoteCurrency: "EUR",
    defaultItemCurrency: "EUR",
    templateCount: ensureTemplateData(data).length,
    storageMode: "local_json",
    supabase: {
      enabled: supabase.enabled,
      urlConfigured: Boolean(supabase.url),
      publishableKeyConfigured: Boolean(supabase.publishableKey),
      anonKeyConfigured: Boolean(supabase.anonKey),
      serviceRoleKeyConfigured: supabase.hasServiceRoleKey,
    },
  };
}
async function handleApi(request, response, url) {
  const data = loadSeedData();
  const templateStore = createTemplateStore({ data, saveData: saveSeedData });
  const templateResult = await templateStore.listTemplates();
  const templates = templateResult.templates;

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, timestamp: new Date().toISOString() });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/meta") {
    sendJson(response, 200, getMetaPayload(data));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    sendJson(response, 200, getDashboard(data));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/templates") {
    sendJson(response, 200, templates);
    return true;
  }

  if (request.method === "GET") {
    const templateId = matchIdRoute(url.pathname, "templates");
    if (templateId) {
      try {
        const result = await templateStore.getTemplateById(templateId);
        sendJson(response, 200, result.template);
      } catch (error) {
        sendJson(response, 404, { error: error.message });
      }
      return true;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/templates") {
    const template = normalizeTemplatePayload(parseJsonBody(await readRequestBody(request)));
    const result = await templateStore.saveTemplate(template);
    sendJson(response, 201, result.template);
    return true;
  }

  if (request.method === "PUT") {
    const templateId = matchIdRoute(url.pathname, "templates");
    if (templateId) {
      const existing = templates.find((item) => item.id === templateId);
      if (!existing) {
        sendJson(response, 404, { error: "\u6a21\u677f\u4e0d\u5b58\u5728\u3002" });
        return true;
      }
      const template = normalizeTemplatePayload(parseJsonBody(await readRequestBody(request)), existing);
      const result = await templateStore.saveTemplate(template);
      sendJson(response, 200, result.template);
      return true;
    }
  }

  if (request.method === "DELETE") {
    const templateId = matchIdRoute(url.pathname, "templates");
    if (templateId) {
      const result = await templateStore.deleteTemplate(templateId);
      if (!result.deleted) {
        sendJson(response, 404, { error: "\u6a21\u677f\u4e0d\u5b58\u5728\u3002" });
        return true;
      }
      sendJson(response, 200, { message: "\u6a21\u677f\u5df2\u5220\u9664\u3002" });
      return true;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/quotes") {
    sendJson(response, 200, data.quotes.map(enrichQuote));
    return true;
  }

  if (request.method === "GET") {
    const quoteId = matchIdRoute(url.pathname, "quotes");
    if (quoteId) {
      try {
        sendJson(response, 200, enrichQuote(findById(data.quotes, quoteId, "ï¿½ï¿½ï¿½ï¿½")));
      } catch (error) {
        sendJson(response, 404, { error: error.message });
      }
      return true;
    }
  }

  if (request.method === "DELETE") {
    const quoteId = matchIdRoute(url.pathname, "quotes");
    if (quoteId) {
      if (!removeById(data.quotes, quoteId)) {
        sendJson(response, 404, { error: "ï¿½ï¿½ï¿½Û²ï¿½ï¿½ï¿½ï¿½Ú¡ï¿½" });
        return true;
      }
      saveSeedData(data);
      sendJson(response, 200, { message: "ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½É¾ï¿½ï¿½ï¿½ï¿½" });
      return true;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/receptions") {
    sendJson(response, 200, data.receptions);
    return true;
  }

  if (request.method === "GET") {
    const receptionId = matchIdRoute(url.pathname, "receptions");
    if (receptionId) {
      try {
        sendJson(response, 200, findById(data.receptions, receptionId, "ï¿½Ó´ï¿½ï¿½ï¿½ï¿½ï¿½"));
      } catch (error) {
        sendJson(response, 404, { error: error.message });
      }
      return true;
    }
  }

  if (request.method === "DELETE") {
    const receptionId = matchIdRoute(url.pathname, "receptions");
    if (receptionId) {
      if (!removeById(data.receptions, receptionId)) {
        sendJson(response, 404, { error: "ï¿½Ó´ï¿½ï¿½ï¿½ï¿½ñ²»´ï¿½ï¿½Ú¡ï¿½" });
        return true;
      }
      saveSeedData(data);
      sendJson(response, 200, { message: "ï¿½Ó´ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½É¾ï¿½ï¿½ï¿½ï¿½" });
      return true;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/documents") {
    sendJson(response, 200, data.documents);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/document-previews") {
    const quoteId = url.searchParams.get("quoteId") || (data.quotes[0] && data.quotes[0].id);
    const receptionId = url.searchParams.get("receptionId") || (data.receptions[0] && data.receptions[0].id);
    try {
      const quote = quoteId ? enrichQuote(findById(data.quotes, quoteId, "ï¿½ï¿½ï¿½ï¿½")) : null;
      const reception = receptionId ? findById(data.receptions, receptionId, "ï¿½Ó´ï¿½ï¿½ï¿½ï¿½ï¿½") : null;
      sendJson(response, 200, buildDocumentPreviews({ quote, reception }));
    } catch (error) {
      sendJson(response, 404, { error: error.message });
    }
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/projects") {
    sendJson(response, 200, deriveProjects(data));
    return true;
  }

  if (request.method === "GET") {
    const projectId = matchIdRoute(url.pathname, "projects");
    if (projectId) {
      try {
        sendJson(response, 200, getProjectDetail(data, projectId));
      } catch (error) {
        sendJson(response, 404, { error: error.message });
      }
      return true;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/quotes/calculate") {
    const payload = parseJsonBody(await readRequestBody(request));
    const baseCurrency = normalizeCurrency(payload.baseCurrency || payload.currency || "EUR");
    sendJson(response, 200, calculateQuoteTotals(payload.items || [], baseCurrency));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/quotes") {
    const quote = normalizeQuotePayload(parseJsonBody(await readRequestBody(request)));
    upsertById(data.quotes, quote.id, quote);
    saveSeedData(data);
    sendJson(response, 201, enrichQuote(quote));
    return true;
  }

  if (request.method === "PUT") {
    const quoteId = matchIdRoute(url.pathname, "quotes");
    if (quoteId) {
      const existing = data.quotes.find((item) => item.id === quoteId);
      if (!existing) {
        sendJson(response, 404, { error: "ï¿½ï¿½ï¿½Û²ï¿½ï¿½ï¿½ï¿½Ú¡ï¿½" });
        return true;
      }
      const quote = normalizeQuotePayload(parseJsonBody(await readRequestBody(request)), existing.id);
      upsertById(data.quotes, quote.id, quote);
      saveSeedData(data);
      sendJson(response, 200, enrichQuote(quote));
      return true;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/receptions") {
    const reception = normalizeReceptionPayload(parseJsonBody(await readRequestBody(request)));
    upsertById(data.receptions, reception.id, reception);
    saveSeedData(data);
    sendJson(response, 201, reception);
    return true;
  }

  if (request.method === "PUT") {
    const receptionId = matchIdRoute(url.pathname, "receptions");
    if (receptionId) {
      const existing = data.receptions.find((item) => item.id === receptionId);
      if (!existing) {
        sendJson(response, 404, { error: "ï¿½Ó´ï¿½ï¿½ï¿½ï¿½ñ²»´ï¿½ï¿½Ú¡ï¿½" });
        return true;
      }
      const reception = normalizeReceptionPayload(parseJsonBody(await readRequestBody(request)), existing.id);
      upsertById(data.receptions, reception.id, reception);
      saveSeedData(data);
      sendJson(response, 200, reception);
      return true;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/documents") {
    const document = normalizeDocumentPayload(parseJsonBody(await readRequestBody(request)));
    upsertById(data.documents, document.id, document);
    saveSeedData(data);
    sendJson(response, 201, document);
    return true;
  }

  if (request.method === "PUT") {
    const documentId = matchIdRoute(url.pathname, "documents");
    if (documentId) {
      const existing = data.documents.find((item) => item.id === documentId);
      if (!existing) {
        sendJson(response, 404, { error: "ï¿½Äµï¿½ï¿½ï¿½ï¿½ï¿½ï¿½Ú¡ï¿½" });
        return true;
      }
      const document = normalizeDocumentPayload(parseJsonBody(await readRequestBody(request)), existing.id);
      upsertById(data.documents, document.id, document);
      saveSeedData(data);
      sendJson(response, 200, document);
      return true;
    }
  }

  return false;
}

async function handleRequest(request, response) {
  const baseUrl = request.headers?.host ? `http://${request.headers.host}` : "http://localhost";
  const url = new URL(request.url, baseUrl);

  try {
    const handled = await handleApi(request, response, url);
    if (handled) {
      return;
    }

    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const safePath = path.normalize(requestedPath).replace(/^([.][.][/\\])+/, "");
    const filePath = path.join(publicDir, safePath);
    sendFile(response, filePath);
  } catch (error) {
    sendJson(response, 500, {
      error: "·þÎñÆ÷´¦ÀíÊ§°Ü£¬ÇëÉÔºóÖØÊÔ¡£",
      message: error.message,
    });
  }
}

function createServer() {
  return http.createServer(handleRequest);
}

module.exports = {
  createServer,
  generateQuoteNumber,
  handleRequest,
};

