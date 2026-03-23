const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { loadSeedData, saveSeedData } = require('./dataStore');
const { getSupabaseConfig } = require('./supabaseConfig');
const { supabaseRequest } = require('./supabaseClient');
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
const { createQuoteStore } = require("./services/quoteStore");
const { createReceptionStore } = require("./services/receptionStore");
const { createDocumentStore } = require("./services/documentStore");
const { createSupplierStore } = require("./services/supplierStore");
const { createProjectQuoteStore } = require("./services/projectQuoteStore");
const { getTermsSnapshot, saveTermsSnapshot } = require("./services/termsStore");
const { validateSnapshot, applyTranslationResult, renderValidityBlock, renderPaymentBlock } = require("./services/termsService");
const { translateContent } = require("./services/claudeTranslateService");
const { resolveAuthContext, requirePermission, requireRoutePermission, filterSupplierCatalogFields } = require("./services/authMiddleware");

const publicDir = path.join(process.cwd(), "web");
const supportedLanguages = ["zh-CN", "en", "sr"];
const supportedReceptionStatuses = ["pending", "in_progress", "done"];
const supportedReceptionTaskTypes = ["airport_pickup", "hotel_checkin", "vehicle_service", "guide_support", "business_meeting", "document_delivery", "misc"];
const supportedProjectStatuses = ["planning", "confirmed", "running", "completed"];
const supportedItemCategories = ["av_equipment", "stage_structure", "print_display", "decoration", "furniture", "personnel", "logistics", "management"];
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

  // HTML 文件：读取全文，注入 window.__ENV__，再响应
  if (ext === ".html") {
    const envScript = `<script>\nwindow.__ENV__ = {\n  SUPABASE_URL: ${JSON.stringify(process.env.SUPABASE_URL || "")},\n  SUPABASE_ANON_KEY: ${JSON.stringify(process.env.SUPABASE_ANON_KEY || "")}\n};\n</script>`;
    let html = fs.readFileSync(filePath, "utf8");
    if (html.includes("</head>")) {
      html = html.replace("</head>", envScript + "\n</head>");
    } else {
      html = html.replace("<body>", envScript + "\n<body>");
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }

  // 其他静态资源：保持原有流式返回
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
    const billingQuantity = Number(detail.billingQuantity || 1);
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
    if (billingQuantity <= 0) {
      throw new Error(`第 ${index + 1} 条用车项目第 ${detailIndex + 1} 条明细的计费数量必须大于 0。`);
    }
    if (costUnitPrice < 0 || priceUnitPrice < 0) {
      throw new Error(`第 ${index + 1} 条用车项目第 ${detailIndex + 1} 条明细的成本单价和销售单价不能为负数。`);
    }

    return {
      detailType,
      vehicleModel: String(detail.vehicleModel).trim(),
      vehicleCount,
      pricingUnit,
      billingQuantity,
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

function normalizeBoolean(value, fallback = false) {
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

function normalizeMealDetails(mealDetails, index, itemCurrency) {
  if (!mealDetails || typeof mealDetails !== "object") {
    throw new Error(`第 ${index + 1} 条用餐项目的专用数据格式不正确。`);
  }

  const mealPeople = Math.max(Number(mealDetails.mealPeople || 0), 0);
  const tripDays = Math.max(Number(mealDetails.tripDays || 0), 0);
  const includeLunch = normalizeBoolean(mealDetails.includeLunch, true);
  const lunchPrice = Math.max(Number(mealDetails.lunchPrice || 0), 0);
  const includeDinner = normalizeBoolean(mealDetails.includeDinner, true);
  const dinnerPrice = Math.max(Number(mealDetails.dinnerPrice || 0), 0);
  const firstDayLunch = normalizeBoolean(mealDetails.firstDayLunch, true);
  const firstDayDinner = normalizeBoolean(mealDetails.firstDayDinner, true);
  const lastDayLunch = normalizeBoolean(mealDetails.lastDayLunch, true);
  const lastDayDinner = normalizeBoolean(mealDetails.lastDayDinner, true);
  const currency = assertSupportedCurrency(mealDetails.currency || itemCurrency, `第 ${index + 1} 条用餐项目的币种`);

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

  const lunchTotal = Math.round(mealPeople * lunchCount * lunchPrice * 100) / 100;
  const dinnerTotal = Math.round(mealPeople * dinnerCount * dinnerPrice * 100) / 100;
  const totalAmount = Math.round((lunchTotal + dinnerTotal) * 100) / 100;

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
    currency,
  };
}

function normalizeQuoteItems(items, baseCurrency) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("请至少录入一条报价项目。");
  }

  return items.map((item, index) => {
    const itemType = assertOneOf(item.type, supportedQuoteItemTypes, `第 ${index + 1} 条报价项目的服务类型`);
    const currency = assertSupportedCurrency(item.currency || baseCurrency, `第 ${index + 1} 条报价项目的币种`);
    const hasHotelDetails = itemType === "hotel" && Array.isArray(item.hotelDetails) && item.hotelDetails.length > 0;
    const hasVehicleDetails = itemType === "vehicle" && Array.isArray(item.vehicleDetails) && item.vehicleDetails.length > 0;
    const hasServiceDetails = ["guide", "interpreter"].includes(itemType) && Array.isArray(item.serviceDetails) && item.serviceDetails.length > 0;
    const hasMealDetails = itemType === "dining" && item.mealDetails && typeof item.mealDetails === "object";
    const hotelDetails = hasHotelDetails ? normalizeHotelDetails(item.hotelDetails, index, baseCurrency) : [];
    const vehicleDetails = hasVehicleDetails ? normalizeVehicleDetails(item.vehicleDetails, index, baseCurrency) : [];
    const serviceDetails = hasServiceDetails ? normalizeServiceDetails(item.serviceDetails, index, baseCurrency) : [];
    const mealDetails = hasMealDetails ? normalizeMealDetails(item.mealDetails, index, currency) : null;
    const quantity = hasHotelDetails || hasVehicleDetails || hasServiceDetails || hasMealDetails ? 1 : Number(item.quantity || 0);
    const cost = hasHotelDetails || hasVehicleDetails || hasServiceDetails || hasMealDetails ? 0 : Number(item.cost || 0);
    const price = hasHotelDetails || hasVehicleDetails || hasServiceDetails || hasMealDetails ? 0 : Number(item.price || 0);

    if (!hasHotelDetails && !hasVehicleDetails && !hasServiceDetails && !hasMealDetails) {
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
      unit: hasHotelDetails ? "酒店" : hasVehicleDetails ? "用车" : hasMealDetails ? "用餐" : notEmpty(item.unit || "项", `第 ${index + 1} 条报价项目的单位`),
      supplier: String(item.supplier || "").trim(),
      currency,
      cost,
      price,
      quantity,
      notes: String(item.notes || "").trim(),
      hotelDetails,
      vehicleDetails,
      serviceDetails,
      mealDetails,
    };
  });
}

