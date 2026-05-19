'use strict';

const { supabaseRequest } = require('../supabaseClient');
const { loadSeedData, saveSeedData } = require('../dataStore');
const { upsertSupplierProjectCost } = require('./supplierProjectCostStore');
const { buildProjectCostSummary } = require('./supplierProjectCostStore');

const VALID_PARSE_STATUSES = new Set(['parsed', 'failed']);
const VALID_REVIEW_STATUSES = new Set(['pending', 'applied', 'rejected']);

function generateInvoiceTextImportId() {
  return `SITI-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function ensureSupplierInvoiceTextImportsData(data) {
  if (!Array.isArray(data.supplierInvoiceTextImports)) data.supplierInvoiceTextImports = [];
}

function normalizeInvoiceTextImportFromSupabase(row) {
  return {
    id: row.id || '',
    projectId: row.project_id || '',
    supplierId: row.supplier_id || '',
    supplierDisplay: row.supplier_display || '',
    rawText: row.raw_text || '',
    ocrLanguage: row.ocr_language || 'sr',
    parseStatus: row.parse_status || 'parsed',
    parseError: row.parse_error || '',
    parsedSupplierName: row.parsed_supplier_name || '',
    parsedSupplierPib: row.parsed_supplier_pib || '',
    invoiceNumber: row.invoice_number || '',
    invoiceDate: row.invoice_date || null,
    currency: row.currency || 'RSD',
    subtotalWithoutTax: row.subtotal_without_tax != null ? Number(row.subtotal_without_tax) : null,
    taxAmount: row.tax_amount != null ? Number(row.tax_amount) : null,
    totalWithTax: row.total_with_tax != null ? Number(row.total_with_tax) : null,
    suggestedSupplierId: row.suggested_supplier_id || '',
    suggestedSupplierDisplay: row.suggested_supplier_display || '',
    matchConfidence: row.match_confidence != null ? Number(row.match_confidence) : null,
    matchReason: row.match_reason || '',
    reviewStatus: row.review_status || 'pending',
    targetSupplierCostId: row.target_supplier_cost_id || '',
    appliedAt: row.applied_at || null,
    notes: row.notes || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function normalizeLocalInvoiceTextImport(item) {
  return {
    id: item.id || '',
    projectId: item.projectId || '',
    supplierId: item.supplierId || '',
    supplierDisplay: item.supplierDisplay || '',
    rawText: item.rawText || '',
    ocrLanguage: item.ocrLanguage || 'sr',
    parseStatus: item.parseStatus || 'parsed',
    parseError: item.parseError || '',
    parsedSupplierName: item.parsedSupplierName || '',
    parsedSupplierPib: item.parsedSupplierPib || '',
    invoiceNumber: item.invoiceNumber || '',
    invoiceDate: item.invoiceDate || null,
    currency: item.currency || 'RSD',
    subtotalWithoutTax: item.subtotalWithoutTax != null ? Number(item.subtotalWithoutTax) : null,
    taxAmount: item.taxAmount != null ? Number(item.taxAmount) : null,
    totalWithTax: item.totalWithTax != null ? Number(item.totalWithTax) : null,
    suggestedSupplierId: item.suggestedSupplierId || '',
    suggestedSupplierDisplay: item.suggestedSupplierDisplay || '',
    matchConfidence: item.matchConfidence != null ? Number(item.matchConfidence) : null,
    matchReason: item.matchReason || '',
    reviewStatus: item.reviewStatus || 'pending',
    targetSupplierCostId: item.targetSupplierCostId || '',
    appliedAt: item.appliedAt || null,
    notes: item.notes || '',
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || '',
  };
}

function buildSupabaseInvoiceTextImportPayload(item) {
  const raw = {
    id: item.id,
    project_id: item.projectId,
    supplier_id: item.supplierId || '',
    supplier_display: item.supplierDisplay || '',
    raw_text: item.rawText || '',
    ocr_language: item.ocrLanguage || 'sr',
    parse_status: item.parseStatus || 'parsed',
    parse_error: item.parseError || '',
    parsed_supplier_name: item.parsedSupplierName || '',
    parsed_supplier_pib: item.parsedSupplierPib || '',
    invoice_number: item.invoiceNumber || '',
    invoice_date: item.invoiceDate || null,
    currency: item.currency || 'RSD',
    subtotal_without_tax: item.subtotalWithoutTax != null ? Number(item.subtotalWithoutTax) : null,
    tax_amount: item.taxAmount != null ? Number(item.taxAmount) : null,
    total_with_tax: item.totalWithTax != null ? Number(item.totalWithTax) : null,
    suggested_supplier_id: item.suggestedSupplierId || '',
    suggested_supplier_display: item.suggestedSupplierDisplay || '',
    match_confidence: item.matchConfidence != null ? Number(item.matchConfidence) : null,
    match_reason: item.matchReason || '',
    review_status: item.reviewStatus || 'pending',
    target_supplier_cost_id: item.targetSupplierCostId || '',
    applied_at: item.appliedAt || null,
    notes: item.notes || '',
  };
  const payload = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) payload[k] = v;
  }
  return payload;
}

// ── normalizeMoneyString ──────────────────────────────────────────────────────
// Handles Serbian format: 120.000,00 (dot=thousands, comma=decimal)
// and international formats: 120,000.00 / 120000.00
function normalizeMoneyString(str) {
  if (!str) return null;
  const s = String(str).trim();
  // Case: Serbian/European format — has both dot AND comma, comma is last (decimal)
  // e.g. "120.000,00"
  const dotComma = /^[\d.]+,\d{1,2}$/.test(s);
  if (dotComma) {
    // Remove dots (thousands sep), replace comma with dot
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  // Case: US format — has both comma AND dot, dot is last (decimal)
  // e.g. "120,000.00"
  const commaDot = /^[\d,]+\.\d{1,2}$/.test(s);
  if (commaDot) {
    return parseFloat(s.replace(/,/g, ''));
  }
  // Case: dot as thousands only, no decimal (e.g. "5.000")
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    return parseFloat(s.replace(/\./g, ''));
  }
  // Case: comma as thousands only, no decimal (e.g. "5,000")
  if (/^\d{1,3}(,\d{3})+$/.test(s)) {
    return parseFloat(s.replace(/,/g, ''));
  }
  // Plain number
  const plain = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(plain) ? null : plain;
}

// ── parseSupplierInvoiceText ──────────────────────────────────────────────────
function parseSupplierInvoiceText(rawText) {
  const text = String(rawText || '');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let parsedSupplierName = '';
  let parsedSupplierPib = '';
  let invoiceNumber = '';
  let invoiceDate = null;
  let currency = 'RSD';
  let subtotalWithoutTax = null;
  let taxAmount = null;
  let totalWithTax = null;
  let parseStatus = 'parsed';
  let parseError = '';

  // ── Currency detection (scan whole text first) ──
  if (/€|EUR/i.test(text)) {
    currency = 'EUR';
  } else if (/дин|din\b/i.test(text)) {
    currency = 'RSD';
  } else if (/RSD/i.test(text)) {
    currency = 'RSD';
  }

  // ── Line-by-line parsing ──
  for (const line of lines) {
    const norm = line.toLowerCase();

    // ── PIB ──
    if (!parsedSupplierPib) {
      const pibMatch = line.match(/(?:PIB|P\.I\.B\.|ПИБ|Tax\s*ID|VAT\s*ID)[:\s]*([0-9]{7,12})/i);
      if (pibMatch) parsedSupplierPib = pibMatch[1].trim();
    }

    // ── Invoice Number ──
    if (!invoiceNumber) {
      const invMatch = line.match(
        /(?:Ra[cč]un\s*(?:broj|br\.?)?|Faktura\s*(?:br\.?|broj)?|Broj\s*ra[cč]una|Invoice\s*(?:No\.?|Number|br\.?)?|Br\.?)\s*[:\-]?\s*([A-Za-z0-9\/\-]+)/i
      );
      if (invMatch) invoiceNumber = invMatch[1].trim();
    }

    // ── Date ──
    if (!invoiceDate) {
      // Try ISO and slash format first: YYYY-MM-DD, YYYY/MM/DD
      let dm = line.match(/\b(\d{4}[-\/]\d{2}[-\/]\d{2})\b/);
      if (dm) {
        invoiceDate = dm[1].replace(/\//g, '-');
      } else {
        // DD.MM.YYYY or DD/MM/YYYY
        dm = line.match(/\b(\d{2})[.\/](\d{2})[.\/](\d{4})\b/);
        if (dm) invoiceDate = `${dm[3]}-${dm[2]}-${dm[1]}`;
      }
    }

    // ── Total with tax (priority) ──
    // Match: Ukupno za uplatu / Ukupno sa PDV / Ukupno sa PDV-om / Total with VAT / Iznos za uplatu
    if (totalWithTax === null) {
      if (/ukupno\s+(?:za\s+uplatu|sa\s+pdv(?:-?om)?)|total\s+with\s+vat|iznos\s+za\s+uplatu/i.test(norm)) {
        const numMatch = line.match(/([0-9][0-9.,\s]*[0-9])/);
        if (numMatch) totalWithTax = normalizeMoneyString(numMatch[1].replace(/\s/g, ''));
      }
    }
    // Fallback: "Ukupno" line (only if not already found)
    if (totalWithTax === null) {
      if (/^ukupno\s*[:\-]?\s*/i.test(norm) || /\bukupno\b.*?([0-9][0-9.,]*)/i.test(line)) {
        const numMatch = line.match(/([0-9][0-9.,\s]*[0-9])\s*(?:RSD|EUR|€|дин|din)?/i);
        if (numMatch) {
          const v = normalizeMoneyString(numMatch[1].replace(/\s/g, ''));
          if (v !== null && v > 0) totalWithTax = v;
        }
      }
    }
    // Generic "Total" line
    if (totalWithTax === null && /^\s*total\s*[:\-]?\s*/i.test(norm)) {
      const numMatch = line.match(/([0-9][0-9.,\s]*[0-9])/);
      if (numMatch) {
        const v = normalizeMoneyString(numMatch[1].replace(/\s/g, ''));
        if (v !== null && v > 0) totalWithTax = v;
      }
    }

    // ── Subtotal without tax ──
    if (subtotalWithoutTax === null) {
      if (/osnovi[cč]a|bez\s+pdv|subtotal|neto\s*(?:iznos)?/i.test(norm)) {
        const numMatch = line.match(/([0-9][0-9.,\s]*[0-9])/);
        if (numMatch) subtotalWithoutTax = normalizeMoneyString(numMatch[1].replace(/\s/g, ''));
      }
    }

    // ── Tax amount ──
    if (taxAmount === null) {
      // Only match "PDV:" or "VAT:" lines (not "bez PDV" or "sa PDV" already handled as total)
      if (/^\s*(?:PDV|VAT)\s*[:\-]?\s*[0-9]/i.test(line)) {
        const numMatch = line.match(/([0-9][0-9.,\s]*[0-9])/);
        if (numMatch) taxAmount = normalizeMoneyString(numMatch[1].replace(/\s/g, ''));
      }
    }

    // ── Inline currency from amount lines ──
    if (/€/.test(line)) currency = 'EUR';
    else if (/\bEUR\b/i.test(line) && !/ukupno|total|osnovi|pdv/i.test(norm)) currency = 'EUR';
  }

  // ── Supplier name: try lines before PIB or invoice keywords ──
  // Take first non-empty line that doesn't look like a keyword line
  const SKIP_KEYWORDS = /faktura|ra[cč]un|datum|PIB|PDV|ukupno|total|iznos|osnovi|subtotal|invoice|tax\s*id/i;
  for (const line of lines.slice(0, 8)) {
    if (!SKIP_KEYWORDS.test(line) && line.length > 2 && !parsedSupplierName) {
      parsedSupplierName = line;
      break;
    }
  }

  // ── Validate total ──
  if (totalWithTax === null) {
    parseStatus = 'failed';
    parseError = '未能识别发票总金额';
  }

  return {
    parsedSupplierName,
    parsedSupplierPib,
    invoiceNumber,
    invoiceDate,
    currency,
    subtotalWithoutTax,
    taxAmount,
    totalWithTax,
    rawText,
    parseStatus,
    parseError,
  };
}

// ── normalizeForMatch ─────────────────────────────────────────────────────────
function normalizeForMatch(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(d\.?o\.?o\.?|ltd\.?|l\.?t\.?d\.?|llc\.?|公司|inc\.?|corp\.?|a\.?d\.?)\b/gi, '')
    .replace(/[^\w一-鿿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── matchInvoiceToProjectSupplier ─────────────────────────────────────────────
function matchInvoiceToProjectSupplier(parsed, costSummary) {
  const rows = Array.isArray(costSummary && costSummary.supplierRows) ? costSummary.supplierRows : [];
  const parsedNorm = normalizeForMatch(parsed.parsedSupplierName);

  if (!parsedNorm || rows.length === 0) {
    // Single-supplier low-confidence suggestion
    if (rows.length === 1) {
      return {
        suggestedSupplierId: rows[0].supplierId || '',
        suggestedSupplierDisplay: rows[0].supplierDisplay || '',
        matchConfidence: 20,
        matchReason: '项目仅有一个供应商，自动低置信度建议',
      };
    }
    return { suggestedSupplierId: '', suggestedSupplierDisplay: '', matchConfidence: 0, matchReason: '无法匹配' };
  }

  let best = null;
  let bestScore = 0;

  for (const row of rows) {
    const displayNorm = normalizeForMatch(row.supplierDisplay);
    let score = 0;
    let reason = '';

    if (parsedNorm === displayNorm) {
      score = 95;
      reason = '名称完全一致';
    } else if (parsedNorm.includes(displayNorm) || displayNorm.includes(parsedNorm)) {
      score = 75;
      reason = '名称包含匹配';
    } else {
      // Token overlap
      const pTokens = new Set(parsedNorm.split(' ').filter(Boolean));
      const dTokens = new Set(displayNorm.split(' ').filter(Boolean));
      let overlap = 0;
      for (const t of pTokens) if (dTokens.has(t)) overlap++;
      if (overlap > 0 && pTokens.size > 0) {
        score = Math.round((overlap / Math.max(pTokens.size, dTokens.size)) * 60);
        reason = `关键词部分匹配（${overlap}个词）`;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = { row, reason };
    }
  }

  if (best && bestScore > 0) {
    return {
      suggestedSupplierId: best.row.supplierId || '',
      suggestedSupplierDisplay: best.row.supplierDisplay || '',
      matchConfidence: bestScore,
      matchReason: best.reason,
    };
  }

  if (rows.length === 1) {
    return {
      suggestedSupplierId: rows[0].supplierId || '',
      suggestedSupplierDisplay: rows[0].supplierDisplay || '',
      matchConfidence: 20,
      matchReason: '项目仅有一个供应商，自动低置信度建议',
    };
  }

  return { suggestedSupplierId: '', suggestedSupplierDisplay: '', matchConfidence: 0, matchReason: '无匹配' };
}

// ── createInvoiceTextImport ───────────────────────────────────────────────────
async function createInvoiceTextImport(config, projectId, payload) {
  const rawText = String(payload.rawText || '').trim();
  if (!rawText) {
    const err = new Error('rawText 不能为空。');
    err.status = 400;
    throw err;
  }

  const parsed = parseSupplierInvoiceText(rawText);

  // Build cost summary for supplier matching
  let costSummary = { supplierRows: [] };
  try {
    costSummary = await buildProjectCostSummary(config, projectId);
  } catch (_) {
    // Non-fatal: matching fails gracefully
  }
  const match = matchInvoiceToProjectSupplier(parsed, costSummary);

  const now = new Date().toISOString();
  const id = generateInvoiceTextImportId();

  const record = {
    id,
    projectId,
    supplierId: payload.supplierId || '',
    supplierDisplay: payload.supplierDisplay || '',
    rawText,
    ocrLanguage: payload.ocrLanguage || 'sr',
    parseStatus: parsed.parseStatus,
    parseError: parsed.parseError,
    parsedSupplierName: parsed.parsedSupplierName,
    parsedSupplierPib: parsed.parsedSupplierPib,
    invoiceNumber: parsed.invoiceNumber,
    invoiceDate: parsed.invoiceDate,
    currency: parsed.currency,
    subtotalWithoutTax: parsed.subtotalWithoutTax,
    taxAmount: parsed.taxAmount,
    totalWithTax: parsed.totalWithTax,
    suggestedSupplierId: match.suggestedSupplierId,
    suggestedSupplierDisplay: match.suggestedSupplierDisplay,
    matchConfidence: match.matchConfidence,
    matchReason: match.matchReason,
    reviewStatus: 'pending',
    targetSupplierCostId: '',
    appliedAt: null,
    notes: payload.notes || '',
    createdAt: now,
    updatedAt: now,
  };

  if (config.enabled) {
    const supaPayload = buildSupabaseInvoiceTextImportPayload(record);
    supaPayload.created_at = now;
    supaPayload.updated_at = now;
    const rows = await supabaseRequest(
      config,
      'supplier_invoice_text_imports',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify([supaPayload]),
      }
    );
    const raw = Array.isArray(rows) ? rows[0] : rows;
    if (!raw) throw new Error('保存失败，Supabase 未返回记录。');
    return normalizeInvoiceTextImportFromSupabase(raw);
  }

  const data = loadSeedData();
  ensureSupplierInvoiceTextImportsData(data);
  data.supplierInvoiceTextImports.push(record);
  saveSeedData(data);
  return normalizeLocalInvoiceTextImport(record);
}

// ── listInvoiceTextImports ────────────────────────────────────────────────────
async function listInvoiceTextImports(config, projectId) {
  if (config.enabled) {
    try {
      const rows = await supabaseRequest(
        config,
        `supplier_invoice_text_imports?project_id=eq.${encodeURIComponent(projectId)}&order=created_at.desc&select=*`
      );
      if (!Array.isArray(rows)) return [];
      return rows.map(normalizeInvoiceTextImportFromSupabase);
    } catch (err) {
      console.error('[supplierInvoiceTextImportStore] listInvoiceTextImports Supabase error:', err.message);
      return [];
    }
  }
  const data = loadSeedData();
  ensureSupplierInvoiceTextImportsData(data);
  return data.supplierInvoiceTextImports
    .filter(r => r.projectId === projectId)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .map(normalizeLocalInvoiceTextImport);
}

// ── applyInvoiceTextImport ────────────────────────────────────────────────────
async function applyInvoiceTextImport(config, projectId, importId, payload) {
  // Load the import record
  let importRecord = null;
  if (config.enabled) {
    const rows = await supabaseRequest(
      config,
      `supplier_invoice_text_imports?id=eq.${encodeURIComponent(importId)}&project_id=eq.${encodeURIComponent(projectId)}&select=*`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      const err = new Error('发票导入记录不存在。');
      err.status = 404;
      throw err;
    }
    importRecord = normalizeInvoiceTextImportFromSupabase(rows[0]);
  } else {
    const data = loadSeedData();
    ensureSupplierInvoiceTextImportsData(data);
    const raw = data.supplierInvoiceTextImports.find(r => r.id === importId && r.projectId === projectId);
    if (!raw) {
      const err = new Error('发票导入记录不存在。');
      err.status = 404;
      throw err;
    }
    importRecord = normalizeLocalInvoiceTextImport(raw);
  }

  if (importRecord.reviewStatus === 'applied') {
    const err = new Error('该导入记录已经应用过，不能重复应用。');
    err.status = 400;
    throw err;
  }

  const supplierId = payload.supplierId || importRecord.suggestedSupplierId || '';
  const supplierDisplay = payload.supplierDisplay || importRecord.suggestedSupplierDisplay || '';
  if (!supplierId && !supplierDisplay) {
    const err = new Error('supplierId 和 supplierDisplay 至少需要填写一个。');
    err.status = 400;
    throw err;
  }

  // Determine actual total cost
  let actualTotalCost;
  if (payload.actualTotalCost !== undefined && payload.actualTotalCost !== null && payload.actualTotalCost !== '') {
    actualTotalCost = Number(payload.actualTotalCost);
  } else if (payload.useSupplierTotal && importRecord.totalWithTax != null) {
    actualTotalCost = importRecord.totalWithTax;
  } else if (importRecord.totalWithTax != null) {
    actualTotalCost = importRecord.totalWithTax;
  } else {
    actualTotalCost = null;
  }

  if (actualTotalCost !== null && (isNaN(actualTotalCost) || actualTotalCost < 0)) {
    const err = new Error('actualTotalCost 必须是 >= 0 的数字');
    err.status = 400;
    throw err;
  }

  const costPayload = {
    supplierId,
    supplierDisplay,
    actualTotalCost,
    costCurrency: payload.costCurrency || importRecord.currency || 'RSD',
    costStatus: payload.costStatus || 'confirmed',
    useSupplierTotal: payload.useSupplierTotal !== false,
    invoiceNumber: payload.invoiceNumber !== undefined ? payload.invoiceNumber : importRecord.invoiceNumber,
    invoiceDate: payload.invoiceDate !== undefined ? payload.invoiceDate : importRecord.invoiceDate,
    sourceType: 'invoice_text',
    notes: payload.notes || `来自发票文本导入：${importId}`,
  };

  const supplierCost = await upsertSupplierProjectCost(config, projectId, costPayload);

  // Update the import record
  const now = new Date().toISOString();
  const importPatch = {
    reviewStatus: 'applied',
    targetSupplierCostId: supplierCost.id,
    appliedAt: now,
    updatedAt: now,
  };

  if (config.enabled) {
    const rows = await supabaseRequest(
      config,
      `supplier_invoice_text_imports?id=eq.${encodeURIComponent(importId)}&project_id=eq.${encodeURIComponent(projectId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          review_status: 'applied',
          target_supplier_cost_id: supplierCost.id,
          applied_at: now,
          updated_at: now,
        }),
      }
    );
    const raw = Array.isArray(rows) ? rows[0] : rows;
    const updatedImport = raw ? normalizeInvoiceTextImportFromSupabase(raw) : { ...importRecord, ...importPatch };
    return { importRecord: updatedImport, supplierCost };
  }

  const data = loadSeedData();
  ensureSupplierInvoiceTextImportsData(data);
  const idx = data.supplierInvoiceTextImports.findIndex(r => r.id === importId && r.projectId === projectId);
  if (idx >= 0) {
    data.supplierInvoiceTextImports[idx] = { ...data.supplierInvoiceTextImports[idx], ...importPatch };
    saveSeedData(data);
    return { importRecord: normalizeLocalInvoiceTextImport(data.supplierInvoiceTextImports[idx]), supplierCost };
  }
  return { importRecord: { ...importRecord, ...importPatch }, supplierCost };
}

