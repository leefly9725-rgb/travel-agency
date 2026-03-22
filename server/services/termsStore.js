// server/services/termsStore.js
// 商务条款持久化层 — 双路径：本地 seed.json / 远端 Supabase
// 本地：在 data.quotes[] 中找到对应 quote，读写 terms_snapshot 字段
// 远端：PATCH quotes 表的 terms_snapshot 列

"use strict";

const { loadSeedData, saveSeedData } = require("../dataStore");
const { getSupabaseConfig } = require("../supabaseConfig");
const { supabaseRequest } = require("../supabaseClient");
const { buildDefaultSnapshot } = require("./termsService");

// ─── 本地 (seed.json) ─────────────────────────────────────────────────────────

async function getLocalSnapshot(quoteId) {
  const data = await loadSeedData();
  const quotes = data.quotes || [];
  const quote = quotes.find((q) => q.id === quoteId);
  if (!quote) throw new Error(`报价不存在：${quoteId}`);
  return quote.terms_snapshot || null;
}

async function saveLocalSnapshot(quoteId, snapshot) {
  const data = await loadSeedData();
  const quotes = data.quotes || [];
  const idx = quotes.findIndex((q) => q.id === quoteId);
  if (idx === -1) throw new Error(`报价不存在：${quoteId}`);
  quotes[idx].terms_snapshot = snapshot;
  data.quotes = quotes;
  await saveSeedData(data);
}

// ─── 远端 (Supabase) ──────────────────────────────────────────────────────────

async function getRemoteSnapshot(config, quoteId) {
  const rows = await supabaseRequest(
    config,
    `quotes?select=terms_snapshot&id=eq.${encodeURIComponent(quoteId)}`
  );
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`报价不存在：${quoteId}`);
  return rows[0].terms_snapshot || null;
}

async function saveRemoteSnapshot(config, quoteId, snapshot) {
  await supabaseRequest(
    config,
    `quotes?id=eq.${encodeURIComponent(quoteId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ terms_snapshot: snapshot }),
    }
  );
}

// ─── 默认模板 (仅远端) ────────────────────────────────────────────────────────

async function getRemoteDefaultTemplate(config) {
  try {
    const rows = await supabaseRequest(
      config,
      "business_terms_templates?is_default=eq.true&order=created_at.asc&limit=1"
    );
    if (Array.isArray(rows) && rows.length > 0 && rows[0].snapshot) {
      return rows[0].snapshot;
    }
  } catch (_) {
    // 表可能还未创建，降级到内置默认
  }
  return null;
}

// ─── 统一入口 ─────────────────────────────────────────────────────────────────

/**
 * 读取报价的 terms_snapshot；若为空则返回默认模板（不写库）
 */
async function getTermsSnapshot(quoteId) {
  const config = getSupabaseConfig();

  let snapshot;
  if (config.enabled) {
    snapshot = await getRemoteSnapshot(config, quoteId);
    if (!snapshot) {
      // 尝试从远端默认模板获取
      snapshot = await getRemoteDefaultTemplate(config);
    }
  } else {
    snapshot = await getLocalSnapshot(quoteId);
  }

  // 最终兜底：内置默认快照
  return snapshot || buildDefaultSnapshot();
}

/**
 * 保存报价的 terms_snapshot
 */
async function saveTermsSnapshot(quoteId, snapshot) {
  const config = getSupabaseConfig();
  if (config.enabled) {
    await saveRemoteSnapshot(config, quoteId, snapshot);
  } else {
    await saveLocalSnapshot(quoteId, snapshot);
  }
}

module.exports = { getTermsSnapshot, saveTermsSnapshot };
