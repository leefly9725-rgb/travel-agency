// 项目型报价列表主线：报价 -> 项目前置工作台
// 业务入口保持为 /api/quotes（pricingMode=project_based）和现有转项目接口。

const PROJECT_STATUS_LABELS = {
  draft: "草稿",
  confirmed: "已确认",
  running: "执行中",
  completed: "已完成",
  cancelled: "已取消",
};

const EXECUTION_STATUS_LABELS = {
  preparing: "准备中",
  executing: "执行中",
  completed: "已完成",
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

function sanitizeProjectName(name) {
  if (!name) return "未命名项目";
  const trimmed = name.trim();
  if (!trimmed || /^[?？]+$/.test(trimmed)) return "未命名项目";
  return trimmed;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dateValue(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function hasPermission(permissionCode) {
  return typeof window.can === "function" ? window.can(permissionCode) : true;
}

function formatCurrency(amount, currency) {
  if (typeof window.AppUtils?.formatCurrency === "function") {
    return window.AppUtils.formatCurrency(amount, currency || "EUR");
  }
  return `${currency || "EUR"} ${Number(amount || 0).toFixed(2)}`;
}

function getProjectGroups(quote) {
  return Array.isArray(quote?.projectGroups)
    ? quote.projectGroups
    : Array.isArray(quote?.project_groups)
      ? quote.project_groups
      : [];
}

function getProjectQuoteTotals(quote) {
  const groups = getProjectGroups(quote);
  let groupCost = 0;
  let groupSales = 0;

  groups.forEach((group) => {
    const items = Array.isArray(group?.items) ? group.items : [];
    let itemCost = 0;
    let itemSales = 0;

    items.forEach((item) => {
      const qty = toNumber(item?.quantity, 0);
      const costSubtotalRaw = item?.costSubtotal ?? item?.cost_subtotal;
      const salesSubtotalRaw = item?.salesSubtotal ?? item?.sales_subtotal;
      const costUnit = toNumber(
        item?.costUnitPrice ?? item?.cost_unit_price ?? item?.costPrice ?? item?.cost_price,
        0
      );
      const salesUnit = toNumber(
        item?.salesUnitPrice ?? item?.sales_unit_price ?? item?.salesPrice ?? item?.sales_price ?? item?.sell_price,
        0
      );

      itemCost += costSubtotalRaw != null ? toNumber(costSubtotalRaw, 0) : qty * costUnit;
      itemSales += salesSubtotalRaw != null ? toNumber(salesSubtotalRaw, 0) : qty * salesUnit;
    });

    const groupCostRaw = group?.projectCostTotal ?? group?.project_cost_total;
    const groupSalesRaw = group?.projectSalesTotal ?? group?.project_sales_total;
    const resolvedGroupCost = toNumber(groupCostRaw, 0) > 0 ? toNumber(groupCostRaw, 0) : itemCost;
    const resolvedGroupSales = toNumber(groupSalesRaw, 0) > 0 ? toNumber(groupSalesRaw, 0) : itemSales;

    groupCost += resolvedGroupCost;
    groupSales += resolvedGroupSales;
  });

  const quoteCost = toNumber(quote?.totalCost ?? quote?.total_cost, 0);
  const quoteSales = toNumber(quote?.totalSales ?? quote?.total_sales, 0);
  const totalCost = groupCost > 0 ? groupCost : quoteCost;
  const totalSales = groupSales > 0 ? groupSales : quoteSales;
  const totalProfit = totalSales - totalCost;
  const margin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

  return { totalCost, totalSales, totalProfit, margin };
}

function getQuoteComplexity(quote) {
  const groups = getProjectGroups(quote);
  const itemCount = groups.reduce((sum, group) => sum + (Array.isArray(group.items) ? group.items.length : 0), 0);
  return { groupCount: groups.length, itemCount };
}

function getLinkedProject(quote, projectById) {
  return quote.projectId ? projectById?.[quote.projectId] || null : null;
}

function getStatusKey(quote, linkedProject) {
  if (linkedProject) return linkedProject.status || "draft";
  return quote.executionStatus || "preparing";
}

function getSearchText(quote, linkedProject) {
  return [
    quote.quoteNumber,
    quote.projectName,
    quote.clientName,
    quote.destination,
    quote.sourceQuoteNumber,
    quote.projectId,
    linkedProject?.projectNumber,
    linkedProject?.id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function attachCardClicks(container) {
  container.querySelectorAll("[data-card-href]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a, select, input")) return;
      window.open(card.getAttribute("data-card-href"), "_blank", "noopener");
    });
  });
}

