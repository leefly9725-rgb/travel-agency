"use strict";

const crypto = require("node:crypto");
const { supabaseRequest } = require("../supabaseClient");

const materialSeeds = [
  ["pvc-3", "3mm PVC发泡板", "1220×2440×3mm", 9.5], ["acp-3", "铝塑复合板", "1220×2440×3mm", 18.5], ["acp-4", "铝塑复合板", "1220×2440×4mm", 21.5],
  ["acrylic-2", "透明亚克力", "1220×2440×2mm", 19], ["acrylic-3", "透明亚克力", "1220×2440×3mm", 26], ["acrylic-5", "透明亚克力", "1220×2440×5mm", 42],
  ["acrylic-10", "透明亚克力", "1220×2440×10mm", 82], ["aluminum-08", "铝板", "1220×2440×0.8mm", 24.5],
].map(([id, nameZh, specification, costPrice]) => ({ id, nameZh, nameEn: id, specification, costPrice, suggestedSalePrice: Number((costPrice * 1.5).toFixed(2)), defaultMarkupRate: 50, minimumSalePrice: costPrice, currency: "EUR", unit: "sqm", sheetWidthMm: 1220, sheetHeightMm: 2440, thicknessMm: Number((specification.match(/×([\d.]+)mm$/) || [0, 0])[1]), effectiveFrom: "2026-01-01", effectiveTo: null, isActive: true, supplierName: "EMA", notes: "V1 seed" }));

const processSeeds = [
  ["uv", "UV平板打印", 15.5, true], ["sticker", "写真车贴", 15, true], ["engraving", "雕刻", 7.5, false], ["laser-cut", "激光切割", 9, false],
  ["laser-engrave", "激光雕刻", 12, false], ["cnc", "CNC切割", 12.5, false], ["heat-bend", "热弯", 10, false], ["groove-bend", "开槽折弯", 0, false, true],
  ["lamination", "覆膜", 5, true], ["drilling", "打孔", 1, false], ["custom-shape", "异形加工", 0, false, true], ["assembly", "组装加工", 0, false, true], ["other", "其他自定义加工", 0, false, true],
].map(([id, nameZh, costPrice, supportsDoubleSide, requiresManualQuote = false]) => ({ id, nameZh, nameEn: id, costPrice, suggestedSalePrice: Number((costPrice * 1.5).toFixed(2)), defaultMarkupRate: 50, unit: "sqm", supportsDoubleSide, requiresManualQuote, defaultMinimumFee: 35, isActive: true, notes: "V1 seed" }));

const allowed = { "pvc-3": ["uv", "sticker", "engraving"], "acp-3": ["engraving", "uv", "groove-bend"], "acp-4": ["engraving", "uv", "groove-bend"], "acrylic-2": ["laser-cut", "uv"], "acrylic-3": ["heat-bend", "engraving", "uv"], "acrylic-5": ["heat-bend", "laser-engrave", "uv"], "acrylic-10": ["laser-engrave", "uv"], "aluminum-08": ["engraving", "uv"] };
const ruleSeeds = Object.entries(allowed).flatMap(([materialId, ids]) => ids.map((processId) => ({ id: `${materialId}-${processId}`, materialId, processId, isActive: true })));
const entitySeeds = [
  { id: "lds", code: "LDS", nameZh: "泷鼎晟国际旅行社", nameEn: "LDS International Travel", quotePrefix: "LDS-ADV", isActive: true },
  { id: "ema", code: "EMA", nameZh: "EMA Media", nameEn: "EMA Media", quotePrefix: "EMA-ADV", isActive: true },
];
const serviceSeeds = [
  { id: "delivery", nameZh: "配送费", nameEn: "Delivery", category: "delivery", unit: "trip", costPrice: 0, suggestedSalePrice: 150, isActive: true },
  { id: "installation", nameZh: "安装费", nameEn: "Installation", category: "installation", unit: "fixed", costPrice: 0, suggestedSalePrice: 0, requiresManualQuote: true, isActive: true },
  { id: "design", nameZh: "设计费", nameEn: "Design", category: "design", unit: "hour", costPrice: 0, suggestedSalePrice: 0, isActive: true },
  { id: "measurement", nameZh: "测量费", nameEn: "Site measurement", category: "measurement", unit: "trip", costPrice: 0, suggestedSalePrice: 0, isActive: true },
  { id: "high-access", nameZh: "高空作业费", nameEn: "High access", category: "construction", unit: "hour", costPrice: 0, suggestedSalePrice: 0, isActive: true },
  { id: "rush", nameZh: "加急费", nameEn: "Rush fee", category: "urgent", unit: "fixed", costPrice: 0, suggestedSalePrice: 0, isActive: true },
];

