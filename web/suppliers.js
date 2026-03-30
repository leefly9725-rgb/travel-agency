const FALLBACK_CATEGORIES = [
  { code: "av_equipment", nameZh: "\u97f3\u89c6\u9891\u8bbe\u5907" },
  { code: "stage_structure", nameZh: "\u821e\u53f0\u7ed3\u6784" },
  { code: "print_display", nameZh: "\u5370\u5237\u5c55\u793a" },
  { code: "decoration", nameZh: "\u88c5\u9970\u7269\u6599" },
  { code: "furniture", nameZh: "\u5bb6\u5177\u684c\u6905" },
  { code: "personnel", nameZh: "\u4eba\u5458\u670d\u52a1" },
  { code: "logistics", nameZh: "\u7269\u6d41\u8bbe\u5907" },
  { code: "management", nameZh: "\u7ba1\u7406\u670d\u52a1" },
];

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
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText("kpi-supplier-count", `${activeCount} / ${state.suppliers.length}`);
  setText("kpi-item-count", state.items.length);
  setText("kpi-best-price-count", state.bestPriceItems.length > 0 ? state.bestPriceItems.length : "—");
  const times = state.items
    .map((i) => i.updated_at || i.updatedAt)
    .filter(Boolean)
    .sort();
  setText("kpi-last-update", times.length > 0
    ? new Date(times[times.length - 1]).toLocaleDateString("zh-CN")
    : "—");
}