function sortProjectQuotes(arr, key) {
  const copy = [...arr];
  switch (key) {
    case "updated_at":
      return copy.sort((a, b) => dateValue(b.updatedAt || b.updated_at) - dateValue(a.updatedAt || a.updated_at));
    case "created_at":
      return copy.sort((a, b) => dateValue(b.createdAt || b.created_at) - dateValue(a.createdAt || a.created_at));
    case "quoteNumber":
      return copy.sort((a, b) => (a.quoteNumber || "").localeCompare(b.quoteNumber || ""));
    case "clientName":
      return copy.sort((a, b) => (a.clientName || "").localeCompare(b.clientName || "", "zh-CN"));
    case "projectName":
      return copy.sort((a, b) => (sanitizeProjectName(a.projectName)).localeCompare(sanitizeProjectName(b.projectName), "zh-CN"));
    case "totalSales":
      return copy.sort((a, b) => getProjectQuoteTotals(b).totalSales - getProjectQuoteTotals(a).totalSales);
    case "margin_high":
      return copy.sort((a, b) => getProjectQuoteTotals(b).margin - getProjectQuoteTotals(a).margin);
    case "margin_low":
      return copy.sort((a, b) => getProjectQuoteTotals(a).margin - getProjectQuoteTotals(b).margin);
    case "group_count":
      return copy.sort((a, b) => getQuoteComplexity(b).groupCount - getQuoteComplexity(a).groupCount);
    case "item_count":
      return copy.sort((a, b) => getQuoteComplexity(b).itemCount - getQuoteComplexity(a).itemCount);
    default:
      return copy;
  }
}

function buildStat(label, value, note, tone) {
  return `
    <div class="pq-stat-card pq-stat-${esc(tone || "neutral")}">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
      <small>${esc(note)}</small>
    </div>
  `;
}

function renderProjectQuoteStats(quotes) {
  const container = document.getElementById("project-quote-stats");
  if (!container) return;

  const converted = quotes.filter((quote) => quote.projectId).length;
  const unconverted = quotes.length - converted;
  const flagged = quotes.filter(isFlaggedReview).length;
  const totals = quotes.reduce((acc, quote) => {
    const quoteTotals = getProjectQuoteTotals(quote);
    const complexity = getQuoteComplexity(quote);
    acc.totalSales += quoteTotals.totalSales;
    acc.marginSum += quoteTotals.margin;
    acc.groups += complexity.groupCount;
    acc.items += complexity.itemCount;
    return acc;
  }, { totalSales: 0, marginSum: 0, groups: 0, items: 0 });
  const averageMargin = quotes.length ? `${(totals.marginSum / quotes.length).toFixed(1)}%` : "—";
  const currency = quotes.find((quote) => quote.currency)?.currency || "EUR";

  container.innerHTML = [
    buildStat("全部项目型报价", quotes.length, "当前可转项目报价", "neutral"),
    buildStat("未转项目", unconverted, "优先处理入口", "unconverted"),
    buildStat("已转项目", converted, "可进入执行主档", "converted"),
    buildStat("待复核", flagged, "先检查报价质量", "review"),
    buildStat("报价总额", formatCurrency(totals.totalSales, currency), "按当前币种汇总", "sales"),
    buildStat("平均毛利率", averageMargin, "内部利润参考", "margin"),
    buildStat("项目组 / 明细", `${totals.groups} / ${totals.items}`, "复杂度总览", "complexity"),
  ].join("");
}