function priceVersionFromCatalog(catalogType, item) {
  return {
    id: `APV-${crypto.createHash("md5").update(`${catalogType}:${item.id}:1`).digest("hex")}`,
    catalogType,
    catalogId: item.id,
    versionNumber: 1,
    currency: item.currency || "EUR",
    costUnitPrice: Number(item.costPrice || 0),
    saleUnitPrice: Number(item.suggestedSalePrice || 0),
    minimumSaleUnitPrice: item.minimumSalePrice == null ? null : Number(item.minimumSalePrice),
    minimumCharge: Number(item.defaultMinimumFee || 0),
    effectiveFrom: item.effectiveFrom || "2026-01-01",
    changeReason: "V1 catalog baseline",
    supplierSnapshot: item.supplierName ? { supplierName: item.supplierName } : {},
    createdBy: item.updatedBy || "00000000-0000-0000-0000-000000000000",
  };
}

function buildInitialPriceVersions(data) {
  return [
    ...data.advertisingMaterials.map((item) => priceVersionFromCatalog("materials", item)),
    ...data.advertisingProcesses.map((item) => priceVersionFromCatalog("processes", item)),
    ...data.advertisingServiceCatalog.map((item) => priceVersionFromCatalog("services", item)),
  ];
}

function ensureAdvertisingData(data) {
  if (!Array.isArray(data.advertisingMaterials) || !data.advertisingMaterials.length) data.advertisingMaterials = materialSeeds.map((x) => ({ ...x }));
  if (!Array.isArray(data.advertisingProcesses) || !data.advertisingProcesses.length) data.advertisingProcesses = processSeeds.map((x) => ({ ...x }));
  if (!Array.isArray(data.advertisingMaterialProcessRules) || !data.advertisingMaterialProcessRules.length) data.advertisingMaterialProcessRules = ruleSeeds.map((x) => ({ ...x }));
  if (!Array.isArray(data.advertisingServiceCatalog) || !data.advertisingServiceCatalog.length) data.advertisingServiceCatalog = serviceSeeds.map((x) => ({ ...x }));
  if (!Array.isArray(data.advertisingQuotes)) data.advertisingQuotes = [];
  if (!Array.isArray(data.advertisingEntities) || !data.advertisingEntities.length) data.advertisingEntities = entitySeeds.map((x) => ({ ...x }));
  if (!Array.isArray(data.advertisingQuoteAdjustmentLogs)) data.advertisingQuoteAdjustmentLogs = [];
  if (!Array.isArray(data.advertisingPriceVersions)) data.advertisingPriceVersions = buildInitialPriceVersions(data);
  if (!Array.isArray(data.advertisingQuoteBomLines)) data.advertisingQuoteBomLines = [];
  return data;
}

function remoteCatalogRow(row) {
  return { ...(row.data || {}), id: row.id, isActive: row.is_active !== false, updatedAt: row.updated_at || row.data?.updatedAt };
}

