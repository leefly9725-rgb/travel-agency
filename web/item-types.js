const state = { types: [] };

function renderTypeList() {
  const container = document.getElementById("type-list");
  if (state.types.length === 0) {
    container.innerHTML = '<p class="empty">暂无类型，点击「新增类型」开始录入。</p>';
    return;
  }
  container.innerHTML = state.types
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((t) => {
      const statusBadge = t.isActive
        ? '<span class="status-badge" style="background:#e8f5e9;color:#2e7d32">启用</span>'
        : '<span class="status-badge" style="background:#f5f5f5;color:#888">停用</span>';
      const systemBadge = t.isSystem
        ? '<span class="status-badge" style="background:#e3f2fd;color:#1565c0;margin-left:4px">系统内置</span>'
        : "";
      return `
        <article class="card">
          <div class="list-row list-row-top">
            <div>
              <div class="title-row">
                <h3>${t.nameZh}</h3>
                ${statusBadge}${systemBadge}
              </div>
              <p class="meta">代码：${t.code} · 分组：${t.categoryGroup || "—"} · 排序：${t.sortOrder ?? 0}</p>
            </div>
            <div class="action-row">
              <button class="mini-button" data-edit-type="${t.id}">编辑</button>
              ${t.isSystem ? "" : `<button class="ghost mini-button" data-delete-type="${t.id}" data-name="${t.nameZh}">删除</button>`}
            </div>
          </div>
        </article>
      `;
    }).join("");
}

function fillTypeForm(type) {
  const form = document.getElementById("type-form");
  form.id.value = type ? type.id : "";
  form.code.value = type ? type.code : "";
  form.nameZh.value = type ? type.nameZh : "";
  form.categoryGroup.value = type ? (type.categoryGroup || "misc") : "misc";
  form.sortOrder.value = type ? (type.sortOrder ?? 10) : 10;
  form.isActive.checked = type ? (type.isActive !== false) : true;

  // System types: disable code field
  form.code.disabled = Boolean(type?.isSystem);

  document.getElementById("type-mode").textContent = type ? `${type.id} 编辑中` : "新建";
}

async function reloadTypes() {
  state.types = await window.AppUtils.fetchJson("/api/quote-item-types", null, "类型列表加载失败");
  renderTypeList();
}

async function bootstrap() {
  window.AppUtils.applyFlash("item-types-message");
  window.AppUtils.setChineseValidity(document.getElementById("type-form"));

  await reloadTypes();
  fillTypeForm(null);

  document.getElementById("btn-new-type").addEventListener("click", () => {
    fillTypeForm(null);
  });

  document.getElementById("btn-cancel-type").addEventListener("click", () => {
    fillTypeForm(null);
  });

  document.getElementById("type-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    window.AppUtils.hideMessage("item-types-message");
    const form = event.currentTarget;
    const id = form.id.value.trim();
    const payload = {
      code: form.code.value.trim(),
      nameZh: form.nameZh.value.trim(),
      categoryGroup: form.categoryGroup.value,
      sortOrder: Number(form.sortOrder.value || 0),
      isActive: form.isActive.checked,
    };
    try {
      const url = id ? `/api/quote-item-types/${encodeURIComponent(id)}` : "/api/quote-item-types";
      const method = id ? "PUT" : "POST";
      await window.AppUtils.fetchJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, "保存类型失败");
      window.AppUtils.showMessage("item-types-message", id ? "类型已更新。" : "类型已创建。", "success");
      await reloadTypes();
      fillTypeForm(null);
    } catch (error) {
      window.AppUtils.showMessage("item-types-message", error.message, "error");
    }
  });

  document.body.addEventListener("click", async (event) => {
    const editId = event.target.getAttribute("data-edit-type");
    if (editId) {
      const type = state.types.find((t) => t.id === editId);
      if (type) fillTypeForm(type);
      return;
    }

    const deleteId = event.target.getAttribute("data-delete-type");
    if (deleteId) {
      const name = event.target.getAttribute("data-name") || "该类型";
      if (!window.confirm(`确定删除类型「${name}」吗？`)) return;
      try {
        await window.AppUtils.fetchJson(`/api/quote-item-types/${encodeURIComponent(deleteId)}`, { method: "DELETE" }, "删除失败");
        window.AppUtils.showMessage("item-types-message", "类型已删除。", "success");
        await reloadTypes();
        fillTypeForm(null);
      } catch (error) {
        window.AppUtils.showMessage("item-types-message", error.message, "error");
      }
    }
  });
}

bootstrap().catch((error) => {
  window.AppUtils.showMessage("item-types-message", error.message, "error");
});
