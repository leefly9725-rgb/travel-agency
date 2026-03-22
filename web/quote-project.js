// ── Activity templates ────────────────────────────────────────────────────────

const ACTIVITY_TEMPLATES = {
  opening_ceremony: {
    label: "开业庆典",
    items: [
      { groupName: "舞台结构", nameZh: "主舞台", nameEn: "Main Stage", unit: "套", quantity: 1 },
      { groupName: "舞台结构", nameZh: "入口拱门+印刷", nameEn: "Entrance Portal+Print", unit: "套", quantity: 1 },
      { groupName: "舞台结构", nameZh: "讲台", nameEn: "Podium", unit: "个", quantity: 1 },
      { groupName: "音视频设备", nameZh: "音响系统", nameEn: "Sound System", unit: "套", quantity: 1 },
      { groupName: "音视频设备", nameZh: "LED大屏", nameEn: "LED Screen", unit: "套", quantity: 1 },
      { groupName: "印刷展示", nameZh: "背景墙+印刷", nameEn: "Back Wall+Print", unit: "套", quantity: 1 },
      { groupName: "印刷展示", nameZh: "新闻墙", nameEn: "Press Wall", unit: "套", quantity: 1 },
      { groupName: "装饰物料", nameZh: "走道红毯", nameEn: "Walkway Red Carpet", unit: "套", quantity: 1 },
      { groupName: "装饰物料", nameZh: "礼炮彩纸", nameEn: "Confetti Sprayer", unit: "套", quantity: 2 },
      { groupName: "家具桌椅", nameZh: "VIP帐篷+家具", nameEn: "VIP Tent+Furniture", unit: "套", quantity: 1 },
      { groupName: "人员服务", nameZh: "礼仪+摄影", nameEn: "Hosts+Photographers", unit: "套", quantity: 1 },
      { groupName: "人员服务", nameZh: "主持人", nameEn: "Event Host", unit: "人", quantity: 1 },
      { groupName: "物流设备", nameZh: "发电机", nameEn: "Generator", unit: "套", quantity: 1 },
      { groupName: "管理服务", nameZh: "代理费10%", nameEn: "Agency Fee 10%", unit: "式", quantity: 1 },
      { groupName: "管理服务", nameZh: "设计+印前", nameEn: "Design+Prepress", unit: "套", quantity: 1 },
    ],
  },
  large_conference: {
    label: "大型会议",
    items: [
      { groupName: "舞台结构", nameZh: "主舞台", nameEn: "Main Stage", unit: "套", quantity: 1 },
      { groupName: "舞台结构", nameZh: "讲台", nameEn: "Podium", unit: "个", quantity: 1 },
      { groupName: "音视频设备", nameZh: "音响系统", nameEn: "Sound System", unit: "套", quantity: 1 },
      { groupName: "音视频设备", nameZh: "LED大屏", nameEn: "LED Screen", unit: "套", quantity: 1 },
      { groupName: "音视频设备", nameZh: "同传耳机(三语)", nameEn: "SI Headset 3-lang", unit: "套", quantity: 1 },
      { groupName: "音视频设备", nameZh: "混合直播设备", nameEn: "Hybrid Streaming", unit: "套", quantity: 1 },
      { groupName: "家具桌椅", nameZh: "会场桌椅", nameEn: "Venue Tables+Chairs", unit: "桌", quantity: 30 },
      { groupName: "印刷展示", nameZh: "背景墙+印刷", nameEn: "Back Wall+Print", unit: "套", quantity: 1 },
      { groupName: "人员服务", nameZh: "主持人", nameEn: "Event Host", unit: "人", quantity: 1 },
      { groupName: "人员服务", nameZh: "安保", nameEn: "Security", unit: "次", quantity: 1 },
      { groupName: "物流设备", nameZh: "发电机", nameEn: "Generator", unit: "套", quantity: 1 },
      { groupName: "管理服务", nameZh: "代理费10%", nameEn: "Agency Fee 10%", unit: "式", quantity: 1 },
      { groupName: "管理服务", nameZh: "预制作费", nameEn: "Pre-production", unit: "项", quantity: 1 },
    ],
  },
  product_launch: {
    label: "发布会",
    items: [
      { groupName: "舞台结构", nameZh: "主舞台", nameEn: "Main Stage", unit: "套", quantity: 1 },
      { groupName: "舞台结构", nameZh: "讲台", nameEn: "Podium", unit: "个", quantity: 1 },
      { groupName: "音视频设备", nameZh: "LED大屏", nameEn: "LED Screen", unit: "套", quantity: 1 },
      { groupName: "音视频设备", nameZh: "音响系统", nameEn: "Sound System", unit: "套", quantity: 1 },
      { groupName: "印刷展示", nameZh: "背景墙+印刷", nameEn: "Back Wall+Print", unit: "套", quantity: 1 },
      { groupName: "印刷展示", nameZh: "新闻墙", nameEn: "Press Wall", unit: "套", quantity: 1 },
      { groupName: "印刷展示", nameZh: "展示架", nameEn: "Display Stands", unit: "套", quantity: 1 },
      { groupName: "装饰物料", nameZh: "走道红毯", nameEn: "Walkway Red Carpet", unit: "套", quantity: 1 },
      { groupName: "人员服务", nameZh: "主持人", nameEn: "Event Host", unit: "人", quantity: 1 },
      { groupName: "人员服务", nameZh: "礼仪+摄影", nameEn: "Hosts+Photographers", unit: "套", quantity: 1 },
      { groupName: "管理服务", nameZh: "代理费10%", nameEn: "Agency Fee 10%", unit: "式", quantity: 1 },
      { groupName: "管理服务", nameZh: "设计+印前", nameEn: "Design+Prepress", unit: "套", quantity: 1 },
    ],
  },
  exhibition_reception: {
    label: "展会接待",
    items: [
      { groupName: "舞台结构", nameZh: "展位结构搭建", nameEn: "Booth Construction", unit: "套", quantity: 1 },
      { groupName: "舞台结构", nameZh: "拱门", nameEn: "Arched Door", unit: "套", quantity: 1 },
      { groupName: "印刷展示", nameZh: "展示架", nameEn: "Display Stands", unit: "套", quantity: 1 },
      { groupName: "印刷展示", nameZh: "背景墙印刷", nameEn: "Back Wall Print", unit: "套", quantity: 1 },
      { groupName: "印刷展示", nameZh: "围栏印刷", nameEn: "Fence Printing", unit: "套", quantity: 1 },
      { groupName: "音视频设备", nameZh: "音响系统", nameEn: "Sound System", unit: "套", quantity: 1 },
      { groupName: "家具桌椅", nameZh: "洽谈桌椅", nameEn: "Meeting Tables+Chairs", unit: "套", quantity: 1 },
      { groupName: "物流设备", nameZh: "围栏", nameEn: "Frame Fence", unit: "套", quantity: 1 },
      { groupName: "物流设备", nameZh: "红地毯", nameEn: "Red Carpet", unit: "套", quantity: 1 },
      { groupName: "人员服务", nameZh: "礼仪+摄影", nameEn: "Hosts+Photographers", unit: "套", quantity: 1 },
      { groupName: "管理服务", nameZh: "代理费10%", nameEn: "Agency Fee 10%", unit: "式", quantity: 1 },
    ],
  },
};

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  projectId: null,
  viewMode: "internal",  // "internal" | "client"
  rowCounter: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getProjectId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || null;
}

