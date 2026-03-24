// ── 主数据缓存 ────────────────────────────────────────────────────────────────

/** 服务类型主数据缓存，从 GET /api/quote-item-types 加载 */
window._itemTypes = [];

/** 项目组分类缓存，从 GET /api/project-group-types 加载 */
window._groupTypes = [];

// ── Activity templates ────────────────────────────────────────────────────────
// groupName 使用中文名称，套用时通过 resolveGroupNameToCode 映射为 code

const ACTIVITY_TEMPLATES = {
  opening_ceremony: {
    label: "开幕仪式",
    items: [
      { groupName: "搭建制作", nameZh: "主舞台", nameEn: "Main Stage", unit: "套", quantity: 1 },
      { groupName: "搭建制作", nameZh: "入口拱门+印刷", nameEn: "Entrance Portal+Print", unit: "套", quantity: 1 },
      { groupName: "搭建制作", nameZh: "讲台", nameEn: "Podium", unit: "个", quantity: 1 },
      { groupName: "AV / 灯光音响", nameZh: "音响系统", nameEn: "Sound System", unit: "套", quantity: 1 },
      { groupName: "AV / 灯光音响", nameZh: "LED大屏", nameEn: "LED Screen", unit: "套", quantity: 1 },
      { groupName: "设计印刷", nameZh: "背景墙+印刷", nameEn: "Back Wall+Print", unit: "套", quantity: 1 },
      { groupName: "设计印刷", nameZh: "新闻墙", nameEn: "Press Wall", unit: "套", quantity: 1 },
      { groupName: "物料采购", nameZh: "走道红毯", nameEn: "Walkway Red Carpet", unit: "套", quantity: 1 },
      { groupName: "物料采购", nameZh: "礼炮彩纸", nameEn: "Confetti Sprayer", unit: "套", quantity: 2 },
      { groupName: "人员执行", nameZh: "礼仪+摄影", nameEn: "Hosts+Photographers", unit: "套", quantity: 1 },
      { groupName: "人员执行", nameZh: "主持人", nameEn: "Event Host", unit: "人", quantity: 1 },
      { groupName: "物流运输", nameZh: "发电机", nameEn: "Generator", unit: "套", quantity: 1 },
      { groupName: "场地服务", nameZh: "代理费10%", nameEn: "Agency Fee 10%", unit: "式", quantity: 1 },
      { groupName: "设计印刷", nameZh: "设计+印前", nameEn: "Design+Prepress", unit: "套", quantity: 1 },
    ],
  },
  large_conference: {
    label: "大型会议",
    items: [
      { groupName: "搭建制作", nameZh: "主舞台", nameEn: "Main Stage", unit: "套", quantity: 1 },
      { groupName: "搭建制作", nameZh: "讲台", nameEn: "Podium", unit: "个", quantity: 1 },
      { groupName: "AV / 灯光音响", nameZh: "音响系统", nameEn: "Sound System", unit: "套", quantity: 1 },
      { groupName: "AV / 灯光音响", nameZh: "LED大屏", nameEn: "LED Screen", unit: "套", quantity: 1 },
      { groupName: "AV / 灯光音响", nameZh: "同传耳机(三语)", nameEn: "SI Headset 3-lang", unit: "套", quantity: 1 },
      { groupName: "AV / 灯光音响", nameZh: "混合直播设备", nameEn: "Hybrid Streaming", unit: "套", quantity: 1 },
      { groupName: "搭建制作", nameZh: "会场桌椅", nameEn: "Venue Tables+Chairs", unit: "桌", quantity: 30 },
      { groupName: "设计印刷", nameZh: "背景墙+印刷", nameEn: "Back Wall+Print", unit: "套", quantity: 1 },
      { groupName: "人员执行", nameZh: "主持人", nameEn: "Event Host", unit: "人", quantity: 1 },
      { groupName: "人员执行", nameZh: "安保", nameEn: "Security", unit: "次", quantity: 1 },
      { groupName: "物流运输", nameZh: "发电机", nameEn: "Generator", unit: "套", quantity: 1 },
      { groupName: "场地服务", nameZh: "代理费10%", nameEn: "Agency Fee 10%", unit: "式", quantity: 1 },
      { groupName: "场地服务", nameZh: "预制作费", nameEn: "Pre-production", unit: "项", quantity: 1 },
    ],
  },
  product_launch: {
    label: "发布会",
    items: [
      { groupName: "搭建制作", nameZh: "主舞台", nameEn: "Main Stage", unit: "套", quantity: 1 },
      { groupName: "搭建制作", nameZh: "讲台", nameEn: "Podium", unit: "个", quantity: 1 },
      { groupName: "AV / 灯光音响", nameZh: "LED大屏", nameEn: "LED Screen", unit: "套", quantity: 1 },
      { groupName: "AV / 灯光音响", nameZh: "音响系统", nameEn: "Sound System", unit: "套", quantity: 1 },
      { groupName: "设计印刷", nameZh: "背景墙+印刷", nameEn: "Back Wall+Print", unit: "套", quantity: 1 },
      { groupName: "设计印刷", nameZh: "新闻墙", nameEn: "Press Wall", unit: "套", quantity: 1 },
      { groupName: "设计印刷", nameZh: "展示架", nameEn: "Display Stands", unit: "套", quantity: 1 },
      { groupName: "物料采购", nameZh: "走道红毯", nameEn: "Walkway Red Carpet", unit: "套", quantity: 1 },
      { groupName: "人员执行", nameZh: "主持人", nameEn: "Event Host", unit: "人", quantity: 1 },
      { groupName: "人员执行", nameZh: "礼仪+摄影", nameEn: "Hosts+Photographers", unit: "套", quantity: 1 },
      { groupName: "场地服务", nameZh: "代理费10%", nameEn: "Agency Fee 10%", unit: "式", quantity: 1 },
      { groupName: "设计印刷", nameZh: "设计+印前", nameEn: "Design+Prepress", unit: "套", quantity: 1 },
    ],
  },
  exhibition_reception: {
    label: "展会接待",
    items: [
      { groupName: "搭建制作", nameZh: "展位结构搭建", nameEn: "Booth Construction", unit: "套", quantity: 1 },
      { groupName: "搭建制作", nameZh: "拱门", nameEn: "Arched Door", unit: "套", quantity: 1 },
      { groupName: "设计印刷", nameZh: "展示架", nameEn: "Display Stands", unit: "套", quantity: 1 },
      { groupName: "设计印刷", nameZh: "背景墙印刷", nameEn: "Back Wall Print", unit: "套", quantity: 1 },
      { groupName: "设计印刷", nameZh: "围栏印刷", nameEn: "Fence Printing", unit: "套", quantity: 1 },
      { groupName: "AV / 灯光音响", nameZh: "音响系统", nameEn: "Sound System", unit: "套", quantity: 1 },
      { groupName: "搭建制作", nameZh: "洽谈桌椅", nameEn: "Meeting Tables+Chairs", unit: "套", quantity: 1 },
      { groupName: "物流运输", nameZh: "围栏", nameEn: "Frame Fence", unit: "套", quantity: 1 },
      { groupName: "物料采购", nameZh: "红地毯", nameEn: "Red Carpet", unit: "套", quantity: 1 },
      { groupName: "人员执行", nameZh: "礼仪+摄影", nameEn: "Hosts+Photographers", unit: "套", quantity: 1 },
      { groupName: "场地服务", nameZh: "代理费10%", nameEn: "Agency Fee 10%", unit: "式", quantity: 1 },
    ],
  },
};

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  projectId: null,
  viewMode: "internal",  // "internal" | "client"
  rowCounter: 0,
};

