function createOptionList(items, selectedValue, labelBuilder) {
  return items.map((item) => {
    const value = item.id || item;
    const label = labelBuilder ? labelBuilder(item) : value;
    const selected = value === selectedValue ? "selected" : "";
    return `<option value="${value}" ${selected}>${label}</option>`;
  }).join("");
}

function isFlaggedReview(record) {
  return record?.dataQuality?.reviewStatus === "flagged_review";
}

async function loadPreview() {
  const form = document.getElementById("document-filter-form");
  const quote = state.quotes.find((item) => item.id === form.quoteId.value);
  const params = new URLSearchParams({
    quoteId: form.quoteId.value,
    receptionId: form.receptionId.value,
  });
  const previews = await window.AppUtils.fetchJson(`/api/document-previews?${params.toString()}`, null, "文档源数据加载失败，请稍后重试");
  const container = document.getElementById("document-preview-list");
  container.innerHTML = `
    ${isFlaggedReview(quote) ? `
      <section class="review-note">
        <strong>待复核提示</strong>
        <p>${quote.dataQuality.note || "当前文档预览引用的报价记录已标记为待复核，请在正式业务使用前先检查源数据。"}</p>
      </section>
    ` : ""}
    ${previews.map((preview) => `
      <article class="panel">
        <div class="panel-head">
          <h2>${preview.title}</h2>
          <span>${window.AppUi.getLabel("documentPreviewTypeLabels", preview.type)}</span>
        </div>
        ${preview.sections.map((section) => `
          <div class="subpanel">
            <h3>${section.title}</h3>
            <div class="table-like">
              ${section.rows.map((row) => `
                <div class="table-row table-row-wide">
                  <span>${row.label}</span>
                  <strong>${row.value}</strong>
                </div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </article>
    `).join("")}
  `;
}

const state = {
  quotes: [],
  receptions: [],
};

async function bootstrap() {
  const [quotes, receptions] = await Promise.all([
    window.AppUtils.fetchJson("/api/quotes", null, "报价数据加载失败，请稍后重试"),
    window.AppUtils.fetchJson("/api/receptions", null, "接待任务数据加载失败，请稍后重试"),
  ]);
  state.quotes = quotes;
  state.receptions = receptions;

  const params = new URLSearchParams(window.location.search);
  const selectedQuoteId = params.get("quoteId") || (quotes[0] && quotes[0].id) || "";
  const selectedReceptionId = params.get("receptionId") || (receptions[0] && receptions[0].id) || "";

  const form = document.getElementById("document-filter-form");
  form.innerHTML = `
    <label><span>选择报价</span><select name="quoteId">${createOptionList(quotes, selectedQuoteId, (item) => `${item.quoteNumber} / ${item.projectName}`)}</select></label>
    <label><span>选择接待任务</span><select name="receptionId">${createOptionList(receptions, selectedReceptionId, (item) => `${item.title} / ${item.assignee}`)}</select></label>
    <div class="button-row filter-button-row"><button type="submit">刷新预览</button></div>
  `;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadPreview();
  });

  form.quoteId.addEventListener("change", loadPreview);
  form.receptionId.addEventListener("change", loadPreview);
  await loadPreview();
}

bootstrap().catch((error) => {
  document.body.innerHTML = `<pre style="padding:24px;color:#a33;">${error.message}</pre>`;
});
