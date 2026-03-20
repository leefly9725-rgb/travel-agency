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

function attachCardClicks(container) {
  container.querySelectorAll("[data-card-href]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a")) return;
      window.location.href = card.getAttribute("data-card-href");
    });
  });
}

let currentSortKey = "updated_at";
let cachedQuotes = [];

function sortQuotes(arr, sortKey) {
  const copy = [...arr];
  switch (sortKey) {
    case "updated_at":
      return copy.sort((a, b) => (b.updatedAt || "0").localeCompare(a.updatedAt || "0"));
    case "created_at":
      return copy.sort((a, b) => (b.createdAt || b.quoteNumber || "0").localeCompare(a.createdAt || a.quoteNumber || "0"));
    case "quoteNumber":
      return copy.sort((a, b) => (a.quoteNumber || "").localeCompare(b.quoteNumber || ""));
    case "clientName":
      return copy.sort((a, b) => (a.clientName || "").localeCompare(b.clientName || "", "zh-CN"));
    default:
      return copy;
  }
}

function renderProjectQuotes(quotes) {
  const container = document.getElementById("project-quote-list");
  const countEl = document.getElementById("project-quote-count");
  if (countEl) countEl.textContent = `${quotes.length} 条`;

  if (quotes.length === 0) {
    container.innerHTML = '<p class="empty list-empty-state">当前还没有项目型报价，点击上方“新建项目型报价”开始录入。</p>';
    return;
  }

  container.innerHTML = quotes.map((quote) => {
    const totalSales = quote.totalSales != null
      ? quote.totalSales
      : (quote.projectGroups || []).reduce((sum, group) => sum + (group.projectSalesTotal || 0), 0);
    const totalCost = quote.totalCost != null
      ? quote.totalCost
      : (quote.projectGroups || []).reduce((sum, group) => sum + (group.projectCostTotal || 0), 0);
    const grossProfit = totalSales - totalCost;
    const margin = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : "0.0";
    const groupCount = (quote.projectGroups || []).length;
    const itemCount = (quote.projectGroups || []).reduce((sum, group) => sum + (group.items || []).length, 0);
    const cardHref = `/quote-new.html?id=${encodeURIComponent(quote.id)}&mode=project_based`;
    const title = esc(sanitizeProjectName(quote.projectName));
    const deleteName = esc(sanitizeProjectName(quote.projectName));
    const dimPax = quote.paxCount == null;
    const dimGroups = groupCount === 0 && itemCount === 0;
    const dimAttr = ' style="opacity:0.45"';

    return `
      <article class="card quote-card quote-card-project" data-card-href="${cardHref}">
        <div class="list-row list-row-top quote-card-head">
          <div class="quote-card-main">
            <div class="title-row quote-title-row">
              <h3>${title}</h3>
              <span class="status-badge status-badge-strong">项目型报价</span>
              ${isFlaggedReview(quote) ? '<span class="review-badge">待复核</span>' : ""}
            </div>
            <p class="meta quote-card-meta">${esc(quote.clientName || "未填写客户")} · ${esc(quote.startDate || "日期待定")} · ${esc(quote.destination || "地点待定")}</p>
            <p class="quote-card-hint">按项目组汇总的活动 / 会展 / 综合服务报价，可直接进入编辑页继续维护。</p>
          </div>
          <div class="action-row quote-card-actions">
            <a class="button-link small-link action-link-primary" href="${cardHref}">编辑</a>
            <button class="ghost mini-button action-link-danger" data-delete-id="${esc(quote.id)}" data-name="${deleteName}">删除</button>
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

function renderQuotes(quotes) {
  const container = document.getElementById("quote-list");
  const countEl = document.getElementById("standard-quote-count");
  if (countEl) countEl.textContent = `${quotes.length} 条`;

  if (quotes.length === 0) {
    container.innerHTML = '<p class="empty list-empty-state">当前还没有标准报价，点击上方“新建标准报价”开始录入。</p>';
    return;
  }

  container.innerHTML = quotes.map((quote) => {
    const modeLabel = window.AppUi.getLabel("pricingModeLabels", quote.pricingMode || "standard");
    const dateInfo = `${quote.startDate || "—"} ~ ${quote.endDate || "—"}`;
    const locationInfo = quote.destination || "未填写";
    const cardHref = `/quote-detail.html?id=${encodeURIComponent(quote.id)}`;
    return `
      <article class="card quote-card quote-card-standard" data-card-href="${cardHref}">
        <div class="list-row list-row-top quote-card-head">
          <div class="quote-card-main">
            <div class="title-row quote-title-row">
              <h3>${esc(quote.projectName || "未命名报价")}</h3>
              <span class="status-badge">${esc(modeLabel)}</span>
              ${isFlaggedReview(quote) ? '<span class="review-badge">待复核</span>' : ""}
            </div>
            <p class="meta quote-card-meta">${esc(quote.quoteNumber || "无编号")} · ${esc(quote.clientName || "未填写客户")}</p>
          </div>
          <div class="action-row quote-card-actions">
            <a class="button-link small-link action-link-primary" href="/quote-new.html?id=${encodeURIComponent(quote.id)}">编辑</a>
            <a class="button-link small-link action-link-secondary" href="${cardHref}">查看详情</a>
            <button class="ghost mini-button action-link-danger" data-delete-id="${esc(quote.id)}" data-name="${esc(quote.projectName || '该报价')}">删除</button>
          </div>
        </div>
        <div class="detail-grid quote-card-metrics">
          <div class="metric quote-metric"><span>行程日期</span><strong>${esc(dateInfo)}</strong></div>
          <div class="metric quote-metric"><span>主要目的地</span><strong>${esc(locationInfo)}</strong></div>
          <div class="metric quote-metric"><span>销售合计</span><strong>${window.AppUtils.formatCurrency(quote.totalPrice, quote.currency)}</strong></div>
          <div class="metric quote-metric"><span>毛利率</span><strong>${quote.grossMargin}%</strong></div>
        </div>
        ${isFlaggedReview(quote) ? '<p class="review-inline-note">该报价已标记为待复核，正式业务使用前请先检查内容。</p>' : ''}
      </article>
    `;
  }).join("");

  attachCardClicks(container);
}

async function loadAllQuotes() {
  return window.AppUtils.fetchJson("/api/quotes", null, "报价列表加载失败，请稍后重试。");
}

function splitAndRender(allQuotes) {
  const sorted = sortQuotes(allQuotes, currentSortKey);
  const standard = sorted.filter((quote) => (quote.pricingMode || "standard") !== "project_based");
  const projectBased = sorted.filter((quote) => quote.pricingMode === "project_based");
  renderQuotes(standard);
  renderProjectQuotes(projectBased);
}

async function bootstrap() {
  window.AppUtils.applyFlash("quote-message");

  document.body.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-id]");
    if (!button) return;

    const deleteId = button.getAttribute("data-delete-id");
    if (!deleteId) return;

    const name = button.getAttribute("data-name") || "该报价";
    if (!window.confirm(`确认删除“${name}”吗？`)) return;

    try {
      window.AppUtils.hideMessage("quote-message");
      await window.AppUtils.fetchJson(
        `/api/quotes/${encodeURIComponent(deleteId)}`,
        { method: "DELETE" },
        "删除报价失败，请稍后重试。"
      );
      window.AppUtils.showMessage("quote-message", "报价已删除。", "success");
      cachedQuotes = await loadAllQuotes();
      splitAndRender(cachedQuotes);
    } catch (error) {
      window.AppUtils.showMessage("quote-message", error.message, "error");
    }
  });

  const sortSelect = document.getElementById("quote-sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      currentSortKey = sortSelect.value;
      splitAndRender(cachedQuotes);
    });
  }

  try {
    cachedQuotes = await loadAllQuotes();
    splitAndRender(cachedQuotes);
  } catch (error) {
    window.AppUtils.showMessage("quote-message", error.message, "error");
  }
}

bootstrap();