function priceVersionRow(row) {
  return {
    id: row.id,
    catalogType: row.catalogType || row.catalog_type,
    catalogId: row.catalogId || row.catalog_id,
    versionNumber: Number(row.versionNumber ?? row.version_number),
    currency: row.currency,
    costUnitPrice: Number(row.costUnitPrice ?? row.cost_unit_price),
    saleUnitPrice: Number(row.saleUnitPrice ?? row.sale_unit_price),
    minimumSaleUnitPrice: row.minimumSaleUnitPrice ?? row.minimum_sale_unit_price ?? null,
    minimumCharge: Number(row.minimumCharge ?? row.minimum_charge ?? 0),
    effectiveFrom: row.effectiveFrom || row.effective_from,
    changeReason: row.changeReason || row.change_reason,
    supplierSnapshot: row.supplierSnapshot || row.supplier_snapshot || {},
    createdBy: row.createdBy || row.created_by,
    createdAt: row.createdAt || row.created_at,
  };
}

function bomLineRow(row) {
  const line = {
    id: row.id,
    quoteId: row.quoteId || row.quote_id,
    quoteItemId: row.quoteItemId ?? row.quote_item_id ?? row.itemId ?? null,
    position: Number(row.position || 0),
    lineType: row.lineType || row.line_type,
    catalogType: row.catalogType ?? row.catalog_type ?? null,
    catalogId: row.catalogId ?? row.catalog_id ?? null,
    priceVersionId: row.priceVersionId ?? row.price_version_id ?? null,
    descriptionSnapshot: row.descriptionSnapshot ?? row.description_snapshot,
    unitSnapshot: row.unitSnapshot ?? row.unit_snapshot,
    quantity: row.quantity == null ? undefined : Number(row.quantity),
    sourceCurrency: row.sourceCurrency || row.source_currency,
    quoteCurrency: row.quoteCurrency || row.quote_currency,
    costUnitPriceSource: row.costUnitPriceSource == null && row.cost_unit_price_source == null && row.sourceCostUnitPrice == null ? undefined : Number(row.costUnitPriceSource ?? row.cost_unit_price_source ?? row.sourceCostUnitPrice),
    saleUnitPriceSource: row.saleUnitPriceSource == null && row.sale_unit_price_source == null && row.sourceSaleUnitPrice == null ? undefined : Number(row.saleUnitPriceSource ?? row.sale_unit_price_source ?? row.sourceSaleUnitPrice),
    costAmount: row.costAmount == null && row.cost_amount == null ? undefined : Number(row.costAmount ?? row.cost_amount),
    saleAmount: row.saleAmount == null && row.sale_amount == null ? undefined : Number(row.saleAmount ?? row.sale_amount),
    customerVisible: row.customerVisible ?? row.customer_visible ?? true,
    supplierSnapshot: row.supplierSnapshot || row.supplier_snapshot || {},
    internalNotes: row.internalNotes ?? row.internal_notes ?? "",
  };
  return Object.fromEntries(Object.entries(line).filter(([, value]) => value !== undefined));
}

function normalizeV2QuotePayload(payload, { regenerateIds = false } = {}) {
  const quoteId = regenerateIds || !String(payload.id || "").trim() ? `ADV-${crypto.randomUUID()}` : payload.id;
  const itemIdMap = new Map();
  const items = (payload.items || []).map((item, index) => {
    const sourceId = item.id || `advertising-item-${index + 1}`;
    const id = regenerateIds || !item.id || /^advertising-item-\d+$/.test(String(item.id)) ? `ADI-${crypto.randomUUID()}` : item.id;
    itemIdMap.set(String(sourceId), id);
    return { ...item, id, quoteId };
  });
  const bomLines = (payload.bomLines || []).map((line, index) => {
    const sourceItemId = line.quoteItemId ?? line.itemId ?? null;
    const quoteItemId = sourceItemId == null ? null : (itemIdMap.get(String(sourceItemId)) || sourceItemId);
    const id = regenerateIds || !line.id || /^bom-line-\d+$/.test(String(line.id)) ? `ABL-${crypto.randomUUID()}` : line.id;
    return bomLineRow({
      id,
      quoteId,
      quoteItemId,
      position: line.position ?? Math.max(0, Number(line.lineNumber || index + 1) - 1),
      lineType: line.lineType,
      catalogType: line.catalogType ?? null,
      catalogId: line.catalogId ?? null,
      priceVersionId: line.priceVersionId ?? null,
      descriptionSnapshot: line.descriptionSnapshot,
      unitSnapshot: line.unitSnapshot,
      quantity: line.quantity,
      sourceCurrency: line.sourceCurrency,
      quoteCurrency: line.quoteCurrency,
      costUnitPriceSource: line.costUnitPriceSource ?? line.sourceCostUnitPrice,
      saleUnitPriceSource: line.saleUnitPriceSource ?? line.sourceSaleUnitPrice,
      costAmount: line.costAmount,
      saleAmount: line.saleAmount,
      customerVisible: line.customerVisible ?? true,
      supplierSnapshot: line.supplierSnapshot || {},
      internalNotes: line.internalNotes || "",
    });
  });
  return { ...payload, id: quoteId, items, bomLines };
}

