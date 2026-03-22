/* web/terms-editor.js — 商务条款编辑器 V1 */
'use strict';

// ── Constants ──────────────────────────────────────────────────────────────────

const BLOCK_META = {
  included: { icon: '✓', label: '费用包含' },
  excluded: { icon: '✕', label: '费用不含' },
  validity: { icon: '◷', label: '报价有效期' },
  payment:  { icon: '◈', label: '付款方式与节点' },
  notes:    { icon: '≡', label: '特别说明' },
};

const LANG_LABELS = { zh: '中文', en: 'English', sr: 'Srpski' };

const PAYMENT_LABELS = {
  bank_transfer: { zh: '银行转账',    en: 'bank transfer',  sr: 'bankovni transfer' },
  cash:          { zh: '现金',        en: 'cash',           sr: 'gotovina' },
  card_pos:      { zh: '刷卡/POS机',  en: 'card/POS',       sr: 'kartica/POS' },
  alipay:        { zh: '支付宝',      en: 'Alipay',         sr: 'Alipay' },
  wechat_pay:    { zh: '微信支付',    en: 'WeChat Pay',     sr: 'WeChat Pay' },
  paypal:        { zh: 'PayPal',      en: 'PayPal',         sr: 'PayPal' },
  other:         { zh: null,          en: null,             sr: null },
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'bank_transfer', zh: '银行转账' },
  { value: 'cash',          zh: '现金' },
  { value: 'card_pos',      zh: '刷卡/POS机' },
  { value: 'alipay',        zh: '支付宝' },
  { value: 'wechat_pay',    zh: '微信支付' },
  { value: 'paypal',        zh: 'PayPal' },
  { value: 'other',         zh: '其他' },
];

// ── State ──────────────────────────────────────────────────────────────────────

let quoteId = null;
let snapshot = null;
let dirty = false;
let selectedBlockKey = null;
const activeLangMap = {};   // { blockKey: 'zh'|'en'|'sr' }

// ── Boot ───────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-save').addEventListener('click', doSave);
  init();
});

