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
    sendJson(response, 404, { error: "页面不存在。" });
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
    throw new Error(`请填写${fieldName}。`);
  }
  return String(value).trim();
}

function assertOneOf(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    throw new Error(`${fieldName}不在支持范围内。`);
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
    project: "泷鼎晟国际旅行社运营系统 V1.0",
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
    throw new Error(`第 ${index + 1} 条酒店项目请至少录入一条房型明细。`);
  }

  return hotelDetails.map((detail, detailIndex) => {
    const roomCount = Number(detail.roomCount || 0);
    const nights = Number(detail.nights || 0);
    const costNightlyRate = Number(detail.costNightlyRate ?? detail.nightlyRate ?? 0);
    const priceNightlyRate = Number(detail.priceNightlyRate ?? detail.nightlyRate ?? 0);
    const currency = assertSupportedCurrency(detail.currency || baseCurrency, `第 ${index + 1} 条酒店项目第 ${detailIndex + 1} 条房型明细的币种`);

    if (!detail.roomType || String(detail.roomType).trim() === "") {
      throw new Error(`请填写第 ${index + 1} 条酒店项目第 ${detailIndex + 1} 条房型明细的房型名称。`);
    }
    if (roomCount <= 0 || nights <= 0) {
      throw new Error(`第 ${index + 1} 条酒店项目第 ${detailIndex + 1} 条房型明细的房间数和晚数必须大于 0。`);
    }
    if (costNightlyRate < 0 || priceNightlyRate < 0) {
      throw new Error(`第 ${index + 1} 条酒店项目第 ${detailIndex + 1} 条房型明细的每晚成本单价和销售单价不能为负数。`);
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
    throw new Error(`第 ${index + 1} 条用车项目请至少录入一条用车明细。`);
  }

  return vehicleDetails.map((detail, detailIndex) => {
    const vehicleCount = Number(detail.vehicleCount || 0);
    const costUnitPrice = Number(detail.costUnitPrice || 0);
    const priceUnitPrice = Number(detail.priceUnitPrice || 0);
    const detailType = assertOneOf(detail.detailType || "pickup", supportedVehicleDetailTypes, `第 ${index + 1} 条用车项目第 ${detailIndex + 1} 条明细的用车类型`);
    const pricingUnit = assertOneOf(detail.pricingUnit || "trip", supportedVehiclePricingUnits, `第 ${index + 1} 条用车项目第 ${detailIndex + 1} 条明细的计价单位`);
    const currency = assertSupportedCurrency(detail.currency || baseCurrency, `第 ${index + 1} 条用车项目第 ${detailIndex + 1} 条明细的币种`);

    if (!detail.vehicleModel || String(detail.vehicleModel).trim() === "") {
      throw new Error(`请填写第 ${index + 1} 条用车项目第 ${detailIndex + 1} 条明细的车型。`);
    }
    if (vehicleCount <= 0) {
      throw new Error(`第 ${index + 1} 条用车项目第 ${detailIndex + 1} 条明细的车辆数必须大于 0。`);
    }
    if (costUnitPrice < 0 || priceUnitPrice < 0) {
      throw new Error(`第 ${index + 1} 条用车项目第 ${detailIndex + 1} 条明细的成本单价和销售单价不能为负数。`);
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
    throw new Error(`第 ${index + 1} 条导游/翻译项目请至少录入一条服务明细。`);
  }

  return serviceDetails.map((detail, detailIndex) => {
    const quantity = Number(detail.quantity || 0);
    const costUnitPrice = Number(detail.costUnitPrice || 0);
    const priceUnitPrice = Number(detail.priceUnitPrice || 0);
    const serviceRole = assertOneOf(detail.serviceRole || "guide", supportedServiceRoles, `第 ${index + 1} 条导游/翻译项目第 ${detailIndex + 1} 条明细的服务角色`);
    const serviceLanguage = assertOneOf(detail.serviceLanguage || "zh", supportedServiceLanguages, `第 ${index + 1} 条导游/翻译项目第 ${detailIndex + 1} 条明细的语言`);
    const serviceDuration = assertOneOf(detail.serviceDuration || "full_day", supportedServiceDurations, `第 ${index + 1} 条导游/翻译项目第 ${detailIndex + 1} 条明细的服务时长`);
    const currency = assertSupportedCurrency(detail.currency || baseCurrency, `第 ${index + 1} 条导游/翻译项目第 ${detailIndex + 1} 条明细的币种`);

    if (quantity <= 0) {
      throw new Error(`第 ${index + 1} 条导游/翻译项目第 ${detailIndex + 1} 条明细的数量必须大于 0。`);
    }
    if (costUnitPrice < 0 || priceUnitPrice < 0) {
      throw new Error(`第 ${index + 1} 条导游/翻译项目第 ${detailIndex + 1} 条明细的成本单价和销售单价不能为负数。`);
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
    throw new Error("请至少录入一条报价项目。");
  }

  return items.map((item, index) => {
    const itemType = assertOneOf(item.type, supportedQuoteItemTypes, `第 ${index + 1} 条报价项目的服务类型`);
    const hasHotelDetails = itemType === "hotel" && Array.isArray(item.hotelDetails) && item.hotelDetails.length > 0;
    const hasVehicleDetails = itemType === "vehicle" && Array.isArray(item.vehicleDetails) && item.vehicleDetails.length > 0;
    const hasServiceDetails = ["guide", "interpreter"].includes(itemType) && Array.isArray(item.serviceDetails) && item.serviceDetails.length > 0;
    const hotelDetails = hasHotelDetails ? normalizeHotelDetails(item.hotelDetails, index, baseCurrency) : [];
    const vehicleDetails = hasVehicleDetails ? normalizeVehicleDetails(item.vehicleDetails, index, baseCurrency) : [];
    const serviceDetails = hasServiceDetails ? normalizeServiceDetails(item.serviceDetails, index, baseCurrency) : [];
    const quantity = hasHotelDetails || hasVehicleDetails || hasServiceDetails ? 1 : Number(item.quantity || 0);
    const cost = hasHotelDetails || hasVehicleDetails || hasServiceDetails ? 0 : Number(item.cost || 0);
    const price = hasHotelDetails || hasVehicleDetails || hasServiceDetails ? 0 : Number(item.price || 0);
    const currency = assertSupportedCurrency(item.currency || baseCurrency, `第 ${index + 1} 条报价项目的币种`);

    if (!hasHotelDetails && !hasVehicleDetails && !hasServiceDetails) {
      if (quantity <= 0) {
        throw new Error(`第 ${index + 1} 条报价项目的数量必须大于 0。`);
      }
      if (cost < 0 || price < 0) {
        throw new Error(`第 ${index + 1} 条报价项目的金额不能为负数。`);
      }
    }

    return {
      type: itemType,
      name: notEmpty(item.name, `第 ${index + 1} 条报价项目的服务名称`),
      unit: hasHotelDetails ? "酒店" : hasVehicleDetails ? "用车" : notEmpty(item.unit || "项", `第 ${index + 1} 条报价项目的单位`),
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
  const currency = assertSupportedCurrency(payload.currency || "EUR", "报价币种");
  const language = assertOneOf(payload.language || "zh-CN", supportedLanguages, "文档输出语言");
  const startDate = formatDate(notEmpty(payload.startDate || payload.tripDate, "行程开始日期"));
  const endDate = formatDate(notEmpty(payload.endDate || payload.tripDate, "行程结束日期"));

  if (endDate < startDate) {
    throw new Error("行程结束日期不能早于行程开始日期。");
  }

  return {
    id: existingId || payload.id || createId("Q"),
    quoteNumber: payload.quoteNumber ? String(payload.quoteNumber).trim() : generateQuoteNumber(),
    projectId: payload.projectId ? String(payload.projectId).trim() : "",
    clientName: notEmpty(payload.clientName, "客户名称"),
    projectName: notEmpty(payload.projectName, "项目名称"),
    contactName: notEmpty(payload.contactName, "联系人姓名"),
    contactPhone: String(payload.contactPhone || "").trim(),
    language,
    currency,
    startDate,
    endDate,
    tripDate: startDate,
    travelDays: calculateInclusiveDays(startDate, endDate),
    destination: notEmpty(payload.destination || "Belgrade", "主要目的地"),
    paxCount: Number(payload.paxCount || 0),
    notes: String(payload.notes || "").trim(),
    items: normalizeQuoteItems(payload.items, currency),
  };
}

function normalizeTemplateItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("模板报价项目格式不正确。");
  }

  return items.map((item, index) => ({
    type: assertOneOf(item.type, supportedQuoteItemTypes, `第 ${index + 1} 条模板项目的服务类型`),
    name: notEmpty(item.name, `第 ${index + 1} 条模板项目的默认服务名称`),
    unit: notEmpty(item.unit || "项", `第 ${index + 1} 条模板项目的单位`),
    currency: assertSupportedCurrency(item.currency || "EUR", `第 ${index + 1} 条模板项目的币种`),
    quantity: Math.max(Number(item.quantity || 1), 1),
    notes: String(item.notes || "").trim(),
  }));
}

function normalizeTemplatePayload(payload, existingTemplate) {
  return {
    id: existingTemplate?.id || payload.id || createId("TPL"),
    name: notEmpty(payload.name, "模板名称"),
    description: String(payload.description || "").trim(),
    isBuiltIn: Boolean(existingTemplate?.isBuiltIn),
    items: normalizeTemplateItems(payload.items || []),
  };
}

function normalizeReceptionPayload(payload, existingId) {
  return {
    id: existingId || payload.id || createId("R"),
    projectId: payload.projectId ? String(payload.projectId).trim() : "",
    taskType: assertOneOf(payload.taskType || "airport_pickup", supportedReceptionTaskTypes, "任务类型"),
    title: notEmpty(payload.title, "任务标题"),
    assignee: notEmpty(payload.assignee, "负责人"),
    dueTime: notEmpty(payload.dueTime, "截止时间"),
    status: assertOneOf(payload.status || "pending", supportedReceptionStatuses, "任务状态"),
    location: notEmpty(payload.location, "地点"),
    notes: String(payload.notes || "").trim(),
  };
}

function normalizeDocumentPayload(payload, existingId) {
  return {
    id: existingId || payload.id || createId("D"),
    title: notEmpty(payload.title, "文档标题"),
    category: notEmpty(payload.category, "文档分类"),
    language: assertOneOf(payload.language || "zh-CN", supportedLanguages, "文档语言"),
    updatedAt: notEmpty(payload.updatedAt, "更新时间"),
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
    throw new Error(`${label}不存在。`);
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
      specialRequirements: quote.notes || "无",
      linkedQuoteIds: [quote.id],
      linkedReceptionIds: linkedReceptions.map((item) => item.id),
      linkedDocumentPreviewTypes: supportedDocumentPreviewTypes,
    };
  });
}

function getProjectDetail(data, projectId) {
  const projects = deriveProjects(data);
  const project = findById(projects, projectId, "项目主档");
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
  const templates = ensureTemplateData(data);

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
        sendJson(response, 200, findById(templates, templateId, "模板"));
      } catch (error) {
        sendJson(response, 404, { error: error.message });
      }
      return true;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/templates") {
    const template = normalizeTemplatePayload(parseJsonBody(await readRequestBody(request)));
    upsertById(templates, template.id, template);
    saveSeedData(data);
    sendJson(response, 201, template);
    return true;
  }

  if (request.method === "PUT") {
    const templateId = matchIdRoute(url.pathname, "templates");
    if (templateId) {
      const existing = templates.find((item) => item.id === templateId);
      if (!existing) {
        sendJson(response, 404, { error: "模板不存在。" });
        return true;
      }
      const template = normalizeTemplatePayload(parseJsonBody(await readRequestBody(request)), existing);
      upsertById(templates, template.id, template);
      saveSeedData(data);
      sendJson(response, 200, template);
      return true;
    }
  }

  if (request.method === "DELETE") {
    const templateId = matchIdRoute(url.pathname, "templates");
    if (templateId) {
      if (!removeById(templates, templateId)) {
        sendJson(response, 404, { error: "模板不存在。" });
        return true;
      }
      saveSeedData(data);
      sendJson(response, 200, { message: "模板已删除。" });
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
        sendJson(response, 200, enrichQuote(findById(data.quotes, quoteId, "报价")));
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
        sendJson(response, 404, { error: "报价不存在。" });
        return true;
      }
      saveSeedData(data);
      sendJson(response, 200, { message: "报价已删除。" });
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
        sendJson(response, 200, findById(data.receptions, receptionId, "接待任务"));
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
        sendJson(response, 404, { error: "接待任务不存在。" });
        return true;
      }
      saveSeedData(data);
      sendJson(response, 200, { message: "接待任务已删除。" });
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
      const quote = quoteId ? enrichQuote(findById(data.quotes, quoteId, "报价")) : null;
      const reception = receptionId ? findById(data.receptions, receptionId, "接待任务") : null;
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
        sendJson(response, 404, { error: "报价不存在。" });
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
        sendJson(response, 404, { error: "接待任务不存在。" });
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
        sendJson(response, 404, { error: "文档不存在。" });
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

function createServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");

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
        error: "服务器处理失败，请稍后重试。",
        message: error.message,
      });
    }
  });
}

module.exports = {
  createServer,
  generateQuoteNumber,
};