function normalizeQuotePayload(payload, existingId, existingCreatedAt) {
  const now = new Date().toISOString();
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
    pricingMode: supportedPricingModes.includes(payload.pricingMode) ? payload.pricingMode : "standard",
    items: supportedPricingModes.includes(payload.pricingMode) && payload.pricingMode === "project_based"
      ? []
      : normalizeQuoteItems(payload.items, currency),
    projectGroups: payload.pricingMode === "project_based"
      ? normalizeProjectGroups(payload.projectGroups || [])
      : [],
    totalCost: payload.pricingMode === "project_based"
      ? Math.round((payload.projectGroups || []).reduce((s, g) => s + Number(g.projectCostTotal || 0), 0) * 100) / 100
      : 0,
    totalSales: payload.pricingMode === "project_based"
      ? Math.round((payload.projectGroups || []).reduce((s, g) => s + Number(g.projectSalesTotal || 0), 0) * 100) / 100
      : 0,
    totalProfit: payload.pricingMode === "project_based"
      ? Math.round(((payload.projectGroups || []).reduce((s, g) => s + Number(g.projectSalesTotal || 0), 0) -
                    (payload.projectGroups || []).reduce((s, g) => s + Number(g.projectCostTotal || 0), 0)) * 100) / 100
      : 0,
    createdAt: existingCreatedAt || now,
    updatedAt: now,
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

function normalizeSupplierPayload(payload, existingId) {
  return {
    id: existingId || payload.id || createId("SUP"),
    name: notEmpty(payload.name, "供应商名称"),
    contact: String(payload.contact || "").trim(),
    phone: String(payload.phone || "").trim(),
    email: String(payload.email || "").trim(),
    notes: String(payload.notes || "").trim(),
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
  };
}

function normalizeSupplierItemPayload(payload, existingId) {
  return {
    id: existingId || payload.id || undefined,
    supplierId: notEmpty(payload.supplierId || payload.supplier_id, "供应商"),
    category: assertOneOf(payload.category, supportedItemCategories, "物料类别"),
    nameZh: notEmpty(payload.nameZh || payload.name_zh, "中文名称"),
    nameEn: String(payload.nameEn || payload.name_en || "").trim(),
    unit: notEmpty(payload.unit, "单位"),
    costPrice: Math.max(Number(payload.costPrice ?? payload.cost_price ?? 0), 0),
    spec: String(payload.spec || "").trim(),
    notes: String(payload.notes || "").trim(),
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
  };
}

const supportedProjectQuoteStatuses = ["draft", "sent", "confirmed", "cancelled"];
const supportedPricingModes = ["standard", "project_based"];
const supportedProjectItemTypes = ["hotel", "transport", "guide_translation", "driver_guide", "ticket", "fuel", "toll_parking", "event_material", "catalog_item", "av_equipment", "print_display", "decoration", "personnel", "logistics", "misc"];

const DEFAULT_QUOTE_ITEM_TYPES = [
  { id: "qt-001", code: "hotel",            nameZh: "酒店",      categoryGroup: "accommodation", sortOrder: 1, isActive: true, isSystem: true },
  { id: "qt-002", code: "transport",        nameZh: "用车",      categoryGroup: "transport",     sortOrder: 2, isActive: true, isSystem: true },
  { id: "qt-003", code: "guide_translation",nameZh: "导游/翻译", categoryGroup: "service",       sortOrder: 3, isActive: true, isSystem: true },
  { id: "qt-004", code: "catalog_item",     nameZh: "目录项目",  categoryGroup: "catalog",       sortOrder: 4, isActive: true, isSystem: true },
  { id: "qt-005", code: "misc",             nameZh: "杂项",      categoryGroup: "misc",          sortOrder: 5, isActive: true, isSystem: true },
];

function ensureQuoteItemTypes(data) {
  if (!Array.isArray(data.quotationItemTypes) || data.quotationItemTypes.length === 0) {
    data.quotationItemTypes = DEFAULT_QUOTE_ITEM_TYPES.map((t) => ({ ...t }));
  }
  return data.quotationItemTypes;
}

function normalizeQuoteItemTypePayload(payload, existingId, existing) {
  return {
    id: existingId || payload.id || createId("QT"),
    code: existing?.isSystem ? (existing.code) : notEmpty(payload.code, "类型代码").toLowerCase().replace(/\s+/g, "_"),
    nameZh: notEmpty(payload.nameZh, "中文名称"),
    categoryGroup: String(payload.categoryGroup || "misc").trim(),
    sortOrder: Number(payload.sortOrder || 0),
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    isSystem: Boolean(existing?.isSystem || payload.isSystem || false),
  };
}

function normalizeProjectGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return groups.map((group, gi) => {
    const items = Array.isArray(group.items) ? group.items.map((item, ii) => {
      const itemType = supportedProjectItemTypes.includes(item.itemType) ? item.itemType : "misc";
      const qty = Math.max(Number(item.quantity || 1), 0);
      const costUnit = Math.max(Number(item.costUnitPrice || 0), 0);
      const salesUnit = Math.max(Number(item.salesUnitPrice || 0), 0);
      const extraJson = (item.extraJson && typeof item.extraJson === "object") ? item.extraJson : {};
      const nights = itemType === "hotel" ? Math.max(Number(extraJson.nights || 1), 1) : 1;
      const costSubtotal = Math.round(qty * nights * costUnit * 100) / 100;
      const salesSubtotal = Math.round(qty * nights * salesUnit * 100) / 100;
      return {
        itemType,
        itemCategory: String(item.itemCategory || "").trim(),
        itemName: String(item.itemName || "").trim(),
        nameEn: String(item.nameEn || "").trim(),
        specification: String(item.specification || "").trim(),
        unit: String(item.unit || "套").trim(),
        quantity: qty,
        currency: item.currency || "EUR",
        supplierId: String(item.supplierId || "").trim(),
        supplierCatalogItemId: String(item.supplierCatalogItemId || "").trim(),
        costUnitPrice: costUnit,
        salesUnitPrice: salesUnit,
        costSubtotal,
        salesSubtotal,
        remarks: String(item.remarks || "").trim(),
        sortOrder: ii,
        extraJson,
      };
    }) : [];

    const projectCostTotal = Math.round(items.reduce((s, i) => s + i.costSubtotal, 0) * 100) / 100;
    const projectSalesTotal = Math.round(items.reduce((s, i) => s + i.salesSubtotal, 0) * 100) / 100;
    const projectProfitTotal = Math.round((projectSalesTotal - projectCostTotal) * 100) / 100;

    return {
      id: group.id || null,
      projectType: String(group.projectType || "event").trim(),
      projectTitle: String(group.projectTitle || "").trim(),
      sortOrder: gi,
      remarks: String(group.remarks || "").trim(),
      projectCostTotal,
      projectSalesTotal,
      projectProfitTotal,
      items,
    };
  });
}

function normalizeProjectQuoteItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    groupName: String(item.groupName || "").trim(),
    nameZh: notEmpty(item.nameZh || item.name_zh, `第 ${index + 1} 条物料的中文名称`),
    nameEn: String(item.nameEn || item.name_en || "").trim(),
    unit: notEmpty(item.unit, `第 ${index + 1} 条物料的单位`),
    quantity: Math.max(Number(item.quantity || 1), 0),
    costPrice: Math.max(Number(item.costPrice ?? item.cost_price ?? 0), 0),
    sellPrice: Math.max(Number(item.sellPrice ?? item.sell_price ?? 0), 0),
    supplier: String(item.supplier || "").trim(),
    notes: String(item.notes || "").trim(),
    isActive: item.isActive !== false && item.is_active !== false,
    sortOrder: Number(item.sortOrder ?? item.sort_order ?? index),
  }));
}

function normalizeProjectQuotePayload(payload, existingId) {
  return {
    id: existingId || payload.id || createId("PQ"),
    name: notEmpty(payload.name, "项目名称"),
    client: String(payload.client || "").trim(),
    eventDate: formatDate(payload.eventDate || payload.event_date || ""),
    venue: String(payload.venue || "").trim(),
    paxCount: Math.max(Number(payload.paxCount ?? payload.pax_count ?? 0), 0),
    currency: assertSupportedCurrency(payload.currency || "EUR", "报价币种"),
    status: assertOneOf(payload.status || "draft", supportedProjectQuoteStatuses, "报价状态"),
    notes: String(payload.notes || "").trim(),
    items: normalizeProjectQuoteItems(payload.items || []),
  };
}

