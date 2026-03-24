// ── 主数据缓存 ────────────────────────────────────────────────────────────────

/** 服务类型全量缓存，从 GET /api/quote-item-types 加载（始终保存全集，不做 URL 过滤） */
window._allItemTypes = [];

/** 服务类型缓存（向后兼容别名，指向 _allItemTypes） */
window._itemTypes = [];

/** 项目组分类缓存，从 GET /api/project-group-types 加载 */
window._groupTypes = [];

// ── Activity templates ────────────────────────────────────────────────────────
// groupName 使用中文名称，createItemRow 通过 resolveGroupNameToId 映射为 UUID

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

function normalizeItemType(record) {
  if (!record || typeof record !== "object") return null;
  return {
    id: record.id || "",
    code: record.code || "",
    nameZh: record.nameZh || record.name_zh || "",
    projectGroupId: record.projectGroupId || record.project_group_id || null,
    sortOrder: Number(record.sortOrder ?? record.sort_order ?? 0),
    isActive: record.isActive !== false && record.is_active !== false,
  };
}

function normalizeGroupType(record) {
  if (!record || typeof record !== "object") return null;
  return {
    id: record.id || null,
    code: record.code || "",
    nameZh: record.nameZh || record.name_zh || "",
    sortOrder: Number(record.sortOrder ?? record.sort_order ?? 0),
    isActive: record.isActive !== false && record.is_active !== false,
  };
};

// ── 主数据加载 ─────────────────────────────────────────────────────────────────

/**
 * 从 API 加载全量服务类型，缓存到 window._allItemTypes
 * 始终加载全集，运行时按项目组 UUID 在前端过滤，避免切换分组时重复请求
 */
async function fetchItemTypes() {
  try {
    const types = await window.AppUtils.fetchJson("/api/quote-item-types", null, "Failed to load item types.");
    window._allItemTypes = Array.isArray(types)
      ? types.map(normalizeItemType).filter((item) => item && item.code).sort((a, b) => a.sortOrder - b.sortOrder)
      : [];
    window._itemTypes = window._allItemTypes; // backward-compatible alias
  } catch (e) {
    console.warn("[quote-project] failed to load item types; using empty list", e);
    window._allItemTypes = [];
    window._itemTypes = [];
  }
}

