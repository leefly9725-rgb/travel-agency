"use strict";

const round = (value, digits = 2) => Number((Number(value || 0)).toFixed(digits));
const positive = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

function bomError(message, code) {
  return Object.assign(new Error(message), { code, statusCode: 422 });
}

function copySnapshot(value) {
  if (value === undefined || value === null) return value ?? null;
  if (Array.isArray(value)) return value.map(copySnapshot);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copySnapshot(entry)]));
  return value;
}

function assertBomCurrency(currency) {
  if (currency === "EUR" || currency === "RSD") return currency;
  throw bomError("BOM 仅支持 EUR 或 RSD 币种。", "ADVERTISING_FX_SNAPSHOT_INVALID");
}

function validateFxSnapshot(fxSnapshot) {
  const snapshot = fxSnapshot || {};
  if (
    snapshot.baseCurrency !== "EUR" ||
    snapshot.quoteCurrency !== "RSD" ||
    !Number.isFinite(Number(snapshot.rate)) ||
    Number(snapshot.rate) <= 0 ||
    !snapshot.rateDate ||
    !snapshot.source
  ) {
    throw bomError("汇率快照无效。", "ADVERTISING_FX_SNAPSHOT_INVALID");
  }
  return {
    baseCurrency: "EUR",
    quoteCurrency: "RSD",
    rate: Number(snapshot.rate),
    rateDate: snapshot.rateDate,
    source: snapshot.source,
  };
}

function convertBomMoney(amount, fromCurrency, toCurrency, fxSnapshot) {
  const snapshot = validateFxSnapshot(fxSnapshot);
  const from = assertBomCurrency(fromCurrency);
  const to = assertBomCurrency(toCurrency);
  const money = Number(amount);
  if (!Number.isFinite(money)) throw bomError("金额无效。", "ADVERTISING_FX_SNAPSHOT_INVALID");
  if (from === to) return round(money);
  return from === "EUR"
    ? round(money * snapshot.rate)
    : round(money / snapshot.rate);
}

function selectEffectivePriceVersion(priceVersions, catalogType, catalogId, effectiveOn) {
  const candidates = (priceVersions || [])
    .filter((version) => (
      version.catalogType === catalogType &&
      String(version.catalogId) === String(catalogId) &&
      version.effectiveFrom &&
      version.effectiveFrom <= effectiveOn
    ))
    .sort((left, right) => (
      right.effectiveFrom.localeCompare(left.effectiveFrom) ||
      Number(right.versionNumber || 0) - Number(left.versionNumber || 0)
    ));
  if (!candidates.length) {
    throw bomError("找不到生效的价格版本。", "ADVERTISING_PRICE_VERSION_UNAVAILABLE");
  }
  return copySnapshot(candidates[0]);
}

function findActive(rows, id, label) {
  const found = (rows || []).find((row) => String(row.id) === String(id) && row.isActive !== false);
  if (!found) throw bomError(`${label}不存在或已停用。`, "ADVERTISING_PRICE_VERSION_UNAVAILABLE");
  return found;
}

function convertAreaToSquareMeters(width, height, unit = "mm") {
  const factor = { mm: 0.001, cm: 0.01, m: 1 }[unit];
  const w = positive(width);
  const h = positive(height);
  if (!factor || !w || !h) {
    throw bomError("展板尺寸必须为有效的正数。", "ADVERTISING_BOM_TEMPLATE_UNSUPPORTED");
  }
  return round(w * factor * h * factor, 4);
}

function supplierSnapshot(catalogItem, priceVersion) {
  if (priceVersion.supplierSnapshot !== undefined) return copySnapshot(priceVersion.supplierSnapshot);
  if (catalogItem.supplierSnapshot !== undefined) return copySnapshot(catalogItem.supplierSnapshot);
  return {
    id: priceVersion.supplierId || catalogItem.supplierId || null,
    nameZh: priceVersion.supplierNameZh || catalogItem.supplierNameZh || null,
  };
}