function matchIdRoute(pathname, collection) {
  const match = pathname.match(new RegExp(`^/api/${collection}/([^/]+)$`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getNormalizedRequestPath(url) {
  const pathname = url.pathname || "/";
  if (pathname === "/api/[[...route]]") {
    const routedPath = String(url.searchParams.get("route") || "").replace(/^\/+/, "");
    return routedPath ? `/api/${routedPath}` : "/api";
  }
  return pathname;
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
  const project = projects.find((item) => item.id === projectId);
  if (!project) throw new Error("项目主档不存在。");
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

function getMetaPayload(data, templates, storageMode) {
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
    templateCount: templates.length,
    storageMode: storageMode || "local_json",
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
  const quoteStore = createQuoteStore({ data, saveData: saveSeedData });
  const receptionStore = createReceptionStore({ data, saveData: saveSeedData });
  const documentStore = createDocumentStore({ data, saveData: saveSeedData });
  const templateStore = createTemplateStore({ data, saveData: saveSeedData });
  const supplierStore = createSupplierStore({ data, saveData: saveSeedData });
  const projectQuoteStore = createProjectQuoteStore({ data, saveData: saveSeedData });
  const templateResult = await templateStore.listTemplates();
  const templates = templateResult.templates;

  // ── 统一认证 & 路由权限拦截 ──────────────────────────────────────────────
  const authCtx = await resolveAuthContext(request, getSupabaseConfig());
  requireRoutePermission(authCtx, request.method, url.pathname);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, timestamp: new Date().toISOString() });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/meta") {
    sendJson(response, 200, getMetaPayload(data, templates, templateResult.source));
    return true;
  }

  // GET /api/auth/me — 返回当前登录用户信息、角色、权限列表
  if (request.method === "GET" && url.pathname === "/api/auth/me") {
    const userId = authCtx.userId;
    if (!userId) { sendJson(response, 401, { error: "未登录。" }); return true; }

    // dev bypass：直接返回管理员信息，不查 Supabase
    if (userId === "dev-user") {
      sendJson(response, 200, {
        userId: "dev-user",
        display_name: authCtx.user?.display_name || "本地开发管理员",
        email: authCtx.user?.email || "dev@localhost",
        is_active: true,
        roles: ["admin"],
        permissions: ["*"],
      });
      return true;
    }

    const supabase = getSupabaseConfig();
    if (!supabase.enabled) {
      sendJson(response, 200, {
        userId,
        display_name: authCtx.user?.email || userId,
        email: authCtx.user?.email || "",
        is_active: true,
        roles: [],
        permissions: [...authCtx.permissions],
      });
      return true;
    }

    try {
      // 查用户基本信息
      const profiles = await supabaseRequest(
        supabase,
        `user_profiles?id=eq.${encodeURIComponent(userId)}&select=display_name,email,is_active`,
        { method: "GET" }
      );
      const profile = profiles?.[0];
      if (profile && !profile.is_active) {
        sendJson(response, 403, { error: "账号已被停用。" });
        return true;
      }

      // 查角色 code 列表
      const urRows = await supabaseRequest(
        supabase,
        `user_roles?user_id=eq.${encodeURIComponent(userId)}&select=roles(code)`,
        { method: "GET" }
      );
      const roleCodes = (urRows || []).map((ur) => ur.roles?.code).filter(Boolean);

      // admin 角色直接返回通配权限
      if (roleCodes.includes("admin")) {
        sendJson(response, 200, {
          userId,
          display_name: profile?.display_name || "",
          email: profile?.email || "",
          is_active: profile?.is_active ?? true,
          roles: roleCodes,
          permissions: ["*"],
        });
        return true;
      }

      // 普通角色：查所有权限 code（去重）
      const permRows = await supabaseRequest(
        supabase,
        `user_roles?user_id=eq.${encodeURIComponent(userId)}&select=roles(role_permissions(permissions(code)))`,
        { method: "GET" }
      );
      const permSet = new Set();
      for (const ur of (permRows || [])) {
        for (const rp of (ur.roles?.role_permissions || [])) {
          const code = rp.permissions?.code;
          if (code) permSet.add(code);
        }
      }

      sendJson(response, 200, {
        userId,
        display_name: profile?.display_name || "",
        email: profile?.email || "",
        is_active: profile?.is_active ?? true,
        roles: roleCodes,
        permissions: [...permSet],
      });
    } catch (err) {
      console.error('[api/auth/me] error:', {
        message: err.message,
        statusCode: err.statusCode,
        stack: err.stack?.split('\n').slice(0, 5).join('\n'),
      });
      throw err;
    }
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    const [qr, rr, dr] = await Promise.all([
      quoteStore.listQuotes(),
      receptionStore.listReceptions(),
      documentStore.listDocuments(),
    ]);
    sendJson(response, 200, getDashboard({
      quotes: qr.quotes,
      receptions: rr.receptions,
      documents: dr.documents,
      templates,
    }));
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
        sendJson(response, 404, { error: "模板不存在。" });
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
        sendJson(response, 404, { error: "模板不存在。" });
        return true;
      }
      sendJson(response, 200, { message: "模板已删除。" });
      return true;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/quotes") {
    const { quotes } = await quoteStore.listQuotes();
    sendJson(response, 200, quotes.map(enrichQuote));
    return true;
  }

  if (request.method === "GET") {
    const quoteId = matchIdRoute(url.pathname, "quotes");
    if (quoteId) {
      try {
        const { quote } = await quoteStore.getQuoteById(quoteId);
        const enriched = enrichQuote(quote);
        // Resolve owner / reviewer display names when Supabase is available
        const supabaseCfg = getSupabaseConfig();
        if (supabaseCfg.enabled) {
          const userIds = [enriched.ownerId, enriched.reviewerId].filter(Boolean);
          if (userIds.length > 0) {
            try {
              const profiles = await supabaseRequest(
                supabaseCfg,
                `user_profiles?id=in.(${userIds.map(encodeURIComponent).join(",")})&select=id,display_name`
              );
              const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.display_name]));
              enriched.ownerName = enriched.ownerId ? (nameMap[enriched.ownerId] || null) : null;
              enriched.reviewerName = enriched.reviewerId ? (nameMap[enriched.reviewerId] || null) : null;
            } catch (_) { /* name resolution failure is non-fatal */ }
          }
        }
        sendJson(response, 200, enriched);
      } catch (error) {
        sendJson(response, 404, { error: error.message });
      }
      return true;
    }
  }

  // POST /api/quotes/:id/submit — 提交审批 (draft/rejected → pending)
  {
    const m = url.pathname.match(/^\/api\/quotes\/([^/]+)\/submit$/);
    if (request.method === "POST" && m) {
      requirePermission(authCtx, "");
      const quoteId = decodeURIComponent(m[1]);
      const supabaseCfg = getSupabaseConfig();
      if (!supabaseCfg.enabled) { sendJson(response, 503, { error: "审批工作流需要 Supabase，当前未配置。" }); return true; }
      await supabaseRequest(supabaseCfg, "rpc/submit_quote_for_review", {
        method: "POST", body: JSON.stringify({ p_quote_id: quoteId }),
      });
      sendJson(response, 200, { ok: true });
      return true;
    }
  }

  // POST /api/quotes/:id/review — 审批 (pending → approved/rejected，DB RPC 自行校验角色)
  {
    const m = url.pathname.match(/^\/api\/quotes\/([^/]+)\/review$/);
    if (request.method === "POST" && m) {
      requirePermission(authCtx, "");
      const quoteId = decodeURIComponent(m[1]);
      const supabaseCfg = getSupabaseConfig();
      if (!supabaseCfg.enabled) { sendJson(response, 503, { error: "审批工作流需要 Supabase，当前未配置。" }); return true; }
      const { action, note = "" } = parseJsonBody(await readRequestBody(request));
      if (!["approve", "reject"].includes(action)) { sendJson(response, 400, { error: "action 必须为 approve 或 reject。" }); return true; }
      if (action === "reject" && !String(note).trim()) { sendJson(response, 400, { error: "拒绝时必须填写拒绝原因。" }); return true; }
      await supabaseRequest(supabaseCfg, "rpc/review_quote", {
        method: "POST", body: JSON.stringify({ p_quote_id: quoteId, p_action: action, p_note: note }),
      });
      sendJson(response, 200, { ok: true });
      return true;
    }
  }

  // POST /api/quotes/:id/reopen — 打回重改 (rejected → draft)
  {
    const m = url.pathname.match(/^\/api\/quotes\/([^/]+)\/reopen$/);
    if (request.method === "POST" && m) {
      requirePermission(authCtx, "");
      const quoteId = decodeURIComponent(m[1]);
      const supabaseCfg = getSupabaseConfig();
      if (!supabaseCfg.enabled) { sendJson(response, 503, { error: "审批工作流需要 Supabase，当前未配置。" }); return true; }
      await supabaseRequest(supabaseCfg, "rpc/reopen_quote", {
        method: "POST", body: JSON.stringify({ p_quote_id: quoteId }),
      });
      sendJson(response, 200, { ok: true });
      return true;
    }
  }

  // PATCH /api/quotes/:id — 局部字段更新（供前端 approve 回调更新 execution_status）
  if (request.method === "PATCH") {
    const quoteId = matchIdRoute(url.pathname, "quotes");
    if (quoteId) {
      requirePermission(authCtx, "");
      const supabaseCfg = getSupabaseConfig();
      if (!supabaseCfg.enabled) { sendJson(response, 503, { error: "此操作需要 Supabase，当前未配置。" }); return true; }
      const body = parseJsonBody(await readRequestBody(request));
      const { execution_status, owner_id } = body;

      // [权限修复] execution_status / owner_id 字段角色校验：仅 manager / admin 可修改
      const RESTRICTED_FIELDS = ["execution_status", "owner_id"];
      const hasRestrictedField = RESTRICTED_FIELDS.some(f => f in body);
      if (hasRestrictedField) {
        // 通配权限（admin dev bypass）直接放行
        if (!authCtx.permissions.has("*")) {
          // 查询当前用户的角色列表，写法与 /api/auth/me 保持一致
          const urRows = await supabaseRequest(
            supabaseCfg,
            `user_roles?user_id=eq.${encodeURIComponent(authCtx.userId)}&select=roles(code)`,
            { method: "GET" }
          );
          const roleCodes = (urRows || []).map(ur => ur.roles?.code).filter(Boolean);
          if (!roleCodes.includes("admin") && !roleCodes.includes("manager")) {
            sendJson(response, 403, { error: "权限不足，仅管理员可修改执行状态" });
            return true;
          }
        }
      }

      if (execution_status !== undefined) {
        const allowed = ["preparing", "executing", "completed"];
        if (!allowed.includes(execution_status)) {
          sendJson(response, 400, { error: `execution_status 无效，允许值：${allowed.join("/")}。` });
          return true;
        }
      }

      const patch = {};
      if (execution_status !== undefined) patch.execution_status = execution_status;
      if (owner_id !== undefined) patch.owner_id = owner_id;

      if (Object.keys(patch).length === 0) {
        sendJson(response, 400, { error: "请求体中无可更新的字段。" });
        return true;
      }

      await supabaseRequest(
        supabaseCfg,
        `quotes?id=eq.${encodeURIComponent(quoteId)}`,
        { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) }
      );
      sendJson(response, 200, { ok: true });
      return true;
    }
  }

  if (request.method === "DELETE") {
    const quoteId = matchIdRoute(url.pathname, "quotes");
    if (quoteId) {
      const result = await quoteStore.deleteQuote(quoteId);
      if (!result.deleted) {
        sendJson(response, 404, { error: "报价不存在。" });
        return true;
      }
      sendJson(response, 200, { message: "报价已删除。" });
      return true;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/receptions") {
    const { receptions } = await receptionStore.listReceptions();
    sendJson(response, 200, receptions);
    return true;
  }

  if (request.method === "GET") {
    const receptionId = matchIdRoute(url.pathname, "receptions");
    if (receptionId) {
      try {
        const { reception } = await receptionStore.getReceptionById(receptionId);
        sendJson(response, 200, reception);
      } catch (error) {
        sendJson(response, 404, { error: error.message });
      }
      return true;
    }
  }

  if (request.method === "DELETE") {
    const receptionId = matchIdRoute(url.pathname, "receptions");
    if (receptionId) {
      const result = await receptionStore.deleteReception(receptionId);
      if (!result.deleted) {
        sendJson(response, 404, { error: "接待任务不存在。" });
        return true;
      }
      sendJson(response, 200, { message: "接待任务已删除。" });
      return true;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/documents") {
    const { documents } = await documentStore.listDocuments();
    sendJson(response, 200, documents);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/document-previews") {
    const [qr, rr] = await Promise.all([quoteStore.listQuotes(), receptionStore.listReceptions()]);
    const allQuotes = qr.quotes;
    const allReceptions = rr.receptions;
    const quoteId = url.searchParams.get("quoteId") || (allQuotes[0] && allQuotes[0].id);
    const receptionId = url.searchParams.get("receptionId") || (allReceptions[0] && allReceptions[0].id);
    try {
      const quoteObj = quoteId ? allQuotes.find((q) => q.id === quoteId) : null;
      if (quoteId && !quoteObj) throw new Error("报价不存在。");
      const receptionObj = receptionId ? allReceptions.find((r) => r.id === receptionId) : null;
      sendJson(response, 200, buildDocumentPreviews({ quote: quoteObj ? enrichQuote(quoteObj) : null, reception: receptionObj }));
    } catch (error) {
      sendJson(response, 404, { error: error.message });
    }
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/projects") {
    const [qr, rr] = await Promise.all([quoteStore.listQuotes(), receptionStore.listReceptions()]);
    sendJson(response, 200, deriveProjects({ quotes: qr.quotes, receptions: rr.receptions }));
    return true;
  }

  if (request.method === "GET") {
    const projectId = matchIdRoute(url.pathname, "projects");
    if (projectId) {
      try {
        const [qr, rr] = await Promise.all([quoteStore.listQuotes(), receptionStore.listReceptions()]);
        sendJson(response, 200, getProjectDetail({ quotes: qr.quotes, receptions: rr.receptions }, projectId));
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
    const result = await quoteStore.saveQuote(quote);
    sendJson(response, 201, enrichQuote(result.quote));
    return true;
  }

  if (request.method === "PUT") {
    const quoteId = matchIdRoute(url.pathname, "quotes");
    if (quoteId) {
      let existingCreatedAt = null;
      try {
        const { quote: existing } = await quoteStore.getQuoteById(quoteId);
        existingCreatedAt = existing.createdAt || null;
      } catch {
        sendJson(response, 404, { error: "报价不存在。" });
        return true;
      }
      const quote = normalizeQuotePayload(parseJsonBody(await readRequestBody(request)), quoteId, existingCreatedAt);
      const result = await quoteStore.saveQuote(quote);
      sendJson(response, 200, enrichQuote(result.quote));
      return true;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/receptions") {
    const reception = normalizeReceptionPayload(parseJsonBody(await readRequestBody(request)));
    const result = await receptionStore.saveReception(reception);
    sendJson(response, 201, result.reception);
    return true;
  }

  if (request.method === "PUT") {
    const receptionId = matchIdRoute(url.pathname, "receptions");
    if (receptionId) {
      try {
        await receptionStore.getReceptionById(receptionId);
      } catch {
        sendJson(response, 404, { error: "接待任务不存在。" });
        return true;
      }
      const reception = normalizeReceptionPayload(parseJsonBody(await readRequestBody(request)), receptionId);
      const result = await receptionStore.saveReception(reception);
      sendJson(response, 200, result.reception);
      return true;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/documents") {
    const document = normalizeDocumentPayload(parseJsonBody(await readRequestBody(request)));
    const result = await documentStore.saveDocument(document);
    sendJson(response, 201, result.document);
    return true;
  }

  if (request.method === "PUT") {
    const documentId = matchIdRoute(url.pathname, "documents");
    if (documentId) {
      try {
        await documentStore.getDocumentById(documentId);
      } catch {
        sendJson(response, 404, { error: "文档不存在。" });
        return true;
      }
      const document = normalizeDocumentPayload(parseJsonBody(await readRequestBody(request)), documentId);
      const result = await documentStore.saveDocument(document);
      sendJson(response, 200, result.document);
      return true;
    }
  }

  // ── Suppliers ──────────────────────────────────────────────────────────────

  if (request.method === "GET" && url.pathname === "/api/suppliers") {
    const { suppliers } = await supplierStore.listSuppliers();
    sendJson(response, 200, suppliers);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/suppliers") {
    const supplier = normalizeSupplierPayload(parseJsonBody(await readRequestBody(request)));
    const result = await supplierStore.saveSupplier(supplier);
    sendJson(response, 201, result.supplier);
    return true;
  }

  if (request.method === "PUT") {
    const supplierId = matchIdRoute(url.pathname, "suppliers");
    if (supplierId) {
      const supplier = normalizeSupplierPayload(parseJsonBody(await readRequestBody(request)), supplierId);
      const result = await supplierStore.saveSupplier(supplier);
      sendJson(response, 200, result.supplier);
      return true;
    }
  }

  if (request.method === "DELETE") {
    const supplierId = matchIdRoute(url.pathname, "suppliers");
    if (supplierId) {
      const result = await supplierStore.deleteSupplier(supplierId);
      if (!result.deleted) {
        sendJson(response, 404, { error: "供应商不存在。" });
        return true;
      }
      sendJson(response, 200, { message: "供应商已删除。" });
      return true;
    }
  }

  // ── Supplier Items ─────────────────────────────────────────────────────────

  if (request.method === "GET" && url.pathname === "/api/supplier-items/best-price") {
    const { items: rawBestItems } = await supplierStore.getBestPriceItems();
    const items = filterSupplierCatalogFields(authCtx, rawBestItems);
    sendJson(response, 200, items);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/supplier-items") {
    const category = url.searchParams.get("category") || "";
    const supplierId = url.searchParams.get("supplier_id") || "";
    const { items: rawItems } = await supplierStore.listSupplierItems({ category, supplierId });
    const items = filterSupplierCatalogFields(authCtx, rawItems);
    sendJson(response, 200, items);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/supplier-items") {
    const item = normalizeSupplierItemPayload(parseJsonBody(await readRequestBody(request)));
    const result = await supplierStore.saveSupplierItem(item);
    sendJson(response, 201, result.item);
    return true;
  }

  if (request.method === "PUT") {
    const itemId = matchIdRoute(url.pathname, "supplier-items");
    if (itemId) {
      const item = normalizeSupplierItemPayload(parseJsonBody(await readRequestBody(request)), itemId);
      const result = await supplierStore.saveSupplierItem(item);
      sendJson(response, 200, result.item);
      return true;
    }
  }

  if (request.method === "DELETE") {
    const itemId = matchIdRoute(url.pathname, "supplier-items");
    if (itemId) {
      const result = await supplierStore.deleteSupplierItem(itemId);
      if (!result.deleted) {
        sendJson(response, 404, { error: "物料不存在。" });
        return true;
      }
      sendJson(response, 200, { message: "物料已删除。" });
      return true;
    }
  }

  // ── Project Quotes ─────────────────────────────────────────────────────────

  if (request.method === "GET" && url.pathname === "/api/project-quotes") {
    const { projects } = await projectQuoteStore.listProjectQuotes();
    sendJson(response, 200, projects);
    return true;
  }

  if (request.method === "GET") {
    const projectQuoteId = matchIdRoute(url.pathname, "project-quotes");
    if (projectQuoteId) {
      try {
        const { project } = await projectQuoteStore.getProjectQuoteById(projectQuoteId);
        sendJson(response, 200, project);
      } catch (error) {
        sendJson(response, 404, { error: error.message });
      }
      return true;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/project-quotes") {
    const project = normalizeProjectQuotePayload(parseJsonBody(await readRequestBody(request)));
    const result = await projectQuoteStore.saveProjectQuote(project);
    sendJson(response, 201, result.project);
    return true;
  }

  if (request.method === "PUT") {
    const projectQuoteId = matchIdRoute(url.pathname, "project-quotes");
    if (projectQuoteId) {
      try {
        await projectQuoteStore.getProjectQuoteById(projectQuoteId);
      } catch {
        sendJson(response, 404, { error: "项目型报价不存在。" });
        return true;
      }
      const project = normalizeProjectQuotePayload(parseJsonBody(await readRequestBody(request)), projectQuoteId);
      const result = await projectQuoteStore.saveProjectQuote(project);
      sendJson(response, 200, result.project);
      return true;
    }
  }

  if (request.method === "DELETE") {
    const projectQuoteId = matchIdRoute(url.pathname, "project-quotes");
    if (projectQuoteId) {
      const result = await projectQuoteStore.deleteProjectQuote(projectQuoteId);
      if (!result.deleted) {
        sendJson(response, 404, { error: "项目型报价不存在。" });
        return true;
      }
      sendJson(response, 200, { message: "项目型报价已删除。" });
      return true;
    }
  }

  // ── Quote Item Types ────────────────────────────────────────────────────────

  if (request.method === "GET" && url.pathname === "/api/quote-item-types") {
    const data = await loadSeedData();
    const types = ensureQuoteItemTypes(data);
    sendJson(response, 200, types);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/quote-item-types") {
    const data = await loadSeedData();
    const types = ensureQuoteItemTypes(data);
    const payload = normalizeQuoteItemTypePayload(parseJsonBody(await readRequestBody(request)));
    if (types.some((t) => t.code === payload.code)) {
      sendJson(response, 409, { error: `类型代码「${payload.code}」已存在。` });
      return true;
    }
    types.push(payload);
    data.quotationItemTypes = types;
    await saveSeedData(data);
    sendJson(response, 201, payload);
    return true;
  }

  if (request.method === "PUT") {
    const typeId = matchIdRoute(url.pathname, "quote-item-types");
    if (typeId) {
      const data = await loadSeedData();
      const types = ensureQuoteItemTypes(data);
      const idx = types.findIndex((t) => t.id === typeId);
      if (idx === -1) { sendJson(response, 404, { error: "类型不存在。" }); return true; }
      const payload = normalizeQuoteItemTypePayload(parseJsonBody(await readRequestBody(request)), typeId, types[idx]);
      types[idx] = payload;
      data.quotationItemTypes = types;
      await saveSeedData(data);
      sendJson(response, 200, payload);
      return true;
    }
  }

  if (request.method === "DELETE") {
    const typeId = matchIdRoute(url.pathname, "quote-item-types");
    if (typeId) {
      const data = await loadSeedData();
      const types = ensureQuoteItemTypes(data);
      const idx = types.findIndex((t) => t.id === typeId);
      if (idx === -1) { sendJson(response, 404, { error: "类型不存在。" }); return true; }
      if (types[idx].isSystem) { sendJson(response, 403, { error: "系统内置类型不可删除。" }); return true; }
      types.splice(idx, 1);
      data.quotationItemTypes = types;
      await saveSeedData(data);
      sendJson(response, 200, { message: "类型已删除。" });
      return true;
    }
  }

  // ─── 商务条款 API ─────────────────────────────────────────────────────────

  // GET /api/terms/snapshot?quote_id=xxx
  if (request.method === "GET" && url.pathname === "/api/terms/snapshot") {
    const quoteId = url.searchParams.get("quote_id");
    if (!quoteId) { sendJson(response, 400, { error: "缺少 quote_id 参数。" }); return true; }
    const snapshot = await getTermsSnapshot(quoteId);
    // Enrich structured blocks with rendered text (computed on-the-fly, not stored)
    const enriched = JSON.parse(JSON.stringify(snapshot));
    for (const block of (enriched.blocks || [])) {
      if (block.type === "structured" && block.fields) {
        if (block.key === "validity") {
          block.rendered = renderValidityBlock(block.fields);
        } else if (block.key === "payment") {
          block.rendered = {
            zh: renderPaymentBlock(block.fields, "zh"),
            en: renderPaymentBlock(block.fields, "en"),
            sr: renderPaymentBlock(block.fields, "sr"),
          };
        }
      }
    }
    sendJson(response, 200, enriched);
    return true;
  }

  // POST /api/terms/snapshot — 保存快照
  if (request.method === "POST" && url.pathname === "/api/terms/snapshot") {
    const { quote_id, snapshot } = parseJsonBody(await readRequestBody(request));
    if (!quote_id) { sendJson(response, 400, { error: "缺少 quote_id。" }); return true; }
    validateSnapshot(snapshot);
    await saveTermsSnapshot(quote_id, snapshot);
    sendJson(response, 200, { ok: true });
    return true;
  }

  // POST /api/terms/translate — 翻译单个 block
  if (request.method === "POST" && url.pathname === "/api/terms/translate") {
    const { quote_id, block_key, target_lang } = parseJsonBody(await readRequestBody(request));
    if (!quote_id || !block_key || !target_lang) {
      sendJson(response, 400, { error: "缺少必填字段：quote_id / block_key / target_lang。" });
      return true;
    }
    if (!["en", "sr"].includes(target_lang)) {
      sendJson(response, 400, { error: "target_lang 仅支持 en 或 sr。" });
      return true;
    }
    const snapshot = await getTermsSnapshot(quote_id);
    const block = (snapshot.blocks || []).find((b) => b.key === block_key);
    if (!block) { sendJson(response, 404, { error: `block[${block_key}] 不存在。` }); return true; }
    if (block.type !== "rich_text") {
      sendJson(response, 400, { error: `block[${block_key}] 是结构化字段，不需要 AI 翻译。` });
      return true;
    }
    const translated = await translateContent(block.content.zh, target_lang);
    applyTranslationResult(snapshot, block_key, target_lang, translated);
    await saveTermsSnapshot(quote_id, snapshot);
    sendJson(response, 200, { block_key, target_lang, translated });
    return true;
  }

  // POST /api/terms/translate-all — 翻译所有 rich_text block
  if (request.method === "POST" && url.pathname === "/api/terms/translate-all") {
    const { quote_id, target_lang } = parseJsonBody(await readRequestBody(request));
    if (!quote_id || !target_lang) {
      sendJson(response, 400, { error: "缺少必填字段：quote_id / target_lang。" });
      return true;
    }
    if (!["en", "sr"].includes(target_lang)) {
      sendJson(response, 400, { error: "target_lang 仅支持 en 或 sr。" });
      return true;
    }
    const snapshot = await getTermsSnapshot(quote_id);
    const richBlocks = (snapshot.blocks || []).filter((b) => b.type === "rich_text" && b.enabled);
    const results = [];
    for (const block of richBlocks) {
      const translated = await translateContent(block.content.zh, target_lang);
      applyTranslationResult(snapshot, block.key, target_lang, translated);
      results.push({ block_key: block.key, translated });
    }
    await saveTermsSnapshot(quote_id, snapshot);
    sendJson(response, 200, { target_lang, results });
    return true;
  }

  // GET /api/admin/bootstrap-status — 公开，检查系统是否已完成初始化
  if (request.method === "GET" && url.pathname === "/api/admin/bootstrap-status") {
    const supabase = getSupabaseConfig();
    if (!supabase.enabled) {
      sendJson(response, 200, { initialized: false, admin_count: 0 });
      return true;
    }
    const rows = await supabaseRequest(
      supabase,
      "user_roles?select=user_id&role_id=eq.(select id from roles where code=eq.admin)",
      { method: "GET" }
    ).catch(() => null);
    // Supabase REST 不支持子查询，用两步查询代替
    const roleRows = await supabaseRequest(supabase, "roles?code=eq.admin&select=id", { method: "GET" }).catch(() => null);
    const adminRoleId = roleRows?.[0]?.id;
    let adminCount = 0;
    if (adminRoleId) {
      const urRows = await supabaseRequest(
        supabase,
        `user_roles?role_id=eq.${encodeURIComponent(adminRoleId)}&select=user_id`,
        { method: "GET" }
      ).catch(() => null);
      adminCount = Array.isArray(urRows) ? urRows.length : 0;
    }
    sendJson(response, 200, { initialized: adminCount > 0, admin_count: adminCount });
    return true;
  }

  // ─── 用户权限管理 API（/api/admin/*）────────────────────────────────────────
  // 所有 /api/admin/* 接口额外要求 user.view 权限（仅系统管理员）
  if (url.pathname.startsWith("/api/admin/")) {
    const supabase = getSupabaseConfig();
    requirePermission(authCtx, "user.view");
    if (!supabase.enabled) {
      sendJson(response, 503, { error: "管理功能需要 Supabase，当前未配置。" });
      return true;
    }

    // GET /api/admin/users — 用户列表及角色
    if (request.method === "GET" && url.pathname === "/api/admin/users") {
      const rows = await supabaseRequest(
        supabase,
        "user_profiles?select=id,display_name,email,is_active,user_roles(roles(id,code,name_zh))&order=display_name.asc",
        { method: "GET" }
      );
      const users = (rows || []).map((u) => ({
        id: u.id,
        display_name: u.display_name,
        email: u.email,
        is_active: u.is_active,
        roles: (u.user_roles || []).map((ur) => ur.roles).filter(Boolean),
      }));
      sendJson(response, 200, users);
      return true;
    }

    // GET /api/admin/roles — 角色列表
    if (request.method === "GET" && url.pathname === "/api/admin/roles") {
      const rows = await supabaseRequest(
        supabase,
        "roles?select=id,code,name_zh,description,is_system&order=name_zh.asc",
        { method: "GET" }
      );
      sendJson(response, 200, rows || []);
      return true;
    }

    // GET /api/admin/users/:userId/permissions — 用户权限明细（含个人覆盖）
    const permMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/permissions$/);
    if (request.method === "GET" && permMatch) {
      const userId = decodeURIComponent(permMatch[1]);
      const [rows, rawOverrides] = await Promise.all([
        supabaseRequest(
          supabase,
          `user_roles?select=roles(name_zh,role_permissions(permissions(code,action,resources(group_name,name_zh))))&user_id=eq.${encodeURIComponent(userId)}`,
          { method: "GET" }
        ),
        supabaseRequest(
          supabase,
          `user_permissions?user_id=eq.${encodeURIComponent(userId)}&select=permission_code,granted`,
          { method: "GET" }
        ).catch(() => []),
      ]);
      const overrideMap = new Map((rawOverrides || []).map(o => [o.permission_code, o.granted]));
      const permsMap = new Map();
      for (const ur of (rows || [])) {
        const role = ur.roles;
        if (!role) continue;
        for (const rp of (role.role_permissions || [])) {
          const perm = rp.permissions;
          if (!perm) continue;
          const key = perm.code;
          if (!permsMap.has(key)) {
            permsMap.set(key, {
              permission_code: perm.code,
              resource_group: perm.resources?.group_name || "其他",
              resource_name_zh: perm.resources?.name_zh || perm.code,
              action: perm.action,
              granted_by_roles: [],
              is_override: overrideMap.has(perm.code),
              granted: overrideMap.has(perm.code) ? overrideMap.get(perm.code) : true,
            });
          }
          permsMap.get(key).granted_by_roles.push(role.name_zh);
        }
      }
      const result = [...permsMap.values()].sort((a, b) =>
        a.resource_group.localeCompare(b.resource_group, "zh")
      );
      sendJson(response, 200, result);
      return true;
    }

    // PATCH /api/admin/users/:userId/deactivate — 停用用户（软删除）
    const userDeactivateMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/deactivate$/);
    if (request.method === "PATCH" && userDeactivateMatch) {
      requirePermission(authCtx, "user.edit");
      const userId = decodeURIComponent(userDeactivateMatch[1]);
      if (userId === authCtx.userId) {
        sendJson(response, 400, { error: "不能停用自己的账号。" });
        return true;
      }
      await supabaseRequest(
        supabase,
        `user_profiles?id=eq.${encodeURIComponent(userId)}`,
        { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ is_active: false }) }
      );
      await supabaseRequest(supabase, "audit_log", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          operator_id: authCtx.userId,
          action: "deactivate_user",
          target_type: "user",
          target_id: userId,
          detail: {},
        }),
      });
      sendJson(response, 200, { ok: true });
      return true;
    }

    // PATCH /api/admin/users/:userId/permissions/:permCode — 覆盖单个权限
    const permOverrideMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/permissions\/([^/]+)$/);
    if (request.method === "PATCH" && permOverrideMatch) {
      requirePermission(authCtx, "user.edit");
      const userId = decodeURIComponent(permOverrideMatch[1]);
      const permCode = decodeURIComponent(permOverrideMatch[2]);
      const { granted } = parseJsonBody(await readRequestBody(request));
      if (typeof granted !== "boolean") {
        sendJson(response, 400, { error: "granted 字段必须为布尔值。" });
        return true;
      }
      await supabaseRequest(supabase, "user_permissions", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: userId, permission_code: permCode, granted, updated_at: new Date().toISOString() }),
      });
      await supabaseRequest(supabase, "audit_log", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          operator_id: authCtx.userId,
          action: "override_permission",
          target_type: "user",
          target_id: userId,
          detail: { permission_code: permCode, granted },
        }),
      });
      sendJson(response, 200, { ok: true });
      return true;
    }

    // POST /api/admin/users/:userId/roles — 分配角色
    const userRolesPostMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/roles$/);
    if (request.method === "POST" && userRolesPostMatch) {
      const userId = decodeURIComponent(userRolesPostMatch[1]);
      const { role_id } = parseJsonBody(await readRequestBody(request));
      if (!role_id) { sendJson(response, 400, { error: "缺少 role_id。" }); return true; }
      const roles = await supabaseRequest(supabase, `roles?id=eq.${encodeURIComponent(role_id)}&select=id,code`, { method: "GET" });
      const role = roles?.[0];
      if (!role) { sendJson(response, 404, { error: "角色不存在。" }); return true; }
      await supabaseRequest(supabase, "user_roles", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: userId, role_id }),
      });
      await supabaseRequest(supabase, "audit_log", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          operator_id: authCtx.userId,
          action: "assign_role",
          target_type: "user",
          target_id: userId,
          detail: { role_id, role_code: role.code },
        }),
      });
      sendJson(response, 200, { ok: true });
      return true;
    }

    // POST /api/admin/create-user — 创建新用户账号（Auth + profile + roles + audit）
    if (request.method === "POST" && url.pathname === "/api/admin/create-user") {
      if (!supabase.hasServiceRoleKey) {
        sendJson(response, 503, { error: "创建用户需要 service_role key，当前未配置。" });
        return true;
      }
      const { email, password, display_name, role_ids = [] } = parseJsonBody(await readRequestBody(request));
      if (!email || !password || !display_name) {
        sendJson(response, 400, { error: "email、password、display_name 为必填项。" });
        return true;
      }
      if (String(password).length < 6) {
        sendJson(response, 400, { error: "密码至少 6 位。" });
        return true;
      }
      // 1. Supabase Auth Admin API 创建账号
      const createRes = await fetch(`${supabase.url}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: supabase.serviceRoleKey,
          Authorization: `Bearer ${supabase.serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Supabase 创建账号失败：${createRes.status} ${errText}`);
      }
      const authUser = await createRes.json();
      const newUserId = authUser.id;
      // 2. 插入 user_profiles
      await supabaseRequest(supabase, "user_profiles", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ id: newUserId, display_name, email, is_active: true }),
      });
      // 3. 批量插入 user_roles
      if (Array.isArray(role_ids) && role_ids.length > 0) {
        await supabaseRequest(supabase, "user_roles", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify(role_ids.map((rid) => ({ user_id: newUserId, role_id: rid }))),
        });
      }
      // 4. 审计日志
      await supabaseRequest(supabase, "audit_log", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          operator_id: authCtx.userId,
          action: "create_user",
          target_type: "user",
          target_id: newUserId,
          detail: { email, display_name, role_ids },
        }),
      });
      sendJson(response, 200, { id: newUserId, display_name, email, is_active: true, roles: [] });
      return true;
    }

    // DELETE /api/admin/users/:userId/roles/:roleId — 取消角色
    const userRoleDeleteMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/roles\/([^/]+)$/);
    if (request.method === "DELETE" && userRoleDeleteMatch) {
      const userId = decodeURIComponent(userRoleDeleteMatch[1]);
      const roleId = decodeURIComponent(userRoleDeleteMatch[2]);
      const roles = await supabaseRequest(supabase, `roles?id=eq.${encodeURIComponent(roleId)}&select=id,code`, { method: "GET" });
      const role = roles?.[0];
      if (!role) { sendJson(response, 404, { error: "角色不存在。" }); return true; }
      await supabaseRequest(
        supabase,
        `user_roles?user_id=eq.${encodeURIComponent(userId)}&role_id=eq.${encodeURIComponent(roleId)}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } }
      );
      await supabaseRequest(supabase, "audit_log", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          operator_id: authCtx.userId,
          action: "revoke_role",
          target_type: "user",
          target_id: userId,
          detail: { role_id: roleId, role_code: role.code },
        }),
      });
      sendJson(response, 200, { ok: true });
      return true;
    }
  }

  return false;
}

async function handleRequest(request, response) {
  const baseUrl = request.headers?.host ? `http://${request.headers.host}` : "http://localhost";
  const url = new URL(request.url, baseUrl);
  const normalizedPath = getNormalizedRequestPath(url);

  try {
    const routedUrl = new URL(url.toString());
    routedUrl.pathname = normalizedPath;
    const handled = await handleApi(request, response, routedUrl);
    if (handled) {
      return;
    }

    const requestedPath = normalizedPath === "/" ? "/index.html" : normalizedPath;
    const safePath = path.normalize(requestedPath).replace(/^([.][.][/\\])+/, "");
    const filePath = path.join(publicDir, safePath);
    sendFile(response, filePath);
  } catch (error) {
    const statusCode = error.statusCode === 401 || error.statusCode === 403 ? error.statusCode : 500;
    sendJson(response, statusCode, {
      error: statusCode === 500 ? "服务器处理失败，请稍后重试。" : error.message,
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