// ── 主数据加载 ─────────────────────────────────────────────────────────────────

/**
 * 从 API 加载服务类型，缓存到 window._itemTypes
 * 若当前已选项目组分类有 id 且非 mixed，使用 ?project_group_id=xxx 过滤
 * 否则返回全集
 */
async function fetchItemTypes() {
  const pg    = getFormProjectGroup();
  const group = window._groupTypes.find((t) => t.code === pg);
  let url = "/api/quote-item-types";
  if (group && group.id && pg !== "mixed") {
    url = `/api/quote-item-types?project_group_id=${encodeURIComponent(group.id)}`;
  }
  try {
    const types = await window.AppUtils.fetchJson(url, null, "加载服务类型失败");
    window._itemTypes = Array.isArray(types) ? types : [];
  } catch (e) {
    console.warn("[quote-project] 服务类型加载失败，使用空列表", e);
    window._itemTypes = [];
  }
}

/** 从 API 加载项目组分类，缓存到 window._groupTypes */
async function fetchProjectGroupTypes() {
  try {
    const types = await window.AppUtils.fetchJson(
      "/api/project-group-types",
      null,
      "加载项目组分类失败",
    );
    window._groupTypes = Array.isArray(types) ? types : [];
  } catch (e) {
    console.warn("[quote-project] 项目组分类加载失败，使用默认值", e);
    window._groupTypes = [
      { code: "travel", nameZh: "旅游接待", sortOrder: 1 },
      { code: "event",  nameZh: "活动服务", sortOrder: 2 },
      { code: "mixed",  nameZh: "综合服务", sortOrder: 3 },
    ];
  }
}

