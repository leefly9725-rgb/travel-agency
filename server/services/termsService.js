// server/services/termsService.js
// 商务条款模块 V1 — 核心业务逻辑
// 职责：默认快照、结构校验、source_hash、结构化字段多语言渲染
// 翻译调用在 claudeTranslateService.js 中

"use strict";

const crypto = require("node:crypto");

// ─── 固定标题三语 ────────────────────────────────────────────────────────────

const BLOCK_TITLES = {
  included: { zh: "费用包含",      en: "Included",           sr: "Uključeno" },
  excluded: { zh: "费用不含",      en: "Excluded",           sr: "Isključeno" },
  validity: { zh: "报价有效期",    en: "Quotation Validity", sr: "Rok važenja ponude" },
  payment:  { zh: "付款方式与节点", en: "Payment Terms",      sr: "Uslovi plaćanja" },
  notes:    { zh: "特别说明",      en: "Special Notes",       sr: "Posebne napomene" },
};

// ─── 付款方式枚举标签 ─────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS = {
  bank_transfer: { zh: "银行转账",     en: "bank transfer",  sr: "bankovni transfer" },
  cash:          { zh: "现金",         en: "cash",           sr: "gotovina" },
  card_pos:      { zh: "刷卡/POS 机",  en: "card/POS",       sr: "kartica/POS" },
  alipay:        { zh: "支付宝",       en: "Alipay",         sr: "Alipay" },
  wechat_pay:    { zh: "微信支付",     en: "WeChat Pay",     sr: "WeChat Pay" },
  paypal:        { zh: "PayPal",       en: "PayPal",         sr: "PayPal" },
  other:         { zh: null,           en: null,             sr: null },  // 使用 other_payment_method_text
};

// ─── 默认快照模板 ─────────────────────────────────────────────────────────────

function buildDefaultSnapshot() {
  const now = new Date().toISOString();
  return {
    source_lang: "zh",
    schema_version: "1.0",
    blocks: [
      {
        key: "included",
        enabled: true,
        sort_order: 10,
        type: "rich_text",
        title: BLOCK_TITLES.included,
        content: { zh: [], en: [], sr: [] },
        translation_status: { en: "auto", sr: "auto" },
        source_hash: computeHash([]),
        updated_at: now,
      },
      {
        key: "excluded",
        enabled: true,
        sort_order: 20,
        type: "rich_text",
        title: BLOCK_TITLES.excluded,
        content: { zh: [], en: [], sr: [] },
        translation_status: { en: "auto", sr: "auto" },
        source_hash: computeHash([]),
        updated_at: now,
      },
      {
        key: "validity",
        enabled: true,
        sort_order: 30,
        type: "structured",
        title: BLOCK_TITLES.validity,
        fields: {
          validity_mode: "days",
          valid_days: 10,
          valid_until: null,
          validity_note: null,
        },
      },
      {
        key: "payment",
        enabled: true,
        sort_order: 40,
        type: "structured",
        title: BLOCK_TITLES.payment,
        fields: {
          payment_methods: ["bank_transfer"],
          other_payment_method_text: null,
          deposit_percent: 50,
          balance_due_days_before_event: 7,
          payment_note: null,
        },
      },
      {
        key: "notes",
        enabled: false,
        sort_order: 50,
        type: "rich_text",
        title: BLOCK_TITLES.notes,
        content: { zh: "", en: "", sr: "" },
        translation_status: { en: "auto", sr: "auto" },
        source_hash: computeHash(""),
        updated_at: now,
      },
    ],
  };
}

// ─── source_hash ─────────────────────────────────────────────────────────────

function computeHash(content) {
  const str = typeof content === "string" ? content : JSON.stringify(content);
  return crypto.createHash("md5").update(str).digest("hex").slice(0, 12);
}

// ─── 快照校验 ─────────────────────────────────────────────────────────────────

const ALLOWED_KEYS = new Set(["included", "excluded", "validity", "payment", "notes"]);

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("terms_snapshot 必须是对象。");
  }
  if (snapshot.schema_version !== "1.0") {
    throw new Error("不支持的 schema_version，当前仅支持 1.0。");
  }
  if (!Array.isArray(snapshot.blocks)) {
    throw new Error("terms_snapshot.blocks 必须是数组。");
  }
  for (const block of snapshot.blocks) {
    if (!block.key || !ALLOWED_KEYS.has(block.key)) {
      throw new Error(`非法的 block.key：${block.key}`);
    }
    if (!["rich_text", "structured"].includes(block.type)) {
      throw new Error(`block[${block.key}].type 必须是 rich_text 或 structured。`);
    }
  }
}

// ─── 结构化字段渲染（不走 AI）────────────────────────────────────────────────

/**
 * 将 validity block 渲染为三语文本字符串
 */
function renderValidityBlock(fields) {
  const { validity_mode, valid_days, valid_until, validity_note } = fields;

  const note = (s) => (s ? `\n${s}` : "");

  if (validity_mode === "date") {
    return {
      zh: `本报价有效期至 ${valid_until}。${note(validity_note)}`,
      en: `This quotation is valid until ${valid_until}.${note(validity_note)}`,
      sr: `Ova ponuda važi do ${valid_until}.${note(validity_note)}`,
    };
  }

  // default: days
  const days = valid_days || 10;
  return {
    zh: `本报价自出具之日起 ${days} 个自然日内有效。${note(validity_note)}`,
    en: `This quotation is valid for ${days} calendar days from the date of issue.${note(validity_note)}`,
    sr: `Ova ponuda važi ${days} kalendarskih dana od dana izdavanja.${note(validity_note)}`,
  };
}

