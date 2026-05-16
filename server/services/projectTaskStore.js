'use strict';

const { supabaseRequest } = require('../supabaseClient');
const { loadSeedData, saveSeedData } = require('../dataStore');
const projectExecutionStore = require('./projectExecutionStore');

function generateTaskId() {
  return `PT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── 状态映射：executionItem.status → task.status ──────────────────────────────
function mapExecutionStatusToTaskStatus(execStatus) {
  switch (execStatus) {
    case 'pending':     return 'todo';
    case 'in_progress': return 'in_progress';
    case 'done':        return 'done';
    case 'cancelled':   return 'cancelled';
    default:            return 'todo';
  }
}

// ── 从 executionItem 构造 task 对象 ──────────────────────────────────────────
function buildTaskFromExecutionItem(projectId, ei) {
  const now = new Date().toISOString();
  return {
    id: generateTaskId(),
    projectId,
    sourceExecutionItemId: ei.id,
    sourceQuoteItemId: ei.sourceQuoteItemId || null,
    sourceGroupId: ei.sourceGroupId || null,
    sourceGroupTitle: ei.sourceGroupTitle || '',
    supplierId: ei.supplierId || '',
    supplierCatalogItemId: ei.supplierCatalogItemId || '',
    supplierDisplay: ei.supplierDisplay || '',
    taskType: 'execution',
    title: ei.title || '',
    description: ei.description || '',
    assignee: ei.owner || '',
    dueDate: ei.plannedDate || null,
    executionDate: ei.startDate || ei.endDate || ei.plannedDate || null,
    location: ei.location || '',
    status: mapExecutionStatusToTaskStatus(ei.status),
    priority: 'normal',
    notes: '',
    sortOrder: ei.sortOrder || 0,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Supabase normalize ────────────────────────────────────────────────────────
function normalizeTaskFromSupabase(row) {
  return {
    id: row.id || '',
    projectId: row.project_id || '',
    sourceExecutionItemId: row.source_execution_item_id || '',
    sourceQuoteItemId: row.source_quote_item_id || null,
    sourceGroupId: row.source_group_id || null,
    sourceGroupTitle: row.source_group_title || '',
    supplierId: row.supplier_id || '',
    supplierCatalogItemId: row.supplier_catalog_item_id || '',
    supplierDisplay: row.supplier_display || '',
    taskType: row.task_type || 'execution',
    title: row.title || '',
    description: row.description || '',
    assignee: row.assignee || '',
    dueDate: row.due_date || null,
    executionDate: row.execution_date || null,
    location: row.location || '',
    status: row.status || 'todo',
    priority: row.priority || 'normal',
    notes: row.notes || '',
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function buildSupabaseTaskPayload(task) {
  return {
    id: task.id,
    project_id: task.projectId,
    source_execution_item_id: task.sourceExecutionItemId,
    source_quote_item_id: task.sourceQuoteItemId != null ? task.sourceQuoteItemId : null,
    source_group_id: task.sourceGroupId != null ? task.sourceGroupId : null,
    source_group_title: task.sourceGroupTitle || '',
    supplier_id: task.supplierId || '',
    supplier_catalog_item_id: task.supplierCatalogItemId || '',
    supplier_display: task.supplierDisplay || '',
    task_type: task.taskType || 'execution',
    title: task.title || '',
    description: task.description || '',
    assignee: task.assignee || '',
    due_date: task.dueDate || null,
    execution_date: task.executionDate || null,
    location: task.location || '',
    status: task.status || 'todo',
    priority: task.priority || 'normal',
    notes: task.notes || '',
    sort_order: Number(task.sortOrder || 0),
  };
}

// ── local JSON helpers ────────────────────────────────────────────────────────
function normalizeLocalTask(task) {
  return {
    id: task.id || '',
    projectId: task.projectId || '',
    sourceExecutionItemId: task.sourceExecutionItemId || '',
    sourceQuoteItemId: task.sourceQuoteItemId != null ? task.sourceQuoteItemId : null,
    sourceGroupId: task.sourceGroupId != null ? task.sourceGroupId : null,
    sourceGroupTitle: task.sourceGroupTitle || '',
    supplierId: task.supplierId || '',
    supplierCatalogItemId: task.supplierCatalogItemId || '',
    supplierDisplay: task.supplierDisplay || '',
    taskType: task.taskType || 'execution',
    title: task.title || '',
    description: task.description || '',
    assignee: task.assignee || '',
    dueDate: task.dueDate || null,
    executionDate: task.executionDate || null,
    location: task.location || '',
    status: task.status || 'todo',
    priority: task.priority || 'normal',
    notes: task.notes || '',
    sortOrder: Number(task.sortOrder || 0),
    createdAt: task.createdAt || '',
    updatedAt: task.updatedAt || '',
  };
}

function ensureProjectTasksData(data) {
  if (!Array.isArray(data.projectTasks)) data.projectTasks = [];
}

// ── Public API ────────────────────────────────────────────────────────────────

async function listProjectTasks(config, projectId) {
  if (config.enabled) {
    try {
      const rows = await supabaseRequest(
        config,
        `project_tasks?project_id=eq.${encodeURIComponent(projectId)}&order=sort_order.asc,created_at.asc&select=*`
      );
      if (!Array.isArray(rows)) return [];
      return rows.map(normalizeTaskFromSupabase);
    } catch (err) {
      console.error('[projectTaskStore] listProjectTasks Supabase error:', err.message);
      return [];
    }
  }
  const data = loadSeedData();
  ensureProjectTasksData(data);
  return data.projectTasks
    .filter(t => t.projectId === projectId)
    .sort((a, b) => {
      const so = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      if (so !== 0) return so;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    })
    .map(normalizeLocalTask);
}

async function generateTasksFromExecutionItems(config, projectId) {
  const executionItems = await projectExecutionStore.listExecutionItems(config, projectId);
  if (executionItems.length === 0) {
    return { createdCount: 0, tasks: [] };
  }

  if (config.enabled) {
    // 查已有 task 的 source_execution_item_id 集合（幂等去重）
    let existingRows = [];
    try {
      existingRows = await supabaseRequest(
        config,
        `project_tasks?project_id=eq.${encodeURIComponent(projectId)}&select=source_execution_item_id`
      );
    } catch (err) {
      console.error('[projectTaskStore] generateTasksFromExecutionItems fetch existing error:', err.message);
    }
    const existingEiIds = new Set(
      Array.isArray(existingRows) ? existingRows.map(r => r.source_execution_item_id) : []
    );

    const newTasks = executionItems
      .filter(ei => !existingEiIds.has(ei.id))
      .map(ei => buildTaskFromExecutionItem(projectId, ei));

    if (newTasks.length === 0) {
      const allRows = await supabaseRequest(
        config,
        `project_tasks?project_id=eq.${encodeURIComponent(projectId)}&order=sort_order.asc,created_at.asc&select=*`
      );
      return { createdCount: 0, tasks: Array.isArray(allRows) ? allRows.map(normalizeTaskFromSupabase) : [] };
    }

    const payloads = newTasks.map(buildSupabaseTaskPayload);
    const inserted = await supabaseRequest(config, 'project_tasks', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(payloads),
    });

    const allRows = await supabaseRequest(
      config,
      `project_tasks?project_id=eq.${encodeURIComponent(projectId)}&order=sort_order.asc,created_at.asc&select=*`
    );
    const tasks = Array.isArray(allRows) ? allRows.map(normalizeTaskFromSupabase) : [];
    return { createdCount: Array.isArray(inserted) ? inserted.length : newTasks.length, tasks };
  }

  // local JSON
  const data = loadSeedData();
  ensureProjectTasksData(data);

  const existingEiIds = new Set(
    data.projectTasks
      .filter(t => t.projectId === projectId)
      .map(t => t.sourceExecutionItemId)
  );

  const newTasks = executionItems
    .filter(ei => !existingEiIds.has(ei.id))
    .map(ei => buildTaskFromExecutionItem(projectId, ei));

  if (newTasks.length > 0) {
    data.projectTasks.push(...newTasks);
    saveSeedData(data);
  }

  const allTasks = data.projectTasks
    .filter(t => t.projectId === projectId)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map(normalizeLocalTask);

  return { createdCount: newTasks.length, tasks: allTasks };
}

const VALID_TASK_STATUSES = new Set(['todo', 'in_progress', 'done', 'cancelled']);
const VALID_TASK_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

const UPDATABLE_TASK_FIELDS = new Set([
  'title', 'description', 'assignee', 'dueDate', 'executionDate',
  'location', 'status', 'priority', 'notes', 'sortOrder',
]);

// 允许同步到同供应商其他任务的字段（不含 title/description/notes）
const TASK_SYNC_FIELDS = new Set([
  'assignee', 'dueDate', 'executionDate', 'location', 'status', 'priority',
]);

async function updateProjectTask(config, projectId, taskId, patch, options = {}) {
  const { applyToSameSupplier = false } = options;

  if (patch.status !== undefined && !VALID_TASK_STATUSES.has(patch.status)) {
    const err = new Error(`status 不合法：${patch.status}`);
    err.status = 400;
    throw err;
  }
  if (patch.priority !== undefined && !VALID_TASK_PRIORITIES.has(patch.priority)) {
    const err = new Error(`priority 不合法：${patch.priority}`);
    err.status = 400;
    throw err;
  }

  // 文本字段 null → ''
  const TEXT_NOT_NULL = ['title', 'description', 'assignee', 'location', 'notes'];
  for (const f of TEXT_NOT_NULL) {
    if (patch[f] === null) patch[f] = '';
  }

  const now = new Date().toISOString();
  let updatedTask;

  if (config.enabled) {
    const existing = await supabaseRequest(
      config,
      `project_tasks?select=id&id=eq.${encodeURIComponent(taskId)}&project_id=eq.${encodeURIComponent(projectId)}`
    );
    if (!Array.isArray(existing) || existing.length === 0) {
      const err = new Error('任务不存在。');
      err.status = 404;
      throw err;
    }

    const snakePatch = { updated_at: now };
    if (patch.title !== undefined)         snakePatch.title = patch.title;
    if (patch.description !== undefined)   snakePatch.description = patch.description;
    if (patch.assignee !== undefined)      snakePatch.assignee = patch.assignee;
    if (patch.dueDate !== undefined)       snakePatch.due_date = patch.dueDate || null;
    if (patch.executionDate !== undefined) snakePatch.execution_date = patch.executionDate || null;
    if (patch.location !== undefined)      snakePatch.location = patch.location;
    if (patch.status !== undefined)        snakePatch.status = patch.status;
    if (patch.priority !== undefined)      snakePatch.priority = patch.priority;
    if (patch.notes !== undefined)         snakePatch.notes = patch.notes;
    if (patch.sortOrder !== undefined)     snakePatch.sort_order = Number(patch.sortOrder);

    const rows = await supabaseRequest(
      config,
      `project_tasks?id=eq.${encodeURIComponent(taskId)}&project_id=eq.${encodeURIComponent(projectId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(snakePatch),
      }
    );
    const raw = Array.isArray(rows) ? rows[0] : rows;
    if (!raw) throw new Error('更新失败，Supabase 未返回记录。');
    updatedTask = normalizeTaskFromSupabase(raw);
  } else {
    // local JSON
    const data = loadSeedData();
    ensureProjectTasksData(data);
    const idx = data.projectTasks.findIndex(t => t.id === taskId && t.projectId === projectId);
    if (idx < 0) {
      const err = new Error('任务不存在。');
      err.status = 404;
      throw err;
    }
    const updated = { ...data.projectTasks[idx] };
    for (const field of UPDATABLE_TASK_FIELDS) {
      if (patch[field] !== undefined) {
        if (field === 'sortOrder') updated[field] = Number(patch[field]);
        else updated[field] = patch[field];
      }
    }
    updated.updatedAt = now;
    data.projectTasks[idx] = updated;
    saveSeedData(data);
    updatedTask = normalizeLocalTask(updated);
  }

  if (!applyToSameSupplier) {
    return updatedTask;
  }

  // ── 批量同步同供应商任务 ────────────────────────────────────────────────────
  const supplierId = updatedTask.supplierId;
  const supplierDisplay = updatedTask.supplierDisplay;

  if (!supplierId && !supplierDisplay) {
    return { item: updatedTask, affectedCount: 1, tasks: [updatedTask] };
  }

  // 只同步 patch 中属于 TASK_SYNC_FIELDS 的字段
  const syncPatch = {};
  for (const field of TASK_SYNC_FIELDS) {
    if (patch[field] !== undefined) syncPatch[field] = patch[field];
  }

  const affectedItems = [updatedTask];

  if (config.enabled) {
    const allRows = await supabaseRequest(
      config,
      `project_tasks?project_id=eq.${encodeURIComponent(projectId)}&select=*`
    );
    if (Array.isArray(allRows) && Object.keys(syncPatch).length > 0) {
      const siblings = allRows.filter(r =>
        r.id !== taskId &&
        (supplierId ? r.supplier_id === supplierId : r.supplier_display === supplierDisplay)
      );
      if (siblings.length > 0) {
        const syncSnake = { updated_at: now };
        if (syncPatch.assignee !== undefined)       syncSnake.assignee = syncPatch.assignee;
        if (syncPatch.dueDate !== undefined)        syncSnake.due_date = syncPatch.dueDate || null;
        if (syncPatch.executionDate !== undefined)  syncSnake.execution_date = syncPatch.executionDate || null;
        if (syncPatch.location !== undefined)       syncSnake.location = syncPatch.location;
        if (syncPatch.status !== undefined)         syncSnake.status = syncPatch.status;
        if (syncPatch.priority !== undefined)       syncSnake.priority = syncPatch.priority;

        const siblingIds = siblings.map(r => r.id).join(',');
        const batchRows = await supabaseRequest(
          config,
          `project_tasks?id=in.(${siblingIds})`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(syncSnake),
          }
        );
        if (Array.isArray(batchRows)) {
          batchRows.forEach(r => affectedItems.push(normalizeTaskFromSupabase(r)));
        }
      }
    }
  } else {
    if (Object.keys(syncPatch).length > 0) {
      const data = loadSeedData();
      ensureProjectTasksData(data);
      let changed = false;
      for (let i = 0; i < data.projectTasks.length; i++) {
        const t = data.projectTasks[i];
        if (t.id === taskId || t.projectId !== projectId) continue;
        const match = supplierId
          ? t.supplierId === supplierId
          : t.supplierDisplay === supplierDisplay;
        if (!match) continue;
        const updated = { ...t };
        for (const field of TASK_SYNC_FIELDS) {
          if (syncPatch[field] !== undefined) updated[field] = syncPatch[field];
        }
        updated.updatedAt = now;
        data.projectTasks[i] = updated;
        affectedItems.push(normalizeLocalTask(updated));
        changed = true;
      }
      if (changed) saveSeedData(data);
    }
  }

  return { item: updatedTask, affectedCount: affectedItems.length, tasks: affectedItems };
}

module.exports = {
  listProjectTasks,
  generateTasksFromExecutionItems,
  updateProjectTask,
};
