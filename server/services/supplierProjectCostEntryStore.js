'use strict';

const { supabaseRequest } = require('../supabaseClient');
const { loadSeedData, saveSeedData } = require('../dataStore');

function generateCostEntryId() {
  return `SPCE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function ensureSupplierProjectCostEntriesData(data) {
  if (!Array.isArray(data.supplierProjectCostEntries)) data.supplierProjectCostEntries = [];
}

function normalizeEntryFromSupabase(row) {
  return {
    id: row.id || '',
    projectId: row.project_id || '',
    supplierProjectCostId: row.supplier_project_cost_id || '',
    supplierId: row.supplier_id || '',
    supplierDisplay: row.supplier_display || '',
    entryType: row.entry_type || 'invoice',
    sourceType: row.source_type || 'invoice_text',
    sourceImportId: row.source_import_id || '',
    invoiceNumber: row.invoice_number || '',
    invoiceDate: row.invoice_date || null,
    originalCurrency: row.original_currency || 'EUR',
    originalAmount: row.original_amount != null ? Number(row.original_amount) : null,
    originalSubtotalAmount: row.original_subtotal_amount != null ? Number(row.original_subtotal_amount) : null,
    originalTaxAmount: row.original_tax_amount != null ? Number(row.original_tax_amount) : null,
    projectCurrency: row.project_currency || 'EUR',
    exchangeRate: row.exchange_rate != null ? Number(row.exchange_rate) : null,
    exchangeRateDate: row.exchange_rate_date || null,
    exchangeRateSource: row.exchange_rate_source || '',
    convertedAmount: row.converted_amount != null ? Number(row.converted_amount) : null,
    conversionMethod: row.conversion_method || 'same_currency',
    costStatus: row.cost_status || 'confirmed',
    notes: row.notes || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function normalizeLocalEntry(item) {
  return {
    id: item.id || '',
    projectId: item.projectId || '',
    supplierProjectCostId: item.supplierProjectCostId || '',
    supplierId: item.supplierId || '',
    supplierDisplay: item.supplierDisplay || '',
    entryType: item.entryType || 'invoice',
    sourceType: item.sourceType || 'invoice_text',
    sourceImportId: item.sourceImportId || '',
    invoiceNumber: item.invoiceNumber || '',
    invoiceDate: item.invoiceDate || null,
    originalCurrency: item.originalCurrency || 'EUR',
    originalAmount: item.originalAmount != null ? Number(item.originalAmount) : null,
    originalSubtotalAmount: item.originalSubtotalAmount != null ? Number(item.originalSubtotalAmount) : null,
    originalTaxAmount: item.originalTaxAmount != null ? Number(item.originalTaxAmount) : null,
    projectCurrency: item.projectCurrency || 'EUR',
    exchangeRate: item.exchangeRate != null ? Number(item.exchangeRate) : null,
    exchangeRateDate: item.exchangeRateDate || null,
    exchangeRateSource: item.exchangeRateSource || '',
    convertedAmount: item.convertedAmount != null ? Number(item.convertedAmount) : null,
    conversionMethod: item.conversionMethod || 'same_currency',
    costStatus: item.costStatus || 'confirmed',
    notes: item.notes || '',
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || '',
  };
}

function buildSupabaseEntryPayload(item) {
  return {
    id: item.id,
    project_id: item.projectId,
    supplier_project_cost_id: item.supplierProjectCostId || '',
    supplier_id: item.supplierId || '',
    supplier_display: item.supplierDisplay || '',
    entry_type: item.entryType || 'invoice',
    source_type: item.sourceType || 'invoice_text',
    source_import_id: item.sourceImportId || '',
    invoice_number: item.invoiceNumber || '',
    invoice_date: item.invoiceDate || null,
    original_currency: item.originalCurrency || 'EUR',
    original_amount: item.originalAmount != null ? Number(item.originalAmount) : null,
    original_subtotal_amount: item.originalSubtotalAmount != null ? Number(item.originalSubtotalAmount) : null,
    original_tax_amount: item.originalTaxAmount != null ? Number(item.originalTaxAmount) : null,
    project_currency: item.projectCurrency || 'EUR',
    exchange_rate: item.exchangeRate != null ? Number(item.exchangeRate) : null,
    exchange_rate_date: item.exchangeRateDate || null,
    exchange_rate_source: item.exchangeRateSource || '',
    converted_amount: item.convertedAmount != null ? Number(item.convertedAmount) : null,
    conversion_method: item.conversionMethod || 'same_currency',
    cost_status: item.costStatus || 'confirmed',
    notes: item.notes || '',
  };
}

async function listSupplierProjectCostEntries(config, projectId, filters = {}) {
  if (config.enabled) {
    try {
      let qs = `supplier_project_cost_entries?project_id=eq.${encodeURIComponent(projectId)}&order=created_at.asc&select=*`;
      if (filters.supplierProjectCostId) {
        qs += `&supplier_project_cost_id=eq.${encodeURIComponent(filters.supplierProjectCostId)}`;
      }
      const rows = await supabaseRequest(config, qs);
      if (!Array.isArray(rows)) return [];
      return rows.map(normalizeEntryFromSupabase);
    } catch (err) {
      console.error('[supplierProjectCostEntryStore] list error:', err.message);
      return [];
    }
  }
  const data = loadSeedData();
  ensureSupplierProjectCostEntriesData(data);
  let entries = data.supplierProjectCostEntries
    .filter(e => e.projectId === projectId)
    .map(normalizeLocalEntry);
  if (filters.supplierProjectCostId) {
    entries = entries.filter(e => e.supplierProjectCostId === filters.supplierProjectCostId);
  }
  return entries.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

async function createSupplierProjectCostEntry(config, projectId, payload) {
  const now = new Date().toISOString();
  const id = generateCostEntryId();
  const record = {
    id,
    projectId,
    supplierProjectCostId: payload.supplierProjectCostId || '',
    supplierId: payload.supplierId || '',
    supplierDisplay: payload.supplierDisplay || '',
    entryType: payload.entryType || 'invoice',
    sourceType: payload.sourceType || 'invoice_text',
    sourceImportId: payload.sourceImportId || '',
    invoiceNumber: payload.invoiceNumber || '',
    invoiceDate: payload.invoiceDate || null,
    originalCurrency: payload.originalCurrency || 'EUR',
    originalAmount: payload.originalAmount != null ? Number(payload.originalAmount) : null,
    originalSubtotalAmount: payload.originalSubtotalAmount != null ? Number(payload.originalSubtotalAmount) : null,
    originalTaxAmount: payload.originalTaxAmount != null ? Number(payload.originalTaxAmount) : null,
    projectCurrency: payload.projectCurrency || 'EUR',
    exchangeRate: payload.exchangeRate != null ? Number(payload.exchangeRate) : null,
    exchangeRateDate: payload.exchangeRateDate || null,
    exchangeRateSource: payload.exchangeRateSource || '',
    convertedAmount: payload.convertedAmount != null ? Number(payload.convertedAmount) : null,
    conversionMethod: payload.conversionMethod || 'same_currency',
    costStatus: payload.costStatus || 'confirmed',
    notes: payload.notes || '',
    createdAt: now,
    updatedAt: now,
  };

  if (config.enabled) {
    const supaPayload = buildSupabaseEntryPayload(record);
    supaPayload.created_at = now;
    supaPayload.updated_at = now;
    const rows = await supabaseRequest(config, 'supplier_project_cost_entries', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([supaPayload]),
    });
    const raw = Array.isArray(rows) ? rows[0] : rows;
    if (!raw) throw new Error('保存成本明细失败。');
    return normalizeEntryFromSupabase(raw);
  }

  const data = loadSeedData();
  ensureSupplierProjectCostEntriesData(data);
  data.supplierProjectCostEntries.push(record);
  saveSeedData(data);
  return normalizeLocalEntry(record);
}

// Sum convertedAmount of all confirmed entries for a given SPC record.
async function aggregateSupplierCostEntries(config, projectId, supplierProjectCostId) {
  const entries = await listSupplierProjectCostEntries(config, projectId, { supplierProjectCostId });
  const confirmed = entries.filter(e => e.costStatus === 'confirmed');
  const total = confirmed.reduce((s, e) => s + (e.convertedAmount != null ? Number(e.convertedAmount) : 0), 0);
  return {
    totalConvertedAmount: Math.round(total * 100) / 100,
    entryCount: confirmed.length,
    entries: confirmed,
  };
}

// Re-compute supplier_project_costs.actual_total_cost from confirmed entries.
async function refreshSupplierProjectCostFromEntries(config, projectId, supplierProjectCostId) {
  // Lazy-require to avoid circular dependency
  const { updateSupplierProjectCost } = require('./supplierProjectCostStore');
  const agg = await aggregateSupplierCostEntries(config, projectId, supplierProjectCostId);
  if (agg.entryCount === 0) return null;
  return updateSupplierProjectCost(config, projectId, supplierProjectCostId, {
    actualTotalCost: agg.totalConvertedAmount,
    sourceType: 'invoice_text',
    notes: `来自成本明细聚合（${agg.entryCount} 条发票明细）`,
  });
}

module.exports = {
  ensureSupplierProjectCostEntriesData,
  listSupplierProjectCostEntries,
  createSupplierProjectCostEntry,
  aggregateSupplierCostEntries,
  refreshSupplierProjectCostFromEntries,
};