/**
 * 用 window._groupTypes 填充表头「项目组分类」下拉
 * @param {string} [selectedCode] 要选中的 code，未提供则选第一项
 */
function populateProjectGroupSelect(selectedCode) {
  const select = document.getElementById("select-project-group");
  if (!select) return;

  const types = window._groupTypes.length > 0
    ? window._groupTypes
    : [
        { code: "travel", nameZh: "旅游接待" },
        { code: "event",  nameZh: "活动服务" },
        { code: "mixed",  nameZh: "综合服务" },
      ];

  const effectiveSelected = selectedCode || types[0].code;
  select.innerHTML = types.map((t) =>
    `<option value="${esc(t.code)}" ${t.code === effectiveSelected ? "selected" : ""}>${esc(t.nameZh)}</option>`,
  ).join("");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getProjectId() {
  return new URLSearchParams(window.location.search).get("id") || null;
}

function formatMoney(amount, currency) {
  return window.AppUtils.formatCurrency(Number(amount) || 0, currency || "EUR");
}

function getFormCurrency() {
  return document.querySelector("#project-header-form select[name='currency']").value || "EUR";
}

/** 获取表头当前选中的项目组分类 code */
function getFormProjectGroup() {
  const el = document.getElementById("select-project-group");
  return el ? el.value : "mixed";
}

function esc(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── 服务类型下拉管理 ──────────────────────────────────────────────────────────

/**
 * 将历史 groupName 值反向解析为服务类型 code（历史数据兼容）
 * 先按 code 精确匹配，再按 nameZh 匹配，都失败则标记 legacy
 * @param {string} value
 * @returns {{ code: string, legacy: boolean }}
 */
function resolveGroupNameToCode(value) {
  if (!value) return { code: "misc", legacy: false };
  // 已经是合法 code
  if (window._itemTypes.some((t) => t.code === value)) return { code: value, legacy: false };
  // 按 nameZh 匹配（兼容旧版中文 groupName）
  const byName = window._itemTypes.find((t) => t.nameZh === value);
  if (byName) return { code: byName.code, legacy: false };
  // 匹配失败：保留原值，标记为历史遗留
  return { code: value, legacy: true };
}

/**
 * 根据当前项目组分类过滤服务类型，生成 <option> HTML
 * @param {string} currentValue 当前选中值（合法 code 或已匹配后的 code）
 * @param {string} [projectGroup] 项目组 code（travel | event | mixed），省略时读表单
 * @param {string|null} [legacyValue] 无法匹配的历史中文字符串，显示为橙色警告项
 * @returns {string} options HTML
 */
/**
 * 根据当前项目组分类过滤服务类型，生成 <option> HTML
 * - travel → category_group IN ('travel','misc')
 * - event  → category_group IN ('event','misc')
 * - mixed  → 全集（所有 is_active=true）
 * - currentValue 不在集合内时自动选中 'misc'
 * @param {string} currentValue 当前选中值
 * @param {string} [projectGroup] 项目组 code，省略时读表单
 * @param {string|null} [legacyValue] 无法匹配的历史值，追加警告选项（内部使用）
 * @returns {string} options HTML
 */
function buildServiceTypeOptions(currentValue, projectGroup, legacyValue) {
  const pg = projectGroup || getFormProjectGroup();
  let filtered;

  if (pg === "travel") {
    // 旅游接待：显示 category_group 为 'travel' 或 'misc' 的类型
    filtered = window._itemTypes.filter((t) =>
      t.isActive !== false &&
      (t.categoryGroup === "travel" || t.categoryGroup === "misc"),
    );
  } else if (pg === "event") {
    // 活动服务：显示 category_group 为 'event' 或 'misc' 的类型
    filtered = window._itemTypes.filter((t) =>
      t.isActive !== false &&
      (t.categoryGroup === "event" || t.categoryGroup === "misc"),
    );
  } else {
    // 综合服务（mixed）：全集
    filtered = window._itemTypes.filter((t) => t.isActive !== false);
  }

  // misc 排最后
  const nonMisc = filtered.filter((t) => t.code !== "misc");
  const misc    = filtered.filter((t) => t.code === "misc");
  const sorted  = [...nonMisc, ...misc];
  const validCodes = sorted.map((t) => t.code);

  let options = "";

  // 历史遗留值：插入警告选项并选中（由 createItemRow 传入）
  if (legacyValue && !validCodes.includes(legacyValue)) {
    options += `<option value="${esc(legacyValue)}" selected style="color:#e67e22">⚠️ ${esc(legacyValue)}（未识别）</option>`;
  }

  // currentValue 不在集合内时 fallback 到 misc
  const selectedCode = legacyValue
    ? ""  // 已由 legacyValue option 选中
    : (validCodes.includes(currentValue) ? currentValue : "misc");

  options += sorted.map((t) =>
    `<option value="${esc(t.code)}" ${!legacyValue && t.code === selectedCode ? "selected" : ""}>${esc(t.nameZh)}</option>`,
  ).join("");

  return options;
}

/**
 * 重建所有报价行的服务类型下拉（切换项目组时调用）
 * 不触发 change 事件，避免循环；当前选中值不在新集合内时自动重置为 misc
 */
function rebuildAllServiceTypeSelects() {
  const pg = getFormProjectGroup();
  const validCodes = window._itemTypes
    .filter((t) => t.isActive !== false)
    .map((t) => t.code);

  document.querySelectorAll("#items-tbody tr[data-row-id]").forEach((tr) => {
    const select = tr.querySelector("select[name='groupName']");
    if (!select) return;
    const currentValue = select.value;
    // 历史遗留值（不在合法 code 集合内）跳过重建，保持原样
    if (currentValue && !validCodes.includes(currentValue)) return;
    // currentValue 不在新 pg 集合内时，buildServiceTypeOptions 会自动 fallback 到 misc
    select.innerHTML = buildServiceTypeOptions(currentValue, pg);
  });
}

// ── 备注浮层管理 ──────────────────────────────────────────────────────────────

/** 当前打开浮层对应的 { td, tr }，null 表示已关闭 */
let _notesTarget = null;

/**
 * 在页面加载时创建全局备注浮层并 append 到 body
 * 包含 textarea 和「完成」按钮，点击完成或外部区域时关闭并保存
 */
function createNotesPopover() {
  const popover = document.createElement("div");
  popover.id = "notes-popover";
  popover.style.cssText = [
    "display:none",
    "position:fixed",
    "z-index:9999",
    "background:#fff",
    "border:1px solid #d4a96a",
    "border-radius:8px",
    "padding:12px",
    "box-shadow:0 4px 16px rgba(0,0,0,0.12)",
    "width:280px",
  ].join(";");

  const ta = document.createElement("textarea");
  ta.id = "notes-popover-ta";
  ta.rows = 4;
  ta.style.cssText = "width:100%;border:none;outline:none;resize:none;font-size:13px;line-height:1.6;color:#333;box-sizing:border-box;font-family:inherit";

  const footer = document.createElement("div");
  footer.style.cssText = "text-align:right;margin-top:8px";

  const closeBtn = document.createElement("button");
  closeBtn.id = "notes-popover-close";
  closeBtn.type = "button";
  closeBtn.textContent = "完成";
  closeBtn.style.cssText = "font-size:12px;color:#999;border:none;background:none;cursor:pointer";
  closeBtn.addEventListener("click", closeNotesPopover);

  footer.appendChild(closeBtn);
  popover.appendChild(ta);
  popover.appendChild(footer);
  document.body.appendChild(popover);
}

/**
 * 打开备注编辑浮层，定位在点击的单元格附近
 * @param {HTMLElement} td 备注单元格
 * @param {HTMLElement} tr 所在行
 */
function openNotesPopover(td, tr) {
  if (_notesTarget) closeNotesPopover(); // 先保存已有浮层
  _notesTarget = { td, tr };

  const popover  = document.getElementById("notes-popover");
  const textarea = document.getElementById("notes-popover-ta");
  textarea.value = tr.dataset.notes || "";

  // 定位：优先显示在单元格下方，空间不足时显示在上方
  const rect = td.getBoundingClientRect();
  const pw = 280, ph = 140;
  let top  = rect.bottom + 4;
  let left = rect.left;
  if (left + pw > window.innerWidth - 8)  left = window.innerWidth - pw - 8;
  if (top  + ph > window.innerHeight - 8) top  = rect.top - ph - 4;

  popover.style.top     = `${Math.max(top, 8)}px`;
  popover.style.left    = `${Math.max(left, 8)}px`;
  popover.style.display = "block";
  textarea.focus();
}

/** 关闭浮层并将 textarea 内容保存到对应行的 dataset.notes */
function closeNotesPopover() {
  if (!_notesTarget) return;
  const { td, tr } = _notesTarget;
  const notes = document.getElementById("notes-popover-ta").value;
  tr.dataset.notes = notes;
  renderNotesCellDisplay(td, notes);
  document.getElementById("notes-popover").style.display = "none";
  _notesTarget = null;
  updateSummary();
}

/**
 * 刷新备注单元格的摘要显示
 * 有内容：截断到 20 字；无内容：灰色提示文字
 * @param {HTMLElement} td 备注单元格
 * @param {string} notes 备注文本
 */
function renderNotesCellDisplay(td, notes) {
  if (!notes) {
    td.innerHTML = `<span style="color:#aaa">+ 添加备注</span>`;
  } else {
    const truncated = notes.length > 20 ? notes.slice(0, 20) + "…" : notes;
    td.textContent  = truncated;
    td.style.color  = "#333";
  }
}

// ── 行渲染 ────────────────────────────────────────────────────────────────────

function createItemRow(defaults) {
  const id = `row-${++state.rowCounter}`;
  const tr = document.createElement("tr");
  tr.dataset.rowId = id;
  tr.dataset.notes = defaults?.notes || "";

  // 解析 groupName：兼容旧版中文字符串
  const resolved = resolveGroupNameToCode(defaults?.groupName);
  const serviceTypeOptions = buildServiceTypeOptions(
    resolved.code,
    getFormProjectGroup(),
    resolved.legacy ? resolved.code : null,
  );

  tr.innerHTML = `
    <td><select class="cell-input col-group-select" name="groupName">${serviceTypeOptions}</select></td>
    <td><input class="cell-input col-name-input" name="nameZh" value="${esc(defaults?.nameZh || "")}" placeholder="中文名称" required /></td>
    <td class="view-internal"><input class="cell-input" name="nameEn" value="${esc(defaults?.nameEn || "")}" placeholder="英文名称" /></td>
    <td><input class="cell-input col-unit-input" name="unit" value="${esc(defaults?.unit || "套")}" placeholder="单位" /></td>
    <td><input class="cell-input col-qty-input" name="quantity" type="number" min="0" step="1" value="${Number(defaults?.quantity || 1)}" /></td>
    <td class="view-internal"><input class="cell-input col-price-input" name="costPrice" type="number" min="0" step="0.01" value="${defaults?.costPrice > 0 ? defaults.costPrice : ""}" placeholder="0.00" /></td>
    <td><input class="cell-input col-price-input" name="sellPrice" type="number" min="0" step="0.01" value="${defaults?.sellPrice > 0 ? defaults.sellPrice : ""}" placeholder="0.00" /></td>
    <td class="view-internal computed-cell" data-field="costSubtotal">—</td>
    <td class="computed-cell" data-field="sellSubtotal">—</td>
    <td class="view-internal computed-cell" data-field="margin">—</td>
    <td class="view-internal"><input class="cell-input" name="supplier" value="${esc(defaults?.supplier || "")}" placeholder="供应商" /></td>
    <td data-field="notes"></td>
    <td><button type="button" class="ghost mini-button delete-row">✕</button></td>
  `;

  // 初始化备注单元格显示
  renderNotesCellDisplay(tr.querySelector('[data-field="notes"]'), tr.dataset.notes);
  updateRowComputedCells(tr);
  return tr;
}

function updateRowComputedCells(tr) {
  const qty     = Number(tr.querySelector('[name="quantity"]').value || 0);
  const cost    = Number(tr.querySelector('[name="costPrice"]').value || 0);
  const sell    = Number(tr.querySelector('[name="sellPrice"]').value || 0);
  const costSub = qty * cost;
  const sellSub = qty * sell;
  const margin  = sellSub > 0 ? ((sellSub - costSub) / sellSub * 100).toFixed(1) : "—";
  const currency = getFormCurrency();

  tr.querySelector('[data-field="costSubtotal"]').textContent = costSub > 0 ? formatMoney(costSub, currency) : "—";
  tr.querySelector('[data-field="sellSubtotal"]').textContent = sellSub > 0 ? formatMoney(sellSub, currency) : "—";
  tr.querySelector('[data-field="margin"]').textContent       = margin !== "—" ? `${margin}%` : "—";
}

// ── 表格管理 ──────────────────────────────────────────────────────────────────

function getItemsFromTable() {
  // 若备注浮层仍开着，先保存内容
  if (_notesTarget) closeNotesPopover();

  return Array.from(
    document.getElementById("items-tbody").querySelectorAll("tr[data-row-id]"),
  ).map((tr, index) => ({
    groupName:  tr.querySelector('[name="groupName"]').value.trim(),
    nameZh:     tr.querySelector('[name="nameZh"]').value.trim(),
    nameEn:     tr.querySelector('[name="nameEn"]').value.trim(),
    unit:       tr.querySelector('[name="unit"]').value.trim(),
    quantity:   Number(tr.querySelector('[name="quantity"]').value || 1),
    costPrice:  Number(tr.querySelector('[name="costPrice"]').value || 0),
    sellPrice:  Number(tr.querySelector('[name="sellPrice"]').value || 0),
    supplier:   tr.querySelector('[name="supplier"]').value.trim(),
    notes:      tr.dataset.notes || "",
    isActive:   true,
    sortOrder:  index,
  }));
}

function renderItemsTable(items) {
  const tbody = document.getElementById("items-tbody");
  tbody.innerHTML = "";

  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="13" class="empty">暂无报价行，点击「+ 添加报价行」开始，或选择模板套入</td></tr>';
    return;
  }

  items.forEach((item) => tbody.appendChild(createItemRow(item)));
  updateSummary();
}

function addEmptyRow() {
  const tbody = document.getElementById("items-tbody");
  const emptyRow = tbody.querySelector(".empty-row");
  if (emptyRow) emptyRow.remove();

  // 新增行默认服务类型为 misc
  const tr = createItemRow({ groupName: "misc" });
  tbody.appendChild(tr);
  tr.querySelector('[name="nameZh"]').focus();
  updateSummary();
}

// ── 汇总计算 ──────────────────────────────────────────────────────────────────

function updateSummary() {
  const items    = getItemsFromTable();
  const currency = getFormCurrency();

  let totalCost = 0, totalSell = 0;
  items.forEach((item) => {
    totalCost += item.quantity * item.costPrice;
    totalSell += item.quantity * item.sellPrice;
  });

  const grossProfit = totalSell - totalCost;
  const margin      = totalSell > 0 ? ((grossProfit / totalSell) * 100).toFixed(1) : "0.0";

  document.getElementById("sum-count").textContent  = `${items.length} 条`;
  document.getElementById("sum-cost").textContent   = formatMoney(totalCost,    currency);
  document.getElementById("sum-sell").textContent   = formatMoney(totalSell,    currency);
  document.getElementById("sum-profit").textContent = formatMoney(grossProfit,  currency);
  document.getElementById("sum-margin").textContent = `${margin}%`;

  // 右侧显示当前项目组分类名称（替代原分组明细）
  const pgCode = getFormProjectGroup();
  const pgType = window._groupTypes.find((t) => t.code === pgCode);
  const pgName = pgType
    ? pgType.nameZh
    : (pgCode === "mixed" ? "综合服务" : pgCode);

  document.getElementById("group-breakdown").innerHTML =
    `<div style="padding:4px 0;font-size:13px;color:var(--text-secondary)">` +
    `项目组：<strong style="color:var(--text-primary)">${esc(pgName)}</strong></div>`;
}

/**
 * 项目组分类切换时的处理函数
 * 先按新选中分类重新拉取服务类型，再重建下拉并刷新汇总
 * 绑定到 #select-project-group change 事件
 */
async function onProjectGroupChange() {
  await fetchItemTypes();
  rebuildAllServiceTypeSelects();
  updateSummary();
}

// ── 视图切换 ──────────────────────────────────────────────────────────────────

function applyViewMode() {
  const isClient = state.viewMode === "client";
  document.getElementById("view-label").textContent        = isClient ? "客户视图" : "内部视图";
  document.getElementById("btn-toggle-view").textContent   = isClient ? "切换内部视图" : "切换客户视图";
  document.querySelectorAll(".view-internal").forEach((el) => {
    el.style.display = isClient ? "none" : "";
  });
}

// ── 读写表单 ──────────────────────────────────────────────────────────────────

function getHeaderPayload() {
  const form = document.getElementById("project-header-form");
  return {
    name:          form.querySelector('[name="name"]').value.trim(),
    client:        form.querySelector('[name="client"]').value.trim(),
    eventDate:     form.querySelector('[name="eventDate"]').value,
    venue:         form.querySelector('[name="venue"]').value.trim(),
    paxCount:      Number(form.querySelector('[name="paxCount"]').value || 0),
    currency:      form.querySelector('[name="currency"]').value,
    project_group: form.querySelector('[name="project_group"]').value,
    status:        form.querySelector('[name="status"]').value,
    notes:         form.querySelector('[name="notes"]').value.trim(),
  };
}

function fillHeaderForm(project) {
  const form = document.getElementById("project-header-form");
  form.querySelector('[name="name"]').value      = project.name      || "";
  form.querySelector('[name="client"]').value    = project.client    || "";
  form.querySelector('[name="eventDate"]').value = project.eventDate || "";
  form.querySelector('[name="venue"]').value     = project.venue     || "";
  form.querySelector('[name="paxCount"]').value  = project.paxCount  || 0;
  form.querySelector('[name="currency"]').value  = project.currency  || "EUR";
  form.querySelector('[name="status"]').value    = project.status    || "draft";
  form.querySelector('[name="notes"]').value     = project.notes     || "";

  // 回显项目组分类；历史数据无此字段时默认 mixed
  const pg = project.project_group || project.projectGroup || "mixed";
  populateProjectGroupSelect(pg);
}

// ── 加载 / 保存 ───────────────────────────────────────────────────────────────

async function loadProject(projectId) {
  const project = await window.AppUtils.fetchJson(
    `/api/project-quotes/${encodeURIComponent(projectId)}`,
    null,
    "加载项目型报价失败",
  );
  fillHeaderForm(project);
  renderItemsTable(project.items || []);
  // 加载完成后重建所有行的服务类型下拉（确保与项目组分类匹配）
  rebuildAllServiceTypeSelects();
  document.getElementById("page-title").textContent = project.name || "项目型报价";
  document.getElementById("btn-delete").classList.remove("hidden");
  const termsBtn = document.getElementById("btn-terms");
  if (termsBtn) {
    termsBtn.href = window.AppReturn
      ? window.AppReturn.withReturn(
          `/terms-editor.html?quote_id=${encodeURIComponent(project.id)}`,
          window.AppReturn.getCurrentPath(),
        )
      : `/terms-editor.html?quote_id=${encodeURIComponent(project.id)}`;
  }
}

async function saveProject() {
  const header = getHeaderPayload();
  if (!header.name) {
    window.AppUtils.showMessage("pq-message", "请填写项目名称。", "error");
    return;
  }

  const items = getItemsFromTable();
  for (let i = 0; i < items.length; i++) {
    if (!items[i].nameZh) {
      window.AppUtils.showMessage("pq-message", `请填写第 ${i + 1} 条物料的中文名称。`, "error");
      return;
    }
    if (!items[i].unit) {
      window.AppUtils.showMessage("pq-message", `请填写第 ${i + 1} 条物料的单位。`, "error");
      return;
    }
  }

  const payload = { ...header, items };
  window.AppUtils.hideMessage("pq-message");

  try {
    const projectId = state.projectId;
    const url    = projectId ? `/api/project-quotes/${encodeURIComponent(projectId)}` : "/api/project-quotes";
    const method = projectId ? "PUT" : "POST";
    const saved  = await window.AppUtils.fetchJson(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    }, "保存失败");

    if (!projectId) {
      const editUrl = `/quote-project.html?id=${encodeURIComponent(saved.id)}`;
      window.location.href = window.AppReturn
        ? window.AppReturn.withReturn(editUrl, window.AppReturn.getReturnUrl("/project-quotes.html"))
        : editUrl;
      return;
    }
    window.AppUtils.showMessage("pq-message", "项目型报价已保存。", "success");
    fillHeaderForm(saved);
    renderItemsTable(saved.items || []);
    rebuildAllServiceTypeSelects();
    document.getElementById("page-title").textContent = saved.name || "项目型报价";
  } catch (error) {
    window.AppUtils.showMessage("pq-message", error.message, "error");
  }
}

