'use strict';

const { supabaseRequest } = require('../supabaseClient');
const { loadSeedData, saveSeedData } = require('../dataStore');
const { roundToTwo } = require('./quoteService');
const { normalizeProjectRecordFromSupabase, deriveProjectFinancials } = require('./projectStore');
const { listExecutionItems } = require('./projectExecutionStore');

const VALID_COST_STATUSES = new Set(['pending', 'estimated', 'confirmed', 'disputed']);
const VALID_SOURCE_TYPES = new Set(['manual', 'invoice_text', 'ocr', 'import']);

function generateSupplierCostId() {
  return `SPC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeSupplierProjectCostFromSupabase(row) {
  return {
    id: row.id || '',
    projectId: row.project_id || '',
    supplierId: row.supplier_id || '',
    supplierDisplay: row.supplier_display || '',
    costCurrency: row.cost_currency || 'EUR',
    quotedTotalCost: row.quoted_total_cost != null ? Number(row.quoted_total_cost) : null,
    executionActualTotalCost: row.execution_actual_total_cost != null ? Number(row.execution_actual_total_cost) : null,
    actualTotalCost: row.actual_total_cost != null ? Number(row.actual_total_cost) : null,
    useSupplierTotal: !!row.use_supplier_total,
    costStatus: row.cost_status || 'pending',
    invoiceNumber: row.invoice_number || '',
    invoiceDate: row.invoice_date || null,
    invoiceFileUrl: row.invoice_file_url || '',
    sourceType: row.source_type || 'manual',
    notes: row.notes || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function normalizeLocalSupplierProjectCost(item) {
  return {
    id: item.id || '',
    projectId: item.projectId || '',
    supplierId: item.supplierId || '',
    supplierDisplay: item.supplierDisplay || '',
    costCurrency: item.costCurrency || 'EUR',
    quotedTotalCost: item.quotedTotalCost != null ? Number(item.quotedTotalCost) : null,
    executionActualTotalCost: item.executionActualTotalCost != null ? Number(item.executionActualTotalCost) : null,
    actualTotalCost: item.actualTotalCost != null ? Number(item.actualTotalCost) : null,
    useSupplierTotal: item.useSupplierTotal !== false,
    costStatus: item.costStatus || 'pending',
    invoiceNumber: item.invoiceNumber || '',
    invoiceDate: item.invoiceDate || null,
    invoiceFileUrl: item.invoiceFileUrl || '',
    sourceType: item.sourceType || 'manual',
    notes: item.notes || '',
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || '',
  };
}

function buildSupabaseSupplierProjectCostPayload(item) {
  const raw = {
    id: item.id,
    project_id: item.projectId,
    supplier_id: item.supplierId || '',
    supplier_display: item.supplierDisplay || '',
    cost_currency: item.costCurrency || 'EUR',
    quoted_total_cost: item.quotedTotalCost != null ? Number(item.quotedTotalCost) : null,
    execution_actual_total_cost: item.executionActualTotalCost != null ? Number(item.executionActualTotalCost) : null,
    actual_total_cost: item.actualTotalCost != null ? Number(item.actualTotalCost) : null,
    use_supplier_total: item.useSupplierTotal !== false,
    cost_status: item.costStatus || 'pending',
    invoice_number: item.invoiceNumber || '',
    invoice_date: item.invoiceDate || null,
    invoice_file_url: item.invoiceFileUrl || '',
    source_type: item.sourceType || 'manual',
    notes: item.notes || '',
  };
  const payload = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) payload[k] = v;
  }
  return payload;
}

function ensureSupplierProjectCostsData(data) {
  if (!Array.isArray(data.supplierProjectCosts)) data.supplierProjectCosts = [];
}

async function listSupplierProjectCosts(config, projectId) {
  if (config.enabled) {
    try {
      const rows = await supabaseRequest(
        config,
        `supplier_project_costs?project_id=eq.${encodeURIComponent(projectId)}&order=created_at.asc&select=*`
      );
      if (!Array.isArray(rows)) return [];
      return rows.map(normalizeSupplierProjectCostFromSupabase);
    } catch (err) {
      console.error('[supplierProjectCostStore] listSupplierProjectCosts Supabase error:', err.message);
      return [];
    }
  }
  const data = loadSeedData();
  ensureSupplierProjectCostsData(data);
  return data.supplierProjectCosts
    .filter(c => c.projectId === projectId)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .map(normalizeLocalSupplierProjectCost);
}

// Creates or updates a supplier cost record.
// If a record already exists for (projectId, supplierId, supplierDisplay), updates it.
async function upsertSupplierProjectCost(config, projectId, payload) {
  const supplierId = payload.supplierId || '';
  const supplierDisplay = payload.supplierDisplay || '';

  if (!supplierId && !supplierDisplay) {
    const err = new Error('supplierId 和 supplierDisplay 至少需要填写一个。');
    err.status = 400;
    throw err;
  }

  if (payload.costStatus !== undefined && !VALID_COST_STATUSES.has(payload.costStatus)) {
    const err = new Error(`costStatus 不合法，允许值：${[...VALID_COST_STATUSES].join(', ')}`);
    err.status = 400;
    throw err;
  }
  if (payload.sourceType !== undefined && !VALID_SOURCE_TYPES.has(payload.sourceType)) {
    const err = new Error(`sourceType 不合法，允许值：${[...VALID_SOURCE_TYPES].join(', ')}`);
    err.status = 400;
    throw err;
  }
  if (payload.actualTotalCost !== null && payload.actualTotalCost !== undefined) {
    const v = Number(payload.actualTotalCost);
    if (Number.isNaN(v) || v < 0) {
      const err = new Error('actualTotalCost 必须是 >= 0 的数字');
      err.status = 400;
      throw err;
    }
    payload.actualTotalCost = v;
  }
  if (!payload.costCurrency) payload.costCurrency = 'EUR';

  const now = new Date().toISOString();

  if (config.enabled) {
    // Try to find existing record
    const existing = await supabaseRequest(
      config,
      `supplier_project_costs?project_id=eq.${encodeURIComponent(projectId)}&supplier_id=eq.${encodeURIComponent(supplierId)}&supplier_display=eq.${encodeURIComponent(supplierDisplay)}&select=id`
    );
    const existingRecord = Array.isArray(existing) && existing.length > 0 ? existing[0] : null;

    const item = {
      id: existingRecord ? existingRecord.id : generateSupplierCostId(),
      projectId,
      supplierId,
      supplierDisplay,
      costCurrency: payload.costCurrency || 'EUR',
      quotedTotalCost: payload.quotedTotalCost != null ? Number(payload.quotedTotalCost) : null,
      executionActualTotalCost: payload.executionActualTotalCost != null ? Number(payload.executionActualTotalCost) : null,
      actualTotalCost: payload.actualTotalCost != null ? Number(payload.actualTotalCost) : null,
      useSupplierTotal: payload.useSupplierTotal !== false,
      costStatus: payload.costStatus || 'pending',
      invoiceNumber: payload.invoiceNumber || '',
      invoiceDate: payload.invoiceDate || null,
      invoiceFileUrl: payload.invoiceFileUrl || '',
      sourceType: payload.sourceType || 'manual',
      notes: payload.notes || '',
    };

    const supaPayload = buildSupabaseSupplierProjectCostPayload(item);
    supaPayload.updated_at = now;
    if (!existingRecord) supaPayload.created_at = now;

    const rows = await supabaseRequest(
      config,
      existingRecord
        ? `supplier_project_costs?id=eq.${encodeURIComponent(item.id)}`
        : 'supplier_project_costs',
      {
        method: existingRecord ? 'PATCH' : 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(existingRecord ? supaPayload : [supaPayload]),
      }
    );
    const raw = Array.isArray(rows) ? rows[0] : rows;
    if (!raw) throw new Error('保存失败，Supabase 未返回记录。');
    return normalizeSupplierProjectCostFromSupabase(raw);
  }

  // Local JSON path
  const data = loadSeedData();
  ensureSupplierProjectCostsData(data);
  const idx = data.supplierProjectCosts.findIndex(
    c => c.projectId === projectId && c.supplierId === supplierId && c.supplierDisplay === supplierDisplay
  );

  if (idx >= 0) {
    const existing = data.supplierProjectCosts[idx];
    const updated = {
      ...existing,
      costCurrency: payload.costCurrency || existing.costCurrency || 'EUR',
      useSupplierTotal: payload.useSupplierTotal !== undefined ? payload.useSupplierTotal !== false : existing.useSupplierTotal !== false,
      costStatus: payload.costStatus || existing.costStatus || 'pending',
      invoiceNumber: payload.invoiceNumber !== undefined ? (payload.invoiceNumber || '') : (existing.invoiceNumber || ''),
      invoiceDate: payload.invoiceDate !== undefined ? (payload.invoiceDate || null) : (existing.invoiceDate || null),
      invoiceFileUrl: payload.invoiceFileUrl !== undefined ? (payload.invoiceFileUrl || '') : (existing.invoiceFileUrl || ''),
      sourceType: payload.sourceType || existing.sourceType || 'manual',
      notes: payload.notes !== undefined ? (payload.notes || '') : (existing.notes || ''),
      updatedAt: now,
    };
    if (payload.actualTotalCost !== undefined) updated.actualTotalCost = payload.actualTotalCost != null ? Number(payload.actualTotalCost) : null;
    if (payload.quotedTotalCost !== undefined) updated.quotedTotalCost = payload.quotedTotalCost != null ? Number(payload.quotedTotalCost) : null;
    if (payload.executionActualTotalCost !== undefined) updated.executionActualTotalCost = payload.executionActualTotalCost != null ? Number(payload.executionActualTotalCost) : null;
    data.supplierProjectCosts[idx] = updated;
    saveSeedData(data);
    return normalizeLocalSupplierProjectCost(updated);
  }

  const newRecord = {
    id: generateSupplierCostId(),
    projectId,
    supplierId,
    supplierDisplay,
    costCurrency: payload.costCurrency || 'EUR',
    quotedTotalCost: payload.quotedTotalCost != null ? Number(payload.quotedTotalCost) : null,
    executionActualTotalCost: payload.executionActualTotalCost != null ? Number(payload.executionActualTotalCost) : null,
    actualTotalCost: payload.actualTotalCost != null ? Number(payload.actualTotalCost) : null,
    useSupplierTotal: payload.useSupplierTotal !== false,
    costStatus: payload.costStatus || 'pending',
    invoiceNumber: payload.invoiceNumber || '',
    invoiceDate: payload.invoiceDate || null,
    invoiceFileUrl: payload.invoiceFileUrl || '',
    sourceType: payload.sourceType || 'manual',
    notes: payload.notes || '',
    createdAt: now,
    updatedAt: now,
  };
  data.supplierProjectCosts.push(newRecord);
  saveSeedData(data);
  return normalizeLocalSupplierProjectCost(newRecord);
}

// PATCH: update an existing record by costId (not upsert by supplier identity)
async function updateSupplierProjectCost(config, projectId, costId, patch) {
  if (patch.costStatus !== undefined && !VALID_COST_STATUSES.has(patch.costStatus)) {
    const err = new Error(`costStatus 不合法，允许值：${[...VALID_COST_STATUSES].join(', ')}`);
    err.status = 400;
    throw err;
  }
  if (patch.sourceType !== undefined && !VALID_SOURCE_TYPES.has(patch.sourceType)) {
    const err = new Error(`sourceType 不合法，允许值：${[...VALID_SOURCE_TYPES].join(', ')}`);
    err.status = 400;
    throw err;
  }
  if (patch.actualTotalCost !== null && patch.actualTotalCost !== undefined) {
    const v = Number(patch.actualTotalCost);
    if (Number.isNaN(v) || v < 0) {
      const err = new Error('actualTotalCost 必须是 >= 0 的数字');
      err.status = 400;
      throw err;
    }
    patch.actualTotalCost = v;
  }

  const now = new Date().toISOString();
  const PROTECTED = new Set(['id', 'projectId', 'createdAt', 'updatedAt']);
  const UPDATABLE = [
    'supplierId', 'supplierDisplay', 'costCurrency', 'quotedTotalCost',
    'executionActualTotalCost', 'actualTotalCost', 'useSupplierTotal',
    'costStatus', 'invoiceNumber', 'invoiceDate', 'invoiceFileUrl', 'sourceType', 'notes',
  ];

  if (config.enabled) {
    const existing = await supabaseRequest(
      config,
      `supplier_project_costs?id=eq.${encodeURIComponent(costId)}&project_id=eq.${encodeURIComponent(projectId)}&select=id`
    );
    if (!Array.isArray(existing) || existing.length === 0) {
      const err = new Error('供应商成本记录不存在。');
      err.status = 404;
      throw err;
    }
    const snakePatch = { updated_at: now };
    if (patch.supplierId !== undefined) snakePatch.supplier_id = patch.supplierId || '';
    if (patch.supplierDisplay !== undefined) snakePatch.supplier_display = patch.supplierDisplay || '';
    if (patch.costCurrency !== undefined) snakePatch.cost_currency = patch.costCurrency || 'EUR';
    if (patch.quotedTotalCost !== undefined) snakePatch.quoted_total_cost = patch.quotedTotalCost != null ? Number(patch.quotedTotalCost) : null;
    if (patch.executionActualTotalCost !== undefined) snakePatch.execution_actual_total_cost = patch.executionActualTotalCost != null ? Number(patch.executionActualTotalCost) : null;
    if (patch.actualTotalCost !== undefined) snakePatch.actual_total_cost = patch.actualTotalCost != null ? Number(patch.actualTotalCost) : null;
    if (patch.useSupplierTotal !== undefined) snakePatch.use_supplier_total = patch.useSupplierTotal !== false;
    if (patch.costStatus !== undefined) snakePatch.cost_status = patch.costStatus;
    if (patch.invoiceNumber !== undefined) snakePatch.invoice_number = patch.invoiceNumber || '';
    if (patch.invoiceDate !== undefined) snakePatch.invoice_date = patch.invoiceDate || null;
    if (patch.invoiceFileUrl !== undefined) snakePatch.invoice_file_url = patch.invoiceFileUrl || '';
    if (patch.sourceType !== undefined) snakePatch.source_type = patch.sourceType;
    if (patch.notes !== undefined) snakePatch.notes = patch.notes || '';

    const rows = await supabaseRequest(
      config,
      `supplier_project_costs?id=eq.${encodeURIComponent(costId)}&project_id=eq.${encodeURIComponent(projectId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(snakePatch),
      }
    );
    const raw = Array.isArray(rows) ? rows[0] : rows;
    if (!raw) throw new Error('更新失败，Supabase 未返回记录。');
    return normalizeSupplierProjectCostFromSupabase(raw);
  }

  const data = loadSeedData();
  ensureSupplierProjectCostsData(data);
  const idx = data.supplierProjectCosts.findIndex(c => c.id === costId && c.projectId === projectId);
  if (idx < 0) {
    const err = new Error('供应商成本记录不存在。');
    err.status = 404;
    throw err;
  }
  const updated = { ...data.supplierProjectCosts[idx] };
  for (const field of UPDATABLE) {
    if (patch[field] !== undefined && !PROTECTED.has(field)) {
      if (field === 'actualTotalCost' || field === 'quotedTotalCost' || field === 'executionActualTotalCost') {
        updated[field] = patch[field] != null ? Number(patch[field]) : null;
      } else if (field === 'useSupplierTotal') {
        updated[field] = patch[field] !== false;
      } else {
        updated[field] = patch[field];
      }
    }
  }
  updated.updatedAt = now;
  data.supplierProjectCosts[idx] = updated;
  saveSeedData(data);
  return normalizeLocalSupplierProjectCost(updated);
}

