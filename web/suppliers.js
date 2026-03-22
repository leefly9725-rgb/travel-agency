const CATEGORIES = ["av_equipment", "stage_structure", "print_display", "decoration", "furniture", "personnel", "logistics", "management"];

const state = {
  suppliers: [],
  items: [],
  selectedSupplierId: null,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function categoryLabel(cat) {
  const icon = window.AppUi.getLabel("supplierItemCategoryIcons", cat);
  const text = window.AppUi.getLabel("supplierItemCategoryLabels", cat);
  return `${icon} ${text}`;
}

function getFilteredItems() {
  const cat = document.getElementById("category-filter").value;
  const search = document.getElementById("item-search").value.trim().toLowerCase();
  return state.items.filter((item) => {
    const matchCat = !cat || item.category === cat;
    const matchSearch = !search
      || item.nameZh.toLowerCase().includes(search)
      || item.nameEn.toLowerCase().includes(search);
    return matchCat && matchSearch;
  });
}

function groupByCategory(items) {
  const groups = {};
  CATEGORIES.forEach((cat) => { groups[cat] = []; });
  items.forEach((item) => {
    if (groups[item.category]) groups[item.category].push(item);
  });
  return groups;
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderSupplierList() {
  const container = document.getElementById("supplier-list");
  if (state.suppliers.length === 0) {
    container.innerHTML = '<p class="empty">暂无供应商，点击「新建供应商」开始录入。</p>';
    return;
  }
  container.innerHTML = state.suppliers.map((sup) => {
    const selected = sup.id === state.selectedSupplierId ? " selected-card" : "";
    const itemCount = state.items.filter((i) => i.supplierId === sup.id).length;
    return `
      <article class="card card-selectable${selected}" data-select-supplier="${sup.id}">
        <div class="list-row list-row-top">
          <div>
            <h3>${sup.name}${sup.isActive === false ? ' <span class="status-badge" style="font-size:11px;opacity:0.6">停用</span>' : ""}</h3>
            <p class="meta">${sup.phone || sup.email || sup.contact || "暂无联系方式"} · ${itemCount} 条物料</p>
          </div>
          <div class="action-row">
            ${window.can('supplier.edit') ? `<button class="mini-button" data-edit-supplier="${sup.id}">编辑</button>` : ''}
            ${window.can('supplier.delete') ? `<button class="ghost mini-button" data-delete-supplier="${sup.id}" data-name="${sup.name}">删除</button>` : ''}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderItemList() {
  const section = document.getElementById("items-section");
  const title = document.getElementById("items-section-title");
  const container = document.getElementById("item-list");

  if (!state.selectedSupplierId) {
    section.style.display = "none";
    return;
  }

  const sup = state.suppliers.find((s) => s.id === state.selectedSupplierId);
  section.style.display = "";
  title.textContent = sup ? `${sup.name} · 物料列表` : "物料列表";

  const filtered = getFilteredItems();
  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty">没有符合条件的物料。</p>';
    return;
  }

  const groups = groupByCategory(filtered);
  const html = CATEGORIES.map((cat) => {
    const catItems = groups[cat];
    if (catItems.length === 0) return "";
    return `
      <div class="item-group">
        <h4 class="item-group-title">${categoryLabel(cat)}</h4>
        ${catItems.map((item) => `
          <div class="item-row ${item.isActive ? "" : "item-inactive"}">
            <div class="item-info">
              <span class="item-name">${item.nameZh}</span>
              ${item.nameEn ? `<span class="item-name-en">${item.nameEn}</span>` : ""}
              ${item.spec ? `<span class="item-spec">${item.spec}</span>` : ""}
              <span class="item-unit">/ ${item.unit}</span>
            </div>
            <div class="item-price-actions">
              <span class="item-price">${item.costPrice > 0 ? window.AppUtils.formatCurrency(item.costPrice, "EUR") : "—"}</span>
              ${window.can('supplier.edit') ? `<button class="mini-button" data-edit-item="${item.id}">编辑</button>` : ''}
              ${window.can('supplier.delete') ? `<button class="ghost mini-button" data-delete-item="${item.id}" data-name="${item.nameZh}">删除</button>` : ''}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }).join("");

  container.innerHTML = html || '<p class="empty">没有符合条件的物料。</p>';
}

// ── Form helpers ──────────────────────────────────────────────────────────────

function showSupplierForm() {
  document.getElementById("supplier-form-section").style.display = "";
  document.getElementById("item-form-section").style.display = "none";
}

function showItemForm() {
  document.getElementById("supplier-form-section").style.display = "none";
  document.getElementById("item-form-section").style.display = "";
}

function fillSupplierForm(supplier) {
  const form = document.getElementById("supplier-form");
  form.id.value = supplier ? supplier.id : "";
  form.name.value = supplier ? supplier.name : "";
  form.contact.value = supplier ? (supplier.contact || "") : "";
  form.phone.value = supplier ? (supplier.phone || "") : "";
  form.email.value = supplier ? (supplier.email || "") : "";
  form.notes.value = supplier ? (supplier.notes || "") : "";
  form.isActiveSupplier.checked = supplier ? (supplier.isActive !== false) : true;
  document.getElementById("supplier-mode").textContent = supplier ? `${supplier.id} 编辑中` : "新建";
  showSupplierForm();
}

function fillItemForm(item) {
  const form = document.getElementById("item-form");
  form.id.value = item ? item.id : "";
  form.supplierId.value = item ? item.supplierId : (state.selectedSupplierId || "");
  form.category.value = item ? item.category : CATEGORIES[0];
  form.nameZh.value = item ? item.nameZh : "";
  form.nameEn.value = item ? item.nameEn : "";
  form.spec.value = item ? item.spec : "";
  form.unit.value = item ? item.unit : "";
  form.costPrice.value = item && item.costPrice > 0 ? item.costPrice : "";
  form.notes.value = item ? item.notes : "";
  form.isActive.checked = item ? item.isActive : true;
  document.getElementById("item-mode").textContent = item ? `${item.nameZh} 编辑中` : "新建物料";
  showItemForm();
}

// ── Data loaders ──────────────────────────────────────────────────────────────

async function reloadAll() {
  const [suppliers, items] = await Promise.all([
    window.AppUtils.fetchJson("/api/suppliers", null, "供应商列表加载失败"),
    window.AppUtils.fetchJson("/api/supplier-items", null, "物料列表加载失败"),
  ]);
  state.suppliers = suppliers;
  state.items = items;
  renderSupplierList();
  renderItemList();
}

async function reloadItems() {
  state.items = await window.AppUtils.fetchJson("/api/supplier-items", null, "物料列表加载失败");
  renderItemList();
  renderSupplierList();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function bootstrap() {
  window.AppUtils.applyFlash("supplier-message");

  // Build category select in item form
  const catSelect = document.querySelector("#item-form select[name='category']");
  catSelect.innerHTML = CATEGORIES.map((cat) =>
    `<option value="${cat}">${categoryLabel(cat)}</option>`
  ).join("");

  // Build category filter
  const catFilter = document.getElementById("category-filter");
  catFilter.innerHTML = `<option value="">全部类别</option>` + CATEGORIES.map((cat) =>
    `<option value="${cat}">${categoryLabel(cat)}</option>`
  ).join("");

  window.AppUtils.setChineseValidity(document.getElementById("supplier-form"));
  window.AppUtils.setChineseValidity(document.getElementById("item-form"));

  await reloadAll();

  // Auto-select first supplier
  if (state.suppliers.length > 0 && !state.selectedSupplierId) {
    state.selectedSupplierId = state.suppliers[0].id;
    renderSupplierList();
    renderItemList();
  }

  fillSupplierForm(null);

  // ── Filter / search ───────────────────────────────────────────────────────
  document.getElementById("category-filter").addEventListener("change", renderItemList);
  document.getElementById("item-search").addEventListener("input", renderItemList);

  // ── New supplier button ───────────────────────────────────────────────────
  document.getElementById("btn-new-supplier").addEventListener("click", () => {
    fillSupplierForm(null);
  });

  // ── New item button ───────────────────────────────────────────────────────
  document.getElementById("btn-new-item").addEventListener("click", () => {
    if (!state.selectedSupplierId) {
      window.AppUtils.showMessage("supplier-message", "请先选择一个供应商。", "error");
      return;
    }
    fillItemForm(null);
  });

  // ── Cancel buttons ────────────────────────────────────────────────────────
  document.getElementById("btn-cancel-supplier").addEventListener("click", () => {
    fillSupplierForm(null);
  });
  document.getElementById("btn-cancel-item").addEventListener("click", () => {
    showSupplierForm();
  });

  // ── Supplier form submit ──────────────────────────────────────────────────
  document.getElementById("supplier-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    window.AppUtils.hideMessage("supplier-message");
    const form = event.currentTarget;
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
      window.AppUtils.showMessage("supplier-message", id ? "供应商已更新。" : "供应商已创建。", "success");
      state.selectedSupplierId = saved.id;
      await reloadAll();
      fillSupplierForm(null);
    } catch (error) {
      window.AppUtils.showMessage("supplier-message", error.message, "error");
    }
  });

  // ── Item form submit ──────────────────────────────────────────────────────
  document.getElementById("item-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    window.AppUtils.hideMessage("supplier-message");
    const form = event.currentTarget;
    const id = form.id.value.trim();
    const payload = {
      supplierId: form.supplierId.value,
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
      window.AppUtils.showMessage("supplier-message", id ? "物料已更新。" : "物料已添加。", "success");
      await reloadItems();
      fillItemForm(null);
    } catch (error) {
      window.AppUtils.showMessage("supplier-message", error.message, "error");
    }
  });

  // ── Delegated clicks ──────────────────────────────────────────────────────
  document.body.addEventListener("click", async (event) => {
    // Select supplier
    const selectCard = event.target.closest("[data-select-supplier]");
    if (selectCard && !event.target.closest("button")) {
      state.selectedSupplierId = selectCard.getAttribute("data-select-supplier");
      renderSupplierList();
      renderItemList();
      showSupplierForm();
      return;
    }

    // Edit supplier
    const editSupplierId = event.target.getAttribute("data-edit-supplier");
    if (editSupplierId) {
      const sup = state.suppliers.find((s) => s.id === editSupplierId);
      if (sup) fillSupplierForm(sup);
      return;
    }

    // Delete supplier
    const deleteSupplierId = event.target.getAttribute("data-delete-supplier");
    if (deleteSupplierId) {
      const name = event.target.getAttribute("data-name") || "该供应商";
      if (!window.confirm(`确定删除供应商「${name}」及其所有物料吗？`)) return;
      try {
        await window.AppUtils.fetchJson(`/api/suppliers/${encodeURIComponent(deleteSupplierId)}`, { method: "DELETE" }, "删除供应商失败");
        window.AppUtils.showMessage("supplier-message", "供应商已删除。", "success");
        if (state.selectedSupplierId === deleteSupplierId) {
          state.selectedSupplierId = null;
        }
        await reloadAll();
        fillSupplierForm(null);
      } catch (error) {
        window.AppUtils.showMessage("supplier-message", error.message, "error");
      }
      return;
    }

    // Edit item
    const editItemId = event.target.getAttribute("data-edit-item");
    if (editItemId) {
      const item = state.items.find((i) => i.id === editItemId);
      if (item) fillItemForm(item);
      return;
    }

    // Delete item
    const deleteItemId = event.target.getAttribute("data-delete-item");
    if (deleteItemId) {
      const name = event.target.getAttribute("data-name") || "该物料";
      if (!window.confirm(`确定删除物料「${name}」吗？`)) return;
      try {
        await window.AppUtils.fetchJson(`/api/supplier-items/${encodeURIComponent(deleteItemId)}`, { method: "DELETE" }, "删除物料失败");
        window.AppUtils.showMessage("supplier-message", "物料已删除。", "success");
        await reloadItems();
      } catch (error) {
        window.AppUtils.showMessage("supplier-message", error.message, "error");
      }
    }
  });
}

bootstrap().catch((error) => {
  window.AppUtils.showMessage("supplier-message", error.message, "error");
});

document.addEventListener('authReady', () => {
  if (!window.can('supplier.create')) {
    const btn = document.getElementById('btn-new-supplier');
    if (btn) btn.style.display = 'none';
  }
  // Re-render lists so inline permission checks use correct can() state
  renderSupplierList();
  renderItemList();
});
