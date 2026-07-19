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

function ensureAdvertisingData(data) {
  if (!Array.isArray(data.advertisingMaterials) || !data.advertisingMaterials.length) data.advertisingMaterials = materialSeeds.map((x) => ({ ...x }));
  if (!Array.isArray(data.advertisingProcesses) || !data.advertisingProcesses.length) data.advertisingProcesses = processSeeds.map((x) => ({ ...x }));
  if (!Array.isArray(data.advertisingMaterialProcessRules) || !data.advertisingMaterialProcessRules.length) data.advertisingMaterialProcessRules = ruleSeeds.map((x) => ({ ...x }));
  if (!Array.isArray(data.advertisingServiceCatalog) || !data.advertisingServiceCatalog.length) data.advertisingServiceCatalog = serviceSeeds.map((x) => ({ ...x }));
  if (!Array.isArray(data.advertisingQuotes)) data.advertisingQuotes = [];
  if (!Array.isArray(data.advertisingEntities) || !data.advertisingEntities.length) data.advertisingEntities = entitySeeds.map((x) => ({ ...x }));
  if (!Array.isArray(data.advertisingQuoteAdjustmentLogs)) data.advertisingQuoteAdjustmentLogs = [];
  return data;
}

function remoteCatalogRow(row) { return { ...(row.data || {}), id: row.id, isActive: row.is_active !== false, updatedAt: row.updated_at || row.data?.updatedAt }; }
function remoteQuoteRow(row) { return { ...(row.data || {}), id: row.id, quoteNumber: row.quote_number, entityId: row.entity_id, status: row.status, mode: row.mode, clientName: row.client_name, projectName: row.project_name, currency: row.currency, ownerId: row.owner_id, calculationSnapshot: row.calculation_snapshot || {}, entitySnapshot: row.entity_snapshot || {}, termsSnapshot: row.terms_snapshot || {}, createdAt: row.created_at, updatedAt: row.updated_at }; }