/** 从 API 加载项目组分类，缓存到 window._groupTypes */
async function fetchProjectGroupTypes() {
  try {
    const types = await window.AppUtils.fetchJson(
      "/api/project-group-types",
      null,
      "Failed to load project group types.",
    );
    window._groupTypes = Array.isArray(types)
      ? types.map(normalizeGroupType).filter((item) => item && item.code && item.isActive !== false).sort((a, b) => a.sortOrder - b.sortOrder)
      : [];
  } catch (e) {
    console.warn("[quote-project] failed to load project group types; using defaults", e);
    window._groupTypes = [
      { id: null, code: "travel", nameZh: "\u65c5\u6e38\u63a5\u5f85", sortOrder: 1, isActive: true },
      { id: null, code: "event",  nameZh: "\u6d3b\u52a8\u670d\u52a1", sortOrder: 2, isActive: true },
      { id: null, code: "mixed",  nameZh: "\u7efc\u5408\u670d\u52a1", sortOrder: 3, isActive: true },
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
 * 返回杂项（misc）服务类型的 UUID id，找不到时返回空字符串
 */
function getMiscId() {
  const misc = window._allItemTypes.find((t) => t.code === "misc");
  return misc ? misc.id : "";
}

/**
 * 将任意格式的 groupName 解析为 quote_item_types.id（UUID）
 * 兼容三种格式：UUID（新格式）、code（如 "misc"）、中文 nameZh（历史数据）
 * @param {string} value
 * @returns {string} UUID id，找不到时返回 misc 的 id
 */
function resolveGroupNameToId(value) {
  if (!value) return getMiscId();
  // 已经是合法 id (UUID)
  if (window._allItemTypes.some((t) => t.id === value)) return value;
  // code 精确匹配
  const byCode = window._allItemTypes.find((t) => t.code === value);
  if (byCode) return byCode.id;
  // nameZh 匹配（兼容旧版中文 groupName，如"搭建制作"）
  const byName = window._allItemTypes.find((t) => t.nameZh === value);
  if (byName) return byName.id;
  // 匹配失败：fallback 到 misc
  return getMiscId();
}

/**
 * 根据项目组 UUID 过滤服务类型，生成 <option> HTML
 * - 有效 projectGroupId 且非 mixed：显示该分组 + mixed 分组的服务类型
 * - mixed 或无 projectGroupId：显示全集
 * - currentValue（UUID）不在集合内时自动 fallback 到 misc
 * @param {string} currentValue 当前选中值（quote_item_types.id UUID）
 * @param {string|null} projectGroupId 项目组 UUID（project_group_types.id），省略则用全集
 * @returns {string} options HTML，option value = quote_item_types.id（UUID）
 */
function buildServiceTypeOptions(currentValue, projectGroupId) {
  const mixedGroup = window._groupTypes.find((t) => t.code === "mixed");
  const mixedId    = mixedGroup ? mixedGroup.id : null;

  let filtered;
  if (!projectGroupId || projectGroupId === mixedId) {
    // mixed 或无分组：显示全集
    filtered = window._allItemTypes.filter((t) => t.isActive !== false);
  } else {
    // 显示当前分组 + mixed 分组（杂项）的服务类型
    filtered = window._allItemTypes.filter((t) =>
      t.isActive !== false &&
      (t.projectGroupId === projectGroupId ||
       t.projectGroupId === mixedId ||
       !t.projectGroupId),  // null = 适用所有分组
    );
  }

  const validIds   = new Set(filtered.map((t) => t.id));
  const miscId     = getMiscId();
  // currentValue 不在集合内时 fallback 到 misc，misc 也不存在时取第一项
  const selectedId = validIds.has(currentValue)
    ? currentValue
    : (validIds.has(miscId) ? miscId : (filtered[0]?.id || ""));

  return filtered.map((t) =>
    `<option value="${esc(t.id)}" ${t.id === selectedId ? "selected" : ""}>${esc(t.nameZh)}</option>`,
  ).join("");
}

/**
 * 重建所有报价行的服务类型下拉（切换项目组时调用）
 * 从 _allItemTypes 全集按新项目组 UUID 过滤，不触发 change 事件
 * currentValue（UUID）不在新集合内时自动 fallback 到 misc
 */
function rebuildAllServiceTypeSelects() {
  const pgCode  = getFormProjectGroup();
  const pgType  = window._groupTypes.find((t) => t.code === pgCode);
  const pgGroupId = pgType ? pgType.id : null;

  document.querySelectorAll("#items-tbody tr[data-row-id]").forEach((tr) => {
    const select = tr.querySelector("select[name='groupName']");
    if (!select) return;
    select.innerHTML = buildServiceTypeOptions(select.value, pgGroupId);
  });
}

// ── 备注浮层管理 ──────────────────────────────────────────────────────────────

/** 当前打开浮层对应的行 rowId，null 表示已关闭 */
let notesCurrentRowId = null;

/**
 * 按 rowId 读取对应行的备注内容
 * @param {string} rowId
 * @returns {string}
 */
function getRowNotes(rowId) {
  const tr = document.querySelector(`#items-tbody tr[data-row-id="${CSS.escape(rowId)}"]`);
  return tr ? (tr.dataset.notes || "") : "";
}

/**
 * 按 rowId 将备注内容写回对应行的 dataset
 * @param {string} rowId
 * @param {string} notes
 */
function setRowNotes(rowId, notes) {
  const tr = document.querySelector(`#items-tbody tr[data-row-id="${CSS.escape(rowId)}"]`);
  if (tr) tr.dataset.notes = notes;
}

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
 * @param {HTMLElement} td 备注单元格（.notes-cell）
 * @param {string} rowId 所在行的 rowId
 */
function openNotesPopover(td, rowId) {
  if (notesCurrentRowId) closeNotesPopover(); // 先保存已有浮层
  notesCurrentRowId = rowId;

  const popover  = document.getElementById("notes-popover");
  const textarea = document.getElementById("notes-popover-ta");
  textarea.value = getRowNotes(rowId);

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

/** 关闭浮层，将 textarea 内容写回对应行，并刷新摘要显示 */
function closeNotesPopover() {
  if (!notesCurrentRowId) return;
  const rowId = notesCurrentRowId;
  const notes = document.getElementById("notes-popover-ta").value.trim();
  setRowNotes(rowId, notes);          // 写回行数据
  updateNotesPreview(rowId);          // 更新摘要显示
  document.getElementById("notes-popover").style.display = "none";
  notesCurrentRowId = null;
  updateSummary();
}

/**
 * 刷新备注单元格的摘要 span 显示
 * 有内容：截断到 20 字；无内容：灰色提示文字
 * @param {string} rowId 行 id
 */
function updateNotesPreview(rowId) {
  const td = document.querySelector(`#items-tbody td.notes-cell[data-row-id="${CSS.escape(rowId)}"]`);
  if (!td) return;
  renderNotesCellDisplay(td, getRowNotes(rowId));
}

/**
 * 刷新备注单元格内 .notes-preview span 的文本
 * @param {HTMLElement} td 备注单元格
 * @param {string} notes 备注文本
 */
function renderNotesCellDisplay(td, notes) {
  const preview = td.querySelector(".notes-preview");
  if (!preview) return;
  if (!notes) {
    preview.textContent = "+ 添加备注";
    preview.style.color = "#bbb";
  } else {
    preview.textContent = notes.length > 20 ? notes.slice(0, 20) + "…" : notes;
    preview.style.color = "#333";
  }
}

// ── 行渲染 ────────────────────────────────────────────────────────────────────

function createItemRow(defaults) {
  const id = `row-${++state.rowCounter}`;
  const tr = document.createElement("tr");
  tr.dataset.rowId = id;
  tr.dataset.notes = defaults?.notes || "";

  // 解析 groupName → UUID（兼容历史中文字符串、code、UUID）
  const resolvedId = resolveGroupNameToId(defaults?.groupName);
  // 获取当前项目组的 UUID，用于过滤服务类型下拉选项
  const pgCode    = getFormProjectGroup();
  const pgType    = window._groupTypes.find((t) => t.code === pgCode);
  const pgGroupId = pgType ? pgType.id : null;
  const serviceTypeOptions = buildServiceTypeOptions(resolvedId, pgGroupId);

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
    <td class="col-notes notes-cell" data-field="notes" data-row-id="${esc(id)}" style="cursor:pointer"><span class="notes-preview"></span></td>
    <td><button type="button" class="ghost mini-button delete-row">✕</button></td>
  `;

  // 初始化备注单元格摘要显示
  renderNotesCellDisplay(tr.querySelector(".notes-cell"), tr.dataset.notes);
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
  if (notesCurrentRowId) closeNotesPopover();

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
 * _allItemTypes 已是全量，直接按新项目组 UUID 过滤重建下拉，无需重新请求 API
 */
function onProjectGroupChange() {
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
  console.log("[init] _groupTypes:", window._groupTypes);

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
  console.log("[init] _allItemTypes:", window._allItemTypes);

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

    // 套用时直接传原始 groupName（中文名称或 code），
    // createItemRow 内部通过 resolveGroupNameToId 解析为 UUID
    renderItemsTable(template.items);
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
    // 备注单元格点击：通过 .notes-cell 类和 data-row-id 定位
    const notesTd = event.target.closest(".notes-cell");
    if (notesTd) {
      const rowId = notesTd.dataset.rowId;
      if (rowId) openNotesPopover(notesTd, rowId);
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
    if (!notesCurrentRowId) return;
    const popover = document.getElementById("notes-popover");
    if (popover.style.display !== "none" &&
        !popover.contains(event.target) &&
        !event.target.closest(".notes-cell")) {
      closeNotesPopover();
    }
  });
}

bootstrap().catch((error) => {
  window.AppUtils.showMessage("pq-message", error.message, "error");
});
