'use strict';

const { supabaseRequest } = require('../supabaseClient');
const { roundToTwo } = require('./quoteService');

// ── Pure helpers (no I/O, fully testable) ─────────────────────────────────────

function deriveProjectFinancials(project) {
  const snap =
    project && project.quoteSnapshot !== null && typeof project.quoteSnapshot === 'object'
      ? project.quoteSnapshot
      : {};
  return {
    totalSales: Number(snap.totalSales || 0),
    totalCost: Number(snap.totalCost || 0),
    grossProfit: Number(snap.grossProfit || 0),
    grossMargin: Number(snap.grossMargin || 0),
  };
}

function normalizeProjectRecordFromSupabase(row) {
  const snap =
    row.quote_snapshot !== null && typeof row.quote_snapshot === 'object'
      ? row.quote_snapshot
      : {};
  return {
    id: row.id || '',
    projectNumber: row.project_number || '',
    sourceQuoteId: row.source_quote_id || '',
    sourceQuoteNumber: row.source_quote_number || '',
    sourcePricingMode: row.source_pricing_mode || 'project_based',
    projectName: row.project_name || '',
    clientName: row.client_name || '',
    contactName: row.contact_name || '',
    contactPhone: row.contact_phone || '',
    destination: row.destination || '',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    paxCount: Number(row.pax_count || 0),
    currency: row.currency || 'EUR',
    status: row.status || 'draft',
    ownerName: row.owner_name || '',
    notes: row.notes || '',
    quoteSnapshot: snap,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    ...deriveProjectFinancials({ quoteSnapshot: snap }),
  };
}

function buildSupabaseProjectPayload(project) {
  const raw = {
    id: project.id,
    project_number: project.projectNumber,
    source_quote_id: project.sourceQuoteId,
    source_quote_number: project.sourceQuoteNumber,
    source_pricing_mode: project.sourcePricingMode,
    project_name: project.projectName,
    client_name: project.clientName,
    contact_name: project.contactName,
    contact_phone: project.contactPhone,
    destination: project.destination,
    start_date: project.startDate || null,
    end_date: project.endDate || null,
    pax_count: project.paxCount !== undefined ? Number(project.paxCount) : undefined,
    currency: project.currency,
    status: project.status,
    owner_name: project.ownerName,
    notes: project.notes,
    quote_snapshot:
      project.quoteSnapshot !== null && typeof project.quoteSnapshot === 'object'
        ? project.quoteSnapshot
        : {},
  };
  const payload = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) payload[k] = v;
  }
  return payload;
}

// ── ID generation (mirrors app.js — duplicated to avoid circular import) ───────

function createProjectId() {
  return `PRJ-${Date.now()}`;
}

