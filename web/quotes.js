function isFlaggedReview(record) {
  return record?.dataQuality?.reviewStatus === "flagged_review";
}

function attachCardClicks(container) {
  container.querySelectorAll("[data-card-href]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a")) return;
      window.location.href = card.getAttribute("data-card-href");
    });
  });
}

function renderProjectQuotes(quotes) {
  const container = document.getElementById("project-quote-list");
  if (quotes.length === 0) {
    container.innerHTML = '<p class="empty">暂无项目型报价，点击「新建项目型报价」开始录入。</p>';
    return;
  }
  container.innerHTML = quotes.map((pq) => {
    const totalSell = pq.totalSales != null
      ? pq.totalSales
      : (pq.projectGroups || []).reduce((s, g) => s + (g.projectSalesTotal || 0), 0);
    const totalCost = pq.totalCost != null
      ? pq.totalCost
      : (pq.projectGroups || []).reduce((s, g) => s + (g.projectCostTotal || 0), 0);
    const grossProfit = totalSell - totalCost;
    const margin = totalSell > 0 ? ((grossProfit / totalSell) * 100).toFixed(1) : "0.0";
    const cardHref = `/quote-new.html?id=${encodeURIComponent(pq.id)}`;
    const groupCount = (pq.projectGroups || []).length;
    const itemCount = (pq.projectGroups || []).reduce((s, g) => s + (g.items || []).length, 0);
    return `
      <article class="card" data-card-href="${cardHref}">
        <div class="list-row list-row-top">
          <div>
            <div class="title-row">
              <h3>${pq.projectName || "未命名项目"}</h3>
              <span class="status-badge">项目型报价</span>
              ${isFlaggedReview(pq) ? '<span class="review-badge">待复核</span>' : ""}
            </div>
            <p class="meta">${pq.clientName || "暂无客户"} · ${pq.startDate || "日期待定"} · ${pq.destination || "地点待定"}</p>
          </div>
          <div class="action-row">
            <a class="button-link small-link" href="${cardHref}">编辑</a>
            <button class="ghost mini-button" data-delete-id="${pq.id}" data-name="${pq.projectName || "该报价"}">删除</button>
          </div>
        </div>
        <div class="detail-grid">
          <div class="metric"><span>参与人数</span><strong>${pq.paxCount || "—"} 人</strong></div>
          <div class="metric"><span>项目组 / 明细</span><strong>${groupCount} 组 / ${itemCount} 项</strong></div>
          <div class="metric"><span>报价合计</span><strong>${window.AppUtils.formatCurrency(totalSell, pq.currency || "EUR")}</strong></div>
          <div class="metric"><span>毛利率</span><strong>${margin}%</strong></div>
        </div>
      </article>
    `;
  }).join("");
  attachCardClicks(container);
}

function renderQuotes(quotes) {
  const container = document.getElementById("quote-list");
  if (quotes.length === 0) {
    container.innerHTML = '<p class="empty">当前还没有标准报价记录，先新建一份报价吧。</p>';
    return;
  }
  container.innerHTML = quotes.map((quote) => {
    const modeLabel = window.AppUi.getLabel("pricingModeLabels", quote.pricingMode || "standard");
    const dateInfo = `${quote.startDate || "—"} ~ ${quote.endDate || "—"}`;
    const locInfo = quote.destination || "—";
    const cardHref = `/quote-detail.html?id=${encodeURIComponent(quote.id)}`;
    return `
    <article class="card" data-card-href="${cardHref}">
      <div class="list-row list-row-top">
        <div>
          <div class="title-row">
            <h3>${quote.projectName}</h3>
            <span class="status-badge">${modeLabel}</span>
            ${isFlaggedReview(quote) ? '<span class="review-badge">待复核</span>' : ""}
          </div>
          <p class="meta">${quote.quoteNumber} / ${quote.clientName}</p>
        </div>
        <div class="action-row">
          <a class="button-link small-link" href="/quote-detail.html?id=${encodeURIComponent(quote.id)}">查看详情</a>
          <a class="button-link small-link" href="/quote-new.html?id=${encodeURIComponent(quote.id)}">编辑</a>
          <button class="ghost mini-button" data-delete-id="${quote.id}" data-name="${quote.projectName}">删除</button>
        </div>
      </div>
      <div class="detail-grid">
        <div class="metric"><span>行程日期</span><strong>${dateInfo}</strong></div>
        <div class="metric"><span>主要目的地</span><strong>${locInfo}</strong></div>
        <div class="metric"><span>售价合计</span><strong>${window.AppUtils.formatCurrency(quote.totalPrice, quote.currency)}</strong></div>
        <div class="metric"><span>毛利率</span><strong>${quote.grossMargin}%</strong></div>
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
  const standard = allQuotes.filter((q) => (q.pricingMode || "standard") !== "project_based");
  const projectBased = allQuotes.filter((q) => q.pricingMode === "project_based");
  renderQuotes(standard);
  renderProjectQuotes(projectBased);
}

async function bootstrap() {
  window.AppUtils.applyFlash("quote-message");
  splitAndRender(await loadAllQuotes());

  document.body.addEventListener("click", async (event) => {
    const deleteId = event.target.getAttribute("data-delete-id");
    if (deleteId) {
      const name = event.target.getAttribute("data-name") || "该报价";
      if (!window.confirm(`确定删除「${name}」吗？`)) return;
      try {
        window.AppUtils.hideMessage("quote-message");
        await window.AppUtils.fetchJson(
          `/api/quotes/${encodeURIComponent(deleteId)}`,
          { method: "DELETE" },
          "删除报价失败，请稍后重试。"
        );
        window.AppUtils.showMessage("quote-message", "报价已删除。", "success");
        splitAndRender(await loadAllQuotes());
      } catch (error) {
        window.AppUtils.showMessage("quote-message", error.message, "error");
      }
    }
  });
}

bootstrap().catch((error) => {
  window.AppUtils.showMessage("quote-message", error.message, "error");
});