function formatMoney(amount, currency) {
  return window.AppUtils.formatCurrency(Number(amount) || 0, currency || "EUR");
}

function getFormCurrency() {
  return document.querySelector("#project-header-form select[name='currency']").value || "EUR";
}

// ── Row rendering ─────────────────────────────────────────────────────────────

function createItemRow(defaults) {
  const id = `row-${++state.rowCounter}`;
  const tr = document.createElement("tr");
  tr.dataset.rowId = id;
  tr.innerHTML = `
    <td><input class="cell-input col-group-input" name="groupName" value="${esc(defaults?.groupName || "")}" placeholder="组别" /></td>
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
    <td><input class="cell-input" name="notes" value="${esc(defaults?.notes || "")}" placeholder="备注" /></td>
    <td><button type="button" class="ghost mini-button delete-row">✕</button></td>
  `;
  updateRowComputedCells(tr);
  return tr;
}

function esc(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function updateRowComputedCells(tr) {
  const qty = Number(tr.querySelector('[name="quantity"]').value || 0);
  const cost = Number(tr.querySelector('[name="costPrice"]').value || 0);
  const sell = Number(tr.querySelector('[name="sellPrice"]').value || 0);
  const costSub = qty * cost;
  const sellSub = qty * sell;
  const margin = sellSub > 0 ? ((sellSub - costSub) / sellSub * 100).toFixed(1) : "—";
  const currency = getFormCurrency();

  tr.querySelector('[data-field="costSubtotal"]').textContent = costSub > 0 ? formatMoney(costSub, currency) : "—";
  tr.querySelector('[data-field="sellSubtotal"]').textContent = sellSub > 0 ? formatMoney(sellSub, currency) : "—";
  tr.querySelector('[data-field="margin"]').textContent = margin !== "—" ? `${margin}%` : "—";
}

// ── Table management ──────────────────────────────────────────────────────────

function getItemsFromTable() {
  const tbody = document.getElementById("items-tbody");
  const rows = Array.from(tbody.querySelectorAll("tr[data-row-id]"));
  return rows.map((tr, index) => ({
    groupName: tr.querySelector('[name="groupName"]').value.trim(),
    nameZh: tr.querySelector('[name="nameZh"]').value.trim(),
    nameEn: tr.querySelector('[name="nameEn"]').value.trim(),
    unit: tr.querySelector('[name="unit"]').value.trim(),
    quantity: Number(tr.querySelector('[name="quantity"]').value || 1),
    costPrice: Number(tr.querySelector('[name="costPrice"]').value || 0),
    sellPrice: Number(tr.querySelector('[name="sellPrice"]').value || 0),
    supplier: tr.querySelector('[name="supplier"]').value.trim(),
    notes: tr.querySelector('[name="notes"]').value.trim(),
    isActive: true,
    sortOrder: index,
  }));
}

function renderItemsTable(items) {
  const tbody = document.getElementById("items-tbody");
  tbody.innerHTML = "";

  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="13" class="empty">暂无物料，点击「添加物料行」或选择活动模板开始录入。</td></tr>';
    return;
  }

  items.forEach((item) => {
    tbody.appendChild(createItemRow(item));
  });
  updateSummary();
}

