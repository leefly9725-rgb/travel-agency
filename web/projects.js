const PROJECT_STATUS_LABELS = {
  draft: "草稿",
  confirmed: "已确认",
  running: "执行中",
  completed: "已完成",
  cancelled: "已取消",
};

const PRIORITY_LABELS = {
  low: "低",
  normal: "普通",
  high: "高",
  urgent: "紧急",
};

const OP_STATUS_LABELS = {
  not_started: "未开始",
  preparing: "准备中",
  ready: "已准备",
  blocked: "阻塞",
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

function renderProjectCard(project) {
  const statusLabel = PROJECT_STATUS_LABELS[project.status] || project.status;
  const statusCls = statusBadgeClass(project.status);
  const currency = project.currency || "EUR";
  const priorityLabel = PRIORITY_LABELS[project.priority] || project.priority || "普通";
  const priorityCls = `priority-badge priority-badge-${project.priority || "normal"}`;
  const opStatusLabel = OP_STATUS_LABELS[project.operationStatus] || project.operationStatus || "未开始";
  const opStatusCls = `op-status-badge op-status-badge-${project.operationStatus || "not_started"}`;
  const deadline = project.internalDeadline ? esc(project.internalDeadline) : "—";
  const owner = project.operationOwner ? esc(project.operationOwner) : "—";

  return `
    <article class="card">
      <div class="list-row list-row-top">
        <div>
          <div class="title-row">
            <h3>${esc(project.projectName || "未命名项目")}</h3>
            <span class="status-badge ${statusCls}">${esc(statusLabel)}</span>
          </div>
          <p class="meta">${esc(project.clientName)} · ${esc(project.destination || "目的地待定")} · ${esc(project.startDate || "日期待定")}</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
            <span class="${esc(priorityCls)}">${esc(priorityLabel)}</span>
            <span class="${esc(opStatusCls)}">${esc(opStatusLabel)}</span>
          </div>
        </div>
        <a class="button-link small-link" href="/project-detail.html?id=${encodeURIComponent(project.id)}">查看详情</a>
      </div>
      <div class="detail-grid">
        <div class="metric"><span>项目编号</span><strong>${esc(project.projectNumber)}</strong></div>
        <div class="metric"><span>来源报价</span><strong>${esc(project.sourceQuoteNumber || "—")}</strong></div>
        <div class="metric"><span>销售额</span><strong>${formatCurrency(project.totalSales, currency)}</strong></div>
        <div class="metric"><span>毛利</span><strong>${formatCurrency(project.grossProfit, currency)}</strong></div>
        <div class="metric"><span>项目负责人</span><strong>${owner}</strong></div>
        <div class="metric"><span>内部截止</span><strong>${deadline}</strong></div>
      </div>
    </article>
  `;
}

let allProjects = [];

function applyFilters() {
  const statusVal = document.getElementById("filter-status")?.value || "";
  const opStatusVal = document.getElementById("filter-op-status")?.value || "";
  const priorityVal = document.getElementById("filter-priority")?.value || "";

  const filtered = allProjects.filter((p) => {
    if (statusVal && p.status !== statusVal) return false;
    if (opStatusVal && (p.operationStatus || "not_started") !== opStatusVal) return false;
    if (priorityVal && (p.priority || "normal") !== priorityVal) return false;
    return true;
  });

  const container = document.getElementById("project-list");
  if (filtered.length === 0) {
    container.innerHTML = '<p class="filter-empty">当前筛选条件下暂无项目。</p>';
    return;
  }
  container.innerHTML = filtered.map(renderProjectCard).join("");
}

async function bootstrap() {
  window.AppUtils.applyFlash("project-message");
  try {
    allProjects = await window.AppUtils.fetchJson("/api/projects", null, "项目列表加载失败，请稍后重试");
    const container = document.getElementById("project-list");

    if (allProjects.length === 0) {
      container.innerHTML = '<p class="empty">当前还没有项目。请在项目型报价列表中点击"转为项目"来创建第一个项目。</p>';
      return;
    }

    applyFilters();

    ["filter-status", "filter-op-status", "filter-priority"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", applyFilters);
    });
  } catch (error) {
    window.AppUtils.showMessage("project-message", error.message, "error");
    document.getElementById("project-list").innerHTML = '<p class="empty">项目列表暂时无法显示，请稍后再试。</p>';
  }
}

bootstrap();