function createAdvertisingQuoteStore({ data, saveData, supabaseConfig = {} }) {
  ensureAdvertisingData(data);
  const persist = () => saveData(data);
  const remote = Boolean(supabaseConfig.enabled);
  async function getRemoteCatalog() {
    const [materials, processes, rules, services, entities] = await Promise.all([
      supabaseRequest(supabaseConfig, "advertising_materials?select=*&order=updated_at.desc"),
      supabaseRequest(supabaseConfig, "advertising_processes?select=*&order=updated_at.desc"),
      supabaseRequest(supabaseConfig, "advertising_material_process_rules?select=*&order=id"),
      supabaseRequest(supabaseConfig, "advertising_service_catalog?select=*&order=updated_at.desc"),
      supabaseRequest(supabaseConfig, "quotation_entities_or_letterheads?select=*&order=code"),
    ]);
    return { materials: (materials || []).map(remoteCatalogRow), processes: (processes || []).map(remoteCatalogRow), rules: (rules || []).map((row) => ({ ...remoteCatalogRow(row), materialId: row.material_id, processId: row.process_id })), services: (services || []).map(remoteCatalogRow), entities: (entities || []).map((row) => ({ ...remoteCatalogRow(row), code: row.code })) };
  }
  return {
    async catalog() { return remote ? getRemoteCatalog() : { materials: data.advertisingMaterials, processes: data.advertisingProcesses, rules: data.advertisingMaterialProcessRules, services: data.advertisingServiceCatalog, entities: data.advertisingEntities }; },
    async listQuotes(filters = {}) { if (remote) { const clauses=["select=*","order=updated_at.desc"];if(filters.ownerId)clauses.push(`owner_id=eq.${encodeURIComponent(filters.ownerId)}`);if(filters.entityId)clauses.push(`entity_id=eq.${encodeURIComponent(filters.entityId)}`);if(filters.status)clauses.push(`status=eq.${encodeURIComponent(filters.status)}`);if(filters.mode)clauses.push(`mode=eq.${encodeURIComponent(filters.mode)}`);const rows = await supabaseRequest(supabaseConfig, `advertising_quotes?${clauses.join('&')}`); return (rows || []).map(remoteQuoteRow); } return data.advertisingQuotes.filter(q=>!filters.ownerId||q.ownerId===filters.ownerId).map(({ calculationSnapshot, ...quote }) => ({ ...quote, totals: calculationSnapshot ? { subtotalExcludingVat: calculationSnapshot.subtotalExcludingVat, totalIncludingVat: calculationSnapshot.totalIncludingVat, grossProfit: calculationSnapshot.grossProfit, grossMargin: calculationSnapshot.grossMargin } : {} })); },
    async getQuote(id) { if (remote) { const rows = await supabaseRequest(supabaseConfig, `advertising_quotes?select=*&id=eq.${encodeURIComponent(id)}&limit=1`); if (!rows?.length) throw Object.assign(new Error("广告报价不存在。"), { statusCode: 404 }); return remoteQuoteRow(rows[0]); } const quote = data.advertisingQuotes.find((entry) => entry.id === id); if (!quote) throw Object.assign(new Error("广告报价不存在。"), { statusCode: 404 }); return structuredClone(quote); },
    async saveQuote(payload) {
      if (remote) { const result = await supabaseRequest(supabaseConfig, "rpc/save_advertising_quote", { method: "POST", body: JSON.stringify({ p_quote: payload }) }); return remoteQuoteRow(Array.isArray(result) ? result[0] : result); }
      const now = new Date().toISOString(); const existing = payload.id ? data.advertisingQuotes.find((q) => q.id === payload.id) : null;
      const entity = data.advertisingEntities.find((x) => x.id === (payload.entityId || existing?.entityId || "lds"));
      if (!entity) throw Object.assign(new Error("报价主体不存在。"), { statusCode: 400 });
      const year = new Date().getFullYear(); const prefix = `${entity.quotePrefix}-${year}-`;
      const highest = data.advertisingQuotes.reduce((max, quote) => { const number = String(quote.quoteNumber || ""); if (!number.startsWith(prefix)) return max; const suffix = Number(number.slice(prefix.length)); return Number.isInteger(suffix) ? Math.max(max, suffix) : max; }, 0); const next = String(highest + 1).padStart(4, "0");
      const quote = { ...existing, ...payload, id: existing?.id || `ADV-${crypto.randomUUID()}`, quoteNumber: existing?.quoteNumber || `${prefix}${next}`, entityId: entity.id, entitySnapshot: existing?.entitySnapshot || structuredClone(entity), status: payload.status || existing?.status || "draft", quoteDate: payload.quoteDate || existing?.quoteDate || now.slice(0, 10), validUntil: payload.validUntil || existing?.validUntil || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10), createdAt: existing?.createdAt || now, updatedAt: now };
      const index = data.advertisingQuotes.findIndex((q) => q.id === quote.id); if (index >= 0) data.advertisingQuotes[index] = quote; else data.advertisingQuotes.push(quote); for (const log of payload.adjustmentLogs || []) data.advertisingQuoteAdjustmentLogs.push({ ...log, id: crypto.randomUUID(), quoteId: quote.id, createdAt: now }); persist(); return structuredClone(quote);
    },
    async duplicate(id) { const source = await this.getQuote(id); delete source.id; delete source.quoteNumber; source.status = "draft"; source.projectName = `${source.projectName || "广告报价"} - 副本`; return this.saveQuote(source); },
    async deleteQuote(id) { if (remote) { const deleted = await supabaseRequest(supabaseConfig, `advertising_quotes?id=eq.${encodeURIComponent(id)}&select=id`, { method: "DELETE", headers: { Prefer: "return=representation" } }); return Array.isArray(deleted) && deleted.length > 0; } const index = data.advertisingQuotes.findIndex((q) => q.id === id); if (index < 0) return false; data.advertisingQuotes.splice(index, 1); persist(); return true; },
    async updateCatalog(kind, payload, id, userId) { const map = { materials: ["advertisingMaterials", "advertising_materials"], processes: ["advertisingProcesses", "advertising_processes"], rules: ["advertisingMaterialProcessRules", "advertising_material_process_rules"], services: ["advertisingServiceCatalog", "advertising_service_catalog"], entities: ["advertisingEntities", "quotation_entities_or_letterheads"] }; const pair = map[kind]; if (!pair) throw Object.assign(new Error("价格库类型无效。"), { statusCode: 400 }); const item = { ...payload, id: id || payload.id || crypto.randomUUID(), updatedAt: new Date().toISOString(), updatedBy: userId || null }; const old = (await this.catalog())[kind]?.find((x) => x.id === item.id); const priceFields = ["costPrice","suggestedSalePrice","minimumSalePrice","defaultMinimumFee"]; const changedFields = old ? priceFields.filter((field) => payload[field] !== undefined && Number(payload[field]) !== Number(old[field])) : []; if (changedFields.length && !String(payload.adjustmentReason || "").trim()) throw Object.assign(new Error("修改价格必须填写原因。"), { statusCode: 400, code: "ADJUSTMENT_REASON_REQUIRED" }); if (remote) { const logs = changedFields.map((field) => ({ fieldName: field, oldValue: old[field], newValue: item[field], reason: payload.adjustmentReason })); const result = await supabaseRequest(supabaseConfig, "rpc/save_advertising_catalog_entry", { method: "POST", body: JSON.stringify({ p_kind: kind, p_item: item, p_logs: logs, p_user_id: userId }) }); return remoteCatalogRow(Array.isArray(result) ? result[0] : result); } const key = pair[0]; const index = data[key].findIndex((x) => x.id === item.id); if (index >= 0) data[key][index] = { ...data[key][index], ...item }; else data[key].push(item); for (const field of changedFields) data.advertisingQuoteAdjustmentLogs.push({ id: crypto.randomUUID(), catalogType: kind, catalogId: item.id, fieldName: field, oldValue: old[field], newValue: item[field], reason: payload.adjustmentReason, userId, createdAt: new Date().toISOString() }); persist(); return structuredClone(index >= 0 ? data[key][index] : item); },
    async listAdjustmentLogs(quoteId) { if (remote) { const suffix = quoteId ? `?select=*&quote_id=eq.${encodeURIComponent(quoteId)}&order=created_at.desc` : "?select=*&order=created_at.desc"; return (await supabaseRequest(supabaseConfig, `advertising_quote_adjustment_logs${suffix}`)) || []; } return data.advertisingQuoteAdjustmentLogs.filter((log) => !quoteId || log.quoteId === quoteId).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))); },
  };
}

module.exports = { createAdvertisingQuoteStore, ensureAdvertisingData, materialSeeds, processSeeds, ruleSeeds, entitySeeds, serviceSeeds };