function addEmptyRow() {
  const tbody = document.getElementById("items-tbody");
  const emptyRow = tbody.querySelector(".empty-row");
  if (emptyRow) emptyRow.remove();

  // Detect last used group name for convenience
  const existingRows = tbody.querySelectorAll("tr[data-row-id]");
  let lastGroup = "";
  if (existingRows.length > 0) {
    const lastRow = existingRows[existingRows.length - 1];
    lastGroup = lastRow.querySelector('[name="groupName"]').value || "";
  }

  const tr = createItemRow({ groupName: lastGroup });
  tbody.appendChild(tr);
  tr.querySelector('[name="nameZh"]').focus();
  updateSummary();
}

// ── Summary calculation ────────────────────────────────────────────────────────

function updateSummary() {
  const items = getItemsFromTable();
  const currency = getFormCurrency();

  let totalCost = 0;
  let totalSell = 0;
  const groupTotals = {};

  items.forEach((item) => {
    const costSub = item.quantity * item.costPrice;
    const sellSub = item.quantity * item.sellPrice;
    totalCost += costSub;
    totalSell += sellSub;

    const group = item.groupName || "未分组";
    if (!groupTotals[group]) groupTotals[group] = { cost: 0, sell: 0 };
    groupTotals[group].cost += costSub;
    groupTotals[group].sell += sellSub;
  });

  const grossProfit = totalSell - totalCost;
  const margin = totalSell > 0 ? ((grossProfit / totalSell) * 100).toFixed(1) : "0.0";

  document.getElementById("sum-count").textContent = `${items.length} 条`;
  document.getElementById("sum-cost").textContent = formatMoney(totalCost, currency);
  document.getElementById("sum-sell").textContent = formatMoney(totalSell, currency);
  document.getElementById("sum-profit").textContent = formatMoney(grossProfit, currency);
  document.getElementById("sum-margin").textContent = `${margin}%`;

  // Group breakdown
  const breakdown = document.getElementById("group-breakdown");
  const groups = Object.entries(groupTotals);
  if (groups.length === 0) {
    breakdown.innerHTML = "";
    return;
  }
  breakdown.innerHTML = `
    <h4 class="section-title" style="margin-bottom:8px">分组汇总</h4>
    ${groups.map(([name, totals]) => `
      <div class="list-row" style="padding:4px 0;font-size:13px">
        <span style="color:var(--text-secondary)">${name}</span>
        <span>${formatMoney(totals.sell, currency)}</span>
      </div>
    `).join("")}
  `;
}

