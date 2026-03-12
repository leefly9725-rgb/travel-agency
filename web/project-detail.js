function isFlaggedReview(record) {
  return record?.dataQuality?.reviewStatus === "flagged_review";
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
    const project = await window.AppUtils.fetchJson(`/api/projects/${encodeURIComponent(id)}`, null, "项目档案加载失败，请稍后重试");
    const hasFlaggedQuotes = project.linkedQuotes.some((quote) => isFlaggedReview(quote));
    const container = document.getElementById("project-detail");
    container.innerHTML = `
      <section class="panel">
        <div class="panel-head panel-head-wrap">
          <div>
            <h1>${project.projectName}</h1>
            <p class="meta">${project.client}</p>
          </div>
          <span class="status-text">${window.AppUi.getLabel("projectStatusLabels", project.status)}</span>
        </div>
        ${hasFlaggedQuotes ? `
          <div class="review-note section-spacing">
            <strong>项目复核提示</strong>
            <p>该项目关联的报价中存在“待复核”记录，正式业务使用前请先检查相关报价内容。</p>
          </div>
        ` : ""}
        <div class="detail-grid section-spacing">
          <div class="metric"><span>日期范围</span><strong>${project.dateRange}</strong></div>
          <div class="metric"><span>PAX 人数</span><strong>${project.paxCount}</strong></div>
          <div class="metric"><span>特殊要求</span><strong>${project.specialRequirements}</strong></div>
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
                  <span>${quote.quoteNumber} / ${quote.projectName}</span>
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
              <span>${item.title} / ${window.AppUi.getLabel("receptionStatusLabels", item.status)}</span>
              <strong>${item.dueTime.replace("T", " ")}</strong>
            </div>
          `).join("") : '<p class="empty">暂无关联接待任务。</p>'}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>关联文档源数据</h2></div>
        <div class="table-like">
          ${project.linkedDocumentPreviews.length > 0 ? project.linkedDocumentPreviews.map((doc) => `
            <div class="table-row table-row-wide">
              <span>${doc.title}</span>
              <strong>${window.AppUi.getLabel("documentPreviewTypeLabels", doc.type)}</strong>
            </div>
          `).join("") : '<p class="empty">暂无关联文档源数据。</p>'}
        </div>
      </section>
    `;
  } catch (error) {
    window.AppUtils.showMessage("project-message", error.message, "error");
    document.getElementById("project-detail").innerHTML = window.AppUtils.renderEmptyState("项目档案不可用", error.message);
  }
}

bootstrap();