function generateProjectNumber() {
  return `PRJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
}

// ── Snapshot builder (mirrors app.js buildProjectSnapshot — same reason) ──────

function buildProjectSnapshot(quote) {
  const totalCost = Number(quote.totalCost || 0);
  const totalSales = Number(quote.totalSales || quote.totalPrice || 0);
  const grossProfit = roundToTwo(totalSales - totalCost);
  const grossMargin = totalSales > 0 ? roundToTwo((grossProfit / totalSales) * 100) : 0;
  return {
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber || '',
    pricingMode: quote.pricingMode || 'project_based',
    projectGroups: Array.isArray(quote.projectGroups) ? quote.projectGroups : [],
    totalCost,
    totalSales,
    totalPrice: totalSales,
    grossProfit,
    grossMargin,
    currency: quote.currency || 'EUR',
    clientName: quote.clientName || '',
    projectName: quote.projectName || '',
    contactName: quote.contactName || '',
    contactPhone: quote.contactPhone || '',
    destination: quote.destination || '',
    startDate: quote.startDate || '',
    endDate: quote.endDate || '',
    paxCount: Number(quote.paxCount || 0),
    createdAt: quote.createdAt || '',
    convertedAt: new Date().toISOString(),
  };
}

// ── Supabase store methods ─────────────────────────────────────────────────────

// convertToProject — idempotent; quoteStore is passed in (already created in handleApi)
async function convertToProject(config, quoteStore, quoteId) {
  // 1. Fetch quote (quoteStore handles Supabase vs local internally)
  let quote;
  try {
    const result = await quoteStore.getQuoteById(quoteId);
    quote = result.quote;
  } catch (fetchErr) {
    if (fetchErr && String(fetchErr.message).includes('报价不存在')) {
      const err = new Error('报价不存在。');
      err.status = 404;
      throw err;
    }
    throw fetchErr;
  }

  // 2. Validate pricing mode
  if (quote.pricingMode !== 'project_based') {
    const err = new Error('只有项目型报价（project_based）可以转换为项目。');
    err.status = 400;
    throw err;
  }

  // 3. Idempotency: return existing project if already converted
  const existing = await supabaseRequest(
    config,
    `projects?source_quote_id=eq.${encodeURIComponent(quoteId)}&select=*`,
  );
  if (Array.isArray(existing) && existing.length > 0) {
    return { project: normalizeProjectRecordFromSupabase(existing[0]), created: false };
  }

  // 4. Build project object
  const now = new Date().toISOString();
  const project = {
    id: createProjectId(),
    projectNumber: generateProjectNumber(),
    sourceQuoteId: quoteId,
    sourceQuoteNumber: quote.quoteNumber || '',
    sourcePricingMode: quote.pricingMode || 'project_based',
    projectName: quote.projectName || '',
    clientName: quote.clientName || '',
    contactName: quote.contactName || '',
    contactPhone: quote.contactPhone || '',
    destination: quote.destination || '',
    startDate: quote.startDate || '',
    endDate: quote.endDate || '',
    paxCount: Number(quote.paxCount || 0),
    currency: quote.currency || 'EUR',
    status: 'draft',
    ownerName: '',
    notes: '',
    quoteSnapshot: buildProjectSnapshot(quote),
    createdAt: now,
    updatedAt: now,
  };

  // 5. Insert into public.projects (ignore-duplicates handles concurrent race)
  const payload = buildSupabaseProjectPayload(project);
  let rows = await supabaseRequest(config, 'projects', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(payload),
  });

  // If rows is empty/null, a concurrent insert won the race — re-query
  if (!Array.isArray(rows) || rows.length === 0) {
    const existing2 = await supabaseRequest(
      config,
      `projects?source_quote_id=eq.${encodeURIComponent(quoteId)}&select=*`,
    );
    if (Array.isArray(existing2) && existing2.length > 0) {
      return { project: normalizeProjectRecordFromSupabase(existing2[0]), created: false };
    }
    throw new Error('项目创建失败，Supabase 未返回记录。');
  }

  // 6. Back-write project_id to public.quotes
  const backWriteResult = await supabaseRequest(
    config,
    `quotes?id=eq.${encodeURIComponent(quoteId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ project_id: project.id }),
    },
  );
  if (!Array.isArray(backWriteResult) || backWriteResult.length === 0) {
    console.warn(`[projectStore] back-write project_id failed: quote ${quoteId} not found in Supabase`);
  }

  const inserted = Array.isArray(rows) ? rows[0] : rows;
  return { project: normalizeProjectRecordFromSupabase(inserted || payload), created: true };
}

async function listProjects(config) {
  const rows = await supabaseRequest(config, 'projects?select=*&order=updated_at.desc');
  if (!Array.isArray(rows)) throw new Error('Supabase public.projects 查询失败。');
  return rows.map(normalizeProjectRecordFromSupabase);
}

async function getProjectById(config, id) {
  const rows = await supabaseRequest(
    config,
    `projects?select=*&id=eq.${encodeURIComponent(id)}`,
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return normalizeProjectRecordFromSupabase(rows[0]);
}

async function updateProjectStatus(config, id, status) {
  const VALID = ['draft', 'confirmed', 'running', 'completed', 'cancelled'];
  if (!VALID.includes(status)) {
    const err = new Error(`status 不合法：${status}`);
    err.status = 400;
    throw err;
  }
  // Check existence first so we can return 404 vs 500
  const existing = await supabaseRequest(
    config,
    `projects?select=id&id=eq.${encodeURIComponent(id)}`,
  );
  if (!Array.isArray(existing) || existing.length === 0) {
    const err = new Error('项目不存在。');
    err.status = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const rows = await supabaseRequest(
    config,
    `projects?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status, updated_at: now }),
    },
  );

  const updated = Array.isArray(rows) ? rows[0] : rows;
  if (!updated) throw new Error('更新失败，Supabase 未返回记录。');
  return normalizeProjectRecordFromSupabase(updated);
}

module.exports = {
  deriveProjectFinancials,
  normalizeProjectRecordFromSupabase,
  buildSupabaseProjectPayload,
  convertToProject,
  listProjects,
  getProjectById,
  updateProjectStatus,
};