function renderSupplierList() {
  const container = document.getElementById("supplier-list");
  const allBtn = document.getElementById("btn-show-all-suppliers");
  if (allBtn) {
    allBtn.className = "sup-sidebar-all-btn" + (state.selectedSupplierId === null ? " active" : "");
  }

  const sideSearch = (document.getElementById("supplier-search").value || "").trim().toLowerCase();
  const global = state.filters.global.toLowerCase();
  const list = state.suppliers.filter((sup) => {
    const haystack = [sup.name, sup.contact, sup.phone, sup.email].filter(Boolean).join(" ").toLowerCase();
    if (sideSearch && !haystack.includes(sideSearch)) return false;
    if (global && !haystack.includes(global)) return false;
    return true;
  });

  if (list.length === 0) {
    container.innerHTML = `<div class="sup-empty-state">${t("\\u6682\\u65e0\\u5339\\u914d\\u4f9b\\u5e94\\u5546")}</div>`;
    return;
  }

  container.innerHTML = list.map((sup) => {
    const isActive = sup.isActive !== false;
    const itemCount = state.items.filter((i) => itemSupplierId(i) === sup.id).length;
    const isSelected = sup.id === state.selectedSupplierId;
    const contact = [sup.contact, sup.phone, sup.email].filter(Boolean).join(" / ") || t("\\u6682\\u65e0\\u8054\\u7cfb\\u65b9\\u5f0f");
    return `
      <div class="sup-supplier-card${isSelected ? " active" : ""}${!isActive ? " inactive" : ""}" data-select-supplier="${sup.id}">
        <div class="sup-card-head">
          <div class="sup-card-title-wrap">
            <div class="sup-card-name">${sup.name}</div>
            <span class="sup-status-tag ${isActive ? "is-active" : "is-inactive"}">${isActive ? t("\\u542f\\u7528") : t("\\u505c\\u7528")}</span>
          </div>
          <span class="sup-card-count">${itemCount} ${t("\\u9879")}</span>
        </div>
        <div class="sup-card-meta">${contact}</div>
        <div class="sup-card-foot">
          <span class="sup-card-hint">${isActive ? t("\\u652f\\u6301\\u5feb\\u901f\\u9009\\u5e93\\u4e0e\\u4ef7\\u683c\\u7ef4\\u62a4") : t("\\u5f53\\u524d\\u4f9b\\u5e94\\u5546\\u5df2\\u505c\\u7528")}</span>
          <div class="sup-card-actions">
            ${window.can("supplier.edit") ? `<button class="sup-inline-action" data-edit-supplier="${sup.id}">${t("\\u7f16\\u8f91")}</button>` : ""}
            ${window.can("supplier.delete") ? `<button class="sup-inline-action is-danger" data-delete-supplier="${sup.id}" data-name="${sup.name}">${t("\\u5220\\u9664")}</button>` : ""}
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
  const tbody = document.getElementById("item-table-body");
  const emptyEl = document.getElementById("item-empty");
  const titleEl = document.getElementById("items-table-title");
  const subtitleEl = document.getElementById("items-table-subtitle");

  if (state.selectedSupplierId) {
    const sup = state.suppliers.find((s) => s.id === state.selectedSupplierId);
    titleEl.textContent = sup ? sup.name : t("\\u4ef7\\u683c\\u5e93");
    subtitleEl.textContent = state.filters.bestPriceOnly
      ? t("\\u5f53\\u524d\\u89c6\\u56fe\\u4ec5\\u663e\\u793a\\u6700\\u4f18\\u6210\\u672c\\u6761\\u76ee")
      : t("\\u5f53\\u524d\\u4f9b\\u5e94\\u5546\\u7684\\u7269\\u6599\\u4e0e\\u670d\\u52a1\\u6761\\u76ee");
  } else {
    titleEl.textContent = t("\\u4ef7\\u683c\\u5e93");
    subtitleEl.textContent = state.filters.bestPriceOnly
      ? t("\\u5f53\\u524d\\u89c6\\u56fe\\u4ec5\\u663e\\u793a\\u5168\\u5c40\\u6700\\u4f18\\u6210\\u672c\\u6761\\u76ee")
      : t("\\u67e5\\u770b\\u5168\\u90e8\\u4f9b\\u5e94\\u5546\\u7684\\u4ef7\\u683c\\u5e93\\u4e0e\\u670d\\u52a1\\u660e\\u7ec6");
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
        <td><div class="sup-item-spec" title="${item.spec || ""}">${item.spec || "—"}</div></td>
        <td class="sup-col-unit">${item.unit || "—"}</td>
        <td class="sup-col-price">${price > 0 ? window.AppUtils.formatCurrency(price, "EUR") : "—"}</td>
        <td><span class="sup-status-pill ${active ? "is-active" : "is-inactive"}">${active ? t("\\u542f\\u7528") : t("\\u505c\\u7528")}</span></td>
        <td class="col-actions">
          <div class="sup-action-group">
            ${window.can("supplier.edit") ? `<button class="sup-inline-action" data-edit-item="${item.id}">${t("\\u7f16\\u8f91")}</button>` : ""}
            ${window.can("supplier.edit") && active ? `<button class="sup-inline-action" data-toggle-item="${item.id}" data-current-active="true">${t("\\u505c\\u7528")}</button>` : ""}
            ${window.can("supplier.edit") && !active ? `<button class="sup-inline-action is-success" data-toggle-item="${item.id}" data-current-active="false">${t("\\u542f\\u7528")}</button>` : ""}
            ${window.can("supplier.delete") ? `<button class="sup-inline-action is-danger" data-delete-item="${item.id}" data-name="${itemNameZh(item)}">${t("\\u5220\\u9664")}</button>` : ""}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderBestPriceTable() {
  const tableEl = document.getElementById("best-price-table");
  const tbody = document.getElementById("best-price-body");
  const emptyEl = document.getElementById("best-price-empty");
  const metaEl = document.getElementById("best-price-meta");
  const items = state.bestPriceItems;

  if (!tableEl || !tbody || !emptyEl) return;
  if (metaEl) metaEl.textContent = items.length > 0 ? `${t("\\u5171")} ${items.length} ${t("\\u6761\\u6700\\u4f18\\u6210\\u672c\\u8bb0\\u5f55")}` : "";

  if (items.length === 0) {
    tableEl.style.display = "none";
    emptyEl.style.display = "";
    emptyEl.textContent = t("\\u6682\\u65e0\\u53ef\\u7528\\u7684\\u6700\\u4f18\\u6210\\u672c\\u6570\\u636e");
    return;
  }

  tableEl.style.display = "";
  emptyEl.style.display = "none";
  tbody.innerHTML = items.map((item) => {
    const price = itemCostPrice(item);
    const supName = item.supplierName || item.supplier_name || "—";
    return `
      <tr>
        <td><span class="sup-category-pill">${categoryLabel(item.category)}</span></td>
        <td>
          <div class="sup-best-item-main">
            <div class="sup-best-item-name">${itemNameZh(item)}</div>
            ${itemNameEn(item) ? `<div class="sup-best-item-sub">${itemNameEn(item)}</div>` : ""}
          </div>
        </td>
        <td><div class="sup-best-item-spec">${item.spec || "—"}</div></td>
        <td class="sup-col-unit">${item.unit || "—"}</td>
        <td class="sup-price-value">${price > 0 ? window.AppUtils.formatCurrency(price, "EUR") : "—"}</td>
        <td><div class="sup-best-item-sub">${supName}</div></td>
      </tr>
    `;
  }).join("");
}

function showCatMessage(text, type) {
  const el = document.getElementById("cat-message");
  if (!el) return;
  el.textContent = text;
  el.className = `message-box sup-modal-message ${type === "error" ? "error" : "success"}`;
}

function hideCatMessage() {
  const el = document.getElementById("cat-message");
  if (el) el.className = "message-box hidden sup-modal-message";
}

function renderCategoryManagementList() {
  const listEl = document.getElementById("categories-list");
  if (!listEl) return;

  if (state.categories.length === 0) {
    listEl.innerHTML = `<div class="sup-empty-state">${t("\\u6682\\u65e0\\u53ef\\u7ba1\\u7406\\u7684\\u7269\\u6599\\u5206\\u7c7b")}</div>`;
    return;
  }

  listEl.innerHTML = state.categories.map((c) => {
    const code = c.code || "";
    const label = c.nameZh || c.name_zh || code;
    const sortOrder = c.sortOrder || c.sort_order || 0;
    const icon = window.AppUi.getLabel("supplierItemCategoryIcons", code);
    const catId = String(c.id);
    return `
      <div class="cat-row">
        <span class="cat-row-icon">${icon || "📁"}</span>
        <div class="cat-row-main">
          <div class="cat-row-title">${label}</div>
          <div class="cat-row-meta">${code}${sortOrder ? ` / ${t("\\u6392\\u5e8f")} ${sortOrder}` : ""}</div>
        </div>
        <div class="cat-row-actions">
          <button class="sup-inline-action" data-edit-cat="${catId}">${t("\\u7f16\\u8f91")}</button>
          <button class="sup-inline-action is-danger" data-delete-cat="${catId}" data-cat-name="${label}">${t("\\u5220\\u9664")}</button>
        </div>
      </div>
    `;
  }).join("");
}

function openCatForm(cat) {
  const section = document.getElementById("cat-form-section");
  const form = document.getElementById("cat-form");
  const titleEl = document.getElementById("cat-form-title");
  const codeInput = document.getElementById("cat-code-input");
  const codeHint = document.getElementById("cat-code-hint");
  const isEdit = !!cat;

  form.id.value = isEdit ? String(cat.id) : "";
  form.nameZh.value = isEdit ? (cat.nameZh || cat.name_zh || "") : "";
  form.code.value = isEdit ? (cat.code || "") : "";
  form.sortOrder.value = isEdit ? (cat.sortOrder || cat.sort_order || 0) : "";

  codeInput.readOnly = isEdit;
  codeInput.style.background = isEdit ? "#f3f4f6" : "";
  codeInput.style.color = isEdit ? "#9ca3af" : "";
  codeHint.style.display = isEdit ? "" : "none";

  titleEl.textContent = isEdit
    ? `${t("\\u7f16\\u8f91\\u5206\\u7c7b")} · ${cat.nameZh || cat.name_zh || cat.code}`
    : t("\\u65b0\\u589e\\u5206\\u7c7b");

  section.style.display = "";
  form.nameZh.focus();
}

async function reloadCategories() {
  await loadCategories();
  buildCategorySelects();
  renderCategoryManagementList();
}

function openDialog(id) { document.getElementById(id).showModal(); }
function closeDialog(id) { document.getElementById(id).close(); }

function openSupplierForm(supplier) {
  const form = document.getElementById("supplier-form");
  form.id.value = supplier ? supplier.id : "";
  form.name.value = supplier ? supplier.name : "";
  form.contact.value = supplier ? (supplier.contact || "") : "";
  form.phone.value = supplier ? (supplier.phone || "") : "";
  form.email.value = supplier ? (supplier.email || "") : "";
  form.notes.value = supplier ? (supplier.notes || "") : "";
  form.isActiveSupplier.checked = supplier ? (supplier.isActive !== false) : true;
  document.getElementById("dlg-supplier-title").textContent =
    supplier ? `${t("\\u7f16\\u8f91\\u4f9b\\u5e94\\u5546")} · ${supplier.name}` : t("\\u65b0\\u589e\\u4f9b\\u5e94\\u5546");
  openDialog("dlg-supplier");
}

function buildItemSupplierSelect(selectedId) {
  const sel = document.getElementById("item-supplier-select");
  const currentId = selectedId || state.selectedSupplierId || "";
  sel.innerHTML = state.suppliers
    .map((s) => `<option value="${s.id}"${s.id === currentId ? " selected" : ""}>${s.name}</option>`)
    .join("");
}

function openItemForm(item) {
  buildItemSupplierSelect(item ? itemSupplierId(item) : null);
  const form = document.getElementById("item-form");
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
  document.getElementById("dlg-item-title").textContent =
    item ? `${t("\\u7f16\\u8f91\\u7269\\u6599")} · ${itemNameZh(item)}` : t("\\u65b0\\u589e\\u7269\\u6599");
  openDialog("dlg-item");
}

async function loadCategories() {
  try {
    const cats = await window.AppUtils.fetchJson("/api/supplier-categories", null, t("\\u5206\\u7c7b\\u52a0\\u8f7d\\u5931\\u8d25"));
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

  const filterCat = document.getElementById("filter-category");
  if (filterCat) filterCat.innerHTML = `<option value="">${t("\\u5168\\u90e8\\u7c7b\\u522b")}</option>` + opts;
  const itemCatSel = document.getElementById("item-category-select");
  if (itemCatSel) itemCatSel.innerHTML = opts;
}

async function loadSuppliers() {
  const result = await window.AppUtils.fetchJson("/api/suppliers", null, t("\\u4f9b\\u5e94\\u5546\\u5217\\u8868\\u52a0\\u8f7d\\u5931\\u8d25"));
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
    t("\\u7269\\u6599\\u5217\\u8868\\u52a0\\u8f7d\\u5931\\u8d25")
  );
  state.items = Array.isArray(items) ? items : [];
}

async function loadBestPriceItems() {
  try {
    const items = await window.AppUtils.fetchJson("/api/supplier-items/best-price", null, t("\\u6700\\u4f4e\\u4ef7\\u52a0\\u8f7d\\u5931\\u8d25"));
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
  window.AppUtils.applyFlash("sup-message");
  await loadCategories();
  buildCategorySelects();

  const supForm = document.getElementById("supplier-form");
  const itemForm = document.getElementById("item-form");
  if (supForm) window.AppUtils.setChineseValidity(supForm);
  if (itemForm) window.AppUtils.setChineseValidity(itemForm);

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
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
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
    const catFormSec = document.getElementById("cat-form-section");
    if (catFormSec) catFormSec.style.display = "none";
    renderCategoryManagementList();
    openDialog("dlg-categories");
  });

  on("btn-new-category", "click", () => {
    hideCatMessage();
    openCatForm(null);
  });

  on("btn-cancel-cat-form", "click", () => {
    const catFormSec = document.getElementById("cat-form-section");
    if (catFormSec) catFormSec.style.display = "none";
    hideCatMessage();
  });

  on("btn-save-category", "click", async () => {
    const form = document.getElementById("cat-form");
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
      }, isEdit ? t("\\u7f16\\u8f91\\u5206\\u7c7b\\u5931\\u8d25") : t("\\u65b0\\u589e\\u5206\\u7c7b\\u5931\\u8d25"));

      const catFormSec2 = document.getElementById("cat-form-section");
      if (catFormSec2) catFormSec2.style.display = "none";
      showCatMessage(isEdit ? t("\\u5206\\u7c7b\\u5df2\\u66f4\\u65b0\\u3002") : t("\\u5206\\u7c7b\\u5df2\\u521b\\u5efa\\u3002"), "success");
      await reloadCategories();
    } catch (err) {
      showCatMessage(err.message, "error");
    }
  });

  on("btn-batch-import", "click", () => {
    window.AppUtils.showMessage("sup-message", t("\\u6279\\u91cf\\u5bfc\\u5165\\u529f\\u80fd\\u6b63\\u5728\\u5f00\\u53d1\\u4e2d\\uff0c\\u8bf7\\u4f7f\\u7528 scripts/import-supplier-catalog.js \\u811a\\u672c\\u5bfc\\u5165\\u3002"), "success");
  });

  on("btn-refresh-best-price", "click", async () => {
    const emptyEl = document.getElementById("best-price-empty");
    const tableEl = document.getElementById("best-price-table");
    if (emptyEl) { emptyEl.textContent = t("\\u52a0\\u8f7d\\u4e2d\\u2026"); emptyEl.style.display = ""; }
    if (tableEl) tableEl.style.display = "none";
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
    const form = document.getElementById("supplier-form");
    if (!form) return;
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
      }, t("\\u4fdd\\u5b58\\u4f9b\\u5e94\\u5546\\u5931\\u8d25"));
      closeDialog("dlg-supplier");
      window.AppUtils.showMessage("sup-message", id ? t("\\u4f9b\\u5e94\\u5546\\u5df2\\u66f4\\u65b0\\u3002") : t("\\u4f9b\\u5e94\\u5546\\u5df2\\u521b\\u5efa\\u3002"), "success");
      state.selectedSupplierId = saved.id;
      await reloadAll();
    } catch (err) {
      window.AppUtils.showMessage("sup-message", err.message, "error");
    }
  });

  on("btn-save-item", "click", async () => {
    const form = document.getElementById("item-form");
    if (!form || !form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const id = form.id.value.trim();
    const supplierId = form.supplierIdSel.value;
    if (!supplierId) {
      window.AppUtils.showMessage("sup-message", t("\\u8bf7\\u5148\\u9009\\u62e9\\u4f9b\\u5e94\\u5546\\u3002"), "error");
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
      }, t("\\u4fdd\\u5b58\\u7269\\u6599\\u5931\\u8d25"));
      closeDialog("dlg-item");
      window.AppUtils.showMessage("sup-message", id ? t("\\u7269\\u6599\\u5df2\\u66f4\\u65b0\\u3002") : t("\\u7269\\u6599\\u5df2\\u6dfb\\u52a0\\u3002"), "success");
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
      const name = e.target.getAttribute("data-name") || t("\\u8be5\\u4f9b\\u5e94\\u5546");
      if (!window.confirm(`${t("\\u786e\\u5b9a\\u5220\\u9664\\u4f9b\\u5e94\\u5546\\u300c")}${name}${t("\\u300d\\u53ca\\u5176\\u6240\\u6709\\u7269\\u6599\\u5417\\uff1f\\u6b64\\u64cd\\u4f5c\\u4e0d\\u53ef\\u6062\\u590d\\u3002")}`)) return;
      try {
        await window.AppUtils.fetchJson(`/api/suppliers/${encodeURIComponent(delSupId)}`, { method: "DELETE" }, t("\\u5220\\u9664\\u4f9b\\u5e94\\u5546\\u5931\\u8d25"));
        window.AppUtils.showMessage("sup-message", t("\\u4f9b\\u5e94\\u5546\\u5df2\\u5220\\u9664\\u3002"), "success");
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
        }, t("\\u72b6\\u6001\\u66f4\\u65b0\\u5931\\u8d25"));
        await reloadItems();
      } catch (err) {
        window.AppUtils.showMessage("sup-message", err.message, "error");
      }
      return;
    }

    const delItemId = e.target.getAttribute("data-delete-item");
    if (delItemId) {
      const name = e.target.getAttribute("data-name") || t("\\u8be5\\u7269\\u6599");
      if (!window.confirm(`${t("\\u786e\\u5b9a\\u5220\\u9664\\u7269\\u6599\\u300c")}${name}${t("\\u300d\\u5417\\uff1f")}`)) return;
      try {
        await window.AppUtils.fetchJson(`/api/supplier-items/${encodeURIComponent(delItemId)}`, { method: "DELETE" }, t("\\u5220\\u9664\\u7269\\u6599\\u5931\\u8d25"));
        window.AppUtils.showMessage("sup-message", t("\\u7269\\u6599\\u5df2\\u5220\\u9664\\u3002"), "success");
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
      const name = e.target.getAttribute("data-cat-name") || t("\\u8be5\\u5206\\u7c7b");
      if (!window.confirm(`${t("\\u786e\\u5b9a\\u5220\\u9664/\\u505c\\u7528\\u5206\\u7c7b\\u300c")}${name}${t("\\u300d\\u5417\\uff1f\\n\\n\\u6ce8\\u610f\\uff1a\\u5df2\\u5173\\u8054\\u7269\\u6599\\u7684 category \\u5b57\\u6bb5\\u4e0d\\u4f1a\\u81ea\\u52a8\\u66f4\\u6539\\uff0c\\u4ec5\\u5206\\u7c7b\\u4e3b\\u6570\\u636e\\u88ab\\u79fb\\u9664\\u3002")}`)) return;
      try {
        const result = await window.AppUtils.fetchJson(`/api/supplier-categories/${encodeURIComponent(deleteCatId)}`, { method: "DELETE" }, t("\\u5220\\u9664\\u5206\\u7c7b\\u5931\\u8d25"));
        showCatMessage(result.message || t("\\u5206\\u7c7b\\u5df2\\u5220\\u9664\\u3002"), "success");
        await reloadCategories();
      } catch (err) {
        showCatMessage(err.message, "error");
      }
    }
  });
}

bootstrap().catch((err) => {
  console.error("[suppliers] bootstrap error:", err);
  const msgEl = document.getElementById("sup-message");
  if (msgEl) {
    msgEl.textContent = `${t("\\u9875\\u9762\\u52a0\\u8f7d\\u5931\\u8d25\\uff1a")} ${err.message}`;
    msgEl.className = "message-box error";
  }
});

document.addEventListener("authReady", () => {
  if (!window.can("supplier.create")) {
    ["btn-new-supplier", "btn-new-item"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.style.display = "none";
    });
  }
  renderSupplierList();
  renderItemTable();
});