// ── View toggle ───────────────────────────────────────────────────────────────

function applyViewMode() {
  const isClient = state.viewMode === "client";
  document.getElementById("view-label").textContent = isClient ? "客户视图" : "内部视图";
  document.getElementById("btn-toggle-view").textContent = isClient ? "切换内部视图" : "切换客户视图";

  document.querySelectorAll(".view-internal").forEach((el) => {
    el.style.display = isClient ? "none" : "";
  });
}

// ── Load / save ───────────────────────────────────────────────────────────────

function getHeaderPayload() {
  const form = document.getElementById("project-header-form");
  return {
    name: form.querySelector('[name="name"]').value.trim(),
    client: form.querySelector('[name="client"]').value.trim(),
    eventDate: form.querySelector('[name="eventDate"]').value,
    venue: form.querySelector('[name="venue"]').value.trim(),
    paxCount: Number(form.querySelector('[name="paxCount"]').value || 0),
    currency: form.querySelector('[name="currency"]').value,
    status: form.querySelector('[name="status"]').value,
    notes: form.querySelector('[name="notes"]').value.trim(),
  };
}

function fillHeaderForm(project) {
  const form = document.getElementById("project-header-form");
  form.querySelector('[name="name"]').value = project.name || "";
  form.querySelector('[name="client"]').value = project.client || "";
  form.querySelector('[name="eventDate"]').value = project.eventDate || "";
  form.querySelector('[name="venue"]').value = project.venue || "";
  form.querySelector('[name="paxCount"]').value = project.paxCount || 0;
  form.querySelector('[name="currency"]').value = project.currency || "EUR";
  form.querySelector('[name="status"]').value = project.status || "draft";
  form.querySelector('[name="notes"]').value = project.notes || "";
}

async function loadProject(projectId) {
  const project = await window.AppUtils.fetchJson(
    `/api/project-quotes/${encodeURIComponent(projectId)}`,
    null,
    "加载项目型报价失败",
  );
  fillHeaderForm(project);
  renderItemsTable(project.items || []);
  document.getElementById("page-title").textContent = project.name || "项目型报价";
  document.getElementById("btn-delete").classList.remove("hidden");
  const termsBtn = document.getElementById("btn-terms");
  if (termsBtn) termsBtn.href = `/terms-editor.html?quote_id=${encodeURIComponent(project.id)}`;
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
    const url = projectId ? `/api/project-quotes/${encodeURIComponent(projectId)}` : "/api/project-quotes";
    const method = projectId ? "PUT" : "POST";
    const saved = await window.AppUtils.fetchJson(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, "保存失败");

    if (!projectId) {
      // Redirect to edit URL after create
      window.location.href = `/quote-project.html?id=${encodeURIComponent(saved.id)}`;
      return;
    }
    window.AppUtils.showMessage("pq-message", "项目型报价已保存。", "success");
    fillHeaderForm(saved);
    renderItemsTable(saved.items || []);
    document.getElementById("page-title").textContent = saved.name || "项目型报价";
  } catch (error) {
    window.AppUtils.showMessage("pq-message", error.message, "error");
  }
}

