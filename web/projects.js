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

const PRIORITY_WEIGHT = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

const INCOMPLETE_STATUSES = new Set(["draft", "confirmed", "running"]);
const DAY_MS = 24 * 60 * 60 * 1000;

function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatCurrency(amount, currency) {
  if (typeof window.AppUtils?.formatCurrency === "function") {
    return window.AppUtils.formatCurrency(amount, currency);
  }
  return `${currency || "EUR"} ${Number(amount || 0).toFixed(2)}`;
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric.toFixed(1)}%`;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateTimeValue(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysUntil(value) {
  const date = normalizeDate(value);
  if (!date) return null;
  return Math.round((date.getTime() - getToday().getTime()) / DAY_MS);
}

function getDeadlineInfo(project) {
  const days = daysUntil(project.internalDeadline);
  if (days == null) {
    return { label: "未设置", tone: "empty", title: "暂无内部截止日期" };
  }
  if (days < 0) {
    return { label: `已逾期 ${Math.abs(days)} 天`, tone: "overdue", title: project.internalDeadline };
  }
  if (days === 0) {
    return { label: "今日截止", tone: "today", title: project.internalDeadline };
  }
  if (days <= 7) {
    return { label: `还有 ${days} 天`, tone: "soon", title: project.internalDeadline };
  }
  return { label: `还有 ${days} 天`, tone: "normal", title: project.internalDeadline };
}

function getDateRange(project) {
  if (project.startDate && project.endDate && project.startDate !== project.endDate) {
    return `${project.startDate} - ${project.endDate}`;
  }
  return project.startDate || project.endDate || "日期待定";
}

function getProjectSearchText(project) {
  return [
    project.projectName,
    project.clientName,
    project.destination,
    project.projectNumber,
    project.sourceQuoteNumber,
    project.operationOwner,
    project.salesOwner,
    project.coordinator,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isIncomplete(project) {
  return INCOMPLETE_STATUSES.has(project.status || "draft");
}

function compareDateAsc(a, b, getter) {
  const aDate = normalizeDate(getter(a));
  const bDate = normalizeDate(getter(b));
  if (!aDate && !bDate) return 0;
  if (!aDate) return 1;
  if (!bDate) return -1;
  return aDate.getTime() - bDate.getTime();
}

function defaultProjectCompare(a, b) {
  const incompleteDiff = Number(isIncomplete(b)) - Number(isIncomplete(a));
  if (incompleteDiff) return incompleteDiff;

  const priorityDiff = (PRIORITY_WEIGHT[b.priority || "normal"] || 0) - (PRIORITY_WEIGHT[a.priority || "normal"] || 0);
  if (priorityDiff) return priorityDiff;

  const deadlineDiff = compareDateAsc(a, b, (project) => project.internalDeadline);
  if (deadlineDiff) return deadlineDiff;

  return compareDateAsc(a, b, (project) => project.startDate);
}

function sortProjects(projects, sortKey) {
  const sorted = [...projects];
  if (sortKey === "deadline") {
    return sorted.sort((a, b) => compareDateAsc(a, b, (project) => project.internalDeadline));
  }
  if (sortKey === "priority") {
    return sorted.sort((a, b) => (PRIORITY_WEIGHT[b.priority || "normal"] || 0) - (PRIORITY_WEIGHT[a.priority || "normal"] || 0));
  }
  if (sortKey === "startDate") {
    return sorted.sort((a, b) => compareDateAsc(a, b, (project) => project.startDate));
  }
  if (sortKey === "sales") {
    return sorted.sort((a, b) => Number(b.totalSales || 0) - Number(a.totalSales || 0));
  }
  if (sortKey === "updated") {
    return sorted.sort((a, b) => dateTimeValue(b.updatedAt || b.createdAt) - dateTimeValue(a.updatedAt || a.createdAt));
  }
  return sorted.sort(defaultProjectCompare);
}

function buildStat(label, value, note, tone) {
  return `
    <div class="projects-stat-card projects-stat-${esc(tone || "neutral")}">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
      <small>${esc(note)}</small>
    </div>
  `;
}

function renderProjectStats(projects) {
  const total = projects.length;
  const running = projects.filter((project) => project.status === "running").length;
  const confirmed = projects.filter((project) => project.status === "confirmed").length;
  const ready = projects.filter((project) => project.operationStatus === "ready").length;
  const blocked = projects.filter((project) => project.operationStatus === "blocked").length;
  const urgent = projects.filter((project) => ["urgent", "high"].includes(project.priority || "normal")).length;
  const nearDeadline = projects.filter((project) => {
    const days = daysUntil(project.internalDeadline);
    return isIncomplete(project) && days != null && days <= 7;
  }).length;

  const container = document.getElementById("project-stats");
  if (!container) return;
  container.innerHTML = [
    buildStat("全部项目", total, "当前主档数量", "neutral"),
    buildStat("执行中", running, "需要持续跟进", "running"),
    buildStat("已确认", confirmed, "等待或准备执行", "confirmed"),
    buildStat("运营已准备", ready, "主档准备完成", "ready"),
    buildStat("阻塞", blocked, "需要优先排障", "blocked"),
    buildStat("紧急 / 高优先级", urgent, "优先检查资源", "urgent"),
    buildStat("临近截止", nearDeadline, "7 天内或已逾期", "near"),
  ].join("");
}

function getFilteredProjects() {
  const statusVal = document.getElementById("filter-status")?.value || "";
  const opStatusVal = document.getElementById("filter-op-status")?.value || "";
  const priorityVal = document.getElementById("filter-priority")?.value || "";
  const query = (document.getElementById("project-search")?.value || "").trim().toLowerCase();

  return allProjects.filter((project) => {
    if (statusVal && project.status !== statusVal) return false;
    if (opStatusVal && (project.operationStatus || "not_started") !== opStatusVal) return false;
    if (priorityVal && (project.priority || "normal") !== priorityVal) return false;
    if (query && !getProjectSearchText(project).includes(query)) return false;
    return true;
  });
}

function renderEmptyState(kind) {
  if (kind === "all") {
    return `
      <div class="projects-empty-state">
        <strong>当前还没有项目</strong>
        <p>请从项目型报价列表中点击“转为项目”创建第一个项目。</p>
        <a class="button-link" href="/quotes.html">前往项目型报价列表</a>
      </div>
    `;
  }
  return `
    <div class="projects-empty-state projects-empty-filter">
      <strong>没有符合条件的项目</strong>
      <p>请调整搜索关键词、筛选条件或排序方式后再查看。</p>
      <button type="button" id="reset-project-filters" class="secondary-button">清除筛选</button>
    </div>
  `;
}

function renderErrorState(message) {
  return `
    <div class="projects-empty-state projects-error-state">
      <strong>项目列表暂时无法显示</strong>
      <p>${esc(message || "请检查网络或稍后重试。")}</p>
      <button type="button" id="retry-projects-btn" class="button-link">重新加载</button>
    </div>
  `;
}

function renderProjectCard(project) {
  const status = project.status || "draft";
  const priority = project.priority || "normal";
  const operationStatus = project.operationStatus || "not_started";
  const statusLabel = PROJECT_STATUS_LABELS[status] || status;
  const priorityLabel = PRIORITY_LABELS[priority] || priority;
  const opStatusLabel = OP_STATUS_LABELS[operationStatus] || operationStatus;
  const currency = project.currency || "EUR";
  const deadlineInfo = getDeadlineInfo(project);
  const detailHref = `/project-detail.html?id=${encodeURIComponent(project.id)}`;
  const sourceQuoteHref = project.sourceQuoteId ? `/quote-new.html?id=${encodeURIComponent(project.sourceQuoteId)}&mode=project_based` : "";
  const customerQuoteHref = project.id ? `/project-quotation.html?id=${encodeURIComponent(project.id)}` : "";

  return `
    <article class="project-list-card project-card-priority-${esc(priority)} project-card-op-${esc(operationStatus)}">
      <div class="project-list-card-top">
        <div class="project-list-title-block">
          <span class="project-list-number">${esc(project.projectNumber || "项目编号待定")}</span>
          <h3>${esc(project.projectName || "未命名项目")}</h3>
        </div>
        <div class="project-list-chips" aria-label="项目状态">
          <span class="pl-chip pl-status-${esc(status)}">${esc(statusLabel)}</span>
          <span class="pl-chip pl-priority-${esc(priority)}">${esc(priorityLabel)}</span>
          <span class="pl-chip pl-op-${esc(operationStatus)}">${esc(opStatusLabel)}</span>
        </div>
      </div>

      <div class="project-list-core">
        <div><span>客户</span><strong>${esc(project.clientName || "—")}</strong></div>
        <div><span>目的地</span><strong>${esc(project.destination || "—")}</strong></div>
        <div><span>日期范围</span><strong>${esc(getDateRange(project))}</strong></div>
        <div><span>PAX</span><strong>${esc(project.pax || project.peopleCount || "—")}</strong></div>
      </div>

      <div class="project-list-ops">
        <div><span>项目负责人</span><strong>${esc(project.operationOwner || "—")}</strong></div>
        <div><span>销售负责人</span><strong>${esc(project.salesOwner || "—")}</strong></div>
        <div><span>协作人</span><strong>${esc(project.coordinator || "—")}</strong></div>
        <div class="project-deadline-cell">
          <span>内部截止</span>
          <strong>${esc(project.internalDeadline || "—")}</strong>
          <em class="project-deadline-pill deadline-${esc(deadlineInfo.tone)}" title="${esc(deadlineInfo.title)}">${esc(deadlineInfo.label)}</em>
        </div>
      </div>

      <div class="project-list-footer">
        <div class="project-finance-strip">
          <span>销售额 <strong>${formatCurrency(project.totalSales, currency)}</strong></span>
          <span>毛利 <strong>${formatCurrency(project.grossProfit, currency)}</strong></span>
          <span>毛利率 <strong>${esc(formatPercent(project.grossMargin))}</strong></span>
          <span>来源报价 <strong>${esc(project.sourceQuoteNumber || "—")}</strong></span>
        </div>
        <div class="project-card-actions">
          ${sourceQuoteHref ? `<a class="secondary-button" href="${sourceQuoteHref}">来源报价</a>` : ""}
          ${customerQuoteHref ? `<a class="secondary-button" href="${customerQuoteHref}">客户报价单</a>` : ""}
          <a class="button-link" href="${detailHref}">查看详情</a>
        </div>
      </div>
    </article>
  `;
}

function applyFilters() {
  const container = document.getElementById("project-list");
  if (!container) return;

  if (allProjects.length === 0) {
    container.innerHTML = renderEmptyState("all");
    return;
  }

  const sortKey = document.getElementById("project-sort")?.value || "default";
  const filtered = sortProjects(getFilteredProjects(), sortKey);
  const resultCount = document.getElementById("project-result-count");
  if (resultCount) {
    resultCount.textContent = `显示 ${filtered.length} / ${allProjects.length} 个项目`;
  }

  if (filtered.length === 0) {
    container.innerHTML = renderEmptyState("filtered");
    document.getElementById("reset-project-filters")?.addEventListener("click", resetFilters);
    return;
  }
  container.innerHTML = filtered.map(renderProjectCard).join("");
}

function resetFilters() {
  ["filter-status", "filter-op-status", "filter-priority"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const search = document.getElementById("project-search");
  if (search) search.value = "";
  const sort = document.getElementById("project-sort");
  if (sort) sort.value = "default";
  applyFilters();
}

async function loadProjects() {
  const container = document.getElementById("project-list");
  if (container) {
    container.innerHTML = '<div class="projects-loading">正在加载项目主档...</div>';
  }

  allProjects = await window.AppUtils.fetchJson("/api/projects", null, "项目列表加载失败，请稍后重试");
  renderProjectStats(allProjects);
  applyFilters();
}

function attachEvents() {
  ["filter-status", "filter-op-status", "filter-priority", "project-sort"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", applyFilters);
  });
  document.getElementById("project-search")?.addEventListener("input", applyFilters);
  document.getElementById("reset-project-filters-main")?.addEventListener("click", resetFilters);
  document.getElementById("refresh-projects-btn")?.addEventListener("click", async () => {
    try {
      await loadProjects();
      window.AppUtils.showMessage("project-message", "项目主档已刷新", "success");
    } catch (error) {
      window.AppUtils.showMessage("project-message", error.message, "error");
      const container = document.getElementById("project-list");
      if (container) {
        container.innerHTML = renderErrorState(error.message);
        document.getElementById("retry-projects-btn")?.addEventListener("click", loadProjects);
      }
    }
  });
}

async function bootstrap() {
  window.AppUtils.applyFlash("project-message");
  attachEvents();
  try {
    await loadProjects();
  } catch (error) {
    window.AppUtils.showMessage("project-message", error.message, "error");
    const container = document.getElementById("project-list");
    if (container) {
      container.innerHTML = renderErrorState(error.message);
      document.getElementById("retry-projects-btn")?.addEventListener("click", loadProjects);
    }
  }
}

let allProjects = [];

bootstrap();