/**
 * 将 payment block 渲染为三语文本字符串
 */
function renderPaymentBlock(fields, lang) {
  const {
    payment_methods,
    other_payment_method_text,
    deposit_percent,
    balance_due_days_before_event,
    payment_note,
  } = fields;

  function methodLabel(method, l) {
    const entry = PAYMENT_METHOD_LABELS[method];
    if (!entry) return method;
    if (method === "other") return other_payment_method_text || (l === "zh" ? "其他方式" : "other");
    return entry[l] || method;
  }

  const methods = (payment_methods || []).map((m) => methodLabel(m, lang));
  const note = (s) => (s ? ` ${s}` : "");

  if (lang === "zh") {
    const mStr = methods.join("、");
    return (
      `建议采用${mStr}付款。` +
      `签约确认后支付 ${deposit_percent}% 预付款，` +
      `项目开始前 ${balance_due_days_before_event} 天支付剩余尾款。` +
      note(fields.payment_note)
    ).trim();
  }

  if (lang === "en") {
    const mStr = methods.join("/");
    return (
      `Payment by ${mStr} is preferred. ` +
      `A ${deposit_percent}% deposit is due upon contract signing. ` +
      `The remaining balance is due ${balance_due_days_before_event} days before the event.` +
      note(fields.payment_note)
    ).trim();
  }

  if (lang === "sr") {
    const mStr = methods.join("/");
    return (
      `Plaćanje putem ${mStr}. ` +
      `Depozit od ${deposit_percent}% obavezan je pri potpisivanju ugovora. ` +
      `Preostali iznos se plaća ${balance_due_days_before_event} dana pre početka programa.` +
      note(fields.payment_note)
    ).trim();
  }

  return "";
}

/**
 * 将整个快照中结构化 block 渲染为三语文本（用于 PDF/Preview 消费）
 * 注意：rich_text block 直接返回 content，不做渲染
 */
function renderSnapshotForPreview(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.blocks)) return [];

  return snapshot.blocks
    .filter((b) => b.enabled)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((block) => {
      if (block.type === "structured") {
        const rendered = {};
        if (block.key === "validity") {
          const r = renderValidityBlock(block.fields || {});
          rendered.zh = r.zh;
          rendered.en = r.en;
          rendered.sr = r.sr;
        } else if (block.key === "payment") {
          rendered.zh = renderPaymentBlock(block.fields || {}, "zh");
          rendered.en = renderPaymentBlock(block.fields || {}, "en");
          rendered.sr = renderPaymentBlock(block.fields || {}, "sr");
        }
        return { key: block.key, type: block.type, title: block.title, rendered };
      }
      // rich_text
      return { key: block.key, type: block.type, title: block.title, content: block.content };
    });
}

// ─── 翻译状态更新工具 ─────────────────────────────────────────────────────────

/**
 * 当用户修改了 block 的 content.zh 时，调用此函数更新 stale 状态和 hash
 */
function markBlockAsStale(block) {
  const now = new Date().toISOString();
  const srcContent = block.content ? block.content.zh : "";
  const newHash = computeHash(srcContent);

  if (block.source_hash !== newHash) {
    // 源语言内容有变化
    if (block.translation_status) {
      if (["manual", "auto"].includes(block.translation_status.en)) {
        block.translation_status.en = "stale";
      }
      if (["manual", "auto"].includes(block.translation_status.sr)) {
        block.translation_status.sr = "stale";
      }
    }
    block.source_hash = newHash;
    block.updated_at = now;
  }

  return block;
}

/**
 * 翻译完成后写回 snapshot 并更新 translation_status
 */
function applyTranslationResult(snapshot, blockKey, targetLang, translatedContent) {
  const block = (snapshot.blocks || []).find((b) => b.key === blockKey);
  if (!block) throw new Error(`block[${blockKey}] 不存在。`);
  if (block.type !== "rich_text") throw new Error(`block[${blockKey}] 不是 rich_text，不可翻译。`);

  block.content[targetLang] = translatedContent;
  block.translation_status = block.translation_status || {};
  block.translation_status[targetLang] = "auto";
  block.updated_at = new Date().toISOString();

  return snapshot;
}

/**
 * 用户手动修改译文后，将该语言状态置为 manual
 */
function markTranslationAsManual(snapshot, blockKey, targetLang) {
  const block = (snapshot.blocks || []).find((b) => b.key === blockKey);
  if (!block || !block.translation_status) return snapshot;
  block.translation_status[targetLang] = "manual";
  return snapshot;
}

module.exports = {
  buildDefaultSnapshot,
  computeHash,
  validateSnapshot,
  renderValidityBlock,
  renderPaymentBlock,
  renderSnapshotForPreview,
  markBlockAsStale,
  applyTranslationResult,
  markTranslationAsManual,
};
