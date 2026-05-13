const PROJECT_STATUS_LABELS = {
  draft: "草稿",
  confirmed: "已确认",
  running: "执行中",
  completed: "已完成",
  cancelled: "已取消",
};

function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function statusBadgeClass(status) {
  return { draft: "", confirmed: "e-preparing", running: "e-executing", completed: "e-completed", cancelled: "e-cancelled" }[status] || "";
}

function formatCurrency(amount, currency) {
  if (typeof window.AppUtils?.formatCurrency === "function") {
    return window.AppUtils.formatCurrency(amount, currency);
  }
  return `${currency || "EUR"} ${Number(amount || 0).toFixed(2)}`;
}

async function bootstrap() {
  window.AppUtils.applyFlash("project-message");
  try {
    const projects = await window.AppUtils.fetchJson("/api/projects", null, "项目列表加载失败，请稍后重试");
    const container = document.getElementById("project-list");

    if (projects.length === 0) {
      container.innerHTML = '<p class="empty">当前还没有项目。请在项目型报价列表中点击"转为项目"来创建第一个项目。</p>';
      return;
    }

    container.innerHTML = projects.map((project) => {
      const statusLabel = PROJECT_STATUS_LABELS[project.status] || project.status;
      const statusCls = statusBadgeClass(project.status);
      const currency = project.currency || "EUR";
      return `
        <article class="card">
          <div class="list-row list-row-top">
            <div>
              <div class="title-row">
                <h3>${esc(project.projectName || "未命名项目")}</h3>
                <span class="status-badge ${statusCls}">${esc(statusLabel)}</span>
              </div>
              <p class="meta">${esc(project.clientName)} · ${esc(project.destination || "目的地待定")} · ${esc(project.startDate || "日期待定")}</p>
            </div>
            <a class="button-link small-link" href="/project-detail.html?id=${encodeURIComponent(project.id)}">查看详情</a>
          </div>
          <div class="detail-grid">
            <div class="metric"><span>项目编号</span><strong>${esc(project.projectNumber)}</strong></div>
            <div class="metric"><span>来源报价</span><strong>${esc(project.sourceQuoteNumber || "—")}</strong></div>
            <div class="metric"><span>销售额</span><strong>${formatCurrency(project.totalSales, currency)}</strong></div>
            <div class="metric"><span>毛利</span><strong>${formatCurrency(project.grossProfit, currency)}</strong></div>
          </div>
        </article>
      `;
    }).join("");
  } catch (error) {
    window.AppUtils.showMessage("project-message", error.message, "error");
    document.getElementById("project-list").innerHTML = '<p class="empty">项目列表暂时无法显示，请稍后再试。</p>';
  }
}

bootstrap();
