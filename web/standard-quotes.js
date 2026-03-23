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

function renderQuotes(quotes) {
  const container = document.getElementById("quote-list");
  const countEl = document.getElementById("standard-quote-count");
  if (countEl) countEl.textContent = `${quotes.length} 条`;

  if (quotes.length === 0) {
    container.innerHTML = '<p class="empty list-empty-state">当前还没有标准报价，点击上方"新建标准报价"开始录入。</p>';
    return;
  }

  const STATUS_CLS  = { draft: 's-draft', pending: 's-pending', approved: 's-approved', rejected: 's-rejected' };
  const EXEC_CLS    = { preparing: 'e-preparing', executing: 'e-executing', completed: 'e-completed' };

  container.innerHTML = quotes.map((quote) => {
    const modeLabel = window.AppUi.getLabel("pricingModeLabels", quote.pricingMode || "standard");
    const dateInfo = `${quote.startDate || "—"} ~ ${quote.endDate || "—"}`;
    const locationInfo = quote.destination || "未填写";
    const cardHref = `/quote-detail.html?id=${encodeURIComponent(quote.id)}`;
    const status = quote.status || "draft";
    const execStatus = quote.executionStatus || "preparing";
    const statusLabel = window.AppUi.getLabel("quoteStatusLabels", status) || status;
    const execLabel = window.AppUi.getLabel("executionStatusLabels", execStatus) || execStatus;
    return `
      <article class="card quote-card quote-card-standard" data-card-href="${cardHref}">
        <div class="list-row list-row-top quote-card-head">
          <div class="quote-card-main">
            <div class="title-row quote-title-row">
              <h3>${esc(quote.projectName || "未命名报价")}</h3>
              <span class="status-badge">${esc(modeLabel)}</span>
              <span class="status-badge ${STATUS_CLS[status] || 's-draft'}">${esc(statusLabel)}</span>
              <span class="status-badge ${EXEC_CLS[execStatus] || 'e-preparing'}">${esc(execLabel)}</span>
              ${isFlaggedReview(quote) ? '<span class="review-badge">待复核</span>' : ""}
            </div>
            <p class="meta quote-card-meta">${esc(quote.quoteNumber || "无编号")} · ${esc(quote.clientName || "未填写客户")}</p>
          </div>
          <div class="action-row quote-card-actions">
            ${window.can('standard_quote.edit') ? `<a class="button-link small-link action-link-primary" href="/quote-new.html?id=${encodeURIComponent(quote.id)}">编辑</a>` : ''}
            <a class="button-link small-link action-link-secondary" href="${cardHref}">查看详情</a>
            ${window.can('standard_quote.delete') ? `<button class="ghost mini-button action-link-danger" data-delete-id="${esc(quote.id)}" data-name="${esc(quote.projectName || '该报价')}">删除</button>` : ''}
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

async function bootstrap() {
  window.AppUtils.applyFlash("quote-message");

  document.body.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-id]");
    if (!button) return;

    const deleteId = button.getAttribute("data-delete-id");
    if (!deleteId) return;

    const name = button.getAttribute("data-name") || "该报价";
    if (!window.confirm(`确认删除"${name}"吗？`)) return;

    try {
      window.AppUtils.hideMessage("quote-message");
      await window.AppUtils.fetchJson(
        `/api/quotes/${encodeURIComponent(deleteId)}`,
        { method: "DELETE" },
        "删除报价失败，请稍后重试。"
      );
      window.AppUtils.showMessage("quote-message", "报价已删除。", "success");
      const allQuotes = await window.AppUtils.fetchJson("/api/quotes", null, "报价列表加载失败，请稍后重试。");
      cachedQuotes = allQuotes.filter((q) => (q.pricingMode || "standard") !== "project_based");
      renderQuotes(sortQuotes(cachedQuotes, currentSortKey));
    } catch (error) {
      window.AppUtils.showMessage("quote-message", error.message, "error");
    }
  });

  const sortSelect = document.getElementById("quote-sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      currentSortKey = sortSelect.value;
      renderQuotes(sortQuotes(cachedQuotes, currentSortKey));
    });
  }

  try {
    const allQuotes = await window.AppUtils.fetchJson("/api/quotes", null, "报价列表加载失败，请稍后重试。");
    cachedQuotes = allQuotes.filter((q) => (q.pricingMode || "standard") !== "project_based");
    renderQuotes(sortQuotes(cachedQuotes, currentSortKey));
  } catch (error) {
    window.AppUtils.showMessage("quote-message", error.message, "error");
  }
}

bootstrap();

document.addEventListener('authReady', function () {
  var newStd = document.querySelector('a[href="/quote-new.html"]');
  if (newStd && !window.can('standard_quote.create')) newStd.style.display = 'none';

  if (cachedQuotes.length > 0) renderQuotes(sortQuotes(cachedQuotes, currentSortKey));
});