function getFilteredQuotes() {
  const query = (document.getElementById("project-quote-search")?.value || "").trim().toLowerCase();
  const conversion = document.getElementById("project-quote-conversion-filter")?.value || "";
  const review = document.getElementById("project-quote-review-filter")?.value || "";
  const status = document.getElementById("project-quote-status-filter")?.value || "";

  return cachedQuotes.filter((quote) => {
    const linkedProject = getLinkedProject(quote, cachedProjectById);
    if (query && !getSearchText(quote, linkedProject).includes(query)) return false;
    if (conversion === "converted" && !quote.projectId) return false;
    if (conversion === "unconverted" && quote.projectId) return false;
    if (review === "flagged" && !isFlaggedReview(quote)) return false;
    if (status && getStatusKey(quote, linkedProject) !== status) return false;
    return true;
  });
}

function updateResultCount(count) {
  const countEl = document.getElementById("project-quote-count");
  const resultEl = document.getElementById("project-quote-result-count");
  if (countEl) countEl.textContent = `${cachedQuotes.length} 条`;
  if (resultEl) resultEl.textContent = `显示 ${count} / ${cachedQuotes.length} 条项目型报价`;
}

function renderEmptyState(kind) {
  if (kind === "all") {
    return `
      <div class="pq-empty-state">
        <strong>当前还没有项目型报价</strong>
        <p>活动、会议、展会等复杂报价可以从这里创建。</p>
        <a class="button-link" href="/quote-new.html?mode=project_based" target="_blank" rel="noopener">新建项目型报价</a>
      </div>
    `;
  }
  return `
    <div class="pq-empty-state pq-empty-filter">
      <strong>当前筛选条件下暂无项目型报价</strong>
      <p>请调整搜索关键词、转化状态、复核状态或排序方式。</p>
      <button type="button" id="project-quote-reset-inline" class="secondary-button">清空筛选</button>
    </div>
  `;
}

function renderErrorState(message) {
  return `
    <div class="pq-empty-state pq-error-state">
      <strong>项目型报价列表加载失败</strong>
      <p>${esc(message || "建议刷新页面或稍后重试。")}</p>
    </div>
  `;
}

function renderStatusChip(quote, linkedProject) {
  if (linkedProject) {
    const status = linkedProject.status || "draft";
    return `<span class="pq-chip pq-project-status-${esc(status)}">${esc(PROJECT_STATUS_LABELS[status] || status)}</span>`;
  }

  const status = quote.executionStatus || "preparing";
  const label = window.AppUi?.getLabel("executionStatusLabels", status) || EXECUTION_STATUS_LABELS[status] || status;
  return `<span class="pq-chip pq-exec-status-${esc(status)}">${esc(label)}</span>`;
}