async function deleteProject() {
  if (!state.projectId) return;
  try {
    await window.AppUtils.fetchJson(
      `/api/project-quotes/${encodeURIComponent(state.projectId)}`,
      { method: "DELETE" },
      "删除失败",
    );
    window.AppUtils.setFlash("项目型报价已删除。");
    window.location.href = window.AppReturn
      ? window.AppReturn.getReturnUrl("/project-quotes.html")
      : "/project-quotes.html";
  } catch (error) {
    window.AppUtils.showMessage("pq-message", error.message, "error");
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function bootstrap() {
  window.AppUtils.applyFlash("pq-message");
  state.projectId = getProjectId();

  // 0. 创建备注浮层（全局单例，append 到 body）
  createNotesPopover();

  // 1. 先加载项目组分类（fetchItemTypes 需要 _groupTypes 已就绪才能拼 project_group_id）
  await fetchProjectGroupTypes();

  // 2. 填充项目组分类下拉（新建时默认第一项）
  populateProjectGroupSelect();

  // 3. 若为编辑模式，加载已有报价数据（会调用 populateProjectGroupSelect 覆盖选中值）
  if (state.projectId) {
    try {
      await loadProject(state.projectId);
    } catch (error) {
      window.AppUtils.showMessage("pq-message", error.message, "error");
    }
  }

  // 4. 根据当前选中的项目组分类加载对应服务类型
  await fetchItemTypes();

  applyViewMode();
  updateSummary();

  // ── 事件绑定 ────────────────────────────────────────────────────────────────

  // 视图切换
  document.getElementById("btn-toggle-view").addEventListener("click", () => {
    state.viewMode = state.viewMode === "internal" ? "client" : "internal";
    applyViewMode();
  });

  // 新增行：默认服务类型 misc
  document.getElementById("btn-add-row").addEventListener("click", addEmptyRow);

  // 套用模板
  document.getElementById("btn-apply-template").addEventListener("click", () => {
    const templateKey = document.getElementById("template-select").value;
    if (!templateKey) {
      window.AppUtils.showMessage("pq-message", "请先选择一个活动模板。", "error");
      return;
    }
    const template = ACTIVITY_TEMPLATES[templateKey];
    if (!template) return;

    const tbody = document.getElementById("items-tbody");
    if (tbody.querySelectorAll("tr[data-row-id]").length > 0) {
      if (!window.confirm(`应用「${template.label}」模板将替换当前所有物料行，确定继续吗？`)) return;
    }

    // 套用时将模板 groupName（中文名称）解析为 code
    const resolvedItems = template.items.map((item) => ({
      ...item,
      groupName: resolveGroupNameToCode(item.groupName).code,
    }));

    renderItemsTable(resolvedItems);
    // 套用后重建服务类型下拉（确保与当前项目组匹配）
    rebuildAllServiceTypeSelects();
    document.getElementById("template-select").value = "";
    window.AppUtils.showMessage("pq-message", `已加载「${template.label}」模板，请填写成本价和销售单价。`, "success");
  });

  // 保存
  document.getElementById("btn-save").addEventListener("click", saveProject);

  // 删除
  document.getElementById("btn-delete").addEventListener("click", () => {
    const name = document.querySelector('[name="name"]').value || "此报价";
    if (!window.confirm(`确定删除「${name}」吗？`)) return;
    deleteProject();
  });

  // 币种切换 → 刷新计算列和汇总
  document.querySelector('[name="currency"]').addEventListener("change", () => {
    document.querySelectorAll("tr[data-row-id]").forEach(updateRowComputedCells);
    updateSummary();
  });

  // 项目组分类切换 → 重建服务类型下拉 + 刷新汇总
  document.getElementById("select-project-group").addEventListener("change", onProjectGroupChange);

  // 表格委托：input 事件（价格/数量变动）
  document.getElementById("items-tbody").addEventListener("input", (event) => {
    const tr = event.target.closest("tr[data-row-id]");
    if (!tr) return;
    updateRowComputedCells(tr);
    updateSummary();
  });

  // 表格委托：click 事件（删除行 + 备注单元格点击）
  document.getElementById("items-tbody").addEventListener("click", (event) => {
    // 备注单元格点击
    const notesTd = event.target.closest('td[data-field="notes"]');
    if (notesTd) {
      const tr = notesTd.closest("tr[data-row-id]");
      if (tr) openNotesPopover(notesTd, tr);
      return;
    }
    // 删除行
    if (event.target.classList.contains("delete-row")) {
      const tr = event.target.closest("tr[data-row-id]");
      if (tr) {
        tr.remove();
        const tbody = document.getElementById("items-tbody");
        if (!tbody.querySelector("tr[data-row-id]")) {
          tbody.innerHTML = '<tr class="empty-row"><td colspan="13" class="empty">暂无报价行，点击「+ 添加报价行」开始，或选择模板套入</td></tr>';
        }
        updateSummary();
      }
    }
  });

  // 点击备注浮层外部时自动关闭并保存
  document.addEventListener("mousedown", (event) => {
    if (!_notesTarget) return;
    const popover = document.getElementById("notes-popover");
    if (!popover.contains(event.target)) {
      closeNotesPopover();
    }
  });
}

bootstrap().catch((error) => {
  window.AppUtils.showMessage("pq-message", error.message, "error");
});