async function deleteProject() {
  const projectId = state.projectId;
  if (!projectId) return;

  try {
    await window.AppUtils.fetchJson(
      `/api/project-quotes/${encodeURIComponent(projectId)}`,
      { method: "DELETE" },
      "删除失败",
    );
    window.AppUtils.setFlash("项目型报价已删除。");
    window.location.href = "/quotes.html";
  } catch (error) {
    window.AppUtils.showMessage("pq-message", error.message, "error");
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function bootstrap() {
  window.AppUtils.applyFlash("pq-message");

  state.projectId = getProjectId();

  if (state.projectId) {
    try {
      await loadProject(state.projectId);
    } catch (error) {
      window.AppUtils.showMessage("pq-message", error.message, "error");
    }
  }

  applyViewMode();

  // View toggle
  document.getElementById("btn-toggle-view").addEventListener("click", () => {
    state.viewMode = state.viewMode === "internal" ? "client" : "internal";
    applyViewMode();
  });

  // Add row
  document.getElementById("btn-add-row").addEventListener("click", addEmptyRow);

  // Apply template
  document.getElementById("btn-apply-template").addEventListener("click", () => {
    const templateKey = document.getElementById("template-select").value;
    if (!templateKey) {
      window.AppUtils.showMessage("pq-message", "请先选择一个活动模板。", "error");
      return;
    }
    const template = ACTIVITY_TEMPLATES[templateKey];
    if (!template) return;

    const tbody = document.getElementById("items-tbody");
    const existingRows = tbody.querySelectorAll("tr[data-row-id]");
    if (existingRows.length > 0) {
      if (!window.confirm(`应用「${template.label}」模板将替换当前所有物料行，确定继续吗？`)) return;
    }

    renderItemsTable(template.items);
    document.getElementById("template-select").value = "";
    window.AppUtils.showMessage("pq-message", `已加载「${template.label}」模板，请填写成本价和销售单价。`, "success");
  });

  // Save
  document.getElementById("btn-save").addEventListener("click", saveProject);

  // Delete
  document.getElementById("btn-delete").addEventListener("click", () => {
    const name = document.querySelector('[name="name"]').value || "此报价";
    if (!window.confirm(`确定删除「${name}」吗？`)) return;
    deleteProject();
  });

  // Currency change → refresh computed cells and summary
  document.querySelector('[name="currency"]').addEventListener("change", () => {
    document.querySelectorAll("tr[data-row-id]").forEach(updateRowComputedCells);
    updateSummary();
  });

  // Delegated events on table body
  document.getElementById("items-tbody").addEventListener("input", (event) => {
    const tr = event.target.closest("tr[data-row-id]");
    if (!tr) return;
    updateRowComputedCells(tr);
    updateSummary();
  });

  document.getElementById("items-tbody").addEventListener("click", (event) => {
    if (event.target.classList.contains("delete-row")) {
      const tr = event.target.closest("tr[data-row-id]");
      if (tr) {
        tr.remove();
        const tbody = document.getElementById("items-tbody");
        if (!tbody.querySelector("tr[data-row-id]")) {
          tbody.innerHTML = '<tr class="empty-row"><td colspan="13" class="empty">暂无物料，点击「添加物料行」或选择活动模板开始录入。</td></tr>';
        }
        updateSummary();
      }
    }
  });
}

bootstrap().catch((error) => {
  window.AppUtils.showMessage("pq-message", error.message, "error");
});