function remoteQuoteRow(row, bomLines = undefined) {
  const quote = {
    ...(row.data || {}),
    id: row.id,
    quoteNumber: row.quote_number,
    entityId: row.entity_id,
    status: row.status,
    mode: row.mode,
    clientName: row.client_name,
    projectName: row.project_name,
    currency: row.currency,
    ownerId: row.owner_id,
    calculationSnapshot: row.calculation_snapshot || {},
    entitySnapshot: row.entity_snapshot || {},
    termsSnapshot: row.terms_snapshot || {},
    ...(bomLines === undefined ? {} : { bomLines }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if ((row.pricing_engine || row.data?.pricingEngine) === "bom_v2") {
    quote.pricingEngine = "bom_v2";
    quote.fxSnapshot = row.fx_snapshot || row.data?.fxSnapshot || {};
  } else {
    delete quote.pricingEngine;
    delete quote.fxSnapshot;
    delete quote.bomLines;
  }
  return quote;
}

function sortPriceVersions(rows) {
  return rows.sort((a, b) => (
    String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)) ||
    b.versionNumber - a.versionNumber ||
    String(b.id).localeCompare(String(a.id))
  ));
}

function effectivePriceVersion(versions, kind, catalogId, asOf) {
  return sortPriceVersions(versions.filter((version) => (
    version.catalogType === kind &&
    version.catalogId === catalogId &&
    version.effectiveFrom <= asOf
  )))[0];
}

