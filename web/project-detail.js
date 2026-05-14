const PROJECT_STATUS_LABELS = {
  draft: "草稿",
  confirmed: "已确认",
  running: "执行中",
  completed: "已完成",
  cancelled: "已取消",
};

const VALID_STATUSES = ["draft", "confirmed", "running", "completed", "cancelled"];

const PROJECT_ITEM_CATEGORY_LABELS = {
  hotel: "酒店",
  transport: "用车",
  vehicle: "用车",
  guide_translation: "导游/翻译",
  driver_guide: "司兼导",
  ticket: "门票",
  fuel: "燃油",
  toll_parking: "路桥停车",
  meal: "餐饮",
  dining: "餐饮",
  guide: "导游",
  interpreter: "翻译",
  misc: "杂项",
  av_equipment: "音视频设备",
  stage_structure: "舞台搭建",
  print_display: "印刷展示",
  decoration: "装饰布置",
  furniture: "家具陈设",
  personnel: "人员服务",
  logistics: "物流运输",
  management: "项目管理",
};

function isFlaggedReview(record) {
  return record?.dataQuality?.reviewStatus === "flagged_review";
}

function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatCurrency(amount, currency) {
  if (typeof window.AppUtils?.formatCurrency === "function") {
    return window.AppUtils.formatCurrency(amount, currency);
  }
  return `${currency || "EUR"} ${Number(amount || 0).toFixed(2)}`;
}

function getProjectStatusClass(status) {
  return VALID_STATUSES.includes(status) ? status : "draft";
}

function getProjectItemCategoryLabel(item, group) {
  const candidates = [
    item?.itemCategory,
    item?.item_category,
    item?.itemType,
    item?.item_type,
    group?.itemCategory,
    group?.item_category,
    group?.itemType,
    group?.item_type,
  ];

  for (const value of candidates) {
    const key = String(value || "").trim();
    if (!key) continue;
    if (PROJECT_ITEM_CATEGORY_LABELS[key]) return PROJECT_ITEM_CATEGORY_LABELS[key];
    if (/^type_\d+/i.test(key) || /^type_/i.test(key)) return "自定义分类";
  }

  return "未分类";
}

function renderStatusPanel(currentStatus, projectId) {
  const status = VALID_STATUSES.includes(currentStatus) ? currentStatus : "draft";
  const statusLabel = PROJECT_STATUS_LABELS[status] || status;
  const actions = VALID_STATUSES.map((s) => `
    <button
      type="button"
      class="project-status-button${s === status ? " is-active" : ""}"
      data-status-action="${s}"
      data-project-id="${esc(projectId)}"
      aria-pressed="${s === status ? "true" : "false"}"
    >${PROJECT_STATUS_LABELS[s] || s}</button>
  `).join("");

  return `
    <div class="project-status-panel" data-current-status="${esc(status)}">
      <div class="project-status-summary">
        <span class="project-status-title">项目状态</span>
        <span class="project-status-pill project-status-pill-${getProjectStatusClass(status)}">当前：${esc(statusLabel)}</span>
      </div>
      <div class="project-status-actions" role="group" aria-label="项目状态">
        ${actions}
      </div>
      <span id="status-save-hint" class="project-status-hint" aria-live="polite"></span>
    </div>
  `;
}