async function init() {
  const params = new URLSearchParams(window.location.search);
  quoteId = params.get('quote_id');

  if (!quoteId) {
    showMessage('缺少 quote_id 参数，请从报价编辑页跳转进入。', 'error');
    return;
  }

  // Load quote name (non-critical)
  try {
    const proj = await apiFetch(`/api/project-quotes/${encodeURIComponent(quoteId)}`);
    if (proj && proj.name) {
      document.getElementById('te-quote-name').textContent = `— ${proj.name}`;
    }
    document.getElementById('back-link').href = `/quote-project.html?id=${encodeURIComponent(quoteId)}`;
  } catch (_) { /* display only, ignore */ }

  // Load snapshot
  try {
    snapshot = await apiFetch(`/api/terms/snapshot?quote_id=${encodeURIComponent(quoteId)}`);
    snapshot.blocks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    selectedBlockKey = snapshot.blocks[0]?.key || 'included';
    for (const b of snapshot.blocks) activeLangMap[b.key] = 'zh';
    render();
  } catch (e) {
    showMessage(`加载失败：${e.message}`, 'error');
  }
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Save ───────────────────────────────────────────────────────────────────────

async function doSave() {
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = '保存中…';

  // Sync sort_order from nav DOM order
  document.querySelectorAll('#te-nav-list .te-nav-item').forEach((el, i) => {
    const b = getBlock(el.dataset.key);
    if (b) b.sort_order = (i + 1) * 10;
  });

  try {
    await apiFetch('/api/terms/snapshot', {
      method: 'POST',
      body: JSON.stringify({ quote_id: quoteId, snapshot }),
    });
    dirty = false;
    updateDirtyBadge();
    showMessage('商务条款已保存。', 'success');
  } catch (e) {
    showMessage(`保存失败：${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '保存商务条款';
  }
}

// ── Translation ────────────────────────────────────────────────────────────────

async function doTranslate(blockKey, targetLang) {
  const block = getBlock(blockKey);
  if (!block) return;

  setTranslateLoading(blockKey, targetLang, true);

  try {
    const result = await apiFetch('/api/terms/translate', {
      method: 'POST',
      body: JSON.stringify({ quote_id: quoteId, block_key: blockKey, target_lang: targetLang }),
    });
    block.content[targetLang] = result.translated;
    block.translation_status = block.translation_status || {};
    block.translation_status[targetLang] = 'auto';
    markDirty();
    renderBlockEditor();
    renderNavList();
    showMessage(`${LANG_LABELS[targetLang]} 翻译完成。`, 'success');
  } catch (e) {
    showMessage(`翻译失败：${e.message}`, 'error');
    setTranslateLoading(blockKey, targetLang, false);
  }
}

async function doTranslateAll(blockKey) {
  const block = getBlock(blockKey);
  if (!block) return;

  setAllTranslateLoading(blockKey, true);

  try {
    for (const lang of ['en', 'sr']) {
      const result = await apiFetch('/api/terms/translate', {
        method: 'POST',
        body: JSON.stringify({ quote_id: quoteId, block_key: blockKey, target_lang: lang }),
      });
      block.content[lang] = result.translated;
      block.translation_status = block.translation_status || {};
      block.translation_status[lang] = 'auto';
    }
    markDirty();
    renderBlockEditor();
    renderNavList();
    showMessage('英文和塞语翻译均已完成。', 'success');
  } catch (e) {
    showMessage(`翻译失败：${e.message}`, 'error');
    setAllTranslateLoading(blockKey, false);
  }
}

function setTranslateLoading(blockKey, lang, loading) {
  const btn = document.getElementById(`te-tr-${blockKey}-${lang}`);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? '翻译中…' : (lang === 'en' ? '生成英文翻译' : '生成塞语翻译');
}

function setAllTranslateLoading(blockKey, loading) {
  const btn = document.getElementById(`te-tr-all-${blockKey}`);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? '翻译中…' : '⚡ 一键全部翻译';
}

// ── State helpers ──────────────────────────────────────────────────────────────

function getBlock(key) {
  return snapshot?.blocks?.find(b => b.key === key) || null;
}

function markDirty() {
  dirty = true;
  updateDirtyBadge();
}

function updateDirtyBadge() {
  const el = document.getElementById('dirty-badge');
  if (el) el.classList.toggle('hidden', !dirty);
}

function showMessage(msg, type = 'success') {
  const box = document.getElementById('msg-box');
  if (!box) return;
  box.textContent = msg;
  box.className = `message-box ${type}`;
  box.classList.remove('hidden');
  clearTimeout(box._t);
  box._t = setTimeout(() => box.classList.add('hidden'), 4500);
}

// ── Stale logic ────────────────────────────────────────────────────────────────

function markZhStale(block) {
  if (block.type !== 'rich_text') return;
  const src = block.content?.zh ?? '';
  const newHash = simpleHash(src);
  if (newHash === block.source_hash) return;  // unchanged
  block.source_hash = newHash;
  block.updated_at = new Date().toISOString();
  const st = block.translation_status || {};
  if (['manual', 'auto'].includes(st.en)) st.en = 'stale';
  if (['manual', 'auto'].includes(st.sr)) st.sr = 'stale';
  block.translation_status = st;
}

function simpleHash(content) {
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(16).slice(0, 12);
}

// ── Structured renderers (JS mirror of server/services/termsService.js) ────────

function renderValidityText(fields) {
  const { validity_mode, valid_days, valid_until, validity_note } = fields;
  const n = s => s ? `\n${s}` : '';
  if (validity_mode === 'date') {
    const d = valid_until || '—';
    return {
      zh: `本报价有效期至 ${d}。${n(validity_note)}`,
      en: `This quotation is valid until ${d}.${n(validity_note)}`,
      sr: `Ova ponuda važi do ${d}.${n(validity_note)}`,
    };
  }
  const days = valid_days || 10;
  return {
    zh: `本报价自出具之日起 ${days} 个自然日内有效。${n(validity_note)}`,
    en: `This quotation is valid for ${days} calendar days from the date of issue.${n(validity_note)}`,
    sr: `Ova ponuda važi ${days} kalendarskih dana od dana izdavanja.${n(validity_note)}`,
  };
}

function renderPaymentText(fields, lang) {
  const {
    payment_methods = [], other_payment_method_text,
    deposit_percent = 50, balance_due_days_before_event = 7, payment_note,
  } = fields;

  const methodLabel = m => {
    const e = PAYMENT_LABELS[m];
    if (!e) return m;
    if (m === 'other') return other_payment_method_text || (lang === 'zh' ? '其他方式' : 'other');
    return e[lang] || m;
  };

  const methods = payment_methods.map(methodLabel);
  const note = s => s ? ` ${s}` : '';

  if (lang === 'zh') {
    const ms = methods.join('、') || '（请选择付款方式）';
    return `建议采用${ms}付款。签约确认后支付 ${deposit_percent}% 预付款，项目开始前 ${balance_due_days_before_event} 天支付剩余尾款。${note(payment_note)}`.trim();
  }
  if (lang === 'en') {
    const ms = methods.join('/') || '(select method)';
    return `Payment by ${ms} is preferred. A ${deposit_percent}% deposit is due upon contract signing. The remaining balance is due ${balance_due_days_before_event} days before the event.${note(payment_note)}`.trim();
  }
  if (lang === 'sr') {
    const ms = methods.join('/') || '(izaberite)';
    return `Plaćanje putem ${ms}. Depozit od ${deposit_percent}% obavezan je pri potpisivanju ugovora. Preostali iznos se plaća ${balance_due_days_before_event} dana pre početka programa.${note(payment_note)}`.trim();
  }
  return '';
}

// ── Badge HTML ─────────────────────────────────────────────────────────────────

function badgeHtml(status) {
  if (!status)             return '<span class="te-badge empty">● 未翻译</span>';
  if (status === 'auto')   return '<span class="te-badge auto">● 已同步</span>';
  if (status === 'manual') return '<span class="te-badge manual">● 已修改</span>';
  if (status === 'stale')  return '<span class="te-badge stale">● 待同步</span>';
  return '<span class="te-badge empty">● 未翻译</span>';
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Full render ────────────────────────────────────────────────────────────────

function render() {
  renderNavList();
  renderBlockEditor();
  renderAccordion();
}

// ── Nav List ───────────────────────────────────────────────────────────────────

function renderNavList() {
  const container = document.getElementById('te-nav-list');
  if (!container || !snapshot) return;

  container.innerHTML = snapshot.blocks.map(b => {
    const meta = BLOCK_META[b.key] || {};
    const isActive = b.key === selectedBlockKey;
    return `
      <div class="te-nav-item${isActive ? ' active' : ''}" data-key="${b.key}" draggable="true">
        <span class="te-nav-icon">${meta.icon || '◉'}</span>
        <span class="te-nav-label${b.enabled ? '' : ' te-nav-disabled'}">${meta.label || b.key}</span>
        <label class="te-toggle" title="${b.enabled ? '点击停用' : '点击启用'}" onclick="event.stopPropagation()">
          <input type="checkbox" class="te-toggle-input" data-key="${b.key}"${b.enabled ? ' checked' : ''}>
          <span class="te-toggle-knob"></span>
        </label>
      </div>`;
  }).join('');

  // Select on click
  container.querySelectorAll('.te-nav-item').forEach(el => {
    el.addEventListener('click', () => {
      selectedBlockKey = el.dataset.key;
      renderNavList();
      renderBlockEditor();
    });
  });

  // Toggle enabled
  container.querySelectorAll('.te-toggle-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const b = getBlock(inp.dataset.key);
      if (b) { b.enabled = inp.checked; markDirty(); renderNavList(); renderBlockEditor(); }
    });
  });

  setupNavDrag(container);
}

function setupNavDrag(container) {
  let dragSrc = null;

  container.querySelectorAll('.te-nav-item').forEach(el => {
    el.addEventListener('dragstart', e => {
      dragSrc = el;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      container.querySelectorAll('.te-nav-item').forEach(n => n.classList.remove('drag-over'));
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragSrc && dragSrc !== el) {
        container.querySelectorAll('.te-nav-item').forEach(n => n.classList.remove('drag-over'));
        el.classList.add('drag-over');
      }
    });
    el.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === el) return;
      const srcIdx = snapshot.blocks.findIndex(b => b.key === dragSrc.dataset.key);
      const tgtIdx = snapshot.blocks.findIndex(b => b.key === el.dataset.key);
      if (srcIdx !== -1 && tgtIdx !== -1) {
        const [moved] = snapshot.blocks.splice(srcIdx, 1);
        snapshot.blocks.splice(tgtIdx, 0, moved);
        snapshot.blocks.forEach((b, i) => { b.sort_order = (i + 1) * 10; });
        markDirty();
        renderNavList();
      }
    });
  });
}

// ── Block Editor ───────────────────────────────────────────────────────────────

function renderBlockEditor() {
  const container = document.getElementById('te-editor');
  if (!container || !snapshot) return;

  const block = getBlock(selectedBlockKey);
  if (!block) {
    container.innerHTML = '<p class="te-loading">请从左侧选择一个模块。</p>';
    return;
  }

  const meta = BLOCK_META[block.key] || {};
  const disabledBadge = block.enabled ? '' : '<span class="te-disabled-badge">已停用</span>';

  const header = `
    <div class="te-block-header">
      <span class="te-block-icon">${meta.icon || '◉'}</span>
      <h2 class="te-block-title">${meta.label || block.key}</h2>
      ${disabledBadge}
    </div>`;

  let body = '';
  if (block.type === 'rich_text') body = buildRichTextHtml(block);
  else if (block.key === 'validity') body = buildValidityHtml(block);
  else if (block.key === 'payment') body = buildPaymentHtml(block);

  container.innerHTML = header + body;

  if (block.type === 'rich_text') attachRichTextEvents(block);
  else if (block.key === 'validity') attachValidityEvents(block);
  else if (block.key === 'payment') attachPaymentEvents(block);
}

// ── Rich Text ──────────────────────────────────────────────────────────────────

function buildRichTextHtml(block) {
  const isBullet = block.key !== 'notes';
  const activeLang = activeLangMap[block.key] || 'zh';
  const st = block.translation_status || {};

  const tabs = ['zh', 'en', 'sr'].map(lang => {
    const isActive = lang === activeLang;
    const badge = lang !== 'zh' ? badgeHtml(st[lang]) : '';
    return `<button class="te-lang-tab${isActive ? ' active' : ''}" data-block="${block.key}" data-lang="${lang}">
      ${LANG_LABELS[lang]} ${badge}
    </button>`;
  }).join('');

  const areas = ['zh', 'en', 'sr'].map(lang => {
    const isActive = lang === activeLang;
    const content = block.content?.[lang] ?? (isBullet ? [] : '');
    const isZh = lang === 'zh';
    const blockKey = block.key;

    let inner = '';

    if (isBullet) {
      const items = Array.isArray(content) ? content : [];
      const rowsHtml = items.map((item, idx) => `
        <div class="te-bullet-row" data-idx="${idx}" draggable="${isZh}">
          ${isZh
            ? `<span class="te-drag-handle" title="拖拽排序">⠿</span>`
            : `<span class="te-bullet-dot">•</span>`}
          <input class="te-bullet-input" data-block="${blockKey}" data-lang="${lang}" data-idx="${idx}" value="${esc(String(item ?? ''))}" placeholder="请输入内容…">
          ${isZh ? `<button class="te-bullet-del" data-block="${blockKey}" data-lang="${lang}" data-idx="${idx}" title="删除">×</button>` : ''}
        </div>`).join('');

      inner = `
        <div class="te-bullet-list" id="te-bullets-${blockKey}-${lang}">${rowsHtml}</div>
        ${isZh ? `<button class="te-bullet-add" data-block="${blockKey}" data-lang="${lang}">+ 添加条目</button>` : ''}`;
    } else {
      inner = `<textarea class="te-notes-textarea" data-block="${blockKey}" data-lang="${lang}"
        placeholder="${isZh ? '请输入特别说明内容…' : '翻译内容…'}">${esc(String(content ?? ''))}</textarea>`;
    }

    // Retranslate button inside lang area — use "te-tr-re-" prefix to avoid duplicate IDs
    const retranslateBtn = !isZh ? `
      <div class="te-retranslate-row">
        <button id="te-tr-re-${blockKey}-${lang}" class="te-retranslate-btn"
          data-block="${blockKey}" data-lang="${lang}" data-action="translate"${!block.enabled ? ' disabled' : ''}>
          重新翻译
        </button>
      </div>` : '';

    return `<div class="te-lang-area${isActive ? ' active' : ''}" data-lang="${lang}">${retranslateBtn}${inner}</div>`;
  }).join('');

  const disAttr = block.enabled ? '' : ' disabled';
  return `
    <div class="te-lang-tabs">${tabs}</div>
    <div id="te-lang-areas-${block.key}">${areas}</div>
    <div class="te-translate-bar">
      <button id="te-tr-all-${block.key}" class="te-btn-translate-all"
        data-block="${block.key}" data-action="translate-all"${disAttr}>⚡ 一键全部翻译</button>
      <button id="te-tr-${block.key}-en" class="te-btn-translate"
        data-block="${block.key}" data-lang="en" data-action="translate"${disAttr}>生成英文翻译</button>
      <button id="te-tr-${block.key}-sr" class="te-btn-translate"
        data-block="${block.key}" data-lang="sr" data-action="translate"${disAttr}>生成塞语翻译</button>
    </div>`;
}

function attachRichTextEvents(block) {
  const isBullet = block.key !== 'notes';
  const container = document.getElementById('te-editor');

  // Lang tab switching
  container.querySelectorAll(`.te-lang-tab[data-block="${block.key}"]`).forEach(btn => {
    btn.addEventListener('click', () => {
      activeLangMap[block.key] = btn.dataset.lang;
      renderBlockEditor();
    });
  });

  // Translate buttons (via data-action)
  container.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const bKey = el.dataset.block;
    if (bKey !== block.key) return;
    if (el.dataset.action === 'translate-all') doTranslateAll(bKey);
    if (el.dataset.action === 'translate') doTranslate(bKey, el.dataset.lang);
  }, { once: true });

  if (isBullet) {
    // Bullet input changes
    container.querySelectorAll(`.te-bullet-input[data-block="${block.key}"]`).forEach(inp => {
      inp.addEventListener('input', () => {
        const lang = inp.dataset.lang;
        const idx = +inp.dataset.idx;
        const arr = block.content?.[lang] || [];
        arr[idx] = inp.value;
        block.content[lang] = arr;
        if (lang === 'zh') { markZhStale(block); refreshLangTabBadges(block); }
        else { (block.translation_status = block.translation_status || {})[lang] = 'manual'; refreshLangTabBadges(block); }
        markDirty();
      });
    });

    // Delete bullet
    container.querySelectorAll(`.te-bullet-del[data-block="${block.key}"]`).forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        const idx = +btn.dataset.idx;
        const arr = Array.isArray(block.content?.[lang]) ? block.content[lang] : [];
        arr.splice(idx, 1);
        block.content[lang] = arr;
        if (lang === 'zh') markZhStale(block);
        markDirty();
        renderBlockEditor();
      });
    });

    // Add bullet
    container.querySelectorAll(`.te-bullet-add[data-block="${block.key}"]`).forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        block.content = block.content || {};
        block.content[lang] = Array.isArray(block.content[lang]) ? block.content[lang] : [];
        block.content[lang].push('');
        if (lang === 'zh') markZhStale(block);
        markDirty();
        renderBlockEditor();
        // Focus last input
        setTimeout(() => {
          const inputs = document.querySelectorAll(`.te-bullet-input[data-block="${block.key}"][data-lang="${lang}"]`);
          if (inputs.length) inputs[inputs.length - 1].focus();
        }, 30);
      });
    });

    setupBulletDrag(block, 'zh');

  } else {
    // Textarea (notes)
    container.querySelectorAll(`.te-notes-textarea[data-block="${block.key}"]`).forEach(ta => {
      ta.addEventListener('input', () => {
        const lang = ta.dataset.lang;
        block.content = block.content || {};
        block.content[lang] = ta.value;
        if (lang === 'zh') { markZhStale(block); refreshLangTabBadges(block); }
        else { (block.translation_status = block.translation_status || {})[lang] = 'manual'; refreshLangTabBadges(block); }
        markDirty();
      });
    });
  }
}

function refreshLangTabBadges(block) {
  const st = block.translation_status || {};
  ['en', 'sr'].forEach(lang => {
    const tab = document.querySelector(`.te-lang-tab[data-block="${block.key}"][data-lang="${lang}"]`);
    if (tab) tab.innerHTML = `${LANG_LABELS[lang]} ${badgeHtml(st[lang])}`;
  });
}

function setupBulletDrag(block, lang) {
  const list = document.getElementById(`te-bullets-${block.key}-${lang}`);
  if (!list) return;
  let dragIdx = null;

  list.querySelectorAll('.te-bullet-row').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragIdx = +row.dataset.idx;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      list.querySelectorAll('.te-bullet-row').forEach(r => r.classList.remove('drag-over'));
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      const tgt = +row.dataset.idx;
      if (dragIdx !== null && dragIdx !== tgt) {
        list.querySelectorAll('.te-bullet-row').forEach(r => r.classList.remove('drag-over'));
        row.classList.add('drag-over');
      }
    });
    row.addEventListener('drop', e => {
      e.preventDefault();
      const tgt = +row.dataset.idx;
      if (dragIdx === null || dragIdx === tgt) return;
      const arr = block.content?.[lang] || [];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(tgt, 0, moved);
      block.content[lang] = arr;
      markZhStale(block);
      markDirty();
      renderBlockEditor();
    });
  });
}

// ── Validity Editor ────────────────────────────────────────────────────────────

function buildValidityHtml(block) {
  const f = block.fields || {};
  const isDays = (f.validity_mode || 'days') === 'days';
  const preview = renderValidityText(f);

  return `
    <div class="te-structured-form">
      <div class="te-field-group">
        <span class="te-field-label">有效期模式</span>
        <div class="te-radio-group">
          <label class="te-radio-opt">
            <input type="radio" name="te-validity-mode" value="days"${isDays ? ' checked' : ''}> 按天数（推荐）
          </label>
          <label class="te-radio-opt">
            <input type="radio" name="te-validity-mode" value="date"${!isDays ? ' checked' : ''}> 按截止日期
          </label>
        </div>
      </div>

      <div id="te-days-field" class="te-field-group${isDays ? '' : ' hidden'}">
        <span class="te-field-label">有效天数</span>
        <input id="te-valid-days" type="number" min="1" max="365"
          value="${esc(String(f.valid_days ?? 10))}" style="max-width:160px;min-height:44px">
      </div>

      <div id="te-date-field" class="te-field-group${isDays ? ' hidden' : ''}">
        <span class="te-field-label">截止日期</span>
        <input id="te-valid-until" type="date"
          value="${esc(f.valid_until || '')}" style="max-width:200px;min-height:44px">
      </div>

      <div class="te-field-group">
        <span class="te-field-label">补充说明
          <span style="font-weight:400;color:var(--muted)">（可选）</span>
        </span>
        <input id="te-validity-note" type="text"
          value="${esc(f.validity_note || '')}" placeholder="例如：以书面确认为准">
      </div>
    </div>

    <div class="te-preview-box">
      <div class="te-preview-label">渲染预览（结构化字段，无需 AI 翻译）</div>
      <div class="te-preview-row">
        <span class="te-preview-lang">中文</span>
        <span class="te-preview-text" id="te-prev-validity-zh">${esc(preview.zh)}</span>
      </div>
      <div class="te-preview-row">
        <span class="te-preview-lang">English</span>
        <span class="te-preview-text" id="te-prev-validity-en">${esc(preview.en)}</span>
      </div>
      <div class="te-preview-row">
        <span class="te-preview-lang">Srpski</span>
        <span class="te-preview-text" id="te-prev-validity-sr">${esc(preview.sr)}</span>
      </div>
    </div>`;
}

function attachValidityEvents(block) {
  function refresh() {
    const p = renderValidityText(block.fields || {});
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('te-prev-validity-zh', p.zh);
    set('te-prev-validity-en', p.en);
    set('te-prev-validity-sr', p.sr);
    markDirty();
  }

  document.querySelectorAll('input[name="te-validity-mode"]').forEach(r => {
    r.addEventListener('change', () => {
      block.fields = block.fields || {};
      block.fields.validity_mode = r.value;
      document.getElementById('te-days-field')?.classList.toggle('hidden', r.value !== 'days');
      document.getElementById('te-date-field')?.classList.toggle('hidden', r.value !== 'date');
      refresh();
    });
  });

  const daysEl = document.getElementById('te-valid-days');
  if (daysEl) daysEl.addEventListener('input', () => {
    block.fields = block.fields || {};
    block.fields.valid_days = parseInt(daysEl.value, 10) || 10;
    refresh();
  });

  const dateEl = document.getElementById('te-valid-until');
  if (dateEl) dateEl.addEventListener('input', () => {
    block.fields = block.fields || {};
    block.fields.valid_until = dateEl.value || null;
    refresh();
  });

  const noteEl = document.getElementById('te-validity-note');
  if (noteEl) noteEl.addEventListener('input', () => {
    block.fields = block.fields || {};
    block.fields.validity_note = noteEl.value || null;
    refresh();
  });
}

// ── Payment Editor ─────────────────────────────────────────────────────────────

function buildPaymentHtml(block) {
  const f = block.fields || {};
  const sel = Array.isArray(f.payment_methods) ? f.payment_methods : [];
  const hasOther = sel.includes('other');
  const dep = f.deposit_percent ?? 50;
  const bal = f.balance_due_days_before_event ?? 7;

  const methodsHtml = PAYMENT_METHOD_OPTIONS.map(opt => `
    <label class="te-checkbox-opt">
      <input type="checkbox" name="te-payment-method" value="${opt.value}"${sel.includes(opt.value) ? ' checked' : ''}>
      ${opt.zh}
    </label>`).join('');

  return `
    <div class="te-structured-form">
      <div class="te-field-group">
        <span class="te-field-label">付款方式（可多选）</span>
        <div class="te-checkbox-group">${methodsHtml}</div>
        <div id="te-other-method-wrap"${hasOther ? '' : ' class="hidden"'} style="margin-top:8px">
          <input id="te-other-method-text" type="text"
            value="${esc(f.other_payment_method_text || '')}" placeholder="请注明具体方式">
        </div>
      </div>

      <div class="te-field-group">
        <span class="te-field-label">定金比例：<strong id="te-dep-display">${dep}%</strong></span>
        <div class="te-slider-row">
          <input id="te-dep-range" type="range" min="0" max="100" step="5" value="${dep}">
          <input id="te-dep-num" type="number" min="0" max="100"
            value="${dep}" style="max-width:80px;min-height:44px">
        </div>
      </div>

      <div class="te-field-group">
        <span class="te-field-label">尾款节点（活动开始前 N 天）</span>
        <input id="te-balance-days" type="number" min="0" max="365"
          value="${bal}" style="max-width:160px;min-height:44px">
      </div>

      <div class="te-field-group">
        <span class="te-field-label">补充说明
          <span style="font-weight:400;color:var(--muted)">（可选）</span>
        </span>
        <input id="te-payment-note" type="text"
          value="${esc(f.payment_note || '')}" placeholder="例如：如需开具增值税发票请提前告知">
      </div>
    </div>

    <div class="te-preview-box">
      <div class="te-preview-label">渲染预览（结构化字段，无需 AI 翻译）</div>
      <div class="te-preview-row">
        <span class="te-preview-lang">中文</span>
        <span class="te-preview-text" id="te-prev-payment-zh">${esc(renderPaymentText(f, 'zh'))}</span>
      </div>
      <div class="te-preview-row">
        <span class="te-preview-lang">English</span>
        <span class="te-preview-text" id="te-prev-payment-en">${esc(renderPaymentText(f, 'en'))}</span>
      </div>
      <div class="te-preview-row">
        <span class="te-preview-lang">Srpski</span>
        <span class="te-preview-text" id="te-prev-payment-sr">${esc(renderPaymentText(f, 'sr'))}</span>
      </div>
    </div>`;
}

function attachPaymentEvents(block) {
  function refresh() {
    const f = block.fields || {};
    ['zh', 'en', 'sr'].forEach(lang => {
      const el = document.getElementById(`te-prev-payment-${lang}`);
      if (el) el.textContent = renderPaymentText(f, lang);
    });
    markDirty();
  }

  document.querySelectorAll('input[name="te-payment-method"]').forEach(cb => {
    cb.addEventListener('change', () => {
      block.fields = block.fields || {};
      block.fields.payment_methods = Array.from(
        document.querySelectorAll('input[name="te-payment-method"]:checked')
      ).map(c => c.value);
      const hasOther = block.fields.payment_methods.includes('other');
      document.getElementById('te-other-method-wrap')?.classList.toggle('hidden', !hasOther);
      refresh();
    });
  });

  const otherEl = document.getElementById('te-other-method-text');
  if (otherEl) otherEl.addEventListener('input', () => {
    block.fields = block.fields || {};
    block.fields.other_payment_method_text = otherEl.value || null;
    refresh();
  });

  const rangeEl = document.getElementById('te-dep-range');
  const numEl   = document.getElementById('te-dep-num');
  const dispEl  = document.getElementById('te-dep-display');

  function setDeposit(v) {
    const val = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
    block.fields = block.fields || {};
    block.fields.deposit_percent = val;
    if (rangeEl) rangeEl.value = val;
    if (numEl)   numEl.value   = val;
    if (dispEl)  dispEl.textContent = `${val}%`;
    refresh();
  }

  if (rangeEl) rangeEl.addEventListener('input', () => setDeposit(rangeEl.value));
  if (numEl)   numEl.addEventListener('input',   () => setDeposit(numEl.value));

  const balEl = document.getElementById('te-balance-days');
  if (balEl) balEl.addEventListener('input', () => {
    block.fields = block.fields || {};
    block.fields.balance_due_days_before_event = parseInt(balEl.value, 10) || 7;
    refresh();
  });

  const pNoteEl = document.getElementById('te-payment-note');
  if (pNoteEl) pNoteEl.addEventListener('input', () => {
    block.fields = block.fields || {};
    block.fields.payment_note = pNoteEl.value || null;
    refresh();
  });
}

// ── Mobile Accordion ───────────────────────────────────────────────────────────

function renderAccordion() {
  const container = document.getElementById('te-accordion');
  if (!container || !snapshot) return;

  container.innerHTML = snapshot.blocks.map(b => {
    const meta = BLOCK_META[b.key] || {};
    return `
      <div class="te-acc-item">
        <button class="te-acc-toggle" data-key="${b.key}">
          <span class="te-acc-toggle-label">${meta.icon || '◉'} ${meta.label || b.key}</span>
          <label class="te-toggle" onclick="event.stopPropagation()">
            <input type="checkbox" class="te-acc-toggle-inp" data-key="${b.key}"${b.enabled ? ' checked' : ''}>
            <span class="te-toggle-knob"></span>
          </label>
          <span class="te-acc-chevron">▼</span>
        </button>
        <div class="te-acc-body" id="te-acc-body-${b.key}"></div>
      </div>`;
  }).join('');

  container.querySelectorAll('.te-acc-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      if (e.target.closest('.te-toggle')) return;
      const key = btn.dataset.key;
      const body = document.getElementById(`te-acc-body-${key}`);
      const isOpen = body.classList.contains('open');
      container.querySelectorAll('.te-acc-body').forEach(b => b.classList.remove('open'));
      container.querySelectorAll('.te-acc-toggle').forEach(b => b.classList.remove('open'));
      if (!isOpen) {
        body.classList.add('open');
        btn.classList.add('open');
        selectedBlockKey = key;
        // Render editor content inside accordion body
        const block = getBlock(key);
        if (block) {
          if (block.type === 'rich_text') { body.innerHTML = buildRichTextHtml(block); attachRichTextEvents(block); }
          else if (key === 'validity') { body.innerHTML = buildValidityHtml(block); attachValidityEvents(block); }
          else if (key === 'payment') { body.innerHTML = buildPaymentHtml(block); attachPaymentEvents(block); }
        }
      }
    });
  });

  container.querySelectorAll('.te-acc-toggle-inp').forEach(inp => {
    inp.addEventListener('change', () => {
      const b = getBlock(inp.dataset.key);
      if (b) { b.enabled = inp.checked; markDirty(); }
    });
  });
}