function overlayPriceVersion(item, version) {
  if (!version) return { ...item };
  return {
    ...item,
    costPrice: version.costUnitPrice,
    suggestedSalePrice: version.saleUnitPrice,
    minimumSalePrice: version.minimumSaleUnitPrice,
    defaultMinimumFee: version.minimumCharge,
    currency: version.currency,
    effectiveFrom: version.effectiveFrom,
    activePriceVersion: version,
  };
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function priceVersionError(message, code) {
  return Object.assign(new Error(message), { statusCode: 400, code });
}

function validatePriceVersion(payload) {
  if (!String(payload.adjustmentReason || "").trim()) throw priceVersionError("修改价格必须填写原因。", "ADJUSTMENT_REASON_REQUIRED");
  const values = [payload.costPrice, payload.suggestedSalePrice, payload.minimumSalePrice, payload.defaultMinimumFee].filter((value) => value != null);
  if (!["EUR", "RSD"].includes(payload.currency) || !isValidDate(payload.effectiveFrom) || values.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
    throw priceVersionError("价格版本数据无效。", "ADVERTISING_PRICE_VERSION_INVALID");
  }
  if (!Number.isFinite(Number(payload.costPrice)) || !Number.isFinite(Number(payload.suggestedSalePrice))) {
    throw priceVersionError("价格版本数据无效。", "ADVERTISING_PRICE_VERSION_INVALID");
  }
}

function createAdvertisingQuoteStore({ data, saveData, supabaseConfig = {} }) {
  ensureAdvertisingData(data);
  const persist = () => saveData(data);
  const remote = Boolean(supabaseConfig.enabled);

  async function getRemoteCatalog(asOf) {
    const [materials, processes, rules, services, entities, priceVersions] = await Promise.all([
      supabaseRequest(supabaseConfig, "advertising_materials?select=*&order=updated_at.desc"),
      supabaseRequest(supabaseConfig, "advertising_processes?select=*&order=updated_at.desc"),
      supabaseRequest(supabaseConfig, "advertising_material_process_rules?select=*&order=id"),
      supabaseRequest(supabaseConfig, "advertising_service_catalog?select=*&order=updated_at.desc"),
      supabaseRequest(supabaseConfig, "quotation_entities_or_letterheads?select=*&order=code"),
      supabaseRequest(supabaseConfig, "advertising_price_versions?select=*&order=effective_from.desc,version_number.desc"),
    ]);
    const versions = sortPriceVersions((priceVersions || []).map(priceVersionRow));
    const overlay = (kind, rows) => (rows || []).map(remoteCatalogRow).map((item) => overlayPriceVersion(item, effectivePriceVersion(versions, kind, item.id, asOf)));
    return {
      materials: overlay("materials", materials),
      processes: overlay("processes", processes),
      rules: (rules || []).map((row) => ({ ...remoteCatalogRow(row), materialId: row.material_id, processId: row.process_id })),
      services: overlay("services", services),
      entities: (entities || []).map((row) => ({ ...remoteCatalogRow(row), code: row.code })),
      priceVersions: versions,
    };
  }

  const store = {
    async catalog({ asOf = new Date().toISOString().slice(0, 10) } = {}) {
      if (!isValidDate(asOf)) throw priceVersionError("价格生效日期无效。", "ADVERTISING_PRICE_VERSION_INVALID");
      if (remote) return getRemoteCatalog(asOf);
      const versions = sortPriceVersions(data.advertisingPriceVersions.map(priceVersionRow));
      const overlay = (kind, rows) => rows.map((item) => overlayPriceVersion(item, effectivePriceVersion(versions, kind, item.id, asOf)));
      return {
        materials: overlay("materials", data.advertisingMaterials),
        processes: overlay("processes", data.advertisingProcesses),
        rules: data.advertisingMaterialProcessRules,
        services: overlay("services", data.advertisingServiceCatalog),
        entities: data.advertisingEntities,
        priceVersions: versions,
      };
    },

    async listQuotes(filters = {}) {
      if (remote) {
        const clauses = ["select=*", "order=updated_at.desc"];
        if (filters.ownerId) clauses.push(`owner_id=eq.${encodeURIComponent(filters.ownerId)}`);
        if (filters.entityId) clauses.push(`entity_id=eq.${encodeURIComponent(filters.entityId)}`);
        if (filters.status) clauses.push(`status=eq.${encodeURIComponent(filters.status)}`);
        if (filters.mode) clauses.push(`mode=eq.${encodeURIComponent(filters.mode)}`);
        const rows = await supabaseRequest(supabaseConfig, `advertising_quotes?${clauses.join("&")}`);
        return (rows || []).map((row) => remoteQuoteRow(row));
      }
      return data.advertisingQuotes.filter((quote) => !filters.ownerId || quote.ownerId === filters.ownerId).map(({ calculationSnapshot, ...quote }) => ({
        ...quote,
        totals: calculationSnapshot ? {
          subtotalExcludingVat: calculationSnapshot.subtotalExcludingVat,
          totalIncludingVat: calculationSnapshot.totalIncludingVat,
          grossProfit: calculationSnapshot.grossProfit,
          grossMargin: calculationSnapshot.grossMargin,
        } : {},
      }));
    },

    async getQuote(id) {
      if (remote) {
        const rows = await supabaseRequest(supabaseConfig, `advertising_quotes?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
        if (!rows?.length) throw Object.assign(new Error("广告报价不存在。"), { statusCode: 404 });
        const row = rows[0];
        if ((row.pricing_engine || row.data?.pricingEngine) !== "bom_v2") return remoteQuoteRow(row);
        const bomRows = await supabaseRequest(supabaseConfig, `advertising_quote_bom_lines?select=*&quote_id=eq.${encodeURIComponent(id)}&order=position`);
        return remoteQuoteRow(row, (bomRows || []).map(bomLineRow));
      }
      const quote = data.advertisingQuotes.find((entry) => entry.id === id);
      if (!quote) throw Object.assign(new Error("广告报价不存在。"), { statusCode: 404 });
      if (quote.pricingEngine !== "bom_v2") return structuredClone(quote);
      return structuredClone({ ...quote, bomLines: data.advertisingQuoteBomLines.filter((line) => line.quoteId === id).map(bomLineRow) });
    },

    async saveQuote(payload) {
      const normalizedPayload = payload.pricingEngine === "bom_v2" ? normalizeV2QuotePayload(payload) : payload;
      if (remote && normalizedPayload.pricingEngine === "bom_v2") {
        const { bomLines = [], fxSnapshot = {}, ...quotePayload } = normalizedPayload;
        const result = await supabaseRequest(supabaseConfig, "rpc/save_advertising_quote_v2", {
          method: "POST",
          body: JSON.stringify({ p_quote: quotePayload, p_bom_lines: bomLines, p_fx_snapshot: fxSnapshot }),
        });
        return remoteQuoteRow(Array.isArray(result) ? result[0] : result, bomLines);
      }
      if (remote) {
        const result = await supabaseRequest(supabaseConfig, "rpc/save_advertising_quote", { method: "POST", body: JSON.stringify({ p_quote: normalizedPayload }) });
        return remoteQuoteRow(Array.isArray(result) ? result[0] : result);
      }

      const now = new Date().toISOString();
      const existing = normalizedPayload.id ? data.advertisingQuotes.find((quote) => quote.id === normalizedPayload.id) : null;
      const entity = data.advertisingEntities.find((entry) => entry.id === (normalizedPayload.entityId || existing?.entityId || "lds"));
      if (!entity) throw Object.assign(new Error("报价主体不存在。"), { statusCode: 400 });
      const year = new Date().getFullYear();
      const prefix = `${entity.quotePrefix}-${year}-`;
      const highest = data.advertisingQuotes.reduce((max, quote) => {
        const number = String(quote.quoteNumber || "");
        if (!number.startsWith(prefix)) return max;
        const suffix = Number(number.slice(prefix.length));
        return Number.isInteger(suffix) ? Math.max(max, suffix) : max;
      }, 0);
      const next = String(highest + 1).padStart(4, "0");
      const { bomLines, ...quotePayload } = normalizedPayload;
      const quote = {
        ...existing,
        ...quotePayload,
        ...(normalizedPayload.pricingEngine === "bom_v2" && existing?.fxSnapshot && Object.keys(existing.fxSnapshot).length ? { fxSnapshot: existing.fxSnapshot } : {}),
        id: existing?.id || normalizedPayload.id || `ADV-${crypto.randomUUID()}`,
        quoteNumber: existing?.quoteNumber || `${prefix}${next}`,
        entityId: entity.id,
        entitySnapshot: existing?.entitySnapshot || structuredClone(entity),
        status: normalizedPayload.status || existing?.status || "draft",
        quoteDate: normalizedPayload.quoteDate || existing?.quoteDate || now.slice(0, 10),
        validUntil: normalizedPayload.validUntil || existing?.validUntil || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      const index = data.advertisingQuotes.findIndex((entry) => entry.id === quote.id);
      if (index >= 0) data.advertisingQuotes[index] = quote;
      else data.advertisingQuotes.push(quote);
      if (normalizedPayload.pricingEngine === "bom_v2") {
        data.advertisingQuoteBomLines = data.advertisingQuoteBomLines.filter((line) => line.quoteId !== quote.id);
        data.advertisingQuoteBomLines.push(...(bomLines || []).map((line) => ({ ...line, quoteId: quote.id })));
      }
      for (const log of normalizedPayload.adjustmentLogs || []) data.advertisingQuoteAdjustmentLogs.push({ ...log, id: crypto.randomUUID(), quoteId: quote.id, createdAt: now });
      persist();
      return this.getQuote(quote.id);
    },

    async duplicate(id) {
      const source = await this.getQuote(id);
      delete source.id;
      delete source.quoteNumber;
      source.status = "draft";
      source.projectName = `${source.projectName || "广告报价"} - 副本`;
      if (source.pricingEngine === "bom_v2") return this.saveQuote(normalizeV2QuotePayload(source, { regenerateIds: true }));
      return this.saveQuote(source);
    },

    async deleteQuote(id) {
      if (remote) {
        const deleted = await supabaseRequest(supabaseConfig, `advertising_quotes?id=eq.${encodeURIComponent(id)}&select=id`, { method: "DELETE", headers: { Prefer: "return=representation" } });
        return Array.isArray(deleted) && deleted.length > 0;
      }
      const index = data.advertisingQuotes.findIndex((quote) => quote.id === id);
      if (index < 0) return false;
      data.advertisingQuotes.splice(index, 1);
      data.advertisingQuoteBomLines = data.advertisingQuoteBomLines.filter((line) => line.quoteId !== id);
      persist();
      return true;
    },

    async listPriceVersions({ catalogType, catalogId } = {}) {
      if (remote) {
        const clauses = ["select=*", "order=effective_from.desc,version_number.desc"];
        if (catalogType) clauses.push(`catalog_type=eq.${encodeURIComponent(catalogType)}`);
        if (catalogId) clauses.push(`catalog_id=eq.${encodeURIComponent(catalogId)}`);
        const rows = await supabaseRequest(supabaseConfig, `advertising_price_versions?${clauses.join("&")}`);
        return (rows || []).map(priceVersionRow);
      }
      return structuredClone(sortPriceVersions(data.advertisingPriceVersions.map(priceVersionRow).filter((version) => (!catalogType || version.catalogType === catalogType) && (!catalogId || version.catalogId === catalogId))));
    },

    async saveCatalogPriceVersion(kind, payload, id, userId) {
      if (!["materials", "processes", "services"].includes(kind)) throw priceVersionError("价格库类型无效。", "ADVERTISING_CATALOG_KIND_INVALID");
      validatePriceVersion(payload);
      const catalogId = id || payload.id || crypto.randomUUID();
      const { activePriceVersion: _activePriceVersion, ...catalogPayload } = payload;
      const item = { ...catalogPayload, id: catalogId };
      const priceVersion = {
        currency: payload.currency,
        costUnitPrice: Number(payload.costPrice),
        saleUnitPrice: Number(payload.suggestedSalePrice),
        minimumSaleUnitPrice: payload.minimumSalePrice == null ? null : Number(payload.minimumSalePrice),
        minimumCharge: Number(payload.defaultMinimumFee || 0),
        effectiveFrom: payload.effectiveFrom,
        changeReason: String(payload.adjustmentReason).trim(),
        supplierSnapshot: payload.supplierSnapshot || (payload.supplierName ? { supplierName: payload.supplierName } : {}),
      };
      if (remote) {
        const result = await supabaseRequest(supabaseConfig, "rpc/save_advertising_catalog_entry_v2", {
          method: "POST",
          body: JSON.stringify({ p_kind: kind, p_item: item, p_price_version: priceVersion, p_user_id: userId }),
        });
        const row = Array.isArray(result) ? result[0] : result;
        const version = priceVersionRow(row.priceVersion || row.price_version);
        return overlayPriceVersion(remoteCatalogRow(row.item), version);
      }

      const map = { materials: "advertisingMaterials", processes: "advertisingProcesses", services: "advertisingServiceCatalog" };
      const key = map[kind];
      const existingIndex = data[key].findIndex((entry) => entry.id === catalogId);
      const metadata = { ...item, updatedAt: new Date().toISOString(), updatedBy: userId || null };
      for (const field of ["costPrice", "suggestedSalePrice", "minimumSalePrice", "defaultMinimumFee", "currency", "effectiveFrom", "adjustmentReason", "supplierSnapshot", "activePriceVersion"]) delete metadata[field];
      if (existingIndex >= 0) data[key][existingIndex] = { ...data[key][existingIndex], ...metadata };
      else data[key].push(metadata);
      const versions = data.advertisingPriceVersions.filter((version) => version.catalogType === kind && version.catalogId === catalogId);
      const version = {
        id: `APV-${crypto.randomUUID()}`,
        catalogType: kind,
        catalogId,
        versionNumber: versions.reduce((max, entry) => Math.max(max, Number(entry.versionNumber) || 0), 0) + 1,
        ...priceVersion,
        createdBy: userId || null,
        createdAt: new Date().toISOString(),
      };
      data.advertisingPriceVersions.push(version);
      persist();
      return structuredClone(overlayPriceVersion(data[key].find((entry) => entry.id === catalogId), version));
    },

    async updateCatalog(kind, payload, id, userId) {
      const map = { materials: ["advertisingMaterials", "advertising_materials"], processes: ["advertisingProcesses", "advertising_processes"], rules: ["advertisingMaterialProcessRules", "advertising_material_process_rules"], services: ["advertisingServiceCatalog", "advertising_service_catalog"], entities: ["advertisingEntities", "quotation_entities_or_letterheads"] };
      const pair = map[kind];
      if (!pair) throw Object.assign(new Error("价格库类型无效。"), { statusCode: 400 });
      const item = { ...payload, id: id || payload.id || crypto.randomUUID(), updatedAt: new Date().toISOString(), updatedBy: userId || null };
      const old = (await this.catalog())[kind]?.find((entry) => entry.id === item.id);
      const priceFields = ["costPrice", "suggestedSalePrice", "minimumSalePrice", "defaultMinimumFee"];
      const changedFields = old ? priceFields.filter((field) => payload[field] !== undefined && Number(payload[field]) !== Number(old[field])) : [];
      if (changedFields.length && !String(payload.adjustmentReason || "").trim()) throw Object.assign(new Error("修改价格必须填写原因。"), { statusCode: 400, code: "ADJUSTMENT_REASON_REQUIRED" });
      if (changedFields.length && ["materials", "processes", "services"].includes(kind) && (payload.effectiveFrom !== undefined || payload.currency !== undefined)) {
        return this.saveCatalogPriceVersion(kind, { ...old, ...payload }, item.id, userId);
      }
      if (remote) {
        const logs = changedFields.map((field) => ({ fieldName: field, oldValue: old[field], newValue: item[field], reason: payload.adjustmentReason }));
        const result = await supabaseRequest(supabaseConfig, "rpc/save_advertising_catalog_entry", { method: "POST", body: JSON.stringify({ p_kind: kind, p_item: item, p_logs: logs, p_user_id: userId }) });
        return remoteCatalogRow(Array.isArray(result) ? result[0] : result);
      }
      const key = pair[0];
      const index = data[key].findIndex((entry) => entry.id === item.id);
      if (index >= 0) data[key][index] = { ...data[key][index], ...item };
      else data[key].push(item);
      for (const field of changedFields) data.advertisingQuoteAdjustmentLogs.push({ id: crypto.randomUUID(), catalogType: kind, catalogId: item.id, fieldName: field, oldValue: old[field], newValue: item[field], reason: payload.adjustmentReason, userId, createdAt: new Date().toISOString() });
      persist();
      return structuredClone(index >= 0 ? data[key][index] : item);
    },

    async listAdjustmentLogs(quoteId) {
      if (remote) {
        const suffix = quoteId ? `?select=*&quote_id=eq.${encodeURIComponent(quoteId)}&order=created_at.desc` : "?select=*&order=created_at.desc";
        return (await supabaseRequest(supabaseConfig, `advertising_quote_adjustment_logs${suffix}`)) || [];
      }
      return data.advertisingQuoteAdjustmentLogs.filter((log) => !quoteId || log.quoteId === quoteId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
  };
  return store;
}

module.exports = { createAdvertisingQuoteStore, ensureAdvertisingData, materialSeeds, processSeeds, ruleSeeds, entitySeeds, serviceSeeds };
