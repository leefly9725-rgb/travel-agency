// ═══════════════════════════════════════════════════════════════════════════════
// 项目型报价主线声明（2026-04）
// ─────────────────────────────────────────────────────────────────────────────
// 列表主线：project-quotes.html / project-quotes.js（本文件）
// 编辑主线：quote-new.html?mode=project_based（驱动：quote-project-editor.js）
// 客户版输出：project-quotation.html
// 后端 API：/api/quotes（pricingMode=project_based）
//
// 以下对象已退场（兼容保留，不再承接新需求）：
//   quote-project.html / quote-project.js
//   /api/project-quotes / projectQuoteStore
// ═══════════════════════════════════════════════════════════════════════════════

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

function getProjectQuoteTotals(quote) {
  const groups = Array.isArray(quote?.projectGroups)
    ? quote.projectGroups
    : Array.isArray(quote?.project_groups)
      ? quote.project_groups
      : [];

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

  return {
    totalCost,
    totalSales,
    totalProfit,
    margin,
  };
}

function attachCardClicks(container) {
  container.querySelectorAll("[data-card-href]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a")) return;
      window.open(card.getAttribute("data-card-href"), "_blank", "noopener");
    });
  });
}

let cachedQuotes = [];
let currentSortKey = "updated_at";

function sortProjectQuotes(arr, key) {
  const copy = [...arr];
  switch (key) {
    case "updated_at":
      return copy.sort((a, b) =>
        (b.updatedAt || b.updated_at || "0").localeCompare(a.updatedAt || a.updated_at || "0")
      );
    case "created_at":
      return copy.sort((a, b) =>
        (b.createdAt || b.created_at || "0").localeCompare(a.createdAt || a.created_at || "0")
      );
    case "quoteNumber":
      return copy.sort((a, b) => (a.quoteNumber || "").localeCompare(b.quoteNumber || ""));
    case "clientName":
      return copy.sort((a, b) => (a.clientName || "").localeCompare(b.clientName || "", "zh-CN"));
    case "projectName":
      return copy.sort((a, b) => (a.projectName || "").localeCompare(b.projectName || "", "zh-CN"));
    default:
      return copy;
  }
}

function renderProjectQuotes(quotes) {
  const container = document.getElementById("project-quote-list");
  const countEl = document.getElementById("project-quote-count");
  if (countEl) countEl.textContent = `${quotes.length} 条`;

  if (quotes.length === 0) {
    container.innerHTML = '<p class="empty list-empty-state">当前还没有项目型报价，点击上方"新建项目型报价"开始录入。</p>';
    return;
  }

  const EXEC_CLS = { preparing: 'e-preparing', executing: 'e-executing', completed: 'e-completed' };

  container.innerHTML = quotes.map((quote) => {
    const totals = getProjectQuoteTotals(quote);
    const totalSales = totals.totalSales;
    const margin = totals.margin.toFixed(1);
    const groupCount = (quote.projectGroups || []).length;
    const itemCount = (quote.projectGroups || []).reduce((sum, group) => sum + (group.items || []).length, 0);
    const cardHref = `/quote-new.html?id=${encodeURIComponent(quote.id)}&mode=project_based`;
    const title = esc(sanitizeProjectName(quote.projectName));
    const deleteName = esc(sanitizeProjectName(quote.projectName));
    const dimPax = quote.paxCount == null;
    const dimGroups = groupCount === 0 && itemCount === 0;
    const dimAttr = ' style="opacity:0.45"';
    const execStatus = quote.executionStatus || "preparing";
    const execLabel = window.AppUi.getLabel("executionStatusLabels", execStatus) || execStatus;

    return `
      <article class="card quote-card quote-card-project" data-card-href="${cardHref}">
        <div class="list-row list-row-top quote-card-head">
          <div class="quote-card-main">
            <div class="title-row quote-title-row">
              <h3>${title}</h3>
              <span class="status-badge status-badge-strong">项目型报价</span>
              <span class="status-badge ${EXEC_CLS[execStatus] || 'e-preparing'}">${esc(execLabel)}</span>
              ${isFlaggedReview(quote) ? '<span class="review-badge">待复核</span>' : ""}
            </div>
            <p class="meta quote-card-meta">${esc(quote.clientName || "未填写客户")} · ${esc(quote.startDate || "日期待定")} · ${esc(quote.destination || "地点待定")}</p>
            <p class="quote-card-hint">按项目组汇总的活动 / 会展 / 综合服务报价，可直接进入编辑页继续维护。</p>
          </div>
          <div class="action-row quote-card-actions">
            ${window.can('project_quote.edit') ? `<a class="button-link small-link action-link-primary" href="${cardHref}" target="_blank" rel="noopener">编辑</a>` : ''}
            ${window.can('project_quote.delete') ? `<button class="ghost mini-button action-link-danger" data-delete-id="${esc(quote.id)}" data-name="${deleteName}">删除</button>` : ''}
          </div>
        </div>
        <div class="detail-grid quote-card-metrics">
          <div class="metric quote-metric"${dimPax ? dimAttr : ""}><span>参与人数</span><strong>${quote.paxCount != null ? quote.paxCount : "—"} 人</strong></div>
          <div class="metric quote-metric"${dimGroups ? dimAttr : ""}><span>项目组 / 明细</span><strong>${groupCount} 组 / ${itemCount} 项</strong></div>
          <div class="metric quote-metric"><span>报价合计</span><strong>${window.AppUtils.formatCurrency(totalSales, quote.currency || "EUR")}</strong></div>
          <div class="metric quote-metric"><span>毛利率</span><strong>${margin}%</strong></div>
        </div>
      </article>
    `;
  }).join("");

  attachCardClicks(container);
}

