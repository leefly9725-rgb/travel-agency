'use strict';

const { supabaseRequest } = require('../supabaseClient');
const { loadSeedData, saveSeedData } = require('../dataStore');

function generateExecutionItemId() {
  return `PEI-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeExecutionItemFromSupabase(row) {
  return {
    id: row.id || '',
    projectId: row.project_id || '',
    sourceQuoteItemId: row.source_quote_item_id || null,
    sourceGroupId: row.source_group_id || null,
    sourceGroupTitle: row.source_group_title || '',
    category: row.category || '',
    type: row.type || '',
    title: row.title || '',
    description: row.description || '',
    quantity: row.quantity != null ? Number(row.quantity) : null,
    unit: row.unit || '',
    plannedDate: row.planned_date || null,
    startDate: row.start_date || null,
    endDate: row.end_date || null,
    location: row.location || '',
    owner: row.owner || '',
    status: row.status || 'pending',
    supplierStatus: row.supplier_status || 'not_started',
    notes: row.notes || '',
    supplierId: row.supplier_id || '',
    supplierCatalogItemId: row.supplier_catalog_item_id || '',
    supplierDisplay: row.supplier_display || '',
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function buildSupabaseExecutionItemPayload(item) {
  const raw = {
    id: item.id,
    project_id: item.projectId,
    source_quote_item_id: item.sourceQuoteItemId != null ? item.sourceQuoteItemId : null,
    source_group_id: item.sourceGroupId != null ? item.sourceGroupId : null,
    source_group_title: item.sourceGroupTitle || '',
    category: item.category || '',
    type: item.type || '',
    title: item.title || '',
    description: item.description || '',
    quantity: item.quantity != null ? Number(item.quantity) : null,
    unit: item.unit || '',
    planned_date: item.plannedDate || null,
    start_date: item.startDate || null,
    end_date: item.endDate || null,
    location: item.location || '',
    owner: item.owner || '',
    status: item.status || 'pending',
    supplier_status: item.supplierStatus || 'not_started',
    notes: item.notes || '',
    supplier_id: item.supplierId || '',
    supplier_catalog_item_id: item.supplierCatalogItemId || '',
    supplier_display: item.supplierDisplay || '',
    sort_order: Number(item.sortOrder || 0),
  };
  const payload = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) payload[k] = v;
  }
  return payload;
}

function normalizeLocalExecutionItem(item) {
  return {
    id: item.id || '',
    projectId: item.projectId || '',
    sourceQuoteItemId: item.sourceQuoteItemId != null ? item.sourceQuoteItemId : null,
    sourceGroupId: item.sourceGroupId != null ? item.sourceGroupId : null,
    sourceGroupTitle: item.sourceGroupTitle || '',
    category: item.category || '',
    type: item.type || '',
    title: item.title || '',
    description: item.description || '',
    quantity: item.quantity != null ? Number(item.quantity) : null,
    unit: item.unit || '',
    plannedDate: item.plannedDate || null,
    startDate: item.startDate || null,
    endDate: item.endDate || null,
    location: item.location || '',
    owner: item.owner || '',
    status: item.status || 'pending',
    supplierStatus: item.supplierStatus || 'not_started',
    notes: item.notes || '',
    supplierId: item.supplierId || '',
    supplierCatalogItemId: item.supplierCatalogItemId || '',
    supplierDisplay: item.supplierDisplay || '',
    sortOrder: Number(item.sortOrder || 0),
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || '',
  };
}

function ensureExecutionItemsData(data) {
  if (!Array.isArray(data.projectExecutionItems)) data.projectExecutionItems = [];
}

async function listExecutionItems(config, projectId) {
  if (config.enabled) {
    try {
      const rows = await supabaseRequest(
        config,
        `project_execution_items?project_id=eq.${encodeURIComponent(projectId)}&order=sort_order.asc,created_at.asc&select=*`
      );
      if (!Array.isArray(rows)) return [];
      return rows.map(normalizeExecutionItemFromSupabase);
    } catch (err) {
      console.error('[projectExecutionStore] listExecutionItems Supabase error:', err.message);
      return [];
    }
  }
  const data = loadSeedData();
  ensureExecutionItemsData(data);
  return data.projectExecutionItems
    .filter(i => i.projectId === projectId)
    .sort((a, b) => {
      const so = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      if (so !== 0) return so;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    })
    .map(normalizeLocalExecutionItem);
}

function generateItemsFromSnapshot(projectId, quoteSnapshot) {
  const groups = Array.isArray(quoteSnapshot?.projectGroups)
    ? quoteSnapshot.projectGroups
    : Array.isArray(quoteSnapshot?.project_groups)
      ? quoteSnapshot.project_groups
      : [];

  const items = [];
  const now = new Date().toISOString();

  // 默认到位截止时间 = 项目开始日期前一天
  let defaultPlannedDate = null;
  const snapStartDate = quoteSnapshot.startDate || quoteSnapshot.start_date;
  if (snapStartDate && /^\d{4}-\d{2}-\d{2}$/.test(String(snapStartDate))) {
    const d = new Date(snapStartDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    defaultPlannedDate = d.toISOString().slice(0, 10);
  }

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    if (!group) continue;

    const sourceGroupId = group.id || `group-${gi}`;
    const sourceGroupTitle = group.projectTitle || group.project_title || '';
    const groupCategory = group.itemCategory || group.item_category || group.itemType || group.item_type || group.projectType || group.project_type || '';
    const groupItems = Array.isArray(group.items) ? group.items : [];

    for (let ii = 0; ii < groupItems.length; ii++) {
      const item = groupItems[ii];
      if (!item) continue;

      const sourceQuoteItemId = item.id || `item-${gi}-${ii}`;
      const category = item.itemCategory || item.item_category || item.category || groupCategory || '';
      const type = item.itemType || item.item_type || item.type || '';
      const title = item.itemName || item.name_zh || item.name || item.title || item.serviceName || '未命名执行项';

      const descParts = [];
      if (item.specification) descParts.push(item.specification);
      if (item.remarks) descParts.push(item.remarks);
      if (item.publicNotes) descParts.push(item.publicNotes);
      const description = descParts.join(' | ').trim();

      const quantity = item.quantity != null ? Number(item.quantity) : null;
      const unit = item.unit || '';
      const sortOrder = gi * 1000 + ii;

      items.push({
        id: generateExecutionItemId(),
        projectId,
        sourceQuoteItemId,
        sourceGroupId,
        sourceGroupTitle,
        category,
        type,
        title,
        description,
        quantity,
        unit,
        plannedDate: defaultPlannedDate,
        startDate: null,
        endDate: null,
        location: quoteSnapshot.destination || '',
        owner: '',
        status: 'pending',
        supplierStatus: 'not_started',
        notes: '',
        supplierId: item.supplierId || item.supplier_id || '',
        supplierCatalogItemId: item.supplierCatalogItemId || item.supplier_catalog_item_id || '',
        supplierDisplay: item.supplierDisplay || item.supplier_display || item.supplierName || item.supplier_name || item.supplier || '',
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return items;
}

async function generateExecutionItemsFromProject(config, projectId) {
  const existing = await listExecutionItems(config, projectId);
  if (existing.length > 0) {
    return { created: false, items: existing };
  }

  let quoteSnapshot = null;
  if (config.enabled) {
    const rows = await supabaseRequest(
      config,
      `projects?select=quote_snapshot&id=eq.${encodeURIComponent(projectId)}`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      const err = new Error('项目不存在。');
      err.status = 404;
      throw err;
    }
    quoteSnapshot = rows[0].quote_snapshot || {};
  } else {
    const data = loadSeedData();
    if (!Array.isArray(data.projects)) data.projects = [];
    const project = data.projects.find(p => p.id === projectId);
    if (!project) {
      const err = new Error('项目不存在。');
      err.status = 404;
      throw err;
    }
    quoteSnapshot = project.quoteSnapshot || {};
  }

  const newItems = generateItemsFromSnapshot(projectId, quoteSnapshot);

  if (newItems.length === 0) {
    return { created: false, items: [] };
  }

  if (config.enabled) {
    const payloads = newItems.map(buildSupabaseExecutionItemPayload);
    const rows = await supabaseRequest(config, 'project_execution_items', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payloads),
    });
    const saved = Array.isArray(rows) ? rows.map(normalizeExecutionItemFromSupabase) : newItems.map(normalizeLocalExecutionItem);
    return { created: true, items: saved };
  } else {
    const data = loadSeedData();
    ensureExecutionItemsData(data);
    data.projectExecutionItems.push(...newItems);
    saveSeedData(data);
    return { created: true, items: newItems.map(normalizeLocalExecutionItem) };
  }
}

const VALID_STATUSES = new Set(['pending', 'in_progress', 'done', 'cancelled']);
const VALID_SUPPLIER_STATUSES = new Set(['not_required', 'not_started', 'inquiring', 'quoted', 'selected', 'confirmed']);
const UPDATABLE_FIELDS = new Set([
  'title', 'description', 'quantity', 'unit',
  'plannedDate', 'startDate', 'endDate',
  'location', 'owner', 'status', 'supplierStatus', 'notes', 'sortOrder',
]);

const SYNC_FIELDS = new Set([
  'owner', 'status', 'supplierStatus',
  'plannedDate', 'startDate', 'endDate',
  'location', 'notes',
]);

async function updateExecutionItem(config, projectId, itemId, patch, options = {}) {
  const { applyToSameSupplier = false } = options;

  if (patch.status !== undefined && !VALID_STATUSES.has(patch.status)) {
    const err = new Error(`status 不合法：${patch.status}`);
    err.status = 400;
    throw err;
  }
  if (patch.supplierStatus !== undefined && !VALID_SUPPLIER_STATUSES.has(patch.supplierStatus)) {
    const err = new Error(`supplierStatus 不合法：${patch.supplierStatus}`);
    err.status = 400;
    throw err;
  }

  const TEXT_NOT_NULL = ['title', 'description', 'unit', 'location', 'owner', 'notes'];
  for (const f of TEXT_NOT_NULL) {
    if (patch[f] === null) patch[f] = '';
  }

  const now = new Date().toISOString();
  let updatedItem;

  if (config.enabled) {
    const existing = await supabaseRequest(
      config,
      `project_execution_items?select=id&id=eq.${encodeURIComponent(itemId)}&project_id=eq.${encodeURIComponent(projectId)}`
    );
    if (!Array.isArray(existing) || existing.length === 0) {
      const err = new Error('执行项不存在。');
      err.status = 404;
      throw err;
    }

    const snakePatch = { updated_at: now };
    if (patch.title !== undefined) snakePatch.title = patch.title;
    if (patch.description !== undefined) snakePatch.description = patch.description;
    if (patch.quantity !== undefined) snakePatch.quantity = patch.quantity != null ? Number(patch.quantity) : null;
    if (patch.unit !== undefined) snakePatch.unit = patch.unit;
    if (patch.plannedDate !== undefined) snakePatch.planned_date = patch.plannedDate || null;
    if (patch.startDate !== undefined) snakePatch.start_date = patch.startDate || null;
    if (patch.endDate !== undefined) snakePatch.end_date = patch.endDate || null;
    if (patch.location !== undefined) snakePatch.location = patch.location;
    if (patch.owner !== undefined) snakePatch.owner = patch.owner;
    if (patch.status !== undefined) snakePatch.status = patch.status;
    if (patch.supplierStatus !== undefined) snakePatch.supplier_status = patch.supplierStatus;
    if (patch.notes !== undefined) snakePatch.notes = patch.notes;
    if (patch.sortOrder !== undefined) snakePatch.sort_order = Number(patch.sortOrder);

    const rows = await supabaseRequest(
      config,
      `project_execution_items?id=eq.${encodeURIComponent(itemId)}&project_id=eq.${encodeURIComponent(projectId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(snakePatch),
      }
    );
    const raw = Array.isArray(rows) ? rows[0] : rows;
    if (!raw) throw new Error('更新失败，Supabase 未返回记录。');
    updatedItem = normalizeExecutionItemFromSupabase(raw);
  } else {
    const data = loadSeedData();
    ensureExecutionItemsData(data);
    const idx = data.projectExecutionItems.findIndex(i => i.id === itemId && i.projectId === projectId);
    if (idx < 0) {
      const err = new Error('执行项不存在。');
      err.status = 404;
      throw err;
    }
    const updated = { ...data.projectExecutionItems[idx] };
    for (const field of UPDATABLE_FIELDS) {
      if (patch[field] !== undefined) {
        if (field === 'quantity') updated[field] = patch[field] != null ? Number(patch[field]) : null;
        else if (field === 'sortOrder') updated[field] = Number(patch[field]);
        else updated[field] = patch[field];
      }
    }
    updated.updatedAt = now;
    data.projectExecutionItems[idx] = updated;
    saveSeedData(data);
    updatedItem = normalizeLocalExecutionItem(updated);
  }

  if (!applyToSameSupplier) {
    return updatedItem;
  }

  // ── 批量同步同供应商执行项 ────────────────────────────────────────────────
  const supplierId = updatedItem.supplierId;
  const supplierDisplay = updatedItem.supplierDisplay;

  if (!supplierId && !supplierDisplay) {
    return { item: updatedItem, affectedCount: 1, items: [updatedItem] };
  }

  // 只同步本次 patch 中属于 SYNC_FIELDS 的字段
  const syncPatch = {};
  for (const field of SYNC_FIELDS) {
    if (patch[field] !== undefined) syncPatch[field] = patch[field];
  }

  const affectedItems = [updatedItem];

  if (config.enabled) {
    const allRows = await supabaseRequest(
      config,
      `project_execution_items?project_id=eq.${encodeURIComponent(projectId)}&select=*`
    );
    if (Array.isArray(allRows) && Object.keys(syncPatch).length > 0) {
      const siblings = allRows.filter(r =>
        r.id !== itemId &&
        (supplierId ? r.supplier_id === supplierId : r.supplier_display === supplierDisplay)
      );
      if (siblings.length > 0) {
        const syncSnake = { updated_at: now };
        if (syncPatch.owner !== undefined) syncSnake.owner = syncPatch.owner;
        if (syncPatch.status !== undefined) syncSnake.status = syncPatch.status;
        if (syncPatch.supplierStatus !== undefined) syncSnake.supplier_status = syncPatch.supplierStatus;
        if (syncPatch.plannedDate !== undefined) syncSnake.planned_date = syncPatch.plannedDate || null;
        if (syncPatch.startDate !== undefined) syncSnake.start_date = syncPatch.startDate || null;
        if (syncPatch.endDate !== undefined) syncSnake.end_date = syncPatch.endDate || null;
        if (syncPatch.location !== undefined) syncSnake.location = syncPatch.location;
        if (syncPatch.notes !== undefined) syncSnake.notes = syncPatch.notes;

        const siblingIds = siblings.map(r => r.id).join(',');
        const batchRows = await supabaseRequest(
          config,
          `project_execution_items?id=in.(${siblingIds})`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(syncSnake),
          }
        );
        if (Array.isArray(batchRows)) {
          batchRows.forEach(r => affectedItems.push(normalizeExecutionItemFromSupabase(r)));
        }
      }
    }
  } else {
    if (Object.keys(syncPatch).length > 0) {
      const data = loadSeedData();
      ensureExecutionItemsData(data);
      let changed = false;
      for (let i = 0; i < data.projectExecutionItems.length; i++) {
        const ei = data.projectExecutionItems[i];
        if (ei.id === itemId || ei.projectId !== projectId) continue;
        const match = supplierId
          ? ei.supplierId === supplierId
          : ei.supplierDisplay === supplierDisplay;
        if (!match) continue;
        const updated = { ...ei };
        for (const field of SYNC_FIELDS) {
          if (syncPatch[field] !== undefined) updated[field] = syncPatch[field];
        }
        updated.updatedAt = now;
        data.projectExecutionItems[i] = updated;
        affectedItems.push(normalizeLocalExecutionItem(updated));
        changed = true;
      }
      if (changed) saveSeedData(data);
    }
  }

  return { item: updatedItem, affectedCount: affectedItems.length, items: affectedItems };
}