function renderProjectCard(quote, projectById) {
  const totals = getProjectQuoteTotals(quote);
  const complexity = getQuoteComplexity(quote);
  const cardHref = `/quote-new.html?id=${encodeURIComponent(quote.id)}&mode=project_based`;
  const title = esc(sanitizeProjectName(quote.projectName));
  const deleteName = esc(sanitizeProjectName(quote.projectName));
  const isConverted = Boolean(quote.projectId);
  const linkedProject = getLinkedProject(quote, projectById);
  const conversionLabel = isConverted ? "已转项目" : "未转项目";
  const conversionClass = isConverted ? "converted" : "unconverted";
  const dateRange = quote.startDate && quote.endDate && quote.startDate !== quote.endDate
    ? `${quote.startDate} - ${quote.endDate}`
    : quote.startDate || quote.endDate || "日期待定";
  const pax = quote.paxCount != null ? `${quote.paxCount} 人` : "—";
  const groupText = complexity.groupCount > 0 ? `${complexity.groupCount} 组` : "—";
  const itemText = complexity.itemCount > 0 ? `${complexity.itemCount} 项` : "—";
  const projectNumber = linkedProject?.projectNumber || quote.projectId || "";

  return `
    <article class="pq-card pq-card-${conversionClass}${isFlaggedReview(quote) ? " pq-card-review" : ""}" data-card-href="${cardHref}">
      <div class="pq-card-head">
        <div class="pq-title-zone">
          <span class="pq-number">${esc(quote.quoteNumber || "报价编号待定")}</span>
          <h3>${title}</h3>
          <div class="pq-chip-row" aria-label="报价状态">
            <span class="pq-chip pq-mode-chip">项目型报价</span>
            <span class="pq-chip pq-conversion-${conversionClass}">${conversionLabel}</span>
            ${renderStatusChip(quote, linkedProject)}
            ${isFlaggedReview(quote) ? '<span class="pq-chip pq-review-chip">待复核</span>' : ""}
          </div>
        </div>
        <div class="pq-action-zone">
          ${isConverted
            ? `<a class="button-link pq-primary-action" href="/project-detail.html?id=${encodeURIComponent(quote.projectId)}">查看项目</a>`
            : `<button class="button-link pq-primary-action" data-convert-id="${esc(quote.id)}">转为项目</button>`
          }
          ${hasPermission("project_quote.edit") ? `<a class="secondary-button pq-secondary-action" href="${cardHref}" target="_blank" rel="noopener">${isConverted ? "编辑报价" : "编辑"}</a>` : ""}
          ${hasPermission("project_quote.delete") ? `<button class="ghost mini-button pq-danger-action" data-delete-id="${esc(quote.id)}" data-name="${deleteName}">删除</button>` : ""}
        </div>
      </div>

      <div class="pq-core-grid">
        <div><span>客户</span><strong>${esc(quote.clientName || "—")}</strong></div>
        <div><span>目的地</span><strong>${esc(quote.destination || "—")}</strong></div>
        <div><span>日期</span><strong>${esc(dateRange)}</strong></div>
        <div><span>参与人数</span><strong>${esc(pax)}</strong></div>
      </div>

      <div class="pq-detail-grid">
        <div class="pq-complexity-box">
          <span>项目复杂度</span>
          <strong>${esc(groupText)} / ${esc(itemText)}</strong>
          <small>${complexity.groupCount || complexity.itemCount ? "项目组 / 明细" : "暂无项目组明细"}</small>
        </div>
        <div>
          <span>报价合计</span>
          <strong>${formatCurrency(totals.totalSales, quote.currency || "EUR")}</strong>
          <small>${esc(quote.currency || "EUR")}</small>
        </div>
        <div>
          <span>毛利</span>
          <strong>${formatCurrency(totals.totalProfit, quote.currency || "EUR")}</strong>
          <small>内部参考</small>
        </div>
        <div>
          <span>毛利率</span>
          <strong>${totals.margin.toFixed(1)}%</strong>
          <small>${totals.totalSales > 0 ? "按报价合计计算" : "暂无报价金额"}</small>
        </div>
      </div>

      <div class="pq-card-foot">
        <span>${isConverted ? `已关联项目 ${esc(projectNumber || "—")}` : "尚未转入项目执行主档"}</span>
        <span>点击卡片可继续编辑报价</span>
      </div>
    </article>
  `;
}

function renderProjectQuotes(quotes, projectById) {
  const container = document.getElementById("project-quote-list");
  if (!container) return;
  updateResultCount(quotes.length);

  if (cachedQuotes.length === 0) {
    container.innerHTML = renderEmptyState("all");
    return;
  }

  if (quotes.length === 0) {
    container.innerHTML = renderEmptyState("filtered");
    document.getElementById("project-quote-reset-inline")?.addEventListener("click", resetFilters);
    return;
  }

  container.innerHTML = quotes.map((quote) => renderProjectCard(quote, projectById || cachedProjectById)).join("");
  attachCardClicks(container);
}

function applyFiltersAndSort() {
  const sortSelect = document.getElementById("project-quote-sort-select");
  currentSortKey = sortSelect?.value || currentSortKey;
  renderProjectQuotes(sortProjectQuotes(getFilteredQuotes(), currentSortKey), cachedProjectById);
}

function resetFilters() {
  const search = document.getElementById("project-quote-search");
  const conversion = document.getElementById("project-quote-conversion-filter");
  const review = document.getElementById("project-quote-review-filter");
  const status = document.getElementById("project-quote-status-filter");
  const sort = document.getElementById("project-quote-sort-select");
  if (search) search.value = "";
  if (conversion) conversion.value = "";
  if (review) review.value = "";
  if (status) status.value = "";
  if (sort) sort.value = "updated_at";
  currentSortKey = "updated_at";
  applyFiltersAndSort();
}

