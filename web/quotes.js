function isFlaggedReview(record) {
  return record?.dataQuality?.reviewStatus === "flagged_review";
}

function renderProjectQuotes(projects) {
  const container = document.getElementById("project-quote-list");
  if (projects.length === 0) {
    container.innerHTML = '<p class="empty">暂无项目型报价，点击「新建项目型报价」开始录入。</p>';
    return;
  }
  container.innerHTML = projects.map((pq) => {
    const statusLabel = window.AppUi.getLabel("projectQuoteStatusLabels", pq.status);
    const totalSell = (pq.items || []).reduce((sum, item) => sum + Number(item.quantity || 1) * Number(item.sellPrice || 0), 0);
    const totalCost = (pq.items || []).reduce((sum, item) => sum + Number(item.quantity || 1) * Number(item.costPrice || 0), 0);
    const grossProfit = totalSell - totalCost;
    const margin = totalSell > 0 ? ((grossProfit / totalSell) * 100).toFixed(1) : "0.0";
    return `
      <article class="card">
        <div class="list-row list-row-top">
          <div>
            <div class="title-row">
              <h3>${pq.name}</h3>
              <span class="status-badge">${statusLabel}</span>
            </div>
            <p class="meta">${pq.client || "暂无客户"} · ${pq.eventDate || "日期待定"} · ${pq.venue || "地点待定"}</p>
          </div>
          <div class="action-row">
            <a class="button-link small-link" href="/quote-project.html?id=${encodeURIComponent(pq.id)}">编辑</a>
            <button class="ghost mini-button" data-delete-pq-id="${pq.id}" data-name="${pq.name}">删除</button>
          </div>
        </div>
        <div class="detail-grid">
          <div class="metric"><span>参与人数</span><strong>${pq.paxCount || "—"} 人</strong></div>
          <div class="metric"><span>物料条数</span><strong>${(pq.items || []).length} 条</strong></div>
          <div class="metric"><span>报价合计</span><strong>${window.AppUtils.formatCurrency(totalSell, pq.currency || "EUR")}</strong></div>
          <div class="metric"><span>毛利率</span><strong>${margin}%</strong></div>
        </div>
      </article>
    `;
  }).join("");
}

function renderQuotes(quotes) {
  const container = document.getElementById("quote-list");
  if (quotes.length === 0) {
    container.innerHTML = '<p class="empty">当前还没有报价记录，先新建一份报价吧。</p>';
    return;
  }

  container.innerHTML = quotes.map((quote) => `
    <article class="card">
      <div class="list-row list-row-top">
        <div>
          <div class="title-row">
            <h3>${quote.projectName}</h3>
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
        <div class="metric"><span>行程日期</span><strong>${quote.startDate} ~ ${quote.endDate}</strong></div>
        <div class="metric"><span>主要目的地</span><strong>${quote.destination}</strong></div>
        <div class="metric"><span>售价合计</span><strong>${window.AppUtils.formatCurrency(quote.totalPrice, quote.currency)}</strong></div>
        <div class="metric"><span>毛利率</span><strong>${quote.grossMargin}%</strong></div>
      </div>
      ${isFlaggedReview(quote) ? '<p class="review-inline-note">该报价已标记为待复核，正式业务使用前请先检查内容。</p>' : ''}
    </article>
  `).join("");
}

async function loadQuotes() {
  return window.AppUtils.fetchJson("/api/quotes", null, "报价列表加载失败，请稍后重试。");
}

async function loadProjectQuotes() {
  return window.AppUtils.fetchJson("/api/project-quotes", null, "项目型报价列表加载失败，请稍后重试。");
}

async function bootstrap() {
  window.AppUtils.applyFlash("quote-message");

  const [quotes, projectQuotes] = await Promise.all([loadQuotes(), loadProjectQuotes()]);
  renderQuotes(quotes);
  renderProjectQuotes(projectQuotes);

  document.body.addEventListener("click", async (event) => {
    const deleteId = event.target.getAttribute("data-delete-id");
    if (deleteId) {
      const name = event.target.getAttribute("data-name") || "该报价";
      if (!window.confirm(`确定删除「${name}」吗？`)) return;
      try {
        window.AppUtils.hideMessage("quote-message");
        await window.AppUtils.fetchJson(`/api/quotes/${encodeURIComponent(deleteId)}`, { method: "DELETE" }, "删除报价失败，请稍后重试。");
        window.AppUtils.showMessage("quote-message", "报价已删除。", "success");
        renderQuotes(await loadQuotes());
      } catch (error) {
        window.AppUtils.showMessage("quote-message", error.message, "error");
      }
      return;
    }

    const deletePqId = event.target.getAttribute("data-delete-pq-id");
    if (deletePqId) {
      const name = event.target.getAttribute("data-name") || "该项目型报价";
      if (!window.confirm(`确定删除「${name}」吗？`)) return;
      try {
        window.AppUtils.hideMessage("project-quote-message");
        await window.AppUtils.fetchJson(`/api/project-quotes/${encodeURIComponent(deletePqId)}`, { method: "DELETE" }, "删除失败，请稍后重试。");
        window.AppUtils.showMessage("project-quote-message", "项目型报价已删除。", "success");
        renderProjectQuotes(await loadProjectQuotes());
      } catch (error) {
        window.AppUtils.showMessage("project-quote-message", error.message, "error");
      }
    }
  });
}

bootstrap().catch((error) => {
  window.AppUtils.showMessage("quote-message", error.message, "error");
});