function buildCatalogLine({ lineType, item, catalogType, catalogItem, priceVersion, quantity, quoteCurrency, fxSnapshot, lineNumber }) {
  const sourceCostUnitPrice = positive(priceVersion.costUnitPrice);
  const sourceSaleUnitPrice = Math.max(
    positive(priceVersion.saleUnitPrice),
    positive(priceVersion.minimumSaleUnitPrice)
  );
  const sourceMinimumCharge = positive(priceVersion.minimumCharge);
  const costUnitPrice = convertBomMoney(sourceCostUnitPrice, priceVersion.currency, quoteCurrency, fxSnapshot);
  const saleUnitPrice = convertBomMoney(sourceSaleUnitPrice, priceVersion.currency, quoteCurrency, fxSnapshot);
  const minimumCharge = convertBomMoney(sourceMinimumCharge, priceVersion.currency, quoteCurrency, fxSnapshot);
  const costAmount = round(quantity * costUnitPrice);
  const saleAmount = round(Math.max(quantity * saleUnitPrice, minimumCharge));
  const description = catalogItem.description || catalogItem.descriptionZh || catalogItem.nameZh || catalogItem.name || catalogItem.id;
  return {
    id: `bom-line-${lineNumber}`,
    lineNumber,
    itemId: item.id || "advertising-item-1",
    lineType,
    catalogType,
    catalogId: catalogItem.id,
    nameSnapshot: catalogItem.nameZh || catalogItem.name || catalogItem.id,
    descriptionSnapshot: description,
    unitSnapshot: catalogItem.unit || "fixed",
    quantity: round(quantity, 4),
    quoteCurrency,
    priceVersionId: priceVersion.id,
    priceVersionSnapshot: copySnapshot(priceVersion),
    supplierSnapshot: supplierSnapshot(catalogItem, priceVersion),
    sourceCurrency: priceVersion.currency,
    sourceCostUnitPrice,
    sourceSaleUnitPrice,
    sourceMinimumSaleUnitPrice: positive(priceVersion.minimumSaleUnitPrice),
    sourceMinimumCharge,
    costUnitPrice,
    saleUnitPrice,
    minimumCharge,
    costAmount,
    saleAmount,
  };
}

function buildPvcUvBoardBomLines({ item, catalog, quoteCurrency, effectiveOn, fxSnapshot }) {
  const material = findActive(catalog.materials, "pvc-3", "PVC 材料");
  const process = findActive(catalog.processes, "uv", "UV 工艺");
  const rule = (catalog.rules || []).find((entry) => (
    String(entry.materialId) === String(material.id) &&
    String(entry.processId) === String(process.id) &&
    entry.isActive !== false
  ));
  if (!rule) throw bomError("PVC 材料不支持 UV 工艺。", "ADVERTISING_BOM_TEMPLATE_UNSUPPORTED");

  const materialArea = round(convertAreaToSquareMeters(item.width, item.height, item.sizeUnit || "mm") * (positive(item.quantity, 1) || 1), 4);
  const processArea = round(materialArea * (Number(item.sides) === 2 && process.supportsDoubleSide ? 2 : 1), 4);
  const lines = [];
  const addCatalogLine = (lineType, catalogType, catalogItem, quantity) => {
    if (quantity <= 0) return;
    const priceVersion = selectEffectivePriceVersion(catalog.priceVersions, catalogType, catalogItem.id, effectiveOn);
    lines.push(buildCatalogLine({
      lineType,
      item,
      catalogType,
      catalogItem,
      priceVersion,
      quantity,
      quoteCurrency,
      fxSnapshot,
      lineNumber: lines.length + 1,
    }));
  };

  addCatalogLine("material", "materials", material, materialArea);
  addCatalogLine("process", "processes", process, processArea);
  [
    ["labor", "production-labor", item.laborHours],
    ["installation", "installation", item.installationQuantity],
    ["transport", "delivery", item.transportTrips],
    ["design", "design", item.designHours],
  ].forEach(([lineType, serviceId, quantity]) => {
    const requested = positive(quantity);
    if (requested > 0) addCatalogLine(lineType, "services", findActive(catalog.services, serviceId, "服务"), requested);
  });
  return lines;
}

