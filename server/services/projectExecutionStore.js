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
        plannedDate: null,
        startDate: null,
        endDate: null,
        location: quoteSnapshot.destination || '',
        owner: '',
        status: 'pending',
        supplierStatus: 'not_started',
        notes: '',
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

async function updateExecutionItem(config, projectId, itemId, patch) {
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

  const now = new Date().toISOString();

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
    const updated = Array.isArray(rows) ? rows[0] : rows;
    if (!updated) throw new Error('更新失败，Supabase 未返回记录。');
    return normalizeExecutionItemFromSupabase(updated);
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
    return normalizeLocalExecutionItem(updated);
  }
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
};
