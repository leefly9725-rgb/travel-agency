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

// ── Supabase store methods (added in Task 3) ──────────────────────────────────

module.exports = {
  deriveProjectFinancials,
  normalizeProjectRecordFromSupabase,
  buildSupabaseProjectPayload,
};
