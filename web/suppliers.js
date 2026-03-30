const FALLBACK_CATEGORIES = [
  { code: "av_equipment", nameZh: "音视频设备" },
  { code: "stage_structure", nameZh: "舞台结构" },
  { code: "print_display", nameZh: "印刷展示" },
  { code: "decoration", nameZh: "装饰物料" },
  { code: "furniture", nameZh: "家具桌椅" },
  { code: "personnel", nameZh: "人员服务" },
  { code: "logistics", nameZh: "物流设备" },
  { code: "management", nameZh: "管理服务" },
];

const EMPTY_TEXT = "--";

const SUPPLIERS_REQUIRED_DOM_IDS = [
  "sup-message",
  "global-search",
  "filter-category",
  "filter-status",
  "toggle-best-price",
  "btn-manage-categories",
  "btn-batch-import",
  "btn-new-supplier",
  "btn-new-item",
  "kpi-supplier-count",
  "kpi-item-count",
  "kpi-best-price-count",
  "kpi-last-update",
  "supplier-list",
  "supplier-search",
  "btn-show-all-suppliers",
  "items-table-title",
  "items-table-subtitle",
  "item-table-body",
  "item-empty",
  "best-price-meta",
  "best-price-table",
  "best-price-body",
  "best-price-empty",
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

let suppliersDom = null;

const state = {
  suppliers: [],
  items: [],
  bestPriceItems: [],
  categories: [],
  selectedSupplierId: null,
  filters: {
    global: "",
    category: "",
    status: "",
    bestPriceOnly: false,
  },
};

function t(text) {
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function getOptionalElement(id) {
  return document.getElementById(id);
}

function getRequiredElement(id) {
  const el = getOptionalElement(id);
  if (!el) {
    throw new Error(`[suppliers] DOM contract mismatch: missing required element #${id}`);
  }
  return el;
}

function validateSuppliersPageDom() {
  const missing = SUPPLIERS_REQUIRED_DOM_IDS.filter((id) => !getOptionalElement(id));
  if (missing.length > 0) {
    throw new Error(`[suppliers] DOM contract mismatch. Missing required ids: ${missing.map((id) => `#${id}`).join(", ")}`);
  }
  suppliersDom = Object.fromEntries(
    SUPPLIERS_REQUIRED_DOM_IDS.map((id) => [id, getRequiredElement(id)])
  );
  return suppliersDom;
}

function getSuppliersDom() {
  return suppliersDom || validateSuppliersPageDom();
}

function itemNameZh(item) { return item.nameZh || item.name_zh || ""; }
function itemNameEn(item) { return item.nameEn || item.name_en || ""; }
function itemCostPrice(item) {
  return item.costPrice !== undefined ? item.costPrice : (item.cost_price || 0);
}
function itemIsActive(item) {
  if (item.isActive !== undefined) return item.isActive !== false;
  if (item.is_active !== undefined) return item.is_active !== false;
  return true;
}
function itemSupplierId(item) { return item.supplierId || item.supplier_id || ""; }

function categoryLabel(code) {
  const cat = state.categories.find((c) => (c.code || c.id) === code);
  if (cat) return cat.nameZh || cat.name_zh || code;
  const text = window.AppUi.getLabel("supplierItemCategoryLabels", code);
  const icon = window.AppUi.getLabel("supplierItemCategoryIcons", code);
  return text !== code ? `${icon} ${text}` : code;
}

function updateKPI() {
  const activeCount = state.suppliers.filter((s) => s.isActive !== false).length;
  const setText = (id, val) => {
    getRequiredElement(id).textContent = String(val);
  };

  setText("kpi-supplier-count", `${activeCount} / ${state.suppliers.length}`);
  setText("kpi-item-count", state.items.length);
  setText("kpi-best-price-count", state.bestPriceItems.length > 0 ? state.bestPriceItems.length : EMPTY_TEXT);

  const times = state.items
    .map((i) => i.updated_at || i.updatedAt)
    .filter(Boolean)
    .sort();

  setText(
    "kpi-last-update",
    times.length > 0 ? new Date(times[times.length - 1]).toLocaleDateString("zh-CN") : EMPTY_TEXT
  );
}

function renderSupplierList() {
  const dom = getSuppliersDom();
  const container = dom["supplier-list"];
  const allBtn = dom["btn-show-all-suppliers"];
  const sideSearch = (dom["supplier-search"].value || "").trim().toLowerCase();
  const global = state.filters.global.toLowerCase();

  allBtn.className = "sup-sidebar-all-btn" + (state.selectedSupplierId === null ? " active" : "");

  const list = state.suppliers.filter((sup) => {
    const haystack = [sup.name, sup.contact, sup.phone, sup.email].filter(Boolean).join(" ").toLowerCase();
    if (sideSearch && !haystack.includes(sideSearch)) return false;
    if (global && !haystack.includes(global)) return false;
    return true;
  });

  if (list.length === 0) {
    container.innerHTML = `<div class="sup-empty-state">暂无匹配供应商</div>`;
    return;
  }

  container.innerHTML = list.map((sup) => {
    const isActive = sup.isActive !== false;
    const itemCount = state.items.filter((i) => itemSupplierId(i) === sup.id).length;
    const isSelected = sup.id === state.selectedSupplierId;
    const contact = [sup.contact, sup.phone, sup.email].filter(Boolean).join(" / ") || "暂无联系方式";
    return `
      <div class="sup-supplier-card${isSelected ? " active" : ""}${!isActive ? " inactive" : ""}" data-select-supplier="${sup.id}">
        <div class="sup-card-head">
          <div class="sup-card-title-wrap">
            <div class="sup-card-name">${sup.name}</div>
            <span class="sup-status-tag ${isActive ? "is-active" : "is-inactive"}">${isActive ? "启用" : "停用"}</span>
          </div>
          <span class="sup-card-count">${itemCount} 项</span>
        </div>
        <div class="sup-card-meta">${contact}</div>
        <div class="sup-card-foot">
          <span class="sup-card-hint">${isActive ? "支持快速选库与价格维护" : "当前供应商已停用"}</span>
          <div class="sup-card-actions">
            ${window.can("supplier.edit") ? `<button class="sup-inline-action" data-edit-supplier="${sup.id}">编辑</button>` : ""}
            ${window.can("supplier.delete") ? `<button class="sup-inline-action is-danger" data-delete-supplier="${sup.id}" data-name="${sup.name}">删除</button>` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

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
      itemNameZh(i).toLowerCase().includes(q)
      || itemNameEn(i).toLowerCase().includes(q)
      || (i.spec || "").toLowerCase().includes(q)
      || (i.supplierName || i.supplier_name || "").toLowerCase().includes(q)
    );
  }

  return items;
}

function renderItemTable() {
  const dom = getSuppliersDom();
  const tbody = dom["item-table-body"];
  const emptyEl = dom["item-empty"];
  const titleEl = dom["items-table-title"];
  const subtitleEl = dom["items-table-subtitle"];

  if (state.selectedSupplierId) {
    const sup = state.suppliers.find((s) => s.id === state.selectedSupplierId);
    titleEl.textContent = sup ? sup.name : "价格库";
    subtitleEl.textContent = state.filters.bestPriceOnly
      ? "当前视图仅显示最低成本条目"
      : "当前供应商的物料与服务条目";
  } else {
    titleEl.textContent = "价格库";
    subtitleEl.textContent = state.filters.bestPriceOnly
      ? "当前视图仅显示全局最低成本条目"
      : "查看全部供应商的价格库与服务明细";
  }

  const items = getFilteredItems();
  if (items.length === 0) {
    tbody.innerHTML = "";
    emptyEl.style.display = "";
    return;
  }
  emptyEl.style.display = "none";

  tbody.innerHTML = items.map((item) => {
    const active = itemIsActive(item);
    const price = itemCostPrice(item);
    const supName = item.supplierName || item.supplier_name || "";
    return `
      <tr class="${!active ? "row-inactive" : ""}" data-item-id="${item.id}">
        <td><span class="sup-category-pill">${categoryLabel(item.category)}</span></td>
        <td>
          <div class="sup-item-main">
            <div class="sup-item-name">${itemNameZh(item)}</div>
            ${itemNameEn(item) ? `<div class="sup-item-sub">${itemNameEn(item)}</div>` : ""}
            ${supName && !state.selectedSupplierId ? `<div class="sup-item-sub">${supName}</div>` : ""}
          </div>
        </td>
        <td><div class="sup-item-spec" title="${item.spec || ""}">${item.spec || EMPTY_TEXT}</div></td>
        <td class="sup-col-unit">${item.unit || EMPTY_TEXT}</td>
        <td class="sup-col-price">${price > 0 ? window.AppUtils.formatCurrency(price, "EUR") : EMPTY_TEXT}</td>
        <td><span class="sup-status-pill ${active ? "is-active" : "is-inactive"}">${active ? "启用" : "停用"}</span></td>
        <td class="col-actions">
          <div class="sup-action-group">
            ${window.can("supplier.edit") ? `<button class="sup-inline-action" data-edit-item="${item.id}">编辑</button>` : ""}
            ${window.can("supplier.edit") && active ? `<button class="sup-inline-action" data-toggle-item="${item.id}" data-current-active="true">停用</button>` : ""}
            ${window.can("supplier.edit") && !active ? `<button class="sup-inline-action is-success" data-toggle-item="${item.id}" data-current-active="false">启用</button>` : ""}
            ${window.can("supplier.delete") ? `<button class="sup-inline-action is-danger" data-delete-item="${item.id}" data-name="${itemNameZh(item)}">删除</button>` : ""}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderBestPriceTable() {
  const dom = getSuppliersDom();
  const tableEl = dom["best-price-table"];
  const tbody = dom["best-price-body"];
  const emptyEl = dom["best-price-empty"];
  const metaEl = dom["best-price-meta"];
  const items = state.bestPriceItems;

  metaEl.textContent = items.length > 0 ? `共 ${items.length} 条最低成本记录` : "";

  if (items.length === 0) {
    tableEl.style.display = "none";
    emptyEl.style.display = "";
    emptyEl.textContent = "暂无可用的最低成本数据";
    tbody.innerHTML = "";
    return;
  }

  tableEl.style.display = "";
  emptyEl.style.display = "none";
  tbody.innerHTML = items.map((item) => {
    const price = itemCostPrice(item);
    const supName = item.supplierName || item.supplier_name || EMPTY_TEXT;
    return `
      <tr>
        <td><span class="sup-category-pill">${categoryLabel(item.category)}</span></td>
        <td>
          <div class="sup-best-item-main">
            <div class="sup-best-item-name">${itemNameZh(item)}</div>
            ${itemNameEn(item) ? `<div class="sup-best-item-sub">${itemNameEn(item)}</div>` : ""}
          </div>
        </td>
        <td><div class="sup-best-item-spec">${item.spec || EMPTY_TEXT}</div></td>
        <td class="sup-col-unit">${item.unit || EMPTY_TEXT}</td>
        <td class="sup-price-value">${price > 0 ? window.AppUtils.formatCurrency(price, "EUR") : EMPTY_TEXT}</td>
        <td><div class="sup-best-item-sub">${supName}</div></td>
      </tr>
    `;
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
  const listEl = getRequiredElement("categories-list");
  const summaryEl = getRequiredElement("cat-dialog-summary");
  const listSummaryEl = getRequiredElement("cat-list-summary");
  const total = state.categories.length;

  summaryEl.textContent = total > 0 ? `共 ${total} 个分类` : "暂无分类";
  listSummaryEl.textContent = total > 0
    ? `已建 ${total} 个分类，可在下方继续新增或编辑。`
    : "还没有分类，可以从右上角新建分类开始。";

  if (total === 0) {
    listEl.innerHTML = `<div class="sup-empty-state">暂无可管理的物料分类</div>`;
    return;
  }

  listEl.innerHTML = state.categories.map((c) => {
    const code = c.code || "";
    const label = c.nameZh || c.name_zh || code;
    const sortOrder = c.sortOrder || c.sort_order || 0;
    const icon = window.AppUi.getLabel("supplierItemCategoryIcons", code) || "📦";
    const catId = String(c.id);
    const linkedItemCount = state.items.filter((item) => item.category === code).length;
    return `
      <div class="cat-row">
        <div class="cat-row-main">
          <div class="cat-row-top">
            <span class="cat-row-icon">${icon}</span>
            <div class="cat-row-title-wrap">
              <div class="cat-row-title">${label}</div>
              <div class="cat-row-subtitle">物料分类主数据</div>
            </div>
          </div>
          <div class="cat-row-meta-wrap">
            <span class="cat-row-chip cat-row-code">${code}</span>
            <span class="cat-row-chip">排序 ${sortOrder}</span>
            <span class="cat-row-chip">${linkedItemCount} 项物料</span>
          </div>
        </div>
        <div class="cat-row-actions">
          <button class="sup-inline-action" data-edit-cat="${catId}">编辑</button>
          <button class="sup-inline-action is-danger" data-delete-cat="${catId}" data-cat-name="${label}">删除</button>
        </div>
      </div>
    `;
  }).join("");
}

function openCatForm(cat) {
  const section = getRequiredElement("cat-form-section");
  const form = getRequiredElement("cat-form");
  const titleEl = getRequiredElement("cat-form-title");
  const captionEl = getRequiredElement("cat-form-caption");
  const codeInput = getRequiredElement("cat-code-input");
  const codeHint = getRequiredElement("cat-code-hint");
  const isEdit = !!cat;

  form.id.value = isEdit ? String(cat.id) : "";
  form.nameZh.value = isEdit ? (cat.nameZh || cat.name_zh || "") : "";
  form.code.value = isEdit ? (cat.code || "") : "";
  form.sortOrder.value = isEdit ? (cat.sortOrder || cat.sort_order || 0) : "";

  codeInput.readOnly = isEdit;
  codeInput.style.background = isEdit ? "#f3f4f6" : "";
  codeInput.style.color = isEdit ? "#6b7280" : "";
  codeHint.style.display = isEdit ? "" : "none";

  titleEl.textContent = isEdit ? `编辑分类 · ${cat.nameZh || cat.name_zh || cat.code}` : "新建分类";
  captionEl.textContent = isEdit
    ? "调整分类名称、排序与代码展示方式，保持价格库引用清晰。"
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

function openDialog(id) { getRequiredElement(id).showModal(); }
function closeDialog(id) { getRequiredElement(id).close(); }

function openSupplierForm(supplier) {
  const form = getRequiredElement("supplier-form");
  form.id.value = supplier ? supplier.id : "";
  form.name.value = supplier ? supplier.name : "";
  form.contact.value = supplier ? (supplier.contact || "") : "";
  form.phone.value = supplier ? (supplier.phone || "") : "";
  form.email.value = supplier ? (supplier.email || "") : "";
  form.notes.value = supplier ? (supplier.notes || "") : "";
  form.isActiveSupplier.checked = supplier ? (supplier.isActive !== false) : true;
  getRequiredElement("dlg-supplier-title").textContent = supplier ? `编辑供应商 · ${supplier.name}` : "新建供应商";
  openDialog("dlg-supplier");
}

function buildItemSupplierSelect(selectedId) {
  const sel = getRequiredElement("item-supplier-select");
  const currentId = selectedId || state.selectedSupplierId || "";
  sel.innerHTML = state.suppliers
    .map((s) => `<option value="${s.id}"${s.id === currentId ? " selected" : ""}>${s.name}</option>`)
    .join("");
}

function openItemForm(item) {
  buildItemSupplierSelect(item ? itemSupplierId(item) : null);
  const form = getRequiredElement("item-form");
  form.id.value = item ? item.id : "";
  const supplierId = item ? itemSupplierId(item) : (state.selectedSupplierId || "");
  if (supplierId) form.supplierIdSel.value = supplierId;
  form.category.value = item ? item.category : (state.categories[0]?.code || state.categories[0]?.id || "");
  form.nameZh.value = item ? itemNameZh(item) : "";
  form.nameEn.value = item ? itemNameEn(item) : "";
  form.spec.value = item ? (item.spec || "") : "";
  form.unit.value = item ? (item.unit || "") : "";
  form.costPrice.value = item && itemCostPrice(item) > 0 ? itemCostPrice(item) : "";
  form.notes.value = item ? (item.notes || "") : "";
  form.isActive.checked = item ? itemIsActive(item) : true;
  getRequiredElement("dlg-item-title").textContent = item ? `编辑物料 · ${itemNameZh(item)}` : "新建物料";
  openDialog("dlg-item");
}

async function loadCategories() {
  try {
    const cats = await window.AppUtils.fetchJson("/api/supplier-categories", null, "分类加载失败");
    if (Array.isArray(cats) && cats.length > 0) {
      state.categories = cats;
      return;
    }
  } catch (_) {
    // fall through
  }
  state.categories = FALLBACK_CATEGORIES;
}

function buildCategorySelects() {
  const opts = state.categories.map((c) => {
    const code = c.code || c.id;
    const label = c.nameZh || c.name_zh || code;
    return `<option value="${code}">${label}</option>`;
  }).join("");

  const filterCat = getRequiredElement("filter-category");
  const itemCatSel = getRequiredElement("item-category-select");
  filterCat.innerHTML = `<option value="">全部类别</option>${opts}`;
  itemCatSel.innerHTML = opts;
}

async function loadSuppliers() {
  const result = await window.AppUtils.fetchJson("/api/suppliers", null, "供应商列表加载失败");
  state.suppliers = Array.isArray(result) ? result : [];
}

async function loadItems() {
  const params = new URLSearchParams();
  params.set("status", state.filters.status || "all");
  if (state.selectedSupplierId) {
    params.set("supplier_id", state.selectedSupplierId);
  }

  const items = await window.AppUtils.fetchJson(
    `/api/supplier-items?${params.toString()}`,
    null,
    "物料列表加载失败"
  );
  state.items = Array.isArray(items) ? items : [];
}

async function loadBestPriceItems() {
  try {
    const items = await window.AppUtils.fetchJson("/api/supplier-items/best-price", null, "最低价加载失败");
    state.bestPriceItems = Array.isArray(items) ? items : [];
  } catch (_) {
    state.bestPriceItems = [];
  }
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

async function bootstrap() {
  validateSuppliersPageDom();
  window.AppUtils.applyFlash("sup-message");
  await loadCategories();
  buildCategorySelects();

  const supForm = getRequiredElement("supplier-form");
  const itemForm = getRequiredElement("item-form");
  window.AppUtils.setChineseValidity(supForm);
  window.AppUtils.setChineseValidity(itemForm);

  await reloadAll();

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
    getRequiredElement(id).addEventListener(event, handler);
  }

  on("global-search", "input", (e) => {
    state.filters.global = e.target.value.trim();
    renderSupplierList();
    renderItemTable();
  });

  on("filter-category", "change", (e) => {
    state.filters.category = e.target.value;
    renderItemTable();
  });

  on("filter-status", "change", async (e) => {
    state.filters.status = e.target.value;
    await loadItems();
    renderItemTable();
    updateKPI();
  });

  on("toggle-best-price", "change", (e) => {
    state.filters.bestPriceOnly = e.target.checked;
    renderItemTable();
  });

  on("supplier-search", "input", () => {
    renderSupplierList();
  });

  on("btn-show-all-suppliers", "click", async () => {
    state.selectedSupplierId = null;
    await loadItems();
    renderSupplierList();
    renderItemTable();
    updateKPI();
  });

  on("btn-new-supplier", "click", () => {
    if (!window.can("supplier.create")) return;
    openSupplierForm(null);
  });

  on("btn-new-item", "click", () => {
    if (!window.can("supplier.create")) return;
    openItemForm(null);
  });

  on("btn-manage-categories", "click", () => {
    hideCatMessage();
    closeCatForm();
    renderCategoryManagementList();
    openDialog("dlg-categories");
  });

  on("btn-new-category", "click", () => {
    hideCatMessage();
    openCatForm(null);
  });

  on("btn-cancel-cat-form", "click", () => {
    closeCatForm();
    hideCatMessage();
  });

  on("btn-save-category", "click", async () => {
    const form = getRequiredElement("cat-form");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const id = form.id.value.trim();
    const isEdit = !!id;
    const payload = {
      nameZh: form.nameZh.value.trim(),
      sortOrder: Number(form.sortOrder.value || 0),
    };

    if (!isEdit) {
      payload.code = form.code.value.trim();
    }

    try {
      const url = isEdit ? `/api/supplier-categories/${encodeURIComponent(id)}` : "/api/supplier-categories";
      const method = isEdit ? "PUT" : "POST";
      await window.AppUtils.fetchJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, isEdit ? "编辑分类失败" : "新建分类失败");

      closeCatForm();
      showCatMessage(isEdit ? "分类已更新。" : "分类已创建。", "success");
      await reloadCategories();
    } catch (err) {
      showCatMessage(err.message, "error");
    }
  });

  on("btn-batch-import", "click", () => {
    window.AppUtils.showMessage("sup-message", "批量导入功能正在开发中，请使用 scripts/import-supplier-catalog.js 脚本导入。", "success");
  });

  on("btn-refresh-best-price", "click", async () => {
    const dom = getSuppliersDom();
    const emptyEl = dom["best-price-empty"];
    const tableEl = dom["best-price-table"];
    emptyEl.textContent = "加载中…";
    emptyEl.style.display = "";
    tableEl.style.display = "none";
    await loadBestPriceItems();
    renderBestPriceTable();
    updateKPI();
  });

  document.body.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("[data-close-dlg]");
    if (closeBtn) {
      closeDialog(closeBtn.dataset.closeDlg);
    }
  });

  on("btn-save-supplier", "click", async () => {
    const form = getRequiredElement("supplier-form");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const id = form.id.value.trim();
    const payload = {
      name: form.name.value.trim(),
      contact: form.contact.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      notes: form.notes.value.trim(),
      isActive: form.isActiveSupplier.checked,
    };

    try {
      const url = id ? `/api/suppliers/${encodeURIComponent(id)}` : "/api/suppliers";
      const method = id ? "PUT" : "POST";
      const saved = await window.AppUtils.fetchJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, "保存供应商失败");
      closeDialog("dlg-supplier");
      window.AppUtils.showMessage("sup-message", id ? "供应商已更新。" : "供应商已创建。", "success");
      state.selectedSupplierId = saved.id;
      await reloadAll();
    } catch (err) {
      window.AppUtils.showMessage("sup-message", err.message, "error");
    }
  });

  on("btn-save-item", "click", async () => {
    const form = getRequiredElement("item-form");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const id = form.id.value.trim();
    const supplierId = form.supplierIdSel.value;
    if (!supplierId) {
      window.AppUtils.showMessage("sup-message", "请先选择供应商。", "error");
      return;
    }

    const payload = {
      supplierId,
      category: form.category.value,
      nameZh: form.nameZh.value.trim(),
      nameEn: form.nameEn.value.trim(),
      spec: form.spec.value.trim(),
      unit: form.unit.value.trim(),
      costPrice: Number(form.costPrice.value || 0),
      notes: form.notes.value.trim(),
      isActive: form.isActive.checked,
    };

    try {
      const url = id ? `/api/supplier-items/${encodeURIComponent(id)}` : "/api/supplier-items";
      const method = id ? "PUT" : "POST";
      await window.AppUtils.fetchJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, "保存物料失败");
      closeDialog("dlg-item");
      window.AppUtils.showMessage("sup-message", id ? "物料已更新。" : "物料已添加。", "success");
      await reloadItems();
    } catch (err) {
      window.AppUtils.showMessage("sup-message", err.message, "error");
    }
  });

  document.body.addEventListener("click", async (e) => {
    const supCard = e.target.closest("[data-select-supplier]");
    if (supCard && !e.target.closest("button")) {
      state.selectedSupplierId = supCard.dataset.selectSupplier;
      await loadItems();
      renderSupplierList();
      renderItemTable();
      return;
    }

    const editSupId = e.target.getAttribute("data-edit-supplier");
    if (editSupId) {
      const sup = state.suppliers.find((s) => s.id === editSupId);
      if (sup) openSupplierForm(sup);
      return;
    }

    const delSupId = e.target.getAttribute("data-delete-supplier");
    if (delSupId) {
      const name = e.target.getAttribute("data-name") || "该供应商";
      if (!window.confirm(`确定删除供应商「${name}」及其所有物料吗？此操作不可恢复。`)) return;
      try {
        await window.AppUtils.fetchJson(`/api/suppliers/${encodeURIComponent(delSupId)}`, { method: "DELETE" }, "删除供应商失败");
        window.AppUtils.showMessage("sup-message", "供应商已删除。", "success");
        if (state.selectedSupplierId === delSupId) state.selectedSupplierId = null;
        await reloadAll();
      } catch (err) {
        window.AppUtils.showMessage("sup-message", err.message, "error");
      }
      return;
    }

    const editItemId = e.target.getAttribute("data-edit-item");
    if (editItemId) {
      const item = state.items.find((i) => String(i.id) === String(editItemId))
        || state.bestPriceItems.find((i) => String(i.id) === String(editItemId));
      if (item) openItemForm(item);
      return;
    }

    const toggleItemId = e.target.getAttribute("data-toggle-item");
    if (toggleItemId) {
      const currentActive = e.target.getAttribute("data-current-active") === "true";
      const item = state.items.find((i) => String(i.id) === String(toggleItemId));
      if (!item) return;
      const payload = {
        supplierId: itemSupplierId(item),
        category: item.category,
        nameZh: itemNameZh(item),
        nameEn: itemNameEn(item),
        spec: item.spec || "",
        unit: item.unit,
        costPrice: itemCostPrice(item),
        notes: item.notes || "",
        isActive: !currentActive,
      };
      try {
        await window.AppUtils.fetchJson(`/api/supplier-items/${encodeURIComponent(toggleItemId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, "状态更新失败");
        await reloadItems();
      } catch (err) {
        window.AppUtils.showMessage("sup-message", err.message, "error");
      }
      return;
    }

    const delItemId = e.target.getAttribute("data-delete-item");
    if (delItemId) {
      const name = e.target.getAttribute("data-name") || "该物料";
      if (!window.confirm(`确定删除物料「${name}」吗？`)) return;
      try {
        await window.AppUtils.fetchJson(`/api/supplier-items/${encodeURIComponent(delItemId)}`, { method: "DELETE" }, "删除物料失败");
        window.AppUtils.showMessage("sup-message", "物料已删除。", "success");
        await reloadItems();
      } catch (err) {
        window.AppUtils.showMessage("sup-message", err.message, "error");
      }
      return;
    }

    const editCatId = e.target.getAttribute("data-edit-cat");
    if (editCatId) {
      hideCatMessage();
      const cat = state.categories.find((c) => String(c.id) === editCatId);
      if (cat) openCatForm(cat);
      return;
    }

    const deleteCatId = e.target.getAttribute("data-delete-cat");
    if (deleteCatId) {
      const name = e.target.getAttribute("data-cat-name") || "该分类";
      if (!window.confirm(`确定删除/停用分类「${name}」吗？\n\n注意：已关联物料的 category 字段不会自动更改，仅分类主数据会被移除。`)) return;
      try {
        const result = await window.AppUtils.fetchJson(`/api/supplier-categories/${encodeURIComponent(deleteCatId)}`, { method: "DELETE" }, "删除分类失败");
        showCatMessage(result.message || "分类已删除。", "success");
        await reloadCategories();
      } catch (err) {
        showCatMessage(err.message, "error");
      }
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