async function loadProjectQuotes() {
  const container = document.getElementById("project-quote-list");
  if (container) {
    container.innerHTML = '<div class="pq-loading">正在加载项目型报价...</div>';
  }

  const [allQuotes, allProjects] = await Promise.all([
    window.AppUtils.fetchJson("/api/quotes", null, "报价列表加载失败，请稍后重试。"),
    window.AppUtils.fetchJson("/api/projects", null, null).catch(() => []),
  ]);

  cachedQuotes = allQuotes.filter((q) => q.pricingMode === "project_based");
  cachedProjectById = {};
  if (Array.isArray(allProjects)) {
    allProjects.forEach((p) => { if (p && p.id) cachedProjectById[p.id] = p; });
  }
  renderProjectQuoteStats(cachedQuotes);
  applyFiltersAndSort();
}

function attachControls() {
  ["project-quote-conversion-filter", "project-quote-review-filter", "project-quote-status-filter", "project-quote-sort-select"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", applyFiltersAndSort);
  });
  document.getElementById("project-quote-search")?.addEventListener("input", applyFiltersAndSort);
  document.getElementById("project-quote-reset-filters")?.addEventListener("click", resetFilters);
}

function attachActions() {
  document.body.addEventListener("click", async (event) => {
    const convertBtn = event.target.closest("[data-convert-id]");
    if (convertBtn) {
      const quoteId = convertBtn.getAttribute("data-convert-id");
      if (!quoteId) return;
      convertBtn.disabled = true;
      convertBtn.textContent = "转换中...";
      try {
        const project = await window.AppUtils.fetchJson(
          `/api/quotes/${encodeURIComponent(quoteId)}/convert-to-project`,
          { method: "POST" },
          "转换失败，请稍后重试。"
        );
        window.AppUtils.setFlash("project-quote-message", "报价已转换为项目。", "success");
        window.location.href = `/project-detail.html?id=${encodeURIComponent(project.id)}`;
      } catch (error) {
        convertBtn.disabled = false;
        convertBtn.textContent = "转为项目";
        window.AppUtils.showMessage("project-quote-message", error.message, "error");
      }
      return;
    }

    const deleteBtn = event.target.closest("[data-delete-id]");
    if (deleteBtn) {
      const deleteId = deleteBtn.getAttribute("data-delete-id");
      if (!deleteId) return;
      const name = deleteBtn.getAttribute("data-name") || "该报价";
      if (!window.confirm(`确认删除“${name}”吗？`)) return;
      try {
        window.AppUtils.hideMessage("project-quote-message");
        await window.AppUtils.fetchJson(
          `/api/quotes/${encodeURIComponent(deleteId)}`,
          { method: "DELETE" },
          "删除报价失败，请稍后重试。"
        );
        window.AppUtils.showMessage("project-quote-message", "报价已删除。", "success");
        await loadProjectQuotes();
      } catch (error) {
        window.AppUtils.showMessage("project-quote-message", error.message, "error");
      }
    }
  });
}

async function bootstrap() {
  window.AppUtils.applyFlash("project-quote-message");
  attachControls();
  attachActions();
  try {
    await loadProjectQuotes();
  } catch (error) {
    window.AppUtils.showMessage("project-quote-message", error.message, "error");
    const container = document.getElementById("project-quote-list");
    if (container) container.innerHTML = renderErrorState(error.message);
  }
}

let cachedQuotes = [];
let cachedProjectById = {};
let currentSortKey = "updated_at";

bootstrap();

document.addEventListener("authReady", function () {
  const newProj = document.querySelector('a[href="/quote-new.html?mode=project_based"]');
  if (newProj && !hasPermission("project_quote.create")) newProj.style.display = "none";

  if (cachedQuotes.length > 0) {
    renderProjectQuoteStats(cachedQuotes);
    applyFiltersAndSort();
  }
});