async function bootstrap() {
  window.AppUtils.applyFlash("project-quote-message");

  document.body.addEventListener("click", async (event) => {
    // ── 删除 ──────────────────────────────────────────────────────────────────
    const deleteBtn = event.target.closest("[data-delete-id]");
    if (deleteBtn) {
      const deleteId = deleteBtn.getAttribute("data-delete-id");
      if (!deleteId) return;
      const name = deleteBtn.getAttribute("data-name") || "该报价";
      if (!window.confirm(`确认删除"${name}"吗？`)) return;
      try {
        window.AppUtils.hideMessage("project-quote-message");
        await window.AppUtils.fetchJson(
          `/api/quotes/${encodeURIComponent(deleteId)}`,
          { method: "DELETE" },
          "删除报价失败，请稍后重试。"
        );
        window.AppUtils.showMessage("project-quote-message", "报价已删除。", "success");
        const allQuotes = await window.AppUtils.fetchJson("/api/quotes", null, "报价列表加载失败，请稍后重试。");
        cachedQuotes = allQuotes.filter((q) => q.pricingMode === "project_based");
        renderProjectQuotes(sortProjectQuotes(cachedQuotes, currentSortKey));
      } catch (error) {
        window.AppUtils.showMessage("project-quote-message", error.message, "error");
      }
      return;
    }

  });

  const sortSelect = document.getElementById("project-quote-sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      currentSortKey = sortSelect.value;
      renderProjectQuotes(sortProjectQuotes(cachedQuotes, currentSortKey));
    });
  }

  try {
    const allQuotes = await window.AppUtils.fetchJson("/api/quotes", null, "报价列表加载失败，请稍后重试。");
    cachedQuotes = allQuotes.filter((q) => q.pricingMode === "project_based");
    renderProjectQuotes(sortProjectQuotes(cachedQuotes, currentSortKey));
  } catch (error) {
    window.AppUtils.showMessage("project-quote-message", error.message, "error");
  }
}

bootstrap();

document.addEventListener('authReady', function () {
  var newProj = document.querySelector('a[href="/quote-new.html?mode=project_based"]');
  if (newProj && !window.can('project_quote.create')) newProj.style.display = 'none';

  if (cachedQuotes.length > 0) renderProjectQuotes(sortProjectQuotes(cachedQuotes, currentSortKey));
});