// ── rejectInvoiceTextImport ───────────────────────────────────────────────────
async function rejectInvoiceTextImport(config, projectId, importId, reason) {
  const now = new Date().toISOString();
  const notes = reason ? `驳回原因：${reason}` : '';

  if (config.enabled) {
    const existing = await supabaseRequest(
      config,
      `supplier_invoice_text_imports?id=eq.${encodeURIComponent(importId)}&project_id=eq.${encodeURIComponent(projectId)}&select=id,review_status`
    );
    if (!Array.isArray(existing) || existing.length === 0) {
      const err = new Error('发票导入记录不存在。');
      err.status = 404;
      throw err;
    }
    const rows = await supabaseRequest(
      config,
      `supplier_invoice_text_imports?id=eq.${encodeURIComponent(importId)}&project_id=eq.${encodeURIComponent(projectId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ review_status: 'rejected', notes, updated_at: now }),
      }
    );
    const raw = Array.isArray(rows) ? rows[0] : rows;
    if (!raw) throw new Error('更新失败，Supabase 未返回记录。');
    return normalizeInvoiceTextImportFromSupabase(raw);
  }

  const data = loadSeedData();
  ensureSupplierInvoiceTextImportsData(data);
  const idx = data.supplierInvoiceTextImports.findIndex(r => r.id === importId && r.projectId === projectId);
  if (idx < 0) {
    const err = new Error('发票导入记录不存在。');
    err.status = 404;
    throw err;
  }
  data.supplierInvoiceTextImports[idx] = {
    ...data.supplierInvoiceTextImports[idx],
    reviewStatus: 'rejected',
    notes,
    updatedAt: now,
  };
  saveSeedData(data);
  return normalizeLocalInvoiceTextImport(data.supplierInvoiceTextImports[idx]);
}

module.exports = {
  ensureSupplierInvoiceTextImportsData,
  generateInvoiceTextImportId,
  normalizeInvoiceTextImportFromSupabase,
  normalizeLocalInvoiceTextImport,
  buildSupabaseInvoiceTextImportPayload,
  parseSupplierInvoiceText,
  matchInvoiceToProjectSupplier,
  normalizeMoneyString,
  createInvoiceTextImport,
  listInvoiceTextImports,
  applyInvoiceTextImport,
  rejectInvoiceTextImport,
};
