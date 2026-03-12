function renderTemplates(templates) {
  const container = document.getElementById("template-list");
  if (templates.length === 0) {
    container.innerHTML = '<p class="empty">当前还没有模板，先新建一个模板吧。</p>';
    return;
  }

  container.innerHTML = templates.map((template) => `
    <article class="card">
      <div class="list-row list-row-top">
        <div>
          <div class="title-row">
            <h3>${template.name}</h3>
            ${template.isBuiltIn ? '<span class="review-badge">内置模板</span>' : '<span class="status-text template-status-text">自定义</span>'}
          </div>
          <p class="meta">${template.description || "暂无模板说明"}</p>
        </div>
        <div class="action-row">
          <a class="button-link small-link" href="/template-edit.html?id=${encodeURIComponent(template.id)}">编辑</a>
          <button class="ghost mini-button" data-delete-id="${template.id}" data-name="${template.name}">删除</button>
        </div>
      </div>
      <div class="detail-grid">
        <div class="metric"><span>模板项目数</span><strong>${template.items.length}</strong></div>
        <div class="metric"><span>适用说明</span><strong>${template.description || "未填写"}</strong></div>
      </div>
      <div class="table-like section-spacing-sm">
        ${template.items.length > 0 ? template.items.map((item) => `
          <div class="table-row table-row-wide">
            <span>${window.AppUi.getLabel("quoteItemTypeLabels", item.type)} / ${item.name}</span>
            <strong>${item.quantity} ${item.unit} / ${window.AppUi.getLabel("currencyLabels", item.currency)}</strong>
          </div>
        `).join("") : '<p class="empty">空白模板，不包含预设报价项目。</p>'}
      </div>
    </article>
  `).join("");
}

async function loadTemplates() {
  return window.AppUtils.fetchJson("/api/templates", null, "模板列表加载失败，请稍后重试。");
}

async function bootstrap() {
  window.AppUtils.applyFlash("template-message");
  renderTemplates(await loadTemplates());

  document.body.addEventListener("click", async (event) => {
    const deleteId = event.target.getAttribute("data-delete-id");
    if (!deleteId) {
      return;
    }

    const name = event.target.getAttribute("data-name") || "该模板";
    const confirmed = window.confirm(`确定删除「${name}」吗？`);
    if (!confirmed) {
      return;
    }

    try {
      await window.AppUtils.fetchJson(`/api/templates/${encodeURIComponent(deleteId)}`, { method: "DELETE" }, "删除模板失败，请稍后重试。");
      window.AppUtils.showMessage("template-message", "模板已删除。", "success");
      renderTemplates(await loadTemplates());
    } catch (error) {
      window.AppUtils.showMessage("template-message", error.message, "error");
    }
  });
}

bootstrap().catch((error) => {
  window.AppUtils.showMessage("template-message", error.message, "error");
});
