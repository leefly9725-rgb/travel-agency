const FALLBACK_CATEGORIES = [
  { code: "av_equipment",   nameZh: "音视频设备" },
  { code: "stage_structure",nameZh: "舞台结构" },
  { code: "print_display",  nameZh: "印刷展示" },
  { code: "decoration",     nameZh: "装饰物料" },
  { code: "furniture",      nameZh: "家具桌椅" },
  { code: "personnel",      nameZh: "人员服务" },
  { code: "logistics",      nameZh: "物流设备" },
  { code: "management",     nameZh: "管理服务" },
];

const EMPTY_TEXT = "--";

// 新版 HTML 所需 DOM id 清单（已移除旧版不存在的节点）
const SUPPLIERS_REQUIRED_DOM_IDS = [
  "sup-message",
  "global-search",
  "filter-supplier-bar",
  "filter-category",
  "filter-status",
  "toggle-best-price",
  "btn-manage-categories",
  "btn-batch-import",
  "btn-new-supplier",
  "btn-new-item",
  "kpi-supplier-count",
  "kpi-sup-active",
  "kpi-sup-inactive",
  "kpi-item-count",
  "kpi-item-active",
  "kpi-item-inactive",
  "kpi-best-price-count",
  "kpi-last-update",
  "kpi-last-update-source",
  "supplier-panel-count",
  "supplier-list",
  "supplier-search",
  "items-table-title",
  "items-table-subtitle",
  "item-table-body",
  "item-empty",
  "item-pagination",
  "page-prev",
  "page-next",
  "page-info",
  "page-size-sel",
  "btn-view-all-items",
  "best-price-table",
  "best-price-body",
  "best-price-empty",
  "best-price-pagination",
  "best-price-page-prev",
  "best-price-page-next",
  "best-price-page-info",
  "best-price-page-size",
  "compare-item-sel",
  "compare-date-from",
  "compare-date-to",
  "btn-compare",
  "btn-refresh-best-price",
  "dlg-supplier",
  "dlg-supplier-title",
  "supplier-form",
  "btn-save-supplier",
  "dlg-item",
  "dlg-item-title",
  "item-form",
  "item-supplier-select",
  "item-category-select",
  "btn-save-item",
  "dlg-categories",
  "cat-message",
  "categories-list",
  "cat-list-summary",
  "cat-dialog-summary",
  "cat-form-section",
  "cat-form",
  "cat-form-title",
  "cat-form-caption",
  "cat-code-input",
  "cat-code-hint",
  "btn-new-category",
  "btn-cancel-cat-form",
  "btn-save-category",
];

// 供应商类别 badge 映射
const SUP_TYPE_BADGE = {
  hotel: { cls: "badge-hotel", label: "酒店" },
  dmc:   { cls: "badge-dmc",   label: "地接" },
  trans: { cls: "badge-trans", label: "交通" },
  food:  { cls: "badge-food",  label: "餐饮" },
  venue: { cls: "badge-venue", label: "场地" },
};

let suppliersDom = null;

const DEFAULT_PAGE_SIZE = 5;

function createPaginationState() {
  return { page: 1, pageSize: DEFAULT_PAGE_SIZE };
}

const state = {
  suppliers: [],
  items: [],
  bestPriceItems: [],
  categories: [],
  selectedSupplierId: null,
  filters: {
    global: "",
    category: "",
    status: "active",
    bestPriceOnly: false,
  },
  pagination: {
    items: createPaginationState(),
    bestPrice: createPaginationState(),
  },
};

function getOptionalElement(id) {
  return document.getElementById(id);
}

function resetPagination(key) {
  if (state.pagination[key]) state.pagination[key].page = 1;
}

function setPaginationPageSize(key, pageSize) {
  const pagination = state.pagination[key];
  if (!pagination) return;
  pagination.pageSize = pageSize;
  pagination.page = 1;
}

function paginateRows(rows, pagination) {
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pagination.pageSize) || 1);
  pagination.page = Math.min(Math.max(1, pagination.page), totalPages);
  const startIndex = totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize;
  return {
    totalItems,
    totalPages,
    page: pagination.page,
    rows: rows.slice(startIndex, startIndex + pagination.pageSize),
  };
}

function renderPaginationControls(config, detail) {
  const prevBtn = getOptionalElement(config.prevId);
  const nextBtn = getOptionalElement(config.nextId);
  const infoEl = getOptionalElement(config.infoId);
  const sizeEl = getOptionalElement(config.sizeId);
  if (prevBtn) prevBtn.disabled = detail.page <= 1 || detail.totalItems === 0;
  if (nextBtn) nextBtn.disabled = detail.page >= detail.totalPages || detail.totalItems === 0;
  if (infoEl) {
    infoEl.textContent = detail.totalItems > 0
      ? `\u7b2c ${detail.page} / ${detail.totalPages} \u9875\uff0c\u5171 ${detail.totalItems} \u6761`
      : "\u7b2c 1 / 1 \u9875\uff0c\u5171 0 \u6761";
  }
  if (sizeEl && String(sizeEl.value) !== String(config.pagination.pageSize)) {
    sizeEl.value = String(config.pagination.pageSize);
  }
}