async function backfillSupplierFields(config, projectId, options = {}) {
  const { force = false } = options;

  // 1. Read quoteSnapshot (read-only, never modified)
  let quoteSnapshot = null;
  if (config.enabled) {
    const rows = await supabaseRequest(
      config,
      `projects?select=quote_snapshot&id=eq.${encodeURIComponent(projectId)}`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      const err = new Error('项目不存在。'); err.status = 404; throw err;
    }
    quoteSnapshot = rows[0].quote_snapshot || {};
  } else {
    const data = loadSeedData();
    if (!Array.isArray(data.projects)) data.projects = [];
    const project = data.projects.find(p => p.id === projectId);
    if (!project) { const err = new Error('项目不存在。'); err.status = 404; throw err; }
    quoteSnapshot = project.quoteSnapshot || {};
  }

  // 2. Build supplier lookup structures from quoteSnapshot
  const supplierByItemId = new Map(); // quoteItemId → {supplierId, supplierCatalogItemId, supplierDisplay}
  const groupMeta = [];               // [{id, title, items: [{id, title, hasSupplier, supplierInfo}]}]
  let availableSupplierCount = 0;

  const groups = Array.isArray(quoteSnapshot?.projectGroups)
    ? quoteSnapshot.projectGroups
    : Array.isArray(quoteSnapshot?.project_groups)
      ? quoteSnapshot.project_groups
      : [];

  for (const group of groups) {
    if (!group) continue;
    const groupId = group.id || '';
    const groupTitle = group.projectTitle || group.project_title || '';
    const metaItems = [];
    for (const item of (Array.isArray(group.items) ? group.items : [])) {
      if (!item) continue;
      const supplierId = item.supplierId || item.supplier_id || '';
      const supplierCatalogItemId = item.supplierCatalogItemId || item.supplier_catalog_item_id || '';
      const supplierDisplay = item.supplierDisplay || item.supplier_display || item.supplierName || item.supplier_name || item.supplier || '';
      const title = item.itemName || item.name_zh || item.name || item.title || item.serviceName || '';
      const hasSupplier = !!(supplierId || supplierDisplay);
      const supplierInfo = { supplierId, supplierCatalogItemId, supplierDisplay };
      if (item.id) supplierByItemId.set(item.id, supplierInfo);
      if (hasSupplier) availableSupplierCount++;
      metaItems.push({ id: item.id || '', title, hasSupplier, supplierInfo });
    }
    groupMeta.push({ id: groupId, title: groupTitle, items: metaItems });
  }

  // 3. Read current execution items
  const existingItems = await listExecutionItems(config, projectId);
  const totalCount = existingItems.length;

  // 4. Match each execution item to a supplier
  function findSupplierInfo(ei) {
    // P1: sourceQuoteItemId exact match
    if (ei.sourceQuoteItemId && supplierByItemId.has(ei.sourceQuoteItemId)) {
      return supplierByItemId.get(ei.sourceQuoteItemId);
    }
    // P2: sourceGroupId + title match
    for (const g of groupMeta) {
      if (g.id && ei.sourceGroupId && g.id === ei.sourceGroupId) {
        const m = g.items.find(i => i.title && i.title === ei.title);
        if (m && m.hasSupplier) return m.supplierInfo;
      }
    }
    // P3: sourceGroupTitle + title match
    for (const g of groupMeta) {
      if (g.title && ei.sourceGroupTitle && g.title === ei.sourceGroupTitle) {
        const m = g.items.find(i => i.title && i.title === ei.title);
        if (m && m.hasSupplier) return m.supplierInfo;
      }
    }
    return null;
  }

  const toUpdate = [];
  let skippedCount = 0;

  for (const ei of existingItems) {
    if (!force && (ei.supplierId || ei.supplierDisplay)) continue; // already has supplier
    const si = findSupplierInfo(ei);
    if (si && (si.supplierId || si.supplierDisplay)) {
      toUpdate.push({ ei, supplierInfo: si });
    } else {
      skippedCount++;
    }
  }

  const now = new Date().toISOString();

  // 5. Execute updates (only supplier fields; never touches other fields)
  if (config.enabled) {
    for (const { ei, supplierInfo } of toUpdate) {
      await supabaseRequest(
        config,
        `project_execution_items?id=eq.${encodeURIComponent(ei.id)}&project_id=eq.${encodeURIComponent(projectId)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            supplier_id: supplierInfo.supplierId,
            supplier_catalog_item_id: supplierInfo.supplierCatalogItemId,
            supplier_display: supplierInfo.supplierDisplay,
            updated_at: now,
          }),
        }
      );
    }
  } else {
    if (toUpdate.length > 0) {
      const data = loadSeedData();
      ensureExecutionItemsData(data);
      for (const { ei, supplierInfo } of toUpdate) {
        const idx = data.projectExecutionItems.findIndex(i => i.id === ei.id && i.projectId === projectId);
        if (idx >= 0) {
          data.projectExecutionItems[idx] = {
            ...data.projectExecutionItems[idx],
            supplierId: supplierInfo.supplierId,
            supplierCatalogItemId: supplierInfo.supplierCatalogItemId,
            supplierDisplay: supplierInfo.supplierDisplay,
            updatedAt: now,
          };
        }
      }
      saveSeedData(data);
    }
  }

  // 6. Build result items list with updated supplier info merged in
  const updatedIdMap = new Map(toUpdate.map(({ ei, supplierInfo }) => [ei.id, supplierInfo]));
  const items = existingItems.map(ei => {
    const si = updatedIdMap.get(ei.id);
    if (!si) return normalizeLocalExecutionItem(ei);
    return normalizeLocalExecutionItem({
      ...ei,
      supplierId: si.supplierId,
      supplierCatalogItemId: si.supplierCatalogItemId,
      supplierDisplay: si.supplierDisplay,
      updatedAt: now,
    });
  });

  return { updatedCount: toUpdate.length, skippedCount, totalCount, availableSupplierCount, items };
}

async function deleteExecutionItem(config, projectId, itemId) {
  if (config.enabled) {
    const existing = await supabaseRequest(
      config,
      `project_execution_items?select=id&id=eq.${encodeURIComponent(itemId)}&project_id=eq.${encodeURIComponent(projectId)}`
    );
    if (!Array.isArray(existing) || existing.length === 0) {
      const err = new Error('执行项不存在。');
      err.status = 404;
      throw err;
    }
    await supabaseRequest(
      config,
      `project_execution_items?id=eq.${encodeURIComponent(itemId)}&project_id=eq.${encodeURIComponent(projectId)}`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
    );
  } else {
    const data = loadSeedData();
    ensureExecutionItemsData(data);
    const idx = data.projectExecutionItems.findIndex(i => i.id === itemId && i.projectId === projectId);
    if (idx < 0) {
      const err = new Error('执行项不存在。');
      err.status = 404;
      throw err;
    }
    data.projectExecutionItems.splice(idx, 1);
    saveSeedData(data);
  }
}

module.exports = {
  listExecutionItems,
  generateExecutionItemsFromProject,
  updateExecutionItem,
  deleteExecutionItem,
  backfillSupplierFields,
};