function buildDiscountLine(discountAmount, quoteCurrency, lineNumber) {
  return {
    id: `bom-line-${lineNumber + 1}`,
    lineNumber: lineNumber + 1,
    lineType: "discount",
    itemId: null,
    nameSnapshot: "折扣",
    descriptionSnapshot: "报价折扣",
    unitSnapshot: "fixed",
    quantity: 1,
    quoteCurrency,
    priceVersionId: null,
    supplierSnapshot: null,
    sourceCurrency: quoteCurrency,
    sourceCostUnitPrice: 0,
    sourceSaleUnitPrice: -discountAmount,
    sourceMinimumSaleUnitPrice: 0,
    sourceMinimumCharge: 0,
    costUnitPrice: 0,
    saleUnitPrice: -discountAmount,
    minimumCharge: 0,
    costAmount: 0,
    saleAmount: -discountAmount,
  };
}

function aggregateBomQuotation(input, bomLines, context, fxSnapshot) {
  const item = input.items[0];
  const itemLines = bomLines.filter((line) => line.itemId === (item.id || "advertising-item-1"));
  const itemCost = round(itemLines.reduce((sum, line) => sum + line.costAmount, 0));
  const itemSale = round(itemLines.reduce((sum, line) => sum + line.saleAmount, 0));
  const subtotalExcludingVat = round(bomLines.reduce((sum, line) => sum + line.saleAmount, 0));
  const vatRate = input.vatMode === "not_applicable" ? 0 : positive(input.vatRate, 20);
  const netSubtotal = input.vatMode === "inclusive" && vatRate
    ? round(subtotalExcludingVat / (1 + vatRate / 100))
    : subtotalExcludingVat;
  const vatAmount = input.vatMode === "exclusive"
    ? round(netSubtotal * vatRate / 100)
    : input.vatMode === "inclusive"
      ? round(subtotalExcludingVat - netSubtotal)
      : 0;
  const totalIncludingVat = input.vatMode === "inclusive"
    ? subtotalExcludingVat
    : round(netSubtotal + vatAmount);
  const totalCost = round(bomLines.reduce((sum, line) => sum + line.costAmount, 0));
  const grossProfit = round(netSubtotal - totalCost);
  return {
    pricingEngine: "bom_v2",
    quoteCurrency: input.currency || "EUR",
    fxSnapshot: copySnapshot(fxSnapshot),
    bomLines,
    items: [{ ...item, costAmount: itemCost, saleAmount: itemSale }],
    subtotalExcludingVat: netSubtotal,
    vatRate,
    vatAmount,
    totalIncludingVat,
    totalCost,
    grossProfit,
    grossMargin: netSubtotal ? round(grossProfit / netSubtotal * 100) : 0,
    calculatedAt: new Date().toISOString(),
    calculatedBy: context.userId || null,
  };
}

function calculateAdvertisingBomQuotation(input = {}, catalog = {}, context = {}) {
  if (input.pricingEngine !== "bom_v2" || input.items?.length !== 1 || input.items[0]?.bomTemplateCode !== "pvc_uv_board_v1") {
    throw bomError("只支持单个 PVC UV 展板模板。", "ADVERTISING_BOM_TEMPLATE_UNSUPPORTED");
  }
  const fxSnapshot = validateFxSnapshot(context.fxSnapshot);
  const quoteCurrency = assertBomCurrency(input.currency || "EUR");
  const bomLines = buildPvcUvBoardBomLines({
    item: input.items[0],
    catalog,
    quoteCurrency,
    effectiveOn: input.quoteDate || new Date().toISOString().slice(0, 10),
    fxSnapshot,
  });
  const positiveSubtotal = round(bomLines.reduce((sum, line) => sum + line.saleAmount, 0));
  const discountAmount = round(Math.min(
    positiveSubtotal,
    positiveSubtotal * positive(input.discountPercent) / 100 + positive(input.fixedDiscount)
  ));
  if (discountAmount > 0) bomLines.push(buildDiscountLine(discountAmount, quoteCurrency, bomLines.length));
  return aggregateBomQuotation(input, bomLines, context, fxSnapshot);
}

module.exports = {
  selectEffectivePriceVersion,
  convertBomMoney,
  buildPvcUvBoardBomLines,
  calculateAdvertisingBomQuotation,
};
