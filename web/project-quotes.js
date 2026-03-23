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

let cachedQuotes = [];

function renderApprovalActions(quote) {
  const status = quote.status || "draft";
  const canApprove = window.can && window.can("project_quote.approve");
  const canEdit    = window.can && window.can("project_quote.edit");

  if (canApprove) {
    if (status === "pending") return `
      <button class="ghost mini-button action-link-primary" data-approve-id="${esc(quote.id)}">批准</button>
      <button class="ghost mini-button action-link-danger"  data-reject-id="${esc(quote.id)}">拒绝</button>`;
    if (status === "approved") return `<span class="approval-status-text approved-text">已批准</span>`;
    if (status === "rejected") return `<span class="approval-status-text rejected-text">已拒绝</span>`;
    return "";
  }

  if (canEdit) {
    if (status === "draft")    return `<button class="ghost mini-button" data-submit-id="${esc(quote.id)}">提交审批</button>`;
    if (status === "pending")  return `<span class="approval-status-text muted-text">审批中</span>`;
    if (status === "approved") return `<span class="approval-status-text approved-text">已批准</span>`;
    if (status === "rejected") return `
      <span class="approval-status-text rejected-text">已拒绝</span>
      <button class="ghost mini-button" data-view-reason="${esc(quote.reviewNote || "暂无说明")}">查看原因</button>`;
  }
  return "";
}

function renderProjectQuotes(quotes) {
  const container = document.getElementById("project-quote-list");
  const countEl = document.getElementById("project-quote-count");
  if (countEl) countEl.textContent = `${quotes.length} 条`;

  if (quotes.length === 0) {
    container.innerHTML = '<p class="empty list-empty-state">当前还没有项目型报价，点击上方"新建项目型报价"开始录入。</p>';
    return;
  }

  const STATUS_CLS = { draft: 's-draft', pending: 's-pending', approved: 's-approved', rejected: 's-rejected' };
  const EXEC_CLS   = { preparing: 'e-preparing', executing: 'e-executing', completed: 'e-completed' };

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
    const status = quote.status || "draft";
    const execStatus = quote.executionStatus || "preparing";
    const statusLabel = window.AppUi.getLabel("quoteStatusLabels", status) || status;
    const execLabel = window.AppUi.getLabel("executionStatusLabels", execStatus) || execStatus;

    return `
      <article class="card quote-card quote-card-project" data-card-href="${cardHref}">
        <div class="list-row list-row-top quote-card-head">
          <div class="quote-card-main">
            <div class="title-row quote-title-row">
              <h3>${title}</h3>
              <span class="status-badge status-badge-strong">项目型报价</span>
              <span class="status-badge ${STATUS_CLS[status] || 's-draft'}">${esc(statusLabel)}</span>
              <span class="status-badge ${EXEC_CLS[execStatus] || 'e-preparing'}">${esc(execLabel)}</span>
              ${isFlaggedReview(quote) ? '<span class="review-badge">待复核</span>' : ""}
            </div>
            <p class="meta quote-card-meta">${esc(quote.clientName || "未填写客户")} · ${esc(quote.startDate || "日期待定")} · ${esc(quote.destination || "地点待定")}</p>
            <p class="quote-card-hint">按项目组汇总的活动 / 会展 / 综合服务报价，可直接进入编辑页继续维护。</p>
          </div>
          <div class="action-row quote-card-actions">
            ${renderApprovalActions(quote)}
            ${window.can('project_quote.edit') ? `<a class="button-link small-link action-link-primary" href="${cardHref}">编辑</a>` : ''}
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
        renderProjectQuotes(cachedQuotes);
      } catch (error) {
        window.AppUtils.showMessage("project-quote-message", error.message, "error");
      }
      return;
    }

    // ── 提交审批 ──────────────────────────────────────────────────────────────
    const submitBtn = event.target.closest("[data-submit-id]");
    if (submitBtn) {
      const id = submitBtn.getAttribute("data-submit-id");
      submitBtn.disabled = true;
      try {
        await window.AppUtils.fetchJson(
          `/api/project-quotes/${encodeURIComponent(id)}/submit`,
          { method: "POST" },
          "提交审批失败，请稍后重试。"
        );
        const q = cachedQuotes.find(x => x.id === id);
        if (q) q.status = "pending";
        renderProjectQuotes(cachedQuotes);
        window.AppUtils.showMessage("project-quote-message", "已提交审批，等待经理审核。", "success");
      } catch (err) {
        window.AppUtils.showMessage("project-quote-message", err.message, "error");
        submitBtn.disabled = false;
      }
      return;
    }

    // ── 批准 ──────────────────────────────────────────────────────────────────
    const approveBtn = event.target.closest("[data-approve-id]");
    if (approveBtn) {
      const id = approveBtn.getAttribute("data-approve-id");
      if (!window.confirm("确认批准该报价？")) return;
      approveBtn.disabled = true;
      try {
        await window.AppUtils.fetchJson(
          `/api/project-quotes/${encodeURIComponent(id)}/approve`,
          { method: "POST" },
          "批准操作失败，请稍后重试。"
        );
        const q = cachedQuotes.find(x => x.id === id);
        if (q) q.status = "approved";
        renderProjectQuotes(cachedQuotes);
        window.AppUtils.showMessage("project-quote-message", "报价已批准。", "success");
      } catch (err) {
        window.AppUtils.showMessage("project-quote-message", err.message, "error");
        approveBtn.disabled = false;
      }
      return;
    }

    // ── 拒绝 ──────────────────────────────────────────────────────────────────
    const rejectBtn = event.target.closest("[data-reject-id]");
    if (rejectBtn) {
      const id = rejectBtn.getAttribute("data-reject-id");
      const reason = window.prompt("请填写拒绝原因（必填）：");
      if (reason === null) return;
      if (!reason.trim()) { window.alert("拒绝原因不能为空。"); return; }
      rejectBtn.disabled = true;
      try {
        await window.AppUtils.fetchJson(
          `/api/project-quotes/${encodeURIComponent(id)}/reject`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) },
          "拒绝操作失败，请稍后重试。"
        );
        const q = cachedQuotes.find(x => x.id === id);
        if (q) { q.status = "rejected"; q.reviewNote = reason; }
        renderProjectQuotes(cachedQuotes);
        window.AppUtils.showMessage("project-quote-message", "报价已拒绝。", "success");
      } catch (err) {
        window.AppUtils.showMessage("project-quote-message", err.message, "error");
        rejectBtn.disabled = false;
      }
      return;
    }

    // ── 查看拒绝原因 ──────────────────────────────────────────────────────────
    const reasonBtn = event.target.closest("[data-view-reason]");
    if (reasonBtn) {
      const note = reasonBtn.getAttribute("data-view-reason") || "暂无说明";
      window.alert(`拒绝原因：\n${note}`);
    }
  });

  try {
    const allQuotes = await window.AppUtils.fetchJson("/api/quotes", null, "报价列表加载失败，请稍后重试。");
    cachedQuotes = allQuotes.filter((q) => q.pricingMode === "project_based");
    renderProjectQuotes(cachedQuotes);
  } catch (error) {
    window.AppUtils.showMessage("project-quote-message", error.message, "error");
  }
}

bootstrap();

document.addEventListener('authReady', function () {
  var newProj = document.querySelector('a[href="/quote-new.html?mode=project_based"]');
  if (newProj && !window.can('project_quote.create')) newProj.style.display = 'none';

  if (cachedQuotes.length > 0) renderProjectQuotes(cachedQuotes);
});
