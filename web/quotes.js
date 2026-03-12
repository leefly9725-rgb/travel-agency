function isFlaggedReview(record) {
  return record?.dataQuality?.reviewStatus === "flagged_review";
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

async function bootstrap() {
  window.AppUtils.applyFlash("quote-message");
  renderQuotes(await loadQuotes());

  document.body.addEventListener("click", async (event) => {
    const deleteId = event.target.getAttribute("data-delete-id");
    if (!deleteId) {
      return;
    }

    const name = event.target.getAttribute("data-name") || "该报价";
    const confirmed = window.confirm(`确定删除「${name}」吗？`);
    if (!confirmed) {
      return;
    }

    try {
      window.AppUtils.hideMessage("quote-message");
      await window.AppUtils.fetchJson(`/api/quotes/${encodeURIComponent(deleteId)}`, { method: "DELETE" }, "删除报价失败，请稍后重试。");
      window.AppUtils.showMessage("quote-message", "报价已删除。", "success");
      renderQuotes(await loadQuotes());
    } catch (error) {
      window.AppUtils.showMessage("quote-message", error.message, "error");
    }
  });
}

bootstrap().catch((error) => {
  window.AppUtils.showMessage("quote-message", error.message, "error");
});