function getRequiredElement(id) {
  const el = getOptionalElement(id);
  if (!el) throw new Error(`[suppliers] DOM contract mismatch: missing required element #${id}`);
  return el;
}

function validateSuppliersPageDom() {
  const missing = SUPPLIERS_REQUIRED_DOM_IDS.filter((id) => !getOptionalElement(id));
  if (missing.length > 0) {
    throw new Error(`[suppliers] DOM contract mismatch. Missing: ${missing.map((id) => `#${id}`).join(", ")}`);
  }
  suppliersDom = Object.fromEntries(
    SUPPLIERS_REQUIRED_DOM_IDS.map((id) => [id, getRequiredElement(id)])
  );
  return suppliersDom;
}

function getSuppliersDom() {
  return suppliersDom || validateSuppliersPageDom();
}

function itemNameZh(item)    { return item.nameZh || item.name_zh || ""; }
function itemNameEn(item)    { return item.nameEn || item.name_en || ""; }
function itemCostPrice(item) {
  return item.costPrice !== undefined ? item.costPrice : (item.cost_price || 0);
}
function itemIsActive(item) {
  if (item.isActive !== undefined) return item.isActive !== false;
  if (item.is_active !== undefined) return item.is_active !== false;
  return true;
}
function itemSupplierId(item) { return item.supplierId || item.supplier_id || ""; }

function resolveSupplierNameForItem(item) {
  const directName = item.supplierName || item.supplier_name || item.supplierDisplay || "";
  if (directName && directName !== "--" && directName !== "—") return directName;
  const supplierId = itemSupplierId(item);
  if (!supplierId) return EMPTY_TEXT;
  const supplier = state.suppliers.find((s) => String(s.id) === String(supplierId));
  return supplier ? supplier.name : EMPTY_TEXT;
}

function categoryLabel(code) {
  const cat = state.categories.find((c) => (c.code || c.id) === code);
  if (cat) return cat.nameZh || cat.name_zh || code;
  const text = window.AppUi.getLabel("supplierItemCategoryLabels", code);
  const icon = window.AppUi.getLabel("supplierItemCategoryIcons", code);
  return text !== code ? `${icon} ${text}` : code;
}

function setText(id, val) {
  const el = getOptionalElement(id);
  if (el) el.textContent = String(val);
}

// ── KPI 更新 ──────────────────────────────────────────────
function updateKPI() {
  const total        = state.suppliers.length;
  const activeSupCnt = state.suppliers.filter((s) => s.isActive !== false).length;
  const inactiveSupCnt = total - activeSupCnt;

  const totalItems       = state.items.length;
  const activeItemCnt    = state.items.filter((i) => itemIsActive(i)).length;
  const inactiveItemCnt  = totalItems - activeItemCnt;

  setText("kpi-supplier-count",  total);
  setText("kpi-sup-active",      activeSupCnt);
  setText("kpi-sup-inactive",    inactiveSupCnt);
  setText("supplier-panel-count", `共 ${total} 家`);

  setText("kpi-item-count",    totalItems);
  setText("kpi-item-active",   activeItemCnt);
  setText("kpi-item-inactive", inactiveItemCnt);

  const bestCount = state.bestPriceItems.length;
  setText("kpi-best-price-count", bestCount > 0 ? bestCount : EMPTY_TEXT);

  const times = state.items
    .map((i) => i.updated_at || i.updatedAt)
    .filter(Boolean)
    .sort();

  if (times.length > 0) {
    const latest     = new Date(times[times.length - 1]);
    const latestItem = state.items.find((i) =>
      (i.updated_at || i.updatedAt) === times[times.length - 1]
    );
    setText("kpi-last-update", latest.toLocaleDateString("zh-CN"));
    if (latestItem) {
      const sup = state.suppliers.find((s) => s.id === itemSupplierId(latestItem));
      setText("kpi-last-update-source", sup ? `来源：${sup.name}` : "根据物料更新时间自动显示");
    }
  } else {
    setText("kpi-last-update",        EMPTY_TEXT);
    setText("kpi-last-update-source", "根据物料更新时间自动显示");
  }
}

// ── 供应商列表渲染 ──────────────────────────────────────────
function renderSupplierList() {
  const container  = getRequiredElement("supplier-list");
  const sideSearch = (getRequiredElement("supplier-search").value || "").trim().toLowerCase();
  const global     = state.filters.global.toLowerCase();

  const list = state.suppliers.filter((sup) => {
    const haystack = [sup.name, sup.contact, sup.phone, sup.email]
      .filter(Boolean).join(" ").toLowerCase();
    if (sideSearch && !haystack.includes(sideSearch)) return false;
    if (global    && !haystack.includes(global))      return false;
    return true;
  });

  if (list.length === 0) {
    container.innerHTML = `<div class="s-empty">暂无匹配供应商</div>`;
    return;
  }

  container.innerHTML = list.map((sup) => {
    const isActive   = sup.isActive !== false;
    const itemCount  = state.items.filter((i) => itemSupplierId(i) === sup.id).length;
    const isSelected = sup.id === state.selectedSupplierId;
    const typeKey    = sup.supplierType || sup.supplier_type || "";
    const badge      = SUP_TYPE_BADGE[typeKey];
    const badgeHtml  = badge
      ? `<span class="s-type-badge sb-${typeKey}">${badge.label}</span>`
      : (typeKey ? `<span class="s-type-badge sb-other">${typeKey}</span>` : "");

    return `
      <div class="s-sup-card${isSelected ? " active" : ""}${!isActive ? " inactive" : ""}"
           data-select-supplier="${sup.id}">
        <div class="s-sup-card-head">
          <span class="s-sup-name">${sup.name}</span>
          ${badgeHtml}
        </div>
        <div class="s-sup-meta">
          <div class="s-sup-meta-row">
            <span>${sup.contact ? "联系人：" + sup.contact : ""}</span>
            <span class="s-status-dot ${isActive ? "on" : "off"}">${isActive ? "启用" : "停用"}</span>
          </div>
          ${sup.phone ? `<span class="sup-sup-phone">${sup.phone}</span>` : ""}
          <div class="s-sup-meta-row">
            <span class="sup-sup-email">${sup.email || ""}</span>
            <span>物料 ${itemCount} 项</span>
          </div>
        </div>
        ${window.can("supplier.edit") || window.can("supplier.delete") ? `
        <div class="sup-list-actions">
          ${window.can("supplier.edit")   ? `<button class="s-act"        style="font-size:11px;" data-edit-supplier="${sup.id}">编辑</button>` : ""}
          ${window.can("supplier.delete") ? `<button class="s-act danger" style="font-size:11px;" data-delete-supplier="${sup.id}" data-name="${sup.name}">删除</button>` : ""}
        </div>` : ""}
      </div>`;
  }).join("");
}

// ── 筛选后物料列表 ─────────────────────────────────────────
function getFilteredItems() {
  let items = state.filters.bestPriceOnly ? state.bestPriceItems : state.items;
  const { global, category } = state.filters;

  if (state.selectedSupplierId) {
    items = items.filter((i) => itemSupplierId(i) === state.selectedSupplierId);
  }
  if (category) {
    items = items.filter((i) => i.category === category);
  }
  if (global) {
    const q = global.toLowerCase();
    items = items.filter((i) =>
      itemNameZh(i).toLowerCase().includes(q) ||
      itemNameEn(i).toLowerCase().includes(q) ||
      (i.spec || "").toLowerCase().includes(q) ||
      (i.supplierName || i.supplier_name || "").toLowerCase().includes(q)
    );
  }
  return items;
}

// ── 价格库表格渲染 ─────────────────────────────────────────
function renderItemTable() {
  const dom = getSuppliersDom();
  const tbody = dom["item-table-body"];
  const emptyEl = dom["item-empty"];
  const titleEl = dom["items-table-title"];
  const subtitleEl = dom["items-table-subtitle"];
  const items = getFilteredItems();
  const pageDetail = paginateRows(items, state.pagination.items);

  if (state.selectedSupplierId) {
    const sup = state.suppliers.find((s) => s.id === state.selectedSupplierId);
    titleEl.textContent = sup ? `\u4ef7\u683c\u5e93\uff08\u4f9b\u5e94\u5546\uff1a${sup.name}\uff09` : "\u4ef7\u683c\u5e93";
  } else {
    titleEl.textContent = "\u4ef7\u683c\u5e93";
  }
  subtitleEl.textContent = `\u5171 ${items.length} \u6761`;

  renderPaginationControls({
    prevId: "page-prev",
    nextId: "page-next",
    infoId: "page-info",
    sizeId: "page-size-sel",
    pagination: state.pagination.items,
  }, pageDetail);

  if (items.length === 0) {
    tbody.innerHTML = "";
    emptyEl.style.display = "";
    return;
  }
  emptyEl.style.display = "none";

  tbody.innerHTML = pageDetail.rows.map((item) => {
    const active = itemIsActive(item);
    const price = itemCostPrice(item);
    const currency = item.currency || "EUR";
    const supName = resolveSupplierNameForItem(item);
    const priceStr = price > 0
      ? price.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : EMPTY_TEXT;

    return `
      <tr class="${!active ? "row-inactive" : ""}" data-item-id="${item.id}">
        <td class="sup-col-category"><span class="s-cat-pill">${categoryLabel(item.category)}</span></td>
        <td class="sup-col-item">
          <div class="sup-item-main">
            <div class="sup-item-name">${itemNameZh(item)}</div>
            ${itemNameEn(item) ? `<div class="sup-item-sub">${itemNameEn(item)}</div>` : ""}
            ${supName !== EMPTY_TEXT && !state.selectedSupplierId ? `<div class="sup-item-sub">${supName}</div>` : ""}
          </div>
        </td>
        <td class="sup-col-spec">${item.spec || EMPTY_TEXT}</td>
        <td class="sup-col-unit">${item.unit || EMPTY_TEXT}</td>
        <td class="sup-col-price s-price">${priceStr}</td>
        <td class="sup-col-currency">${currency}</td>
        <td class="sup-col-status"><span class="s-badge ${active ? "on" : "off"}">${active ? "\u542f\u7528" : "\u505c\u7528"}</span></td>
        <td class="sup-col-actions">
          <div class="s-row-actions">
            ${window.can("supplier.edit") ? `<button class="s-act" data-edit-item="${item.id}">\u7f16\u8f91</button>` : ""}
            ${window.can("supplier.edit") && active  ? `<span class="s-act-sep">|</span><button class="s-act danger"  data-toggle-item="${item.id}" data-current-active="true">\u505c\u7528</button>`  : ""}
            ${window.can("supplier.edit") && !active ? `<span class="s-act-sep">|</span><button class="s-act ok" data-toggle-item="${item.id}" data-current-active="false">\u542f\u7528</button>` : ""}
            ${window.can("supplier.delete") ? `<span class="s-act-sep">|</span><button class="s-act danger" data-delete-item="${item.id}" data-name="${itemNameZh(item)}">\u5220\u9664</button>` : ""}
          </div>
        </td>
      </tr>`;
  }).join("");
}

function renderBestPriceTable() {
  const dom = getSuppliersDom();
  const tableEl = dom["best-price-table"];
  const tbody = dom["best-price-body"];
  const emptyEl = dom["best-price-empty"];
  const items = state.bestPriceItems;
  const pageDetail = paginateRows(items, state.pagination.bestPrice);

  renderPaginationControls({
    prevId: "best-price-page-prev",
    nextId: "best-price-page-next",
    infoId: "best-price-page-info",
    sizeId: "best-price-page-size",
    pagination: state.pagination.bestPrice,
  }, pageDetail);

  if (items.length === 0) {
    tableEl.style.display = "none";
    emptyEl.style.display = "";
    emptyEl.textContent = "\u70b9\u51fb\u300c\u67e5\u770b\u6bd4\u4ef7\u300d\u53ef\u5bf9\u6bd4\u591a\u4e2a\u4f9b\u5e94\u5546\u7684\u62a5\u4ef7";
    tbody.innerHTML = "";
    return;
  }

  tableEl.style.display = "";
  emptyEl.style.display = "none";

  tbody.innerHTML = pageDetail.rows.map((item) => {
    const price = itemCostPrice(item);
    const currency = item.currency || "EUR";
    const supName = resolveSupplierNameForItem(item);
    const priceStr = price > 0
      ? price.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : EMPTY_TEXT;
    const isLowest = item.isLowest || item.is_lowest || false;

    return `
      <tr>
        <td class="sup-col-supplier">${supName}</td>
        <td class="sup-col-spec">${item.spec || EMPTY_TEXT}</td>
        <td class="sup-col-unit">${item.unit || EMPTY_TEXT}</td>
        <td class="sup-col-price s-price">\u00A5${priceStr}</td>
        <td class="sup-col-currency">${currency}</td>
        <td class="sup-col-total s-price">${EMPTY_TEXT}</td>
        <td class="sup-col-status">${isLowest ? `<span class="s-badge lowest">\u6700\u4f4e\u4ef7</span>` : ""}</td>
        <td class="sup-col-actions"><button class="s-act ok" data-select-compare-item="${item.id}">\u9009\u7528</button></td>
      </tr>`;
  }).join("");
}

function showCatMessage(text, type) {
  const el = getRequiredElement("cat-message");
  el.textContent = text;
  el.className = `message-box sup-modal-message ${type === "error" ? "error" : "success"}`;
}

function hideCatMessage() {
  const el = getRequiredElement("cat-message");
  el.className = "message-box hidden sup-modal-message";
}

function renderCategoryManagementList() {
  const listEl        = getRequiredElement("categories-list");
  const summaryEl     = getRequiredElement("cat-dialog-summary");
  const listSummaryEl = getRequiredElement("cat-list-summary");
  const total = state.categories.length;

  summaryEl.textContent     = total > 0 ? `共 ${total} 个分类` : "暂无分类";
  listSummaryEl.textContent = total > 0
    ? `已建 ${total} 个分类，可在下方继续新增或编辑。`
    : "还没有分类，可以从右上角新建分类开始。";

  if (total === 0) {
    listEl.innerHTML = `<div class="s-empty">暂无可管理的物料分类</div>`;
    return;
  }

  listEl.innerHTML = state.categories.map((c) => {
    const code            = c.code || "";
    const label           = c.nameZh || c.name_zh || code;
    const sortOrder       = c.sortOrder || c.sort_order || 0;
    const icon            = window.AppUi.getLabel("supplierItemCategoryIcons", code) || "📦";
    const catId           = String(c.id);
    const linkedItemCount = state.items.filter((item) => item.category === code).length;
    return `
      <div class="cat-row">
        <div class="cat-row-left">
          <span class="cat-row-icon">${icon}</span>
          <div>
            <div class="cat-row-title">${label}</div>
            <div class="cat-row-code">${code} · 排序 ${sortOrder} · ${linkedItemCount} 项物料</div>
          </div>
        </div>
        <div class="cat-row-actions">
          <button class="s-btn s-btn-sm" data-edit-cat="${catId}">编辑</button>
          <button class="s-btn s-btn-sm" style="color:var(--s-danger);border-color:var(--s-danger-bd);" data-delete-cat="${catId}" data-cat-name="${label}">删除</button>
        </div>
      </div>`;
  }).join("");
}

function openCatForm(cat) {
  const section   = getRequiredElement("cat-form-section");
  const form      = getRequiredElement("cat-form");
  const titleEl   = getRequiredElement("cat-form-title");
  const captionEl = getRequiredElement("cat-form-caption");
  const codeInput = getRequiredElement("cat-code-input");
  const codeHint  = getRequiredElement("cat-code-hint");
  const isEdit    = !!cat;

  form.id.value        = isEdit ? String(cat.id) : "";
  form.nameZh.value    = isEdit ? (cat.nameZh || cat.name_zh || "") : "";
  form.code.value      = isEdit ? (cat.code || "") : "";
  form.sortOrder.value = isEdit ? (cat.sortOrder || cat.sort_order || 0) : "";

  codeInput.readOnly     = isEdit;
  codeInput.style.background = isEdit ? "#f3f4f6" : "";
  codeInput.style.color      = isEdit ? "#6b7280" : "";
  codeHint.style.display     = isEdit ? "" : "none";

  titleEl.textContent   = isEdit ? `编辑分类 · ${cat.nameZh || cat.name_zh || cat.code}` : "新建分类";
  captionEl.textContent = isEdit
    ? "调整分类名称、排序与代码展示方式。"
    : "创建新的物料分类，让供应商价格库维护更有秩序。";

  section.style.display = "block";
  section.classList.add("is-open");
  form.nameZh.focus();
}

function closeCatForm() {
  const section = getRequiredElement("cat-form-section");
  section.style.display = "none";
  section.classList.remove("is-open");
}

async function reloadCategories() {
  await loadCategories();
  buildCategorySelects();
  renderCategoryManagementList();
}

function openDialog(id)  { getRequiredElement(id).showModal(); }
function closeDialog(id) { getRequiredElement(id).close(); }

function openSupplierForm(supplier) {
  const form = getRequiredElement("supplier-form");
  form.id.value               = supplier ? supplier.id : "";
  form.name.value             = supplier ? supplier.name : "";
  form.contact.value          = supplier ? (supplier.contact || "") : "";
  form.phone.value            = supplier ? (supplier.phone || "") : "";
  form.email.value            = supplier ? (supplier.email || "") : "";
  form.notes.value            = supplier ? (supplier.notes || "") : "";
  form.isActiveSupplier.checked = supplier ? (supplier.isActive !== false) : true;
  // supplierType 字段（新增）
  if (form.supplierType) {
    form.supplierType.value = supplier ? (supplier.supplierType || supplier.supplier_type || "") : "";
  }
  getRequiredElement("dlg-supplier-title").textContent =
    supplier ? `编辑供应商 · ${supplier.name}` : "新增供应商";
  openDialog("dlg-supplier");
}

function buildItemSupplierSelect(selectedId) {
  const sel       = getRequiredElement("item-supplier-select");
  const currentId = selectedId || state.selectedSupplierId || "";
  sel.innerHTML   = state.suppliers
    .map((s) => `<option value="${s.id}"${s.id === currentId ? " selected" : ""}>${s.name}</option>`)
    .join("");
}

function openItemForm(item) {
  buildItemSupplierSelect(item ? itemSupplierId(item) : null);
  const form       = getRequiredElement("item-form");
  form.id.value    = item ? item.id : "";
  const supplierId = item ? itemSupplierId(item) : (state.selectedSupplierId || "");
  if (supplierId) form.supplierIdSel.value = supplierId;
  form.category.value  = item ? item.category : (state.categories[0]?.code || state.categories[0]?.id || "");
  form.nameZh.value    = item ? itemNameZh(item) : "";
  form.nameEn.value    = item ? itemNameEn(item) : "";
  form.spec.value      = item ? (item.spec || "") : "";
  form.unit.value      = item ? (item.unit || "") : "";
  form.costPrice.value = item && itemCostPrice(item) > 0 ? itemCostPrice(item) : "";
  form.notes.value     = item ? (item.notes || "") : "";
  form.isActive.checked = item ? itemIsActive(item) : true;
  if (form.currency) form.currency.value = item ? (item.currency || "EUR") : "EUR";
  getRequiredElement("dlg-item-title").textContent =
    item ? `编辑物料 · ${itemNameZh(item)}` : "新增物料价格";
  openDialog("dlg-item");
}

async function loadCategories() {
  try {
    const cats = await window.AppUtils.fetchJson("/api/supplier-categories", null, "分类加载失败");
    if (Array.isArray(cats) && cats.length > 0) { state.categories = cats; return; }
  } catch (_) {}
  state.categories = FALLBACK_CATEGORIES;
}

function buildCategorySelects() {
  const opts = state.categories.map((c) => {
    const code  = c.code || c.id;
    const label = c.nameZh || c.name_zh || code;
    return `<option value="${code}">${label}</option>`;
  }).join("");
  getRequiredElement("filter-category").innerHTML = `<option value="">全部类别</option>${opts}`;
  getRequiredElement("item-category-select").innerHTML = opts;
}

async function loadSuppliers() {
  const result = await window.AppUtils.fetchJson("/api/suppliers", null, "供应商列表加载失败");
  state.suppliers = Array.isArray(result) ? result : [];
}

async function loadItems() {
  const params = new URLSearchParams();
  params.set("status", state.filters.status || "all");
  if (state.selectedSupplierId) params.set("supplier_id", state.selectedSupplierId);
  const items = await window.AppUtils.fetchJson(
    `/api/supplier-items?${params.toString()}`, null, "物料列表加载失败"
  );
  state.items = Array.isArray(items) ? items : [];
  buildCompareItemSelect();
}

async function loadBestPriceItems() {
  try {
    const items = await window.AppUtils.fetchJson("/api/supplier-items/best-price", null, "最低价加载失败");
    state.bestPriceItems = Array.isArray(items) ? items : [];
  } catch (_) { state.bestPriceItems = []; }
}

async function reloadAll() {
  await Promise.all([loadSuppliers(), loadItems()]);
  renderSupplierList();
  renderItemTable();
  updateKPI();
}

async function reloadItems() {
  await loadItems();
  renderItemTable();
  renderSupplierList();
  updateKPI();
}

// ── 填充顶部筛选栏供应商下拉 ──────────────────────────────
function buildSupplierBarSelect() {
  const sel = getOptionalElement("filter-supplier-bar");
  if (!sel) return;
  sel.innerHTML = `<option value="">供应商：全部</option>` +
    state.suppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
}

function buildCompareItemSelect() {
  const sel = getOptionalElement("compare-item-sel");
  if (!sel) return;
  const currentValue = sel.value || "";
  const names = [...new Set(state.items.map((item) => itemNameZh(item)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
  sel.innerHTML = `<option value="">-- 请选择物料 --</option>` +
    names.map((name) => `<option value="${name}"${name === currentValue ? " selected" : ""}>${name}</option>`).join("");
}

// ── Bootstrap ─────────────────────────────────────────────
async function bootstrap() {
  validateSuppliersPageDom();
  window.AppUtils.applyFlash("sup-message");
  await loadCategories();
  buildCategorySelects();

  window.AppUtils.setChineseValidity(getRequiredElement("supplier-form"));
  window.AppUtils.setChineseValidity(getRequiredElement("item-form"));

  await reloadAll();
  buildSupplierBarSelect();

  if (state.suppliers.length > 0) {
    state.selectedSupplierId = state.suppliers[0].id;
    await loadItems();
    renderSupplierList();
    renderItemTable();
    updateKPI();
  }

  await loadBestPriceItems();
  renderBestPriceTable();

  function on(id, event, handler) {
    const el = getOptionalElement(id);
    if (el) el.addEventListener(event, handler);
  }

  // 筛选栏事件
  on("global-search", "input", (e) => {
    state.filters.global = e.target.value.trim();
    resetPagination("items");
    renderSupplierList();
    renderItemTable();
  });

  on("filter-supplier-bar", "change", async (e) => {
    state.selectedSupplierId = e.target.value || null;
    resetPagination("items");
    renderSupplierList();
    await loadItems();
    renderItemTable();
    updateKPI();
  });

  on("filter-category", "change", (e) => {
    state.filters.category = e.target.value;
    resetPagination("items");
    renderItemTable();
  });

  on("filter-status", "change", async (e) => {
    state.filters.status = e.target.value;
    resetPagination("items");
    await loadItems();
    renderItemTable();
    updateKPI();
  });

  on("toggle-best-price", "change", (e) => {
    state.filters.bestPriceOnly = e.target.checked;
    resetPagination("items");
    renderItemTable();
  });

  on("supplier-search", "input", () => renderSupplierList());

  on("page-prev", "click", () => {
    state.pagination.items.page = Math.max(1, state.pagination.items.page - 1);
    renderItemTable();
  });

  on("page-next", "click", () => {
    state.pagination.items.page += 1;
    renderItemTable();
  });

  on("page-size-sel", "change", (e) => {
    setPaginationPageSize("items", Number(e.target.value) || DEFAULT_PAGE_SIZE);
    renderItemTable();
  });

  on("best-price-page-prev", "click", () => {
    state.pagination.bestPrice.page = Math.max(1, state.pagination.bestPrice.page - 1);
    renderBestPriceTable();
  });

  on("best-price-page-next", "click", () => {
    state.pagination.bestPrice.page += 1;
    renderBestPriceTable();
  });

  on("best-price-page-size", "change", (e) => {
    setPaginationPageSize("bestPrice", Number(e.target.value) || DEFAULT_PAGE_SIZE);
    renderBestPriceTable();
  });

  // 比价按钮
  on("btn-compare", "click", async () => {
    resetPagination("bestPrice");
    const itemSel  = getOptionalElement("compare-item-sel");
    const dateFrom = getOptionalElement("compare-date-from");
    const dateTo   = getOptionalElement("compare-date-to");
    if (!itemSel?.value) return;
    const params = new URLSearchParams({ item_name: itemSel.value });
    if (dateFrom?.value) params.set("date_from", dateFrom.value);
    if (dateTo?.value)   params.set("date_to", dateTo.value);
    try {
      const items = await window.AppUtils.fetchJson(
        `/api/supplier-items/compare?${params.toString()}`, null, "比价加载失败"
      );
      state.bestPriceItems = Array.isArray(items) ? items : [];
    } catch (_) { state.bestPriceItems = []; }
    renderBestPriceTable();
  });

  on("btn-refresh-best-price", "click", async () => {
    const emptyEl = getRequiredElement("best-price-empty");
    const tableEl = getRequiredElement("best-price-table");
    resetPagination("bestPrice");
    emptyEl.textContent   = "加载中…";
    emptyEl.style.display = "";
    tableEl.style.display = "none";
    await loadBestPriceItems();
    renderBestPriceTable();
    updateKPI();
  });

  // 顶部按钮
  on("btn-new-supplier", "click", () => {
    if (!window.can("supplier.create")) return;
    openSupplierForm(null);
  });

  on("btn-new-item", "click", () => {
    if (!window.can("supplier.create")) return;
    openItemForm(null);
  });

  on("btn-view-all-items", "click", async () => {
    state.selectedSupplierId = null;
    resetPagination("items");
    const sel = getOptionalElement("filter-supplier-bar");
    if (sel) sel.value = "";
    renderSupplierList();
    await loadItems();
    renderItemTable();
    updateKPI();
  });

  on("btn-manage-categories", "click", () => {
    hideCatMessage();
    closeCatForm();
    renderCategoryManagementList();
    openDialog("dlg-categories");
  });

  on("btn-new-category",    "click", () => { hideCatMessage(); openCatForm(null); });
  on("btn-cancel-cat-form", "click", () => { closeCatForm(); hideCatMessage(); });

  on("btn-batch-import", "click", () => {
    window.AppUtils.showMessage("sup-message",
      "批量导入功能正在开发中，请使用 scripts/import-supplier-catalog.js 脚本导入。", "success");
  });

  // 对话框关闭
  document.body.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("[data-close-dlg]");
    if (closeBtn) closeDialog(closeBtn.dataset.closeDlg);
  });

  // 保存供应商
  on("btn-save-supplier", "click", async () => {
    const form = getRequiredElement("supplier-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const id = form.id.value.trim();
    const payload = {
      name:         form.name.value.trim(),
      contact:      form.contact.value.trim(),
      phone:        form.phone.value.trim(),
      email:        form.email.value.trim(),
      notes:        form.notes.value.trim(),
      isActive:     form.isActiveSupplier.checked,
      supplierType: form.supplierType ? form.supplierType.value : "",
    };
    try {
      const url    = id ? `/api/suppliers/${encodeURIComponent(id)}` : "/api/suppliers";
      const method = id ? "PUT" : "POST";
      const saved  = await window.AppUtils.fetchJson(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }, "保存供应商失败");
      closeDialog("dlg-supplier");
      window.AppUtils.showMessage("sup-message", id ? "供应商已更新。" : "供应商已创建。", "success");
      state.selectedSupplierId = saved.id;
      await reloadAll();
      buildSupplierBarSelect();
    } catch (err) {
      window.AppUtils.showMessage("sup-message", err.message, "error");
    }
  });

  // 保存物料
  on("btn-save-item", "click", async () => {
    const form = getRequiredElement("item-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const id         = form.id.value.trim();
    const supplierId = form.supplierIdSel.value;
    if (!supplierId) {
      window.AppUtils.showMessage("sup-message", "请先选择供应商。", "error"); return;
    }
    const payload = {
      supplierId,
      category:  form.category.value,
      nameZh:    form.nameZh.value.trim(),
      nameEn:    form.nameEn.value.trim(),
      spec:      form.spec.value.trim(),
      unit:      form.unit.value.trim(),
      costPrice: Number(form.costPrice.value || 0),
      currency:  form.currency ? form.currency.value : "EUR",
      notes:     form.notes.value.trim(),
      isActive:  form.isActive.checked,
    };
    try {
      const url    = id ? `/api/supplier-items/${encodeURIComponent(id)}` : "/api/supplier-items";
      const method = id ? "PUT" : "POST";
      await window.AppUtils.fetchJson(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }, "保存物料失败");
      closeDialog("dlg-item");
      window.AppUtils.showMessage("sup-message", id ? "物料已更新。" : "物料已添加。", "success");
      await reloadItems();
    } catch (err) {
      window.AppUtils.showMessage("sup-message", err.message, "error");
    }
  });

  // 保存分类
  on("btn-save-category", "click", async () => {
    const form = getRequiredElement("cat-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const id     = form.id.value.trim();
    const isEdit = !!id;
    const payload = { nameZh: form.nameZh.value.trim(), sortOrder: Number(form.sortOrder.value || 0) };
    if (!isEdit) payload.code = form.code.value.trim();
    try {
      const url    = isEdit ? `/api/supplier-categories/${encodeURIComponent(id)}` : "/api/supplier-categories";
      const method = isEdit ? "PUT" : "POST";
      await window.AppUtils.fetchJson(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }, isEdit ? "编辑分类失败" : "新建分类失败");
      closeCatForm();
      showCatMessage(isEdit ? "分类已更新。" : "分类已创建。", "success");
      await reloadCategories();
    } catch (err) { showCatMessage(err.message, "error"); }
  });

  // 事件委托：供应商卡片点击 / 物料行操作
  document.body.addEventListener("click", async (e) => {
    // 供应商卡片选中
    const supCard = e.target.closest("[data-select-supplier]");
    if (supCard && !e.target.closest("button")) {
      state.selectedSupplierId = supCard.dataset.selectSupplier;
      resetPagination("items");
      const sel = getOptionalElement("filter-supplier-bar");
      if (sel) sel.value = state.selectedSupplierId;
      await loadItems();
      renderSupplierList();
      renderItemTable();
      return;
    }

    // 编辑供应商
    const editSupId = e.target.getAttribute("data-edit-supplier");
    if (editSupId) {
      const sup = state.suppliers.find((s) => s.id === editSupId);
      if (sup) openSupplierForm(sup);
      return;
    }

    // 删除供应商
    const delSupId = e.target.getAttribute("data-delete-supplier");
    if (delSupId) {
      const name = e.target.getAttribute("data-name") || "该供应商";
      if (!window.confirm(`确定删除供应商「${name}」及其所有物料吗？此操作不可恢复。`)) return;
      try {
        await window.AppUtils.fetchJson(`/api/suppliers/${encodeURIComponent(delSupId)}`,
          { method: "DELETE" }, "删除供应商失败");
        window.AppUtils.showMessage("sup-message", "供应商已删除。", "success");
        if (state.selectedSupplierId === delSupId) state.selectedSupplierId = null;
        await reloadAll();
        buildSupplierBarSelect();
      } catch (err) { window.AppUtils.showMessage("sup-message", err.message, "error"); }
      return;
    }

    // 编辑物料
    const editItemId = e.target.getAttribute("data-edit-item");
    if (editItemId) {
      const item = state.items.find((i) => String(i.id) === String(editItemId))
        || state.bestPriceItems.find((i) => String(i.id) === String(editItemId));
      if (item) openItemForm(item);
      return;
    }

    // 切换物料状态
    const toggleItemId = e.target.getAttribute("data-toggle-item");
    if (toggleItemId) {
      const currentActive = e.target.getAttribute("data-current-active") === "true";
      const item = state.items.find((i) => String(i.id) === String(toggleItemId));
      if (!item) return;
      const payload = {
        supplierId: itemSupplierId(item), category: item.category,
        nameZh: itemNameZh(item), nameEn: itemNameEn(item),
        spec: item.spec || "", unit: item.unit,
        costPrice: itemCostPrice(item), notes: item.notes || "",
        isActive: !currentActive,
      };
      try {
        await window.AppUtils.fetchJson(`/api/supplier-items/${encodeURIComponent(toggleItemId)}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        }, "状态更新失败");
        await reloadItems();
      } catch (err) { window.AppUtils.showMessage("sup-message", err.message, "error"); }
      return;
    }

    // 删除物料
    const delItemId = e.target.getAttribute("data-delete-item");
    if (delItemId) {
      const name = e.target.getAttribute("data-name") || "该物料";
      if (!window.confirm(`确定删除物料「${name}」吗？`)) return;
      try {
        await window.AppUtils.fetchJson(`/api/supplier-items/${encodeURIComponent(delItemId)}`,
          { method: "DELETE" }, "删除物料失败");
        window.AppUtils.showMessage("sup-message", "物料已删除。", "success");
        await reloadItems();
      } catch (err) { window.AppUtils.showMessage("sup-message", err.message, "error"); }
      return;
    }

    // 编辑分类
    const editCatId = e.target.getAttribute("data-edit-cat");
    if (editCatId) {
      hideCatMessage();
      const cat = state.categories.find((c) => String(c.id) === editCatId);
      if (cat) openCatForm(cat);
      return;
    }

    // 删除分类
    const deleteCatId = e.target.getAttribute("data-delete-cat");
    if (deleteCatId) {
      const name = e.target.getAttribute("data-cat-name") || "该分类";
      if (!window.confirm(`确定删除分类「${name}」吗？\n\n注意：已关联物料的 category 字段不会自动更改。`)) return;
      try {
        const result = await window.AppUtils.fetchJson(
          `/api/supplier-categories/${encodeURIComponent(deleteCatId)}`, { method: "DELETE" }, "删除分类失败");
        showCatMessage(result.message || "分类已删除。", "success");
        await reloadCategories();
      } catch (err) { showCatMessage(err.message, "error"); }
    }
  });
}

bootstrap().catch((err) => {
  console.error("[suppliers] bootstrap error:", err);
  const msgEl = getOptionalElement("sup-message");
  if (msgEl) {
    msgEl.textContent = `页面加载失败：${err.message}`;
    msgEl.className = "message-box error";
  }
});

document.addEventListener("authReady", () => {
  if (!window.can("supplier.create")) {
    ["btn-new-supplier", "btn-new-item"].forEach((id) => {
      const btn = getOptionalElement(id);
      if (btn) btn.style.display = "none";
    });
  }
  renderSupplierList();
  renderItemTable();
});