async function deleteSupplierProjectCost(config, projectId, costId) {
  if (config.enabled) {
    const existing = await supabaseRequest(
      config,
      `supplier_project_costs?id=eq.${encodeURIComponent(costId)}&project_id=eq.${encodeURIComponent(projectId)}&select=id`
    );
    if (!Array.isArray(existing) || existing.length === 0) {
      const err = new Error('供应商成本记录不存在。');
      err.status = 404;
      throw err;
    }
    await supabaseRequest(
      config,
      `supplier_project_costs?id=eq.${encodeURIComponent(costId)}&project_id=eq.${encodeURIComponent(projectId)}`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
    );
    return;
  }
  const data = loadSeedData();
  ensureSupplierProjectCostsData(data);
  const idx = data.supplierProjectCosts.findIndex(c => c.id === costId && c.projectId === projectId);
  if (idx < 0) {
    const err = new Error('供应商成本记录不存在。');
    err.status = 404;
    throw err;
  }
  data.supplierProjectCosts.splice(idx, 1);
  saveSeedData(data);
}

// Returns Map<supplierKey, quotedCost> from quoteSnapshot projectGroups items.
// Used as fallback when execution items have null quoteTotalCost (snapshot items lacked costSubtotal).
function buildQuotedSupplierCostMapFromSnapshot(quoteSnapshot) {
  const map = new Map();
  const groups = Array.isArray(quoteSnapshot?.projectGroups) ? quoteSnapshot.projectGroups : [];
  for (const group of groups) {
    const items = Array.isArray(group?.items) ? group.items : [];
    for (const item of items) {
      const supplierId = String(item.supplierId || item.supplier_id || '').trim();
      const supplierDisplay = String(
        item.supplierDisplay || item.supplier_display ||
        item.supplierName || item.supplier_name || item.supplier || ''
      ).trim();
      const key = supplierId ? `id:${supplierId}` : supplierDisplay ? `display:${supplierDisplay}` : null;
      if (!key) continue;
      const cs = item.costSubtotal != null ? Number(item.costSubtotal)
        : item.cost_subtotal != null ? Number(item.cost_subtotal) : null;
      const cu = Number(item.costUnitPrice || item.cost_unit_price || 0);
      const qty = Number(item.quantity || 0);
      const cost = cs != null ? cs : (qty * cu);
      if (!map.has(key)) map.set(key, 0);
      map.set(key, map.get(key) + cost);
    }
  }
  return map;
}