function renderSnapshotGroups(projectGroups, currency) {
  if (!Array.isArray(projectGroups) || projectGroups.length === 0) {
    return '<p class="empty">暂无报价明细快照。</p>';
  }
  return projectGroups.map((group) => {
    const items = Array.isArray(group.items) ? group.items : [];
    const groupCost = Number(group.projectCostTotal || group.project_cost_total || 0);
    const groupSales = Number(group.projectSalesTotal || group.project_sales_total || 0);
    const rows = items.map((item) => `
      <tr>
        <td>${esc(item.itemName || item.name_zh || "")}</td>
        <td>${esc(getProjectItemCategoryLabel(item, group))}</td>
        <td>${esc(item.specification || "")}</td>
        <td>${esc(item.unit || "")}</td>
        <td style="text-align:right">${Number(item.quantity || 0)}</td>
        <td style="text-align:right">${formatCurrency(item.costUnitPrice ?? item.cost_unit_price ?? 0, currency)}</td>
        <td style="text-align:right">${formatCurrency(item.salesUnitPrice ?? item.sales_unit_price ?? 0, currency)}</td>
        <td style="text-align:right">${formatCurrency(item.costSubtotal ?? item.cost_subtotal ?? 0, currency)}</td>
        <td style="text-align:right">${formatCurrency(item.salesSubtotal ?? item.sales_subtotal ?? 0, currency)}</td>
        <td>${esc(item.remarks || item.notes || "")}</td>
      </tr>
    `).join("");
    return `
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head" style="padding-bottom:8px">
          <h3>${esc(group.projectTitle || group.project_title || "未命名项目组")}</h3>
          <div style="font-size:13px;color:#666;">
            成本 ${formatCurrency(groupCost, currency)} · 销售 ${formatCurrency(groupSales, currency)}
          </div>
        </div>
        ${rows ? `
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#f5f5f5;text-align:left">
                <th style="padding:6px 8px">服务名称</th>
                <th style="padding:6px 8px">分类</th>
                <th style="padding:6px 8px">规格</th>
                <th style="padding:6px 8px">单位</th>
                <th style="padding:6px 8px;text-align:right">数量</th>
                <th style="padding:6px 8px;text-align:right">成本单价</th>
                <th style="padding:6px 8px;text-align:right">销售单价</th>
                <th style="padding:6px 8px;text-align:right">成本小计</th>
                <th style="padding:6px 8px;text-align:right">销售小计</th>
                <th style="padding:6px 8px">备注</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : '<p class="empty">本组暂无明细。</p>'}
      </div>
    `;
  }).join("");
}

function renderRealProject(project) {
  const snap = project.quoteSnapshot || {};
  const currency = project.currency || snap.currency || "EUR";

  return `
    <section class="panel">
      <div class="panel-head panel-head-wrap">
        <div>
          <p class="section-kicker">项目编号：${esc(project.projectNumber)}</p>
          <h1>${esc(project.projectName || "未命名项目")}</h1>
          <p class="meta">${esc(project.clientName)}</p>
        </div>
      </div>
      ${renderStatusPanel(project.status, project.id)}
      <div class="detail-grid section-spacing">
        <div class="metric"><span>联系人</span><strong>${esc(project.contactName || "—")}</strong></div>
        <div class="metric"><span>电话</span><strong>${esc(project.contactPhone || "—")}</strong></div>
        <div class="metric"><span>目的地</span><strong>${esc(project.destination || "—")}</strong></div>
        <div class="metric"><span>开始日期</span><strong>${esc(project.startDate || "—")}</strong></div>
        <div class="metric"><span>结束日期</span><strong>${esc(project.endDate || "—")}</strong></div>
        <div class="metric"><span>人数</span><strong>${project.paxCount || 0} 人</strong></div>
        <div class="metric"><span>币种</span><strong>${esc(currency)}</strong></div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>来源报价</h2></div>
      <div class="detail-grid">
        <div class="metric"><span>报价编号</span><strong>${esc(project.sourceQuoteNumber || "—")}</strong></div>
        <div class="metric"><span>报价模式</span><strong>项目型报价</strong></div>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        ${project.sourceQuoteId
          ? `<a class="button-link small-link" href="/quote-new.html?id=${encodeURIComponent(project.sourceQuoteId)}&mode=project_based" target="_blank" rel="noopener">查看原报价</a>
             <a class="button-link small-link" href="/project-quotation.html?id=${encodeURIComponent(project.sourceQuoteId)}" target="_blank" rel="noopener">客户报价单</a>`
          : '<span style="color:#999;font-size:13px">来源报价不可链接</span>'
        }
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>报价快照 · 明细</h2></div>
      ${renderSnapshotGroups(snap.projectGroups, currency)}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>汇总</h2></div>
      <div class="detail-grid">
        <div class="metric"><span>成本合计</span><strong>${formatCurrency(project.totalCost, currency)}</strong></div>
        <div class="metric"><span>销售合计</span><strong>${formatCurrency(project.totalSales, currency)}</strong></div>
        <div class="metric"><span>毛利</span><strong>${formatCurrency(project.grossProfit, currency)}</strong></div>
        <div class="metric"><span>毛利率</span><strong>${Number(project.grossMargin || 0).toFixed(1)}%</strong></div>
      </div>
    </section>
  `;
}

function renderArchiveProject(project) {
  const hasFlaggedQuotes = project.linkedQuotes.some((quote) => isFlaggedReview(quote));
  return `
    <section class="panel">
      <div class="panel-head panel-head-wrap">
        <div>
          <h1>${esc(project.projectName)}</h1>
          <p class="meta">${esc(project.client)}</p>
        </div>
        <span class="status-text">${window.AppUi ? window.AppUi.getLabel("projectStatusLabels", project.status) : project.status}</span>
      </div>
      ${hasFlaggedQuotes ? `
        <div class="review-note section-spacing">
          <strong>项目复核提示</strong>
          <p>该项目关联的报价中存在"待复核"记录，正式业务使用前请先检查相关报价内容。</p>
        </div>
      ` : ""}
      <div class="detail-grid section-spacing">
        <div class="metric"><span>日期范围</span><strong>${esc(project.dateRange)}</strong></div>
        <div class="metric"><span>PAX 人数</span><strong>${project.paxCount}</strong></div>
        <div class="metric"><span>特殊要求</span><strong>${esc(project.specialRequirements)}</strong></div>
        <div class="metric"><span>关联报价</span><strong>${project.linkedQuotes.length}</strong></div>
        <div class="metric"><span>关联接待任务</span><strong>${project.linkedReceptions.length}</strong></div>
        <div class="metric"><span>文档预览</span><strong>${project.linkedDocumentPreviews.length}</strong></div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>关联报价</h2></div>
      <div class="table-like">
        ${project.linkedQuotes.length > 0 ? project.linkedQuotes.map((quote) => `
          <div class="table-row table-row-wide">
            <div>
              <div class="title-row compact-title-row">
                <span>${esc(quote.quoteNumber)} / ${esc(quote.projectName)}</span>
                ${isFlaggedReview(quote) ? '<span class="review-badge">待复核</span>' : ''}
              </div>
              ${isFlaggedReview(quote) ? '<p class="review-inline-note">该报价已标记为待复核，请先检查后再用于正式业务。</p>' : ''}
            </div>
            <a class="button-link small-link" href="/quote-detail.html?id=${encodeURIComponent(quote.id)}">查看报价</a>
          </div>
        `).join("") : '<p class="empty">暂无关联报价。</p>'}
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>关联接待任务</h2></div>
      <div class="table-like">
        ${project.linkedReceptions.length > 0 ? project.linkedReceptions.map((item) => `
          <div class="table-row table-row-wide">
            <span>${esc(item.title)} / ${window.AppUi ? window.AppUi.getLabel("receptionStatusLabels", item.status) : item.status}</span>
            <strong>${esc(item.dueTime || "").replace("T", " ")}</strong>
          </div>
        `).join("") : '<p class="empty">暂无关联接待任务。</p>'}
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>关联文档源数据</h2></div>
      <div class="table-like">
        ${project.linkedDocumentPreviews.length > 0 ? project.linkedDocumentPreviews.map((doc) => `
          <div class="table-row table-row-wide">
            <span>${esc(doc.title)}</span>
            <strong>${window.AppUi ? window.AppUi.getLabel("documentPreviewTypeLabels", doc.type) : doc.type}</strong>
          </div>
        `).join("") : '<p class="empty">暂无关联文档源数据。</p>'}
      </div>
    </section>
  `;
}

async function handleStatusButtonClick(event) {
  const button = event.target.closest("[data-status-action]");
  if (!button) return;
  const projectId = button.getAttribute("data-project-id");
  const newStatus = button.getAttribute("data-status-action");
  const panel = button.closest(".project-status-panel");
  if (!projectId || !newStatus || button.classList.contains("is-active")) return;

  const hint = document.getElementById("status-save-hint");
  const buttons = panel ? Array.from(panel.querySelectorAll("[data-status-action]")) : [];
  if (hint) hint.textContent = "保存中…";
  buttons.forEach((btn) => { btn.disabled = true; });

  try {
    await window.AppUtils.fetchJson(
      `/api/projects/${encodeURIComponent(projectId)}/status`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) },
      "状态更新失败，请稍后重试。"
    );
    if (panel) {
      panel.setAttribute("data-current-status", newStatus);
      const pill = panel.querySelector(".project-status-pill");
      if (pill) {
        pill.className = `project-status-pill project-status-pill-${getProjectStatusClass(newStatus)}`;
        pill.textContent = `当前：${PROJECT_STATUS_LABELS[newStatus] || newStatus}`;
      }
      buttons.forEach((btn) => {
        const isActive = btn.getAttribute("data-status-action") === newStatus;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }
    if (hint) { hint.textContent = "已保存"; setTimeout(() => { hint.textContent = ""; }, 2000); }
  } catch (error) {
    if (hint) hint.textContent = "保存失败";
    window.AppUtils.showMessage("project-message", error.message, "error");
  } finally {
    buttons.forEach((btn) => { btn.disabled = false; });
  }
}

async function bootstrap() {
  window.AppUtils.applyFlash("project-message");
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    document.getElementById("project-detail").innerHTML = window.AppUtils.renderEmptyState("未找到项目编号", "请从项目列表重新进入详情页。");
    return;
  }

  try {
    const project = await window.AppUtils.fetchJson(`/api/projects/${encodeURIComponent(id)}`, null, "项目详情加载失败，请稍后重试");
    const container = document.getElementById("project-detail");

    // Real project entity has quoteSnapshot; archive view has linkedQuotes
    if (project.quoteSnapshot !== undefined) {
      container.innerHTML = renderRealProject(project);
      document.title = `项目 · ${project.projectName || project.projectNumber}`;
      container.addEventListener("click", handleStatusButtonClick);
    } else {
      container.innerHTML = renderArchiveProject(project);
    }
  } catch (error) {
    window.AppUtils.showMessage("project-message", error.message, "error");
    document.getElementById("project-detail").innerHTML = window.AppUtils.renderEmptyState("项目详情不可用", error.message);
  }
}

bootstrap();