// ── buildProjectCostSummary ───────────────────────────────────────────────────
// "供应商总成本优先"规则：
//   对每个有 supplier_project_costs 且 useSupplierTotal=true 且 actualTotalCost 有值的供应商，
//   使用 supplier total，不再叠加该供应商的执行项实际成本。
//   其他供应商 / 无供应商执行项，使用 execution_items.actualTotalCost 之和。
async function buildProjectCostSummary(config, projectId) {
  // 1. Load project
  let project = null;
  if (config.enabled) {
    const rows = await supabaseRequest(
      config,
      `projects?id=eq.${encodeURIComponent(projectId)}&select=*`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      const err = new Error('项目不存在。');
      err.status = 404;
      throw err;
    }
    project = normalizeProjectRecordFromSupabase(rows[0]);
  } else {
    const data = loadSeedData();
    if (!Array.isArray(data.projects)) data.projects = [];
    const raw = data.projects.find(p => p.id === projectId);
    if (!raw) {
      const err = new Error('项目不存在。');
      err.status = 404;
      throw err;
    }
    // Compute financials from quoteSnapshot (same logic as serializeProject in app.js)
    const financials = deriveProjectFinancials(raw);
    project = { ...raw, ...financials };
  }

  // 2. Load execution items
  const executionItems = await listExecutionItems(config, projectId);

  // 3. Load supplier_project_costs
  const supplierCostRecords = await listSupplierProjectCosts(config, projectId);

  // 4. Compute quoted totals
  const quotedRevenueTotal = Number(project.totalSales || 0);
  let quotedCostTotal = Number(project.totalCost || 0);
  if (quotedCostTotal === 0 && executionItems.length > 0) {
    quotedCostTotal = executionItems.reduce((s, ei) => s + Number(ei.quoteTotalCost || 0), 0);
  }
  const quotedGrossProfit = roundToTwo(quotedRevenueTotal - quotedCostTotal);
  const quotedGrossMargin = quotedRevenueTotal > 0
    ? roundToTwo((quotedGrossProfit / quotedRevenueTotal) * 100)
    : 0;

  // 5. Build supplier cost map (keyed by supplierId+supplierDisplay)
  const supplierCostMap = new Map(); // key → cost record
  for (const sc of supplierCostRecords) {
    const key = sc.supplierId
      ? `id:${sc.supplierId}`
      : `display:${sc.supplierDisplay}`;
    supplierCostMap.set(key, sc);
  }

  // 6. Group execution items by supplier key
  // Key: supplierId if non-empty, else supplierDisplay, else '__unassigned__'
  const supplierExecMap = new Map(); // key → [ei, ...]
  for (const ei of executionItems) {
    const key = ei.supplierId
      ? `id:${ei.supplierId}`
      : ei.supplierDisplay
        ? `display:${ei.supplierDisplay}`
        : '__unassigned__';
    if (!supplierExecMap.has(key)) supplierExecMap.set(key, []);
    supplierExecMap.get(key).push(ei);
  }

  // 7. Collect all supplier keys (union of cost records + exec items, excluding unassigned)
  const allSupplierKeys = new Set([
    ...supplierCostMap.keys(),
    ...[...supplierExecMap.keys()].filter(k => k !== '__unassigned__'),
  ]);

  // Snapshot-derived quoted cost map: fallback when execution items lack quoteTotalCost.
  const snapshotQuotedMap = buildQuotedSupplierCostMapFromSnapshot(project.quoteSnapshot || {});

  // 8. Build supplierRows + compute actualCostTotal
  const supplierRows = [];
  let actualCostTotal = 0;

  for (const supplierKey of allSupplierKeys) {
    const costRecord = supplierCostMap.get(supplierKey);
    const eiItems = supplierExecMap.get(supplierKey) || [];

    // Derive supplier identity
    let supplierId = '';
    let supplierDisplay = '';
    if (costRecord) {
      supplierId = costRecord.supplierId;
      supplierDisplay = costRecord.supplierDisplay;
    } else if (eiItems.length > 0) {
      supplierId = eiItems[0].supplierId || '';
      supplierDisplay = eiItems[0].supplierDisplay || '';
    }

    let quotedTotalCost = costRecord?.quotedTotalCost != null
      ? Number(costRecord.quotedTotalCost)
      : eiItems.reduce((s, ei) => s + Number(ei.quoteTotalCost || 0), 0);
    // Snapshot fallback: execution items may have null quoteTotalCost when snapshot items lacked costSubtotal.
    if (quotedTotalCost === 0 && snapshotQuotedMap.has(supplierKey)) {
      quotedTotalCost = snapshotQuotedMap.get(supplierKey);
    }

    const executionActualTotalCost = eiItems.reduce(
      (s, ei) => s + Number(ei.actualTotalCost || 0), 0
    );

    const supplierActualTotalCost = costRecord?.actualTotalCost != null
      ? Number(costRecord.actualTotalCost)
      : null;

    const useSupplierTotal = costRecord
      ? (costRecord.useSupplierTotal !== false)
      : false;

    // Apply supplier-total rule
    let appliedActualCost;
    let appliedMode;
    if (useSupplierTotal && supplierActualTotalCost != null) {
      appliedActualCost = supplierActualTotalCost;
      appliedMode = 'supplier_total';
    } else {
      appliedActualCost = executionActualTotalCost;
      appliedMode = 'execution_items';
    }

    actualCostTotal += appliedActualCost;

    supplierRows.push({
      supplierKey,
      supplierId,
      supplierDisplay,
      costCurrency: costRecord?.costCurrency || project.currency || 'EUR',
      quotedTotalCost,
      executionActualTotalCost,
      supplierActualTotalCost,
      appliedActualCost,
      appliedMode,
      costVariance: roundToTwo(appliedActualCost - quotedTotalCost),
      costStatus: costRecord?.costStatus || 'pending',
      useSupplierTotal,
      invoiceNumber: costRecord?.invoiceNumber || '',
      invoiceDate: costRecord?.invoiceDate || null,
      notes: costRecord?.notes || '',
      costRecordId: costRecord?.id || null,
    });
  }

  // 9. Unassigned execution items
  const unassignedItems = supplierExecMap.get('__unassigned__') || [];
  const unassignedQuotedTotalCost = unassignedItems.reduce(
    (s, ei) => s + Number(ei.quoteTotalCost || 0), 0
  );
  const unassignedExecutionActualCost = unassignedItems.reduce(
    (s, ei) => s + Number(ei.actualTotalCost || 0), 0
  );
  actualCostTotal += unassignedExecutionActualCost;

  // 10. Derived profit metrics
  actualCostTotal = roundToTwo(actualCostTotal);
  const actualGrossProfit = roundToTwo(quotedRevenueTotal - actualCostTotal);
  const actualGrossMargin = quotedRevenueTotal > 0
    ? roundToTwo((actualGrossProfit / quotedRevenueTotal) * 100)
    : 0;
  const costVariance = roundToTwo(actualCostTotal - quotedCostTotal);
  const executionActualCostTotal = roundToTwo(
    executionItems.reduce((s, ei) => s + Number(ei.actualTotalCost || 0), 0)
  );
  const supplierTotalCostApplied = roundToTwo(
    supplierRows
      .filter(r => r.appliedMode === 'supplier_total')
      .reduce((s, r) => s + r.appliedActualCost, 0)
  );

  // 11. Cost completeness metrics
  const supplierTotalCount = allSupplierKeys.size;
  const supplierConfirmedCount = supplierRows.filter(r => r.costStatus === 'confirmed').length;
  const missingCostSupplierCount = supplierRows.filter(r => !r.costRecordId).length;
  const supplierPendingCount = supplierRows.filter(r => r.costStatus !== 'confirmed').length;
  const hasUnconfirmedSupplierCosts = supplierPendingCount > 0;
  const actualProfitIsEstimated = supplierTotalCount === 0 || missingCostSupplierCount > 0 || hasUnconfirmedSupplierCosts;
  const costCompletenessStatus = supplierTotalCount === 0 ? 'empty'
    : (missingCostSupplierCount === 0 && supplierConfirmedCount === supplierTotalCount) ? 'complete'
    : 'partial';

  return {
    projectId,
    currency: project.currency || 'EUR',
    quotedRevenueTotal,
    quotedCostTotal,
    quotedGrossProfit,
    quotedGrossMargin,
    executionActualCostTotal,
    supplierTotalCostApplied,
    actualCostTotal,
    actualGrossProfit,
    actualGrossMargin,
    costVariance,
    costCompletenessStatus,
    supplierTotalCount,
    supplierConfirmedCount,
    supplierPendingCount,
    missingCostSupplierCount,
    hasUnconfirmedSupplierCosts,
    actualProfitIsEstimated,
    supplierRows,
    unassigned: {
      quotedTotalCost: roundToTwo(unassignedQuotedTotalCost),
      executionActualTotalCost: roundToTwo(unassignedExecutionActualCost),
      appliedActualCost: roundToTwo(unassignedExecutionActualCost),
    },
  };
}

module.exports = {
  normalizeSupplierProjectCostFromSupabase,
  normalizeLocalSupplierProjectCost,
  buildSupabaseSupplierProjectCostPayload,
  listSupplierProjectCosts,
  upsertSupplierProjectCost,
  updateSupplierProjectCost,
  deleteSupplierProjectCost,
  buildProjectCostSummary,
  VALID_COST_STATUSES,
  VALID_SOURCE_TYPES,
};
