const EXECUTION_STATUS_LABELS = {
  pending: "待处理",
  in_progress: "进行中",
  done: "已完成",
  cancelled: "已取消",
};

const COST_STATUS_LABELS = {
  not_started: "未开始",
  estimated: "已估算",
  confirmed: "已确认",
  changed: "有变更",
};

const SUPPLIER_STATUS_LABELS = {
  not_required: "无需供应商",
  not_started: "未开始",
  inquiring: "询价中",
  quoted: "已报价",
  selected: "已选择",
  confirmed: "已确认",
};

const PROJECT_STATUS_LABELS = {
  draft: "草稿",
  confirmed: "已确认",
  running: "执行中",
  completed: "已完成",
  cancelled: "已取消",
};

const VALID_STATUSES = ["draft", "confirmed", "running", "completed", "cancelled"];

const PROJECT_ITEM_CATEGORY_LABELS = {
  hotel: "酒店",
  transport: "用车",
  vehicle: "用车",
  guide_translation: "导游/翻译",
  driver_guide: "司兼导",
  ticket: "门票",
  tickets: "门票",
  fuel: "燃油",
  toll_parking: "路桥停车",
  parking: "停车",
  meal: "餐饮",
  dining: "餐饮",
  guide: "导游",
  interpreter: "翻译",
  misc: "杂项",
  av_equipment: "音视频设备",
  stage_structure: "舞台搭建",
  print_display: "印刷展示",
  decoration: "装饰布置",
  furniture: "家具陈设",
  personnel: "人员服务",
  logistics: "物流运输",
  management: "项目管理",
  travel: "旅游服务",
  meeting: "会议",
};

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

function formatCurrency(amount, currency) {
  if (typeof window.AppUtils?.formatCurrency === "function") {
    return window.AppUtils.formatCurrency(amount, currency);
  }
  return `${currency || "EUR"} ${Number(amount || 0).toFixed(2)}`;
}

function getProjectStatusClass(status) {
  return VALID_STATUSES.includes(status) ? status : "draft";
}

function getProjectItemCategoryLabel(item, group) {
  const candidates = [
    item?.itemCategory,
    item?.item_category,
    item?.itemType,
    item?.item_type,
    group?.itemCategory,
    group?.item_category,
    group?.itemType,
    group?.item_type,
  ];

  for (const value of candidates) {
    const key = String(value || "").trim();
    if (!key) continue;
    if (PROJECT_ITEM_CATEGORY_LABELS[key]) return PROJECT_ITEM_CATEGORY_LABELS[key];
    if (/^type_\d+/i.test(key) || /^type_/i.test(key)) return "自定义分类";
  }

  return "未分类";
}

function getExecutionCategoryLabel(item) {
  for (const c of [item.category, item.type]) {
    const k = String(c || "").trim();
    if (k && PROJECT_ITEM_CATEGORY_LABELS[k]) return PROJECT_ITEM_CATEGORY_LABELS[k];
  }
  return "其他";
}

function getProjectDateRange(project) {
  if (!project?.startDate && !project?.endDate) return "—";
  if (project.startDate && project.endDate) return `${project.startDate} 至 ${project.endDate}`;
  return project.startDate || project.endDate;
}

function getDominantSupplierStatus(items) {
  const priority = ["confirmed", "selected", "quoted", "inquiring", "not_started", "not_required"];
  const counts = new Map();
  items.forEach((item) => {
    const key = item.supplierStatus || "not_started";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  let best = "not_started";
  for (const status of priority) {
    if ((counts.get(status) || 0) > (counts.get(best) || 0)) best = status;
  }
  return best;
}

function groupExecutionItems(items) {
  const groups = new Map();
  for (const item of items) {
    const hasSupplier = !!(item.supplierDisplay || item.supplierId);
    const supplierName = item.supplierDisplay || item.supplierId || '';
    const fallbackTitle = item.sourceGroupTitle || '未分组';
    const key = hasSupplier ? `s:${supplierName}` : `g:${fallbackTitle}`;
    if (!groups.has(key)) {
      groups.set(key, { hasSupplier, supplierName, fallbackTitle, items: [] });
    }
    groups.get(key).items.push(item);
  }
  return groups;
}

function renderExecutionStatsBar(items) {
  const total = items.length;
  const pending = items.filter(i => i.status === "pending").length;
  const inProgress = items.filter(i => i.status === "in_progress").length;
  const done = items.filter(i => i.status === "done").length;
  const confirmed = items.filter(i => i.supplierStatus === "confirmed").length;
  const stats = [
    ["总项数", total, "total", false],
    ["待处理", pending, "pending", pending > 0],
    ["进行中", inProgress, "progress", false],
    ["已完成", done, "done", false],
    ["供应商已确认", confirmed, "confirmed", false],
  ];

  // B1-05A cost summary
  const quoteCostTotal = items.reduce((s, i) => s + (i.quoteTotalCost || 0), 0);
  const actualCostTotal = items.reduce((s, i) => s + (i.actualTotalCost || 0), 0);
  const costDiff = actualCostTotal - quoteCostTotal;
  const lockedCount = items.filter(i => i.supplierLocked).length;
  const costConfirmedCount = items.filter(i => i.costStatus === "confirmed").length;
  const hasCostData = items.some(i => i.quoteTotalCost != null || i.actualTotalCost != null);
  const diffClass = costDiff > 0 ? "cost-over" : costDiff < 0 ? "cost-under" : "cost-even";
  const diffSign = costDiff > 0 ? "+" : "";

  return `
    <div class="ei-stats-grid" aria-label="执行清单统计">
      ${stats.map(([label, value, key, isRisk]) => `
        <div class="ei-stat-card ei-stat-${key}${isRisk ? " is-risk-stat" : ""}">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `).join("")}
    </div>
    ${hasCostData ? `
    <div class="ei-cost-summary" aria-label="成本摘要">
      <div class="ei-cost-card">
        <span>报价成本合计</span>
        <strong>${formatCurrency(quoteCostTotal, "EUR")}</strong>
      </div>
      <div class="ei-cost-card">
        <span>实际成本合计</span>
        <strong>${formatCurrency(actualCostTotal, "EUR")}</strong>
      </div>
      <div class="ei-cost-card ${diffClass}">
        <span>成本差异</span>
        <strong>${diffSign}${formatCurrency(costDiff, "EUR")}</strong>
      </div>
      <div class="ei-cost-card">
        <span>已锁定供应商</span>
        <strong>${lockedCount} 项</strong>
      </div>
      <div class="ei-cost-card">
        <span>成本已确认</span>
        <strong>${costConfirmedCount} 项</strong>
      </div>
    </div>` : ""}
  `;
}

function renderStatusPanel(currentStatus, projectId, project) {
  const status = VALID_STATUSES.includes(currentStatus) ? currentStatus : "draft";
  const actions = VALID_STATUSES.map((s) => `
    <button
      type="button"
      class="project-status-button${s === status ? " is-active" : ""}"
      data-status-action="${s}"
      data-project-id="${esc(projectId)}"
      aria-pressed="${s === status ? "true" : "false"}"
    >${PROJECT_STATUS_LABELS[s] || s}</button>
  `).join("");

  return `
    <div class="project-status-panel" data-current-status="${esc(status)}">
      <div class="project-status-row">
        <span class="project-status-label">项目状态</span>
        <div class="project-status-actions" role="group" aria-label="切换项目状态">
          ${actions}
        </div>
      </div>
      <span id="status-save-hint" class="project-status-hint" aria-live="polite"></span>
    </div>
  `;
}

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

function renderMasterPanel(project) {
  const def = (v) => v != null && v !== ""
    ? `<span class="field-value">${esc(v)}</span>`
    : `<span class="field-value empty-value">—</span>`;

  return `
    <section class="panel project-master-panel" id="master-panel">
      <div class="panel-head project-master-head">
        <div>
          <p class="section-kicker">OPERATION MASTER</p>
          <h2>运营主档</h2>
        </div>
        <button type="button" class="button-link small-link project-master-edit-btn" id="edit-master-btn">编辑主档</button>
      </div>
      <div id="master-readonly">
        <div class="pm-group">
          <h3 class="pm-group-title"><span>基础信息</span></h3>
          <div class="project-master-grid">
            <div class="project-master-field">
              <label>客户名称</label>${def(project.clientName)}
            </div>
            <div class="project-master-field">
              <label>联系人</label>${def(project.contactName)}
            </div>
            <div class="project-master-field">
              <label>联系电话</label>${def(project.contactPhone)}
            </div>
            <div class="project-master-field">
              <label>目的地</label>${def(project.destination)}
            </div>
            <div class="project-master-field">
              <label>开始日期</label>${def(project.startDate)}
            </div>
            <div class="project-master-field">
              <label>结束日期</label>${def(project.endDate)}
            </div>
            <div class="project-master-field">
              <label>人数</label>${def(project.paxCount != null ? project.paxCount + " 人" : null)}
            </div>
          </div>
        </div>
        <div class="pm-group">
          <h3 class="pm-group-title"><span>责任人</span></h3>
          <div class="project-master-grid">
            <div class="project-master-field">
              <label>项目负责人</label>${def(project.operationOwner)}
            </div>
            <div class="project-master-field">
              <label>销售负责人</label>${def(project.salesOwner)}
            </div>
            <div class="project-master-field">
              <label>协作人</label>${def(project.coordinator)}
            </div>
          </div>
        </div>
        <div class="pm-group">
          <h3 class="pm-group-title"><span>运营控制</span></h3>
          <div class="project-master-grid">
            <div class="project-master-field">
              <label>优先级</label>
              <span class="field-value field-value-strong">${esc(PRIORITY_LABELS[project.priority] || project.priority || "普通")}</span>
            </div>
            <div class="project-master-field">
              <label>运营准备状态</label>
              <span class="field-value field-value-strong">${esc(OP_STATUS_LABELS[project.operationStatus] || project.operationStatus || "未开始")}</span>
            </div>
            <div class="project-master-field">
              <label>内部准备截止日期</label>${def(project.internalDeadline)}
            </div>
            <div class="project-master-field project-master-textarea-field">
              <label>内部运营备注</label>${def(project.operationNotes)}
            </div>
            <div class="project-master-field project-master-textarea-field">
              <label>风险/阻塞说明</label>${def(project.riskNotes)}
            </div>
          </div>
        </div>
      </div>
      <div id="master-edit-form" style="display:none"></div>
    </section>
  `;
}

function renderMasterEditForm(project) {
  return `
    <form class="project-master-form" id="master-form" novalidate>
      <div class="form-field">
        <label for="mf-projectName">项目名称</label>
        <input id="mf-projectName" name="projectName" type="text" value="${esc(project.projectName || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-clientName">客户名称</label>
        <input id="mf-clientName" name="clientName" type="text" value="${esc(project.clientName || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-contactName">联系人</label>
        <input id="mf-contactName" name="contactName" type="text" value="${esc(project.contactName || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-contactPhone">联系电话</label>
        <input id="mf-contactPhone" name="contactPhone" type="text" value="${esc(project.contactPhone || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-destination">目的地</label>
        <input id="mf-destination" name="destination" type="text" value="${esc(project.destination || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-startDate">开始日期</label>
        <input id="mf-startDate" name="startDate" type="date" value="${esc(project.startDate || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-endDate">结束日期</label>
        <input id="mf-endDate" name="endDate" type="date" value="${esc(project.endDate || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-paxCount">人数</label>
        <input id="mf-paxCount" name="paxCount" type="number" min="0" value="${esc(String(project.paxCount ?? ""))}" />
      </div>
      <div class="form-field">
        <label for="mf-operationOwner">项目负责人</label>
        <input id="mf-operationOwner" name="operationOwner" type="text" value="${esc(project.operationOwner || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-salesOwner">销售负责人</label>
        <input id="mf-salesOwner" name="salesOwner" type="text" value="${esc(project.salesOwner || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-coordinator">协作人</label>
        <input id="mf-coordinator" name="coordinator" type="text" value="${esc(project.coordinator || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-priority">优先级</label>
        <select id="mf-priority" name="priority">
          <option value="low"${project.priority === "low" ? " selected" : ""}>低</option>
          <option value="normal"${(!project.priority || project.priority === "normal") ? " selected" : ""}>普通</option>
          <option value="high"${project.priority === "high" ? " selected" : ""}>高</option>
          <option value="urgent"${project.priority === "urgent" ? " selected" : ""}>紧急</option>
        </select>
      </div>
      <div class="form-field">
        <label for="mf-operationStatus">运营准备状态</label>
        <select id="mf-operationStatus" name="operationStatus">
          <option value="not_started"${(!project.operationStatus || project.operationStatus === "not_started") ? " selected" : ""}>未开始</option>
          <option value="preparing"${project.operationStatus === "preparing" ? " selected" : ""}>准备中</option>
          <option value="ready"${project.operationStatus === "ready" ? " selected" : ""}>已准备</option>
          <option value="blocked"${project.operationStatus === "blocked" ? " selected" : ""}>阻塞</option>
        </select>
      </div>
      <div class="form-field">
        <label for="mf-internalDeadline">内部准备截止日期</label>
        <input id="mf-internalDeadline" name="internalDeadline" type="date" value="${esc(project.internalDeadline || "")}" />
      </div>
      <div class="form-field-full">
        <label for="mf-operationNotes">内部运营备注</label>
        <textarea id="mf-operationNotes" name="operationNotes">${esc(project.operationNotes || "")}</textarea>
      </div>
      <div class="form-field-full">
        <label for="mf-riskNotes">风险/阻塞说明</label>
        <textarea id="mf-riskNotes" name="riskNotes">${esc(project.riskNotes || "")}</textarea>
      </div>
      <div class="project-master-actions" style="grid-column:1/-1">
        <button type="submit" class="button-primary">保存</button>
        <button type="button" id="cancel-master-btn" class="button-link small-link">取消</button>
        <span id="master-save-hint" class="project-master-save-hint" aria-live="polite"></span>
      </div>
    </form>
  `;
}

function renderSnapshotGroups(projectGroups, currency) {
  if (!Array.isArray(projectGroups) || projectGroups.length === 0) {
    return '<p class="empty">暂无报价明细快照。</p>';
  }
  return projectGroups.map((group) => {
    const items = Array.isArray(group.items) ? group.items : [];
    const groupCost = Number(group.projectCostTotal || group.project_cost_total || 0);
    const groupSales = Number(group.projectSalesTotal || group.project_sales_total || 0);
    const rows = items.map((item) => `
      <tr>
        <td>${esc(item.itemName || item.name_zh || "")}</td>
        <td>${esc(getProjectItemCategoryLabel(item, group))}</td>
        <td>${esc(item.specification || "")}</td>
        <td>${esc(item.unit || "")}</td>
        <td style="text-align:right">${Number(item.quantity || 0)}</td>
        <td style="text-align:right">${formatCurrency(item.costUnitPrice ?? item.cost_unit_price ?? 0, currency)}</td>
        <td style="text-align:right">${formatCurrency(item.salesUnitPrice ?? item.sales_unit_price ?? 0, currency)}</td>
        <td style="text-align:right">${formatCurrency(item.costSubtotal ?? item.cost_subtotal ?? 0, currency)}</td>
        <td style="text-align:right">${formatCurrency(item.salesSubtotal ?? item.sales_subtotal ?? 0, currency)}</td>
        <td>${esc(item.remarks || item.notes || "")}</td>
      </tr>
    `).join("");
    return `
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head" style="padding-bottom:8px">
          <h3>${esc(group.projectTitle || group.project_title || "未命名项目组")}</h3>
          <div style="font-size:13px;color:#666;">
            成本 ${formatCurrency(groupCost, currency)} · 销售 ${formatCurrency(groupSales, currency)}
          </div>
        </div>
        ${rows ? `
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#f5f5f5;text-align:left">
                <th style="padding:6px 8px">服务名称</th>
                <th style="padding:6px 8px">分类</th>
                <th style="padding:6px 8px">规格</th>
                <th style="padding:6px 8px">单位</th>
                <th style="padding:6px 8px;text-align:right">数量</th>
                <th style="padding:6px 8px;text-align:right">成本单价</th>
                <th style="padding:6px 8px;text-align:right">销售单价</th>
                <th style="padding:6px 8px;text-align:right">成本小计</th>
                <th style="padding:6px 8px;text-align:right">销售小计</th>
                <th style="padding:6px 8px">备注</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : '<p class="empty">本组暂无明细。</p>'}
      </div>
    `;
  }).join("");
}

function renderRealProject(project) {
  const snap = project.quoteSnapshot || {};
  const currency = project.currency || snap.currency || "EUR";
  const status = VALID_STATUSES.includes(project.status) ? project.status : "draft";
  const priority = project.priority || "normal";
  const operationStatus = project.operationStatus || "not_started";
  const riskItems = [];
  if (priority === "urgent") riskItems.push("紧急优先级");
  if (operationStatus === "blocked") riskItems.push("运营阻塞");
  if (project.internalDeadline) {
    const deadline = new Date(`${project.internalDeadline}T00:00:00`);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!Number.isNaN(deadline.getTime())) {
      const days = Math.round((deadline.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
      if (days < 0) riskItems.push(`内部截止已逾期 ${Math.abs(days)} 天`);
      else if (days === 0) riskItems.push("内部截止今日到期");
      else if (days <= 3) riskItems.push(`内部截止还剩 ${days} 天`);
    }
  }
  const nextAction = operationStatus === "blocked"
    ? "先处理运营阻塞说明"
    : status === "draft"
      ? "确认项目状态并补齐运营主档"
      : status === "confirmed"
        ? "生成并分配接待 / 执行任务"
        : status === "running"
          ? "跟进临近截止任务与供应商确认"
          : "复核报价快照与汇总信息";

  return `
    <section class="panel project-workspace-header project-ops-header">
      <div class="project-workspace-main project-ops-main">
        <div class="project-workspace-title">
          <p class="section-kicker">项目编号：${esc(project.projectNumber || "—")}</p>
          <h1>${esc(project.projectName || "未命名项目")}</h1>
          <p class="project-client">${esc(project.clientName || "—")}</p>
        </div>
        <div class="project-workspace-chips" aria-label="项目关键状态">
          <span class="project-status-pill project-status-pill-${getProjectStatusClass(status)}" data-project-status-pill>${esc(PROJECT_STATUS_LABELS[status] || status)}</span>
          <span class="proj-chip proj-chip-priority proj-chip-priority-${esc(priority)}">${esc(PRIORITY_LABELS[priority] || priority)}</span>
          <span class="proj-chip proj-chip-op proj-chip-op-${esc(operationStatus)}">${esc(OP_STATUS_LABELS[operationStatus] || operationStatus)}</span>
        </div>
      </div>
      <div class="project-workspace-facts project-ops-facts">
        <div class="project-fact"><span>目的地</span><strong>${esc(project.destination || "—")}</strong></div>
        <div class="project-fact"><span>日期范围</span><strong>${esc(getProjectDateRange(project))}</strong></div>
        <div class="project-fact"><span>PAX</span><strong>${project.paxCount != null ? esc(String(project.paxCount)) : "—"}</strong></div>
        <div class="project-fact"><span>内部截止</span><strong>${esc(project.internalDeadline || "—")}</strong></div>
      </div>
      <div class="project-ops-brief ${riskItems.length ? "has-risk" : "is-clear"}">
        <div>
          <span>当前判断</span>
          <strong>${riskItems.length ? esc(riskItems.join(" · ")) : "暂无高亮风险"}</strong>
        </div>
        <div>
          <span>下一步动作</span>
          <strong>${esc(nextAction)}</strong>
        </div>
      </div>
      ${renderStatusPanel(project.status, project.id)}
      <nav class="ops-anchor-nav" aria-label="页面区块快捷入口">
        <a class="ops-anchor-link" href="#master-panel">运营主档</a>
        <a class="ops-anchor-link" href="#project-tasks-panel">接待 / 执行任务</a>
        <a class="ops-anchor-link" href="#execution-items-panel">执行清单</a>
        <a class="ops-anchor-link" href="#project-cost-summary-panel">成本汇总</a>
        <a class="ops-anchor-link" href="#project-source-quote">来源报价</a>
        <a class="ops-anchor-link" href="#project-snapshot">报价快照</a>
      </nav>
    </section>

    ${renderMasterPanel(project)}

    <div id="project-tasks-container">
      <section class="panel project-tasks-panel">
        <div class="panel-head project-tasks-head"><h2>接待 / 执行任务</h2></div>
        <p style="color:#888;font-size:13px;margin:8px 0">加载中…</p>
      </section>
    </div>

    <div id="execution-items-container">
      <section class="panel">
        <div class="panel-head"><h2>项目执行清单</h2></div>
        <p style="color:#888;font-size:13px;margin:8px 0">加载中…</p>
      </section>
    </div>

    <div id="project-cost-summary-container">
      <section class="panel project-cost-summary-panel" id="project-cost-summary-panel">
        <div class="panel-head"><h2>供应商成本汇总</h2></div>
        <p style="color:#888;font-size:13px;margin:8px 0">加载中…</p>
      </section>
    </div>

    <section class="panel auxiliary-panel project-reference-panel" id="project-snapshot">
      <details class="collapsible-panel">
        <summary class="panel-summary"><h2>报价快照 · 明细</h2></summary>
        ${renderSnapshotGroups(snap.projectGroups, currency)}
      </details>
    </section>

    <section class="panel auxiliary-panel project-reference-panel" id="project-source-quote">
      <details class="collapsible-panel">
        <summary class="panel-summary"><h2>来源报价</h2></summary>
        <div class="detail-grid auxiliary-grid">
          <div class="metric"><span>报价编号</span><strong>${esc(project.sourceQuoteNumber || "—")}</strong></div>
          <div class="metric"><span>报价模式</span><strong>项目型报价</strong></div>
          <div class="metric"><span>币种</span><strong>${esc(currency)}</strong></div>
        </div>
        <div class="auxiliary-actions">
          ${project.sourceQuoteId
            ? `<a class="button-link small-link" href="/quote-new.html?id=${encodeURIComponent(project.sourceQuoteId)}&mode=project_based" target="_blank" rel="noopener">查看原报价</a>
               <a class="button-link small-link" href="/project-quotation.html?id=${encodeURIComponent(project.sourceQuoteId)}" target="_blank" rel="noopener">客户报价单</a>`
            : '<span class="empty">来源报价不可链接</span>'
          }
        </div>
      </details>
    </section>

    <section class="panel auxiliary-panel project-reference-panel" id="project-summary">
      <details class="collapsible-panel">
        <summary class="panel-summary"><h2>报价汇总</h2></summary>
        <div class="detail-grid auxiliary-grid">
          <div class="metric"><span>成本合计</span><strong>${formatCurrency(project.totalCost, currency)}</strong></div>
          <div class="metric"><span>销售合计</span><strong>${formatCurrency(project.totalSales, currency)}</strong></div>
          <div class="metric"><span>毛利</span><strong>${formatCurrency(project.grossProfit, currency)}</strong></div>
          <div class="metric"><span>毛利率</span><strong>${Number(project.grossMargin || 0).toFixed(1)}%</strong></div>
        </div>
      </details>
    </section>
  `;
}

function renderArchiveProject(project) {
  const hasFlaggedQuotes = project.linkedQuotes.some((quote) => isFlaggedReview(quote));
  return `
    <section class="panel">
      <div class="panel-head panel-head-wrap">
        <div>
          <h1>${esc(project.projectName)}</h1>
          <p class="meta">${esc(project.client)}</p>
        </div>
        <span class="status-text">${window.AppUi ? window.AppUi.getLabel("projectStatusLabels", project.status) : project.status}</span>
      </div>
      ${hasFlaggedQuotes ? `
        <div class="review-note section-spacing">
          <strong>项目复核提示</strong>
          <p>该项目关联的报价中存在"待复核"记录，正式业务使用前请先检查相关报价内容。</p>
        </div>
      ` : ""}
      <div class="detail-grid section-spacing">
        <div class="metric"><span>日期范围</span><strong>${esc(project.dateRange)}</strong></div>
        <div class="metric"><span>PAX 人数</span><strong>${project.paxCount}</strong></div>
        <div class="metric"><span>特殊要求</span><strong>${esc(project.specialRequirements)}</strong></div>
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
                <span>${esc(quote.quoteNumber)} / ${esc(quote.projectName)}</span>
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
            <span>${esc(item.title)} / ${window.AppUi ? window.AppUi.getLabel("receptionStatusLabels", item.status) : item.status}</span>
            <strong>${esc(item.dueTime || "").replace("T", " ")}</strong>
          </div>
        `).join("") : '<p class="empty">暂无关联接待任务。</p>'}
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>关联文档源数据</h2></div>
      <div class="table-like">
        ${project.linkedDocumentPreviews.length > 0 ? project.linkedDocumentPreviews.map((doc) => `
          <div class="table-row table-row-wide">
            <span>${esc(doc.title)}</span>
            <strong>${window.AppUi ? window.AppUi.getLabel("documentPreviewTypeLabels", doc.type) : doc.type}</strong>
          </div>
        `).join("") : '<p class="empty">暂无关联文档源数据。</p>'}
      </div>
    </section>
  `;
}

async function handleMasterPanelEvents(container, project) {
  const editBtn = container.querySelector("#edit-master-btn");
  if (!editBtn) return;

  editBtn.addEventListener("click", () => {
    const readonly = container.querySelector("#master-readonly");
    const editArea = container.querySelector("#master-edit-form");
    if (!readonly || !editArea) return;
    readonly.style.display = "none";
    editBtn.style.display = "none";
    editArea.style.display = "block";
    editArea.innerHTML = renderMasterEditForm(project);

    const form = editArea.querySelector("#master-form");
    const cancelBtn = editArea.querySelector("#cancel-master-btn");
    const hint = editArea.querySelector("#master-save-hint");

    cancelBtn?.addEventListener("click", () => {
      editArea.style.display = "none";
      editArea.innerHTML = "";
      editBtn.style.display = "";
      readonly.style.display = "";
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const patch = {};
      for (const [k, v] of formData.entries()) {
        patch[k] = v;
      }
      if (patch.paxCount !== undefined) patch.paxCount = Number(patch.paxCount);

      const submitBtns = form.querySelectorAll("button[type=submit]");
      submitBtns.forEach((b) => { b.disabled = true; });
      if (hint) hint.textContent = "保存中…";

      try {
        const updated = await window.AppUtils.fetchJson(
          `/api/projects/${encodeURIComponent(project.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
          "保存失败，请稍后重试。"
        );
        Object.assign(project, updated);
        // 重新渲染只读网格
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = renderMasterPanel(updated);
        const newReadonly = tempDiv.querySelector("#master-readonly");
        if (newReadonly && readonly) {
          readonly.innerHTML = newReadonly.innerHTML;
        }
        editArea.style.display = "none";
        editArea.innerHTML = "";
        editBtn.style.display = "";
        readonly.style.display = "";
        window.AppUtils.showMessage("project-message", "运营主档已保存。", "success");
      } catch (err) {
        if (hint) hint.textContent = "保存失败";
        window.AppUtils.showMessage("project-message", err.message, "error");
      } finally {
        submitBtns.forEach((b) => { b.disabled = false; });
      }
    });
  });
}

async function handleStatusButtonClick(event) {
  const button = event.target.closest("[data-status-action]");
  if (!button) return;
  const projectId = button.getAttribute("data-project-id");
  const newStatus = button.getAttribute("data-status-action");
  const panel = button.closest(".project-status-panel");
  if (!projectId || !newStatus || button.classList.contains("is-active")) return;

  const hint = document.getElementById("status-save-hint");
  const buttons = panel ? Array.from(panel.querySelectorAll("[data-status-action]")) : [];
  if (hint) hint.textContent = "保存中…";
  buttons.forEach((btn) => { btn.disabled = true; });

  try {
    await window.AppUtils.fetchJson(
      `/api/projects/${encodeURIComponent(projectId)}/status`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) },
      "状态更新失败，请稍后重试。"
    );
    if (panel) {
      panel.setAttribute("data-current-status", newStatus);
      const pill = document.querySelector("[data-project-status-pill]");
      if (pill) {
        pill.className = `project-status-pill project-status-pill-${getProjectStatusClass(newStatus)}`;
        pill.setAttribute("data-project-status-pill", "");
        pill.textContent = PROJECT_STATUS_LABELS[newStatus] || newStatus;
      }
      buttons.forEach((btn) => {
        const isActive = btn.getAttribute("data-status-action") === newStatus;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }
    if (hint) { hint.textContent = "已保存"; setTimeout(() => { hint.textContent = ""; }, 2000); }
  } catch (error) {
    if (hint) hint.textContent = "保存失败";
    window.AppUtils.showMessage("project-message", error.message, "error");
  } finally {
    buttons.forEach((btn) => { btn.disabled = false; });
  }
}

function renderExecutionItemsSection(items, projectId) {
  if (!Array.isArray(items) || items.length === 0) {
    return `
      <section class="panel" id="execution-items-panel">
        <div class="panel-head"><h2>项目执行清单</h2></div>
        <p class="empty">暂无执行清单，请先从报价快照生成。</p>
        <div style="margin-top:12px;display:flex;align-items:center;gap:12px">
          <button type="button" class="button-primary" id="generate-execution-btn" data-project-id="${esc(projectId)}">
            从报价快照生成执行清单
          </button>
          <span id="generate-execution-hint" class="project-status-hint" aria-live="polite"></span>
        </div>
      </section>
    `;
  }

  const hasMissingSupplier = items.some(i => !i.supplierId && !i.supplierDisplay);
  const backfillBar = hasMissingSupplier ? `
    <div class="ei-backfill-bar">
      <div class="ei-backfill-copy">
        <strong>供应商信息不完整</strong>
        <span>可从报价快照补齐，不会覆盖已编辑的状态、负责人和备注。</span>
      </div>
      <button type="button" class="button-secondary ei-backfill-btn" id="backfill-supplier-btn" data-project-id="${esc(projectId)}">补齐供应商信息</button>
      <span id="backfill-hint" class="project-status-hint" aria-live="polite"></span>
    </div>
  ` : '';

  const groups = groupExecutionItems(items);
  const groupHtml = Array.from(groups.entries()).map(([, { hasSupplier, supplierName, fallbackTitle, items: groupItems }]) => {
    const doneCount = groupItems.filter(i => i.status === "done").length;
    const pendingCount = groupItems.filter(i => i.status === "pending").length;
    const supplierStatus = getDominantSupplierStatus(groupItems);
    const groupLabel = hasSupplier ? esc(supplierName) : `未指定供应商 · ${esc(fallbackTitle)}`;
    const rows = groupItems.map((item) => {
      const lockedBadge = item.supplierLocked
        ? `<span class="ei-locked-badge">已锁定</span>` : "";
      const costStatusBadge = item.costStatus && item.costStatus !== "not_started"
        ? `<span class="ei-cost-status-badge ei-cost-status-${esc(item.costStatus)}">${esc(COST_STATUS_LABELS[item.costStatus] || item.costStatus)}</span>` : "";
      const hasCost = item.actualTotalCost != null || item.quoteTotalCost != null;
      const costMini = hasCost ? `
        <div class="ei-cost-mini">
          ${item.actualTotalCost != null ? `<span class="ei-cost-actual">${formatCurrency(item.actualTotalCost, item.costCurrency || "EUR")}</span>` : ""}
          ${item.quoteTotalCost != null ? `<span class="ei-cost-quote">报 ${formatCurrency(item.quoteTotalCost, item.costCurrency || "EUR")}</span>` : ""}
        </div>` : "";
      return `
      <tr id="ei-row-${esc(item.id)}" data-item-id="${esc(item.id)}">
        <td class="ei-cell">${esc(getExecutionCategoryLabel(item))}</td>
        <td class="ei-cell ei-cell-title" title="${esc(item.notes || "")}">${esc(item.title || "—")}</td>
        <td class="ei-cell ei-cell-num">${item.quantity != null ? item.quantity : "—"}${item.unit ? "&nbsp;" + esc(item.unit) : ""}</td>
        <td class="ei-cell ei-cell-date"><span>${esc(item.plannedDate || "—")}</span></td>
        <td class="ei-cell">${esc(item.location || "—")}</td>
        <td class="ei-cell">${esc(item.owner || "—")}</td>
        <td class="ei-cell">
          <span class="ei-status-badge ei-status-${esc(item.status)}">
            ${esc(EXECUTION_STATUS_LABELS[item.status] || item.status)}
          </span>
        </td>
        <td class="ei-cell">
          <span class="ei-sup-badge ei-sup-${esc(item.supplierStatus)}">
            ${esc(SUPPLIER_STATUS_LABELS[item.supplierStatus] || item.supplierStatus)}
          </span>
          ${lockedBadge}${costStatusBadge}${costMini}
        </td>
        <td class="ei-cell ei-cell-actions">
          <button type="button" class="button-link small-link ei-edit-btn" data-item-id="${esc(item.id)}">编辑</button>
          <button type="button" class="button-link small-link danger-link ei-delete-btn" data-item-id="${esc(item.id)}">删除</button>
        </td>
      </tr>
    `;
    }).join("");

    return `
      <div class="ei-group supplier-execution-group${hasSupplier ? "" : " ei-group-no-supplier"}">
        <div class="ei-group-head">
          <div class="ei-group-title-block">
            <span class="ei-group-kicker">${hasSupplier ? "供应商执行包" : "待分配执行包"}</span>
            <strong class="ei-group-name">${groupLabel}</strong>
          </div>
          <div class="ei-group-summary">
            <span>${groupItems.length} 项</span>
            <span>已完成 ${doneCount}</span>
            ${pendingCount > 0 ? `<span>待处理 ${pendingCount}</span>` : ""}
            <span class="ei-sup-badge ei-sup-${esc(supplierStatus)}">${esc(SUPPLIER_STATUS_LABELS[supplierStatus] || supplierStatus)}</span>
          </div>
        </div>
        <div class="ei-table-wrap">
          <table class="ei-table">
            <thead>
              <tr>
                <th>分类</th>
                <th>执行内容</th>
                <th>数量/单位</th>
                <th>到位截止时间</th>
                <th>地点</th>
                <th>负责人</th>
                <th>执行状态</th>
                <th>供应商状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join("");

  return `
    <section class="panel project-execution-panel" id="execution-items-panel">
      <div class="panel-head project-execution-head">
        <div>
          <p class="section-kicker">EXECUTION</p>
          <h2>项目执行清单</h2>
        </div>
      </div>
      ${renderExecutionStatsBar(items)}
      ${backfillBar}
      <div id="execution-groups-container">${groupHtml}</div>
    </section>
  `;
}

function renderExecutionItemEditRow(item) {
  const statusOptions = Object.entries(EXECUTION_STATUS_LABELS)
    .map(([v, l]) => `<option value="${v}"${item.status === v ? " selected" : ""}>${l}</option>`)
    .join("");
  const supplierOptions = Object.entries(SUPPLIER_STATUS_LABELS)
    .map(([v, l]) => `<option value="${v}"${item.supplierStatus === v ? " selected" : ""}>${l}</option>`)
    .join("");

  const hasSupplier = !!(item.supplierId || item.supplierDisplay);
  const syncChecked = hasSupplier ? " checked" : "";
  const syncDisabled = hasSupplier ? "" : " disabled";
  const syncHint = hasSupplier
    ? `同步到"${esc(item.supplierDisplay || item.supplierId)}"的其他执行项`
    : "当前执行项无供应商信息，无法同步";

  return `
    <tr id="ei-row-${esc(item.id)}" data-item-id="${esc(item.id)}" class="ei-edit-row">
      <td colspan="9" style="padding:0">
        <form class="ei-edit-card" data-item-id="${esc(item.id)}">
          <div class="ei-edit-section">
            <h4>内容与数量</h4>
            <div class="ei-edit-row1">
            <div class="ei-edit-field ei-edit-field-wide">
              <label>执行内容</label>
              <input name="title" type="text" value="${esc(item.title || "")}" />
            </div>
            <div class="ei-edit-field">
              <label>数量</label>
              <input name="quantity" type="number" value="${item.quantity != null ? item.quantity : ""}" />
            </div>
            <div class="ei-edit-field">
              <label>单位</label>
              <input name="unit" type="text" value="${esc(item.unit || "")}" />
            </div>
            </div>
          </div>
          <div class="ei-edit-section">
            <h4>到位截止 / 地点 / 负责人</h4>
            <div class="ei-edit-row2">
            <div class="ei-edit-field">
              <label>到位截止时间</label>
              <input name="plannedDate" type="date" value="${esc(item.plannedDate || "")}" />
            </div>
            <div class="ei-edit-field">
              <label>地点</label>
              <input name="location" type="text" value="${esc(item.location || "")}" />
            </div>
            <div class="ei-edit-field">
              <label>负责人</label>
              <input name="owner" type="text" value="${esc(item.owner || "")}" />
            </div>
            </div>
          </div>
          <div class="ei-edit-section">
            <h4>执行状态 / 供应商状态 / 同供应商同步</h4>
            <div class="ei-edit-row3">
            <div class="ei-edit-field">
              <label>执行状态</label>
              <select name="status">${statusOptions}</select>
            </div>
            <div class="ei-edit-field">
              <label>供应商状态</label>
              <select name="supplierStatus">${supplierOptions}</select>
            </div>
            <div class="ei-edit-sync">
              <label class="ei-sync-label">
                <input type="checkbox" name="applyToSameSupplier" value="1"${syncChecked}${syncDisabled} />
                <span>${syncHint}</span>
              </label>
            </div>
            </div>
          </div>
          <div class="ei-edit-section">
            <h4>备注</h4>
            <div class="ei-edit-row4">
            <div class="ei-edit-field ei-edit-field-wide">
              <label>备注</label>
              <textarea name="notes">${esc(item.notes || "")}</textarea>
            </div>
            </div>
          </div>
          <div class="ei-edit-section ei-cost-section">
            <h4>供应商锁定 &amp; 实际成本 <span class="ei-cost-section-tag">内部</span></h4>
            <div class="ei-cost-edit-grid">
              <div class="ei-edit-field">
                <label>当前供应商</label>
                <span class="ei-readonly-value">${esc(item.supplierDisplay || item.supplierId || "—")}</span>
              </div>
              <div class="ei-edit-field ei-edit-field-checkbox">
                <label class="ei-checkbox-label">
                  <input type="checkbox" name="supplierLocked" value="1"${item.supplierLocked ? " checked" : ""} />
                  <span>供应商已锁定</span>
                </label>
                ${item.supplierLockedAt ? `<span class="ei-locked-at">锁定于 ${esc(item.supplierLockedAt.slice(0, 10))}</span>` : ""}
              </div>
              <div class="ei-edit-field">
                <label>报价成本单价 <span class="ei-readonly-tag">只读</span></label>
                <span class="ei-readonly-value">${item.quoteUnitCost != null ? formatCurrency(item.quoteUnitCost, item.costCurrency || "EUR") : "—"}</span>
              </div>
              <div class="ei-edit-field">
                <label>报价成本小计 <span class="ei-readonly-tag">只读</span></label>
                <span class="ei-readonly-value">${item.quoteTotalCost != null ? formatCurrency(item.quoteTotalCost, item.costCurrency || "EUR") : "—"}</span>
              </div>
              <div class="ei-edit-field">
                <label>实际成本单价</label>
                <input type="number" name="actualUnitCost" min="0" step="0.01" value="${item.actualUnitCost != null ? item.actualUnitCost : ""}" placeholder="留空则不修改" />
              </div>
              <div class="ei-edit-field">
                <label>实际成本小计</label>
                <input type="number" name="actualTotalCost" min="0" step="0.01" value="${item.actualTotalCost != null ? item.actualTotalCost : ""}" placeholder="留空则按单价×数量推导" />
              </div>
              <div class="ei-edit-field">
                <label>成本币种</label>
                <select name="costCurrency">
                  ${["EUR", "CNY", "RSD", "KM", "ALL"].map(c => `<option value="${c}"${(item.costCurrency || "EUR") === c ? " selected" : ""}>${c}</option>`).join("")}
                </select>
              </div>
              <div class="ei-edit-field">
                <label>成本状态</label>
                <select name="costStatus">
                  ${Object.entries(COST_STATUS_LABELS).map(([v, l]) => `<option value="${v}"${(item.costStatus || "not_started") === v ? " selected" : ""}>${l}</option>`).join("")}
                </select>
              </div>
              <div class="ei-edit-field ei-edit-field-wide">
                <label>供应商锁定备注</label>
                <textarea name="supplierLockNotes" rows="2">${esc(item.supplierLockNotes || "")}</textarea>
              </div>
              <div class="ei-edit-field ei-edit-field-wide">
                <label>成本备注</label>
                <textarea name="costNotes" rows="2">${esc(item.costNotes || "")}</textarea>
              </div>
            </div>
          </div>
          <div class="ei-edit-actions">
            <button type="submit" class="button-primary">保存</button>
            <button type="button" class="ei-cancel-btn button-link small-link" data-item-id="${esc(item.id)}">取消</button>
            <span class="ei-save-hint" aria-live="polite"></span>
          </div>
        </form>
      </td>
    </tr>
  `;
}

async function loadAndRenderExecutionItems(projectId) {
  const container = document.getElementById("execution-items-container");
  if (!container) return;

  try {
    const items = await window.AppUtils.fetchJson(
      `/api/projects/${encodeURIComponent(projectId)}/execution-items`,
      null,
      "执行清单加载失败"
    );
    container.innerHTML = renderExecutionItemsSection(items, projectId);
    setupExecutionItemsHandlers(projectId);
  } catch (err) {
    container.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h2>项目执行清单</h2></div>
        <p style="color:#c44;font-size:13px">${esc(err.message)}</p>
      </section>
    `;
  }
}

function setupExecutionItemsHandlers(projectId) {
  const container = document.getElementById("execution-items-container");
  if (!container) return;

  const genBtn = container.querySelector("#generate-execution-btn");
  if (genBtn) {
    genBtn.addEventListener("click", async () => {
      const hint = container.querySelector("#generate-execution-hint");
      genBtn.disabled = true;
      if (hint) hint.textContent = "生成中…";
      try {
        await window.AppUtils.fetchJson(
          `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`,
          { method: "POST" },
          "生成失败，请稍后重试"
        );
        await loadAndRenderExecutionItems(projectId);
      } catch (err) {
        if (hint) hint.textContent = "生成失败：" + err.message;
        genBtn.disabled = false;
      }
    });
  }

  const backfillBtn = container.querySelector("#backfill-supplier-btn");
  if (backfillBtn) {
    backfillBtn.addEventListener("click", async () => {
      const hint = container.querySelector("#backfill-hint");
      backfillBtn.disabled = true;
      if (hint) hint.textContent = "回填中…";
      try {
        const result = await window.AppUtils.fetchJson(
          `/api/projects/${encodeURIComponent(projectId)}/execution-items/backfill-suppliers`,
          { method: "POST" },
          "回填失败，请稍后重试"
        );
        await loadAndRenderExecutionItems(projectId);
        const msg = result.updatedCount > 0
          ? `已补齐 ${result.updatedCount} 条供应商信息；${result.skippedCount} 条报价快照中无供应商信息，需手工维护。`
          : "没有可回填的供应商信息，可能报价快照中未记录供应商。";
        window.AppUtils.showMessage("project-message", msg, "success");
      } catch (err) {
        const hint2 = container.querySelector("#backfill-hint");
        if (hint2) hint2.textContent = "回填失败：" + err.message;
        backfillBtn.disabled = false;
      }
    });
  }

  const groupsContainer = container.querySelector("#execution-groups-container");
  if (!groupsContainer) return;

  groupsContainer.addEventListener("click", async (e) => {
    const editBtn = e.target.closest(".ei-edit-btn");
    const cancelBtn = e.target.closest(".ei-cancel-btn");
    const deleteBtn = e.target.closest(".ei-delete-btn");

    if (editBtn) {
      const itemId = editBtn.getAttribute("data-item-id");
      const row = document.getElementById(`ei-row-${itemId}`);
      if (!row) return;
      try {
        const allItems = await window.AppUtils.fetchJson(
          `/api/projects/${encodeURIComponent(projectId)}/execution-items`,
          null,
          "加载失败"
        );
        const item = allItems.find((i) => i.id === itemId);
        if (!item) return;
        const editRowHtml = renderExecutionItemEditRow(item);
        const temp = document.createElement("tbody");
        temp.innerHTML = editRowHtml;
        row.replaceWith(temp.firstElementChild);
        setupEditFormHandlers(projectId, itemId);
      } catch (err) {
        window.AppUtils.showMessage("project-message", err.message, "error");
      }
    }

    if (cancelBtn) {
      await loadAndRenderExecutionItems(projectId);
    }

    if (deleteBtn) {
      const itemId = deleteBtn.getAttribute("data-item-id");
      if (!confirm("确认删除此执行项？")) return;
      deleteBtn.disabled = true;
      try {
        await window.AppUtils.fetchJson(
          `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`,
          { method: "DELETE" },
          "删除失败，请稍后重试"
        );
        await loadAndRenderExecutionItems(projectId);
      } catch (err) {
        window.AppUtils.showMessage("project-message", err.message, "error");
        deleteBtn.disabled = false;
      }
    }
  });
}

function setupEditFormHandlers(projectId, itemId) {
  const form = document.querySelector(`.ei-edit-card[data-item-id="${itemId}"]`);
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const hint = form.querySelector(".ei-save-hint");
    const submitBtn = form.querySelector("button[type=submit]");
    const formData = new FormData(form);
    const NULL_ON_EMPTY = new Set(["plannedDate", "startDate", "endDate", "quantity"]);
    const NUMBER_FIELDS = new Set(["actualUnitCost", "actualTotalCost"]);
    const patch = {};
    for (const [k, v] of formData.entries()) {
      if (k === "applyToSameSupplier" || k === "supplierLocked") continue;
      if (v === "" && NULL_ON_EMPTY.has(k)) { patch[k] = null; continue; }
      if (v === "" && NUMBER_FIELDS.has(k)) { patch[k] = null; continue; }
      patch[k] = v;
    }
    if (patch.quantity !== undefined && patch.quantity !== null) patch.quantity = Number(patch.quantity);
    if (patch.actualUnitCost !== undefined && patch.actualUnitCost !== null) patch.actualUnitCost = Number(patch.actualUnitCost);
    if (patch.actualTotalCost !== undefined && patch.actualTotalCost !== null) patch.actualTotalCost = Number(patch.actualTotalCost);

    // checkbox: supplierLocked (unchecked → not in FormData → must send false explicitly)
    const supplierLockedCb = form.querySelector('input[name="supplierLocked"]');
    if (supplierLockedCb) patch.supplierLocked = supplierLockedCb.checked;

    const syncCheckbox = form.querySelector('input[name="applyToSameSupplier"]');
    if (syncCheckbox && syncCheckbox.checked && !syncCheckbox.disabled) {
      patch.applyToSameSupplier = true;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (hint) hint.textContent = "保存中…";

    try {
      const result = await window.AppUtils.fetchJson(
        `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
        "保存失败，请稍后重试"
      );
      const affectedCount = result && result.affectedCount != null ? result.affectedCount : 1;
      await loadAndRenderExecutionItems(projectId);
      if (affectedCount > 1) {
        window.AppUtils.showMessage("project-message", `已保存，并同步更新了同供应商 ${affectedCount} 条执行项。`, "success");
      }
    } catch (err) {
      if (hint) hint.textContent = "保存失败：" + err.message;
      if (submitBtn) submitBtn.disabled = false;
    }
  });
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
    const project = await window.AppUtils.fetchJson(`/api/projects/${encodeURIComponent(id)}`, null, "项目详情加载失败，请稍后重试");
    const container = document.getElementById("project-detail");

    // Real project entity has quoteSnapshot; archive view has linkedQuotes
    if (project.quoteSnapshot !== undefined) {
      container.innerHTML = renderRealProject(project);
      document.title = `项目 · ${project.projectName || project.projectNumber}`;
      container.addEventListener("click", handleStatusButtonClick);
      handleMasterPanelEvents(container, project);
      loadAndRenderExecutionItems(project.id);
      loadAndRenderProjectTasks(project.id);
      loadAndRenderProjectCostSummary(project.id);
    } else {
      container.innerHTML = renderArchiveProject(project);
    }
  } catch (error) {
    window.AppUtils.showMessage("project-message", error.message, "error");
    document.getElementById("project-detail").innerHTML = window.AppUtils.renderEmptyState("项目详情不可用", error.message);
  }
}

// ── B1-04: 接待/执行任务区块 ──────────────────────────────────────────────────

const TASK_STATUS_LABELS = {
  todo:        "待处理",
  in_progress: "进行中",
  done:        "已完成",
  cancelled:   "已取消",
};

const TASK_PRIORITY_LABELS = {
  low:    "低",
  normal: "普通",
  high:   "高",
  urgent: "紧急",
};


async function loadAndRenderProjectTasks(projectId) {
  let container = document.getElementById("project-tasks-container");
  if (!container) {
    const eiContainer = document.getElementById("execution-items-container");
    if (!eiContainer) return;
    container = document.createElement("div");
    container.id = "project-tasks-container";
    eiContainer.insertAdjacentElement("beforebegin", container);
  }
  try {
    const tasks = await window.AppUtils.fetchJson(
      `/api/projects/${encodeURIComponent(projectId)}/tasks`,
      null,
      "任务加载失败"
    );
    container.innerHTML = renderProjectTasksSection(tasks);
    setupProjectTasksHandlers(projectId);
  } catch (err) {
    container.innerHTML = `
      <section class="panel project-tasks-panel">
        <div class="panel-head project-tasks-head"><h2>接待 / 执行任务</h2></div>
        <p style="color:#c44;font-size:13px">${esc(err.message)}</p>
      </section>`;
  }
}

function getTaskStatusClass(status) {
  return ["todo", "in_progress", "done", "cancelled"].includes(status) ? status : "todo";
}

function getTaskPriorityClassName(priority) {
  return ["low", "normal", "high", "urgent"].includes(priority) ? priority : "normal";
}

function isOpenProjectTask(task) {
  return task.status === "todo" || task.status === "in_progress";
}

function getProjectTaskToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getProjectTaskDueInfo(task) {
  if (!task.dueDate) return { tone: "empty", text: "未设置" };
  const due = new Date(`${task.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return { tone: "empty", text: "日期异常" };
  const days = Math.round((due.getTime() - getProjectTaskToday().getTime()) / (24 * 60 * 60 * 1000));
  if (!isOpenProjectTask(task)) return { tone: "normal", text: task.dueDate };
  if (days < 0) return { tone: "overdue", text: `已逾期 ${Math.abs(days)} 天` };
  if (days === 0) return { tone: "today", text: "今日截止" };
  if (days <= 3) return { tone: "soon", text: `还有 ${days} 天` };
  return { tone: "normal", text: task.dueDate };
}

function isProjectTaskDueRisk(task) {
  const tone = getProjectTaskDueInfo(task).tone;
  return tone === "overdue" || tone === "today" || tone === "soon";
}

function renderTaskStats(tasks) {
  const counts = { todo: 0, in_progress: 0, done: 0, cancelled: 0 };
  let noAssignee = 0;
  let dueRisk = 0;
  for (const task of tasks) {
    counts[getTaskStatusClass(task.status)] += 1;
    if (!String(task.assignee || "").trim()) noAssignee += 1;
    if (isProjectTaskDueRisk(task)) dueRisk += 1;
  }
  const stats = [
    ["总任务", tasks.length, "total", false],
    ["待处理", counts.todo, "todo", false],
    ["进行中", counts.in_progress, "progress", false],
    ["已完成", counts.done, "done", false],
    ["已取消", counts.cancelled, "cancelled", false],
    ["未分配", noAssignee, "unassigned", noAssignee > 0],
    ["临近/逾期", dueRisk, "due", dueRisk > 0],
  ];
  return `
    <div class="pt-stats-grid pt-stats-compact" aria-label="接待 / 执行任务统计">
      ${stats.map(([label, value, key, isRisk]) => `
        <div class="pt-stat-card pt-stat-${key}${isRisk ? " is-risk-stat" : ""}">
          <span>${esc(label)}</span>
          <strong>${esc(value)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTaskRiskCallout(tasks) {
  const overdue = tasks.filter(t => isOpenProjectTask(t) && getProjectTaskDueInfo(t).tone === "overdue").length;
  const today = tasks.filter(t => isOpenProjectTask(t) && getProjectTaskDueInfo(t).tone === "today").length;
  const unassignedOpen = tasks.filter(t => isOpenProjectTask(t) && !String(t.assignee || "").trim()).length;
  if (overdue === 0 && today === 0 && unassignedOpen === 0) return "";
  const parts = [];
  if (overdue > 0) parts.push(`${overdue} 个任务已逾期`);
  if (today > 0) parts.push(`${today} 个任务今日截止`);
  if (unassignedOpen > 0) parts.push(`${unassignedOpen} 个开放任务未分配负责人`);
  return `<div class="ops-risk-callout" role="status" aria-live="polite"><span>${esc(parts.join(" · "))}</span></div>`;
}

function renderTaskCard(task) {
  const status = getTaskStatusClass(task.status);
  const priority = getTaskPriorityClassName(task.priority);
  const dueInfo = getProjectTaskDueInfo(task);
  const assignee = String(task.assignee || "").trim();
  const notes = String(task.notes || "").trim();
  const dueCls = isOpenProjectTask(task)
    ? (dueInfo.tone === "overdue" || dueInfo.tone === "today") ? " project-task-due-urgent" : dueInfo.tone === "soon" ? " project-task-due-soon" : ""
    : "";
  return `
    <article id="pt-card-${esc(task.id)}" class="project-task-card project-task-compact project-task-${esc(status)} project-task-priority-${esc(priority)}${dueCls}" data-task-id="${esc(task.id)}">
      <div class="project-task-card-head">
        <div class="project-task-title-block">
          <h4>${esc(task.title || "未命名任务")}</h4>
          <p>${esc(task.supplierDisplay || "未记录供应商")}</p>
        </div>
        <div class="project-task-chips">
          <span class="pt-chip pt-status-${esc(status)}">${esc(TASK_STATUS_LABELS[status] || status)}</span>
          <span class="pt-chip pt-priority-${esc(priority)}">${esc(TASK_PRIORITY_LABELS[priority] || priority)}</span>
          <span class="pt-chip pt-due-${esc(dueInfo.tone)}">${esc(dueInfo.text)}</span>
        </div>
      </div>
      <div class="project-task-compact-grid">
        <div><span>负责人</span><strong class="${assignee ? "" : "empty-value"}">${esc(assignee || "—")}</strong></div>
        <div><span>到位截止</span><strong>${esc(task.dueDate || "—")}</strong></div>
        <div><span>执行日期</span><strong>${esc(task.executionDate || "—")}</strong></div>
        <div><span>地点</span><strong>${esc(task.location || "—")}</strong></div>
      </div>
      <div class="project-task-card-foot">
        <p title="${esc(notes)}"><span>备注</span>${notes ? esc(notes) : '<em>—</em>'}</p>
        <button type="button" class="button-link small-link pt-edit-btn" data-task-id="${esc(task.id)}">编辑任务</button>
      </div>
    </article>
  `;
}

function renderTaskEditRow(task) {
  const status = getTaskStatusClass(task.status);
  const priority = getTaskPriorityClassName(task.priority);
  const statusOptions = Object.entries(TASK_STATUS_LABELS)
    .map(([value, label]) => `<option value="${value}"${status === value ? " selected" : ""}>${label}</option>`).join("");
  const priorityOptions = Object.entries(TASK_PRIORITY_LABELS)
    .map(([value, label]) => `<option value="${value}"${priority === value ? " selected" : ""}>${label}</option>`).join("");
  return `
    <article id="pt-card-${esc(task.id)}" class="project-task-card project-task-edit-card" data-task-id="${esc(task.id)}">
      <form class="pt-edit-form" data-task-id="${esc(task.id)}">
        <div class="pt-edit-readonly">
          <div><span>任务标题</span><strong>${esc(task.title || "未命名任务")}</strong></div>
          <div><span>供应商</span><strong>${esc(task.supplierDisplay || "未记录供应商")}</strong></div>
        </div>
        <div class="pt-edit-grid">
          <label><span>负责人</span><input name="assignee" value="${esc(task.assignee || "")}" /></label>
          <label><span>到位截止日期</span><input type="date" name="dueDate" value="${esc(task.dueDate || "")}" /></label>
          <label><span>执行日期</span><input type="date" name="executionDate" value="${esc(task.executionDate || "")}" /></label>
          <label><span>地点</span><input name="location" value="${esc(task.location || "")}" /></label>
          <label><span>状态</span><select name="status">${statusOptions}</select></label>
          <label><span>优先级</span><select name="priority">${priorityOptions}</select></label>
          <label class="pt-edit-wide"><span>备注</span><textarea name="notes" rows="3">${esc(task.notes || "")}</textarea></label>
        </div>
        <div class="pt-sync-row">
          <label class="pt-sync-label${task.supplierId || task.supplierDisplay ? "" : " pt-sync-label-disabled"}">
            <input type="checkbox" name="applyToSameSupplier" value="1"${task.supplierId || task.supplierDisplay ? "" : " disabled"} />
            <span class="pt-sync-main">同步至同供应商其他任务</span>${!(task.supplierId || task.supplierDisplay) ? '<span class="pt-sync-tip">（此任务无供应商，不适用）</span>' : ""}
          </label>
        </div>
        <div class="pt-edit-actions">
          <button type="submit" class="button-primary">保存</button>
          <button type="button" class="button-link small-link pt-cancel-btn">取消</button>
          <span class="pt-save-hint" aria-live="polite"></span>
        </div>
      </form>
    </article>
  `;
}

function groupTasksByAssignee(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const key = String(task.assignee || "").trim() || "__unassigned__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }
  const sorted = [];
  if (groups.has("__unassigned__")) sorted.push(["__unassigned__", groups.get("__unassigned__")]);
  const assigned = [];
  for (const [key, items] of groups) {
    if (key !== "__unassigned__") assigned.push([key, items]);
  }
  assigned.sort((a, b) => a[0].localeCompare(b[0], "zh-CN"));
  return sorted.concat(assigned);
}

function renderProjectTasksSection(tasks) {
  if (tasks.length === 0) {
    return `
      <section class="panel project-tasks-panel" id="project-tasks-panel">
        <div class="panel-head project-tasks-head">
          <div>
            <p class="section-kicker">RECEPTION / EXECUTION TASKS</p>
            <h2>接待 / 执行任务</h2>
          </div>
        </div>
        <div class="project-tasks-empty">
          <strong>暂无接待 / 执行任务</strong>
          <p>从执行清单生成任务后，可在这里跟踪负责人、日期、地点、状态和备注。</p>
          <button type="button" class="button-primary" id="generate-tasks-btn">从执行清单生成任务</button>
          <span id="generate-tasks-hint" class="project-status-hint" aria-live="polite"></span>
        </div>
      </section>`;
  }

  const groupHtml = groupTasksByAssignee(tasks).map(([assignee, groupTasks]) => {
    const unassigned = assignee === "__unassigned__";
    const openCount = groupTasks.filter(isOpenProjectTask).length;
    const riskCount = groupTasks.filter(isProjectTaskDueRisk).length;
    return `
      <section class="project-task-group${unassigned ? " project-task-group-unassigned" : ""}">
        <div class="project-task-group-head">
          <div>
            <span class="project-task-group-kicker">${unassigned ? "UNASSIGNED" : "ASSIGNEE"}</span>
            <h3>${unassigned ? "未分配负责人" : esc(assignee)}</h3>
          </div>
          <div class="project-task-group-meta">
            <span>${groupTasks.length} 个任务</span>
            <span>${openCount} 个未完成</span>
            ${riskCount ? `<span class="is-risk">${riskCount} 个临近/逾期</span>` : ""}
          </div>
        </div>
        <div class="project-task-list">${groupTasks.map(renderTaskCard).join("")}</div>
      </section>`;
  }).join("");

  return `
    <section class="panel project-tasks-panel project-tasks-workbench" id="project-tasks-panel">
      <div class="panel-head project-tasks-head">
        <div>
          <p class="section-kicker">RECEPTION / EXECUTION TASKS</p>
          <h2>接待 / 执行任务</h2>
          <p class="panel-subtitle">把执行清单拆成可分配、可跟进、可同步的每日执行任务。</p>
        </div>
        <button type="button" class="button-link small-link" id="generate-tasks-btn">从执行清单同步</button>
      </div>
      ${renderTaskStats(tasks)}
      ${renderTaskRiskCallout(tasks)}
      <div class="project-task-filter-shell" aria-label="任务筛选预留">
        <span class="is-active">全部</span>
        <span>待处理</span>
        <span>进行中</span>
        <span>临近/逾期</span>
        <span>未分配</span>
      </div>
      <div id="task-groups-container" class="project-task-groups">${groupHtml}</div>
      <span id="generate-tasks-hint" class="project-status-hint" aria-live="polite"></span>
    </section>`;
}

function setupProjectTasksHandlers(projectId) {
  const container = document.getElementById("project-tasks-container");
  if (!container) return;

  const genBtn = container.querySelector("#generate-tasks-btn");
  if (genBtn) {
    genBtn.addEventListener("click", async () => {
      const hint = container.querySelector("#generate-tasks-hint");
      genBtn.disabled = true;
      if (hint) hint.textContent = "生成中...";
      try {
        const result = await window.AppUtils.fetchJson(
          `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`,
          { method: "POST" },
          "生成失败，请稍后重试"
        );
        await loadAndRenderProjectTasks(projectId);
        const msg = result.createdCount > 0
          ? `已生成 ${result.createdCount} 个任务。`
          : "任务已是最新，无需重新生成。";
        window.AppUtils.showMessage("project-message", msg, "success");
      } catch (err) {
        if (hint) hint.textContent = `生成失败：${err.message}`;
        genBtn.disabled = false;
      }
    });
  }

  const groupsContainer = container.querySelector("#task-groups-container");
  if (!groupsContainer) return;

  groupsContainer.addEventListener("click", async (event) => {
    const editBtn = event.target.closest(".pt-edit-btn");
    const cancelBtn = event.target.closest(".pt-cancel-btn");

    if (editBtn) {
      const taskId = editBtn.getAttribute("data-task-id");
      const card = document.getElementById(`pt-card-${taskId}`);
      if (!card) return;
      try {
        const allTasks = await window.AppUtils.fetchJson(
          `/api/projects/${encodeURIComponent(projectId)}/tasks`,
          null,
          "加载失败"
        );
        const task = allTasks.find((item) => item.id === taskId);
        if (!task) return;
        const temp = document.createElement("div");
        temp.innerHTML = renderTaskEditRow(task);
        card.replaceWith(temp.firstElementChild);
        setupTaskEditFormHandlers(projectId, taskId);
      } catch (err) {
        window.AppUtils.showMessage("project-message", err.message, "error");
      }
    }

    if (cancelBtn) {
      await loadAndRenderProjectTasks(projectId);
    }
  });
}

function setupTaskEditFormHandlers(projectId, taskId) {
  const form = document.querySelector(`.pt-edit-form[data-task-id="${taskId}"]`);
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const hint = form.querySelector(".pt-save-hint");
    const submitBtn = form.querySelector("button[type=submit]");
    const formData = new FormData(form);
    const NULL_ON_EMPTY = new Set(["dueDate", "executionDate"]);
    const applyToSameSupplier = form.querySelector('input[name="applyToSameSupplier"]')?.checked === true;
    const patch = {};
    for (const [key, value] of formData.entries()) {
      if (key === "applyToSameSupplier") continue;
      patch[key] = (value === "" && NULL_ON_EMPTY.has(key)) ? null : value;
    }
    if (submitBtn) submitBtn.disabled = true;
    if (hint) hint.textContent = "保存中...";
    try {
      const result = await window.AppUtils.fetchJson(
        `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...patch, applyToSameSupplier }),
        },
        "保存失败，请稍后重试"
      );
      await loadAndRenderProjectTasks(projectId);
      if (applyToSameSupplier && result && result.affectedCount > 1) {
        window.AppUtils.showMessage("project-message", `已保存，共同步 ${result.affectedCount} 个同供应商任务。`, "success");
      }
    } catch (err) {
      if (hint) hint.textContent = `保存失败：${err.message}`;
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// ── B1-05B: 供应商成本汇总区块 ───────────────────────────────────────────────

const SUPPLIER_COST_STATUS_LABELS = {
  pending:   "待确认",
  estimated: "已估算",
  confirmed: "已确认",
  disputed:  "有异议",
};

const SUPPLIER_COST_STATUS_CLASS = {
  pending:   "scs-pending",
  estimated: "scs-estimated",
  confirmed: "scs-confirmed",
  disputed:  "scs-disputed",
};

function fmt(amount, currency) {
  return formatCurrency(amount, currency || "EUR");
}

function fmtOrDash(amount, currency) {
  if (amount == null) return "—";
  return fmt(amount, currency);
}

function varianceClass(v) {
  if (v == null) return "";
  if (v > 0) return "spc-over";
  if (v < 0) return "spc-under";
  return "";
}

function renderProjectCostKpiGrid(summary) {
  const currency = summary.currency || "EUR";
  const varianceCls = varianceClass(summary.costVariance);
  const actualMarginCls = summary.actualGrossMargin < 0 ? "spc-over"
    : summary.actualGrossMargin > 0 ? "spc-under" : "";

  let estimatedBannerText = "";
  if (summary.actualProfitIsEstimated) {
    if (summary.missingCostSupplierCount > 0) {
      estimatedBannerText = `（${summary.missingCostSupplierCount} 个供应商未录入成本）`;
    } else if (summary.supplierPendingCount > 0) {
      estimatedBannerText = `（${summary.supplierPendingCount} 个供应商成本未确认）`;
    }
  }

  const estimatedBanner = summary.actualProfitIsEstimated ? `
    <div class="sc-estimated-banner">⚠ 成本未完整 · 暂估利润 ${esc(estimatedBannerText)}</div>` : "";

  return `
    <div class="project-cost-kpi-grid">
      <div class="pck-item">
        <span class="pck-label">报价收入</span>
        <span class="pck-value">${esc(fmt(summary.quotedRevenueTotal, currency))}</span>
      </div>
      <div class="pck-item">
        <span class="pck-label">报价成本</span>
        <span class="pck-value">${esc(fmt(summary.quotedCostTotal, currency))}</span>
      </div>
      <div class="pck-item">
        <span class="pck-label">报价毛利</span>
        <span class="pck-value">${esc(fmt(summary.quotedGrossProfit, currency))} <em>(${esc(String(summary.quotedGrossMargin))}%)</em></span>
      </div>
      <div class="pck-item pck-divider">
        <span class="pck-label">项目实际成本</span>
        <span class="pck-value">${esc(fmt(summary.actualCostTotal, currency))}</span>
      </div>
      <div class="pck-item">
        <span class="pck-label">${summary.actualProfitIsEstimated ? "暂估毛利" : "实际毛利"}</span>
        <span class="pck-value ${esc(actualMarginCls)}">${esc(fmt(summary.actualGrossProfit, currency))} <em>(${esc(String(summary.actualGrossMargin))}%)</em></span>
      </div>
      <div class="pck-item">
        <span class="pck-label">成本差异</span>
        <span class="pck-value ${esc(varianceCls)}">${summary.costVariance > 0 ? "+" : ""}${esc(fmt(summary.costVariance, currency))}</span>
      </div>
    </div>
    ${estimatedBanner}`;
}

function renderSupplierCostRow(row, currency) {
  const modeLabel = row.appliedMode === "supplier_total" ? "供应商总成本" : "执行项汇总";
  const modeCls = row.appliedMode === "supplier_total" ? "scm-supplier" : "scm-items";
  const statusLabel = SUPPLIER_COST_STATUS_LABELS[row.costStatus] || row.costStatus;
  const statusCls = SUPPLIER_COST_STATUS_CLASS[row.costStatus] || "scs-pending";
  const varCls = varianceClass(row.costVariance);

  return `
    <tr class="supplier-cost-row" data-supplier-key="${esc(row.supplierKey)}" data-cost-record-id="${esc(row.costRecordId || '')}">
      <td class="sc-col-supplier">
        <strong>${esc(row.supplierDisplay || row.supplierId || "（未命名）")}</strong>
        ${row.invoiceNumber ? `<br><span class="sc-invoice-num">发票：${esc(row.invoiceNumber)}</span>` : ""}
      </td>
      <td class="sc-col-num">${esc(fmtOrDash(row.quotedTotalCost, currency))}</td>
      <td class="sc-col-num">${esc(fmtOrDash(row.executionActualTotalCost, currency))}</td>
      <td class="sc-col-num">${esc(fmtOrDash(row.supplierActualTotalCost, currency))}</td>
      <td class="sc-col-mode"><span class="supplier-cost-mode-badge ${esc(modeCls)}">${esc(modeLabel)}</span></td>
      <td class="sc-col-num ${esc(varCls)}">${row.costVariance > 0 ? "+" : ""}${esc(fmtOrDash(row.costVariance, currency))}</td>
      <td class="sc-col-status"><span class="supplier-cost-status-badge ${esc(statusCls)}">${esc(statusLabel)}</span></td>
      <td class="sc-col-actions">
        <button class="sc-edit-btn btn-xs" data-supplier-key="${esc(row.supplierKey)}">${row.costRecordId ? "编辑" : "录入总成本"}</button>
        ${row.costRecordId ? `<button class="sc-del-btn btn-xs btn-danger-xs" data-cost-id="${esc(row.costRecordId)}">删除</button>` : ""}
      </td>
    </tr>
    <tr class="supplier-cost-edit-row" id="sc-edit-row-${esc(row.supplierKey.replace(/[^a-z0-9]/gi, '_'))}" style="display:none">
      <td colspan="8" style="padding:0"></td>
    </tr>`;
}

function renderSupplierCostEditForm(row, currency, supplierKey) {
  const costRecord = row || {};
  return `
    <form class="supplier-cost-edit-form" data-supplier-key="${esc(supplierKey)}" data-cost-id="${esc(costRecord.costRecordId || '')}">
      <div class="sc-edit-grid">
        <div class="sc-edit-field">
          <label>供应商总成本</label>
          <input type="number" min="0" step="0.01" name="actualTotalCost" value="${esc(costRecord.supplierActualTotalCost != null ? String(costRecord.supplierActualTotalCost) : '')}" placeholder="留空=不采用总成本">
        </div>
        <div class="sc-edit-field">
          <label>币种</label>
          <select name="costCurrency">
            ${["EUR","CNY","RSD","USD"].map(c => `<option value="${c}"${((costRecord.costCurrency || costRecord.currency) || "EUR") === c ? " selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
        <div class="sc-edit-field">
          <label>采用供应商总成本</label>
          <select name="useSupplierTotal">
            <option value="true"${costRecord.useSupplierTotal !== false ? " selected" : ""}>是（覆盖执行项明细）</option>
            <option value="false"${costRecord.useSupplierTotal === false ? " selected" : ""}>否（使用执行项实际成本）</option>
          </select>
        </div>
        <div class="sc-edit-field">
          <label>成本状态</label>
          <select name="costStatus">
            ${Object.entries(SUPPLIER_COST_STATUS_LABELS).map(([v, l]) => `<option value="${v}"${(costRecord.costStatus || "pending") === v ? " selected" : ""}>${l}</option>`).join("")}
          </select>
        </div>
        <div class="sc-edit-field">
          <label>发票号</label>
          <input type="text" name="invoiceNumber" value="${esc(costRecord.invoiceNumber || '')}" placeholder="可选">
        </div>
        <div class="sc-edit-field">
          <label>发票日期</label>
          <input type="date" name="invoiceDate" value="${esc(costRecord.invoiceDate || '')}">
        </div>
        <div class="sc-edit-field sc-edit-field-full">
          <label>备注</label>
          <input type="text" name="notes" value="${esc(costRecord.notes || '')}" placeholder="可选">
        </div>
      </div>
      <div class="sc-edit-actions">
        <button type="submit" class="btn-primary-xs">保存</button>
        <button type="button" class="sc-cancel-btn btn-xs">取消</button>
        <span class="sc-save-hint"></span>
      </div>
    </form>`;
}

function renderProjectCostSummary(summary, projectId) {
  const currency = summary.currency || "EUR";
  const hasRows = summary.supplierRows && summary.supplierRows.length > 0;
  const hasUnassigned = summary.unassigned && summary.unassigned.executionActualTotalCost > 0;

  const tableHtml = hasRows || hasUnassigned ? `
    <div class="supplier-cost-table-wrap">
      <table class="supplier-cost-table">
        <thead>
          <tr>
            <th>供应商</th>
            <th>报价成本</th>
            <th>执行项实际</th>
            <th>供应商总成本</th>
            <th>采用口径</th>
            <th>差异</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody id="sc-table-body">
          ${(summary.supplierRows || []).map(r => renderSupplierCostRow(r, currency)).join("")}
          ${hasUnassigned ? (() => {
            const uv = (summary.unassigned.executionActualTotalCost || 0) - (summary.unassigned.quotedTotalCost || 0);
            const uvSign = uv > 0 ? "+" : "";
            const uvCls = varianceClass(uv);
            return `
          <tr class="supplier-cost-row supplier-cost-row-unassigned">
            <td class="sc-col-supplier" style="color:var(--muted);font-size:12px">（无供应商执行项）</td>
            <td class="sc-col-num">${esc(fmtOrDash(summary.unassigned.quotedTotalCost, currency))}</td>
            <td class="sc-col-num">${esc(fmt(summary.unassigned.executionActualTotalCost, currency))}</td>
            <td class="sc-col-num">—</td>
            <td class="sc-col-mode"><span class="supplier-cost-mode-badge scm-items">执行项汇总</span></td>
            <td class="sc-col-num ${esc(uvCls)}">${uvSign}${esc(fmt(uv, currency))}</td>
            <td></td>
            <td></td>
          </tr>`;
          })() : ""}
        </tbody>
      </table>
    </div>` : `<p class="sc-empty">暂无执行项，生成执行项后可在此查看成本汇总。</p>`;

  return `
    <section class="panel project-cost-summary-panel" id="project-cost-summary-panel">
      <div class="panel-head">
        <h2>供应商成本汇总</h2>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <button class="btn-xs invoice-import-open-btn" data-project-id="${esc(projectId)}">导入发票文本</button>
          <button class="btn-xs sc-refresh-btn" data-project-id="${esc(projectId)}">刷新</button>
        </div>
      </div>
      ${renderProjectCostKpiGrid(summary)}
      ${tableHtml}
      <span id="sc-message" aria-live="polite" style="font-size:12px;color:var(--muted)"></span>
      <div id="invoice-import-panel-container"></div>
      <div id="invoice-import-history-container"></div>
    </section>`;
}

async function loadAndRenderProjectCostSummary(projectId) {
  const container = document.getElementById("project-cost-summary-container");
  if (!container) return;
  try {
    const summary = await window.AppUtils.fetchJson(
      `/api/projects/${encodeURIComponent(projectId)}/cost-summary`,
      null,
      "成本汇总加载失败"
    );
    container.innerHTML = renderProjectCostSummary(summary, projectId);
    setupSupplierCostHandlers(projectId);
    setupInvoiceImportHandlers(projectId, summary);
    await loadInvoiceImportHistory(projectId);
  } catch (err) {
    container.innerHTML = `
      <section class="panel project-cost-summary-panel" id="project-cost-summary-panel">
        <div class="panel-head"><h2>供应商成本汇总</h2></div>
        <p style="color:#c44;font-size:13px">${esc(err.message)}</p>
      </section>`;
  }
}

function setupSupplierCostHandlers(projectId) {
  const container = document.getElementById("project-cost-summary-container");
  if (!container) return;

  // Refresh button
  const refreshBtn = container.querySelector(".sc-refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadAndRenderProjectCostSummary(projectId));
  }

  // Edit / add cost record
  container.addEventListener("click", async (event) => {
    const editBtn = event.target.closest(".sc-edit-btn");
    const cancelBtn = event.target.closest(".sc-cancel-btn");
    const delBtn = event.target.closest(".sc-del-btn");

    if (editBtn) {
      const supplierKey = editBtn.getAttribute("data-supplier-key");
      const editRowId = `sc-edit-row-${supplierKey.replace(/[^a-z0-9]/gi, '_')}`;
      const editRow = document.getElementById(editRowId);
      if (!editRow) return;

      // Load current summary row data
      const dataRow = editRow.previousElementSibling;
      const costRecordId = dataRow ? dataRow.getAttribute("data-cost-record-id") : "";

      // Build row data from summary (re-fetch or read from DOM)
      let summary;
      try {
        summary = await window.AppUtils.fetchJson(
          `/api/projects/${encodeURIComponent(projectId)}/cost-summary`,
          null,
          "加载失败"
        );
      } catch (e) {
        return;
      }
      const rowData = summary.supplierRows.find(r => r.supplierKey === supplierKey);
      if (!rowData) return;

      editRow.style.display = "";
      editRow.querySelector("td").innerHTML = renderSupplierCostEditForm(rowData, summary.currency, supplierKey);
      setupCostEditFormHandlers(projectId, supplierKey, rowData);
    }

    if (cancelBtn) {
      await loadAndRenderProjectCostSummary(projectId);
    }

    if (delBtn) {
      const costId = delBtn.getAttribute("data-cost-id");
      if (!costId) return;
      if (!confirm("确认删除此供应商成本记录？")) return;
      try {
        await window.AppUtils.fetchJson(
          `/api/projects/${encodeURIComponent(projectId)}/supplier-costs/${encodeURIComponent(costId)}`,
          { method: "DELETE" },
          "删除失败"
        );
        await loadAndRenderProjectCostSummary(projectId);
      } catch (err) {
        const msgEl = document.getElementById("sc-message");
        if (msgEl) msgEl.textContent = `删除失败：${err.message}`;
      }
    }
  });
}

function setupCostEditFormHandlers(projectId, supplierKey, rowData) {
  const form = document.querySelector(`.supplier-cost-edit-form[data-supplier-key="${supplierKey}"]`);
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const hint = form.querySelector(".sc-save-hint");
    const submitBtn = form.querySelector("button[type=submit]");
    const formData = new FormData(form);
    const patch = {};
    for (const [key, value] of formData.entries()) {
      patch[key] = value;
    }
    // Coerce types
    if (patch.actualTotalCost !== undefined) {
      patch.actualTotalCost = patch.actualTotalCost === "" ? null : Number(patch.actualTotalCost);
    }
    patch.useSupplierTotal = patch.useSupplierTotal === "true";
    if (patch.invoiceDate === "") patch.invoiceDate = null;

    // Always send supplierId + supplierDisplay for upsert/update identity
    const costId = form.getAttribute("data-cost-id");

    if (submitBtn) submitBtn.disabled = true;
    if (hint) hint.textContent = "保存中...";
    try {
      if (costId) {
        await window.AppUtils.fetchJson(
          `/api/projects/${encodeURIComponent(projectId)}/supplier-costs/${encodeURIComponent(costId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
          "保存失败"
        );
      } else {
        // New record — include supplier identity
        await window.AppUtils.fetchJson(
          `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...patch,
              supplierId: rowData.supplierId || "",
              supplierDisplay: rowData.supplierDisplay || "",
            }),
          },
          "保存失败"
        );
      }
      await loadAndRenderProjectCostSummary(projectId);
    } catch (err) {
      if (hint) hint.textContent = `保存失败：${err.message}`;
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// ── B1-05C: 发票文本导入 UI ────────────────────────────────────────────────────

function renderInvoiceImportStatusBadge(status) {
  const map = { pending: ["iisb-pending", "待审核"], applied: ["iisb-applied", "已写入"], rejected: ["iisb-rejected", "已驳回"] };
  const [cls, label] = map[status] || ["iisb-pending", status];
  return `<span class="invoice-import-status-badge ${esc(cls)}">${esc(label)}</span>`;
}

function renderInvoiceImportHistory(imports) {
  if (!imports || imports.length === 0) {
    return `<div class="invoice-import-history">
      <h4>发票导入历史</h4>
      <p class="invoice-import-history-empty">暂无导入记录。</p>
    </div>`;
  }
  const rows = imports.map(r => `
    <tr>
      <td>${esc((r.createdAt || '').slice(0, 10))}</td>
      <td>${esc(r.parsedSupplierName || r.supplierDisplay || '—')}</td>
      <td>${esc(r.invoiceNumber || '—')}</td>
      <td>${r.totalWithTax != null ? esc(String(r.totalWithTax)) + ' ' + esc(r.currency || '') : '—'}</td>
      <td>${renderInvoiceImportStatusBadge(r.reviewStatus)}</td>
    </tr>`).join('');
  return `<div class="invoice-import-history">
    <h4>发票导入历史（最近 ${imports.length} 条）</h4>
    <table class="invoice-history-table">
      <thead><tr><th>日期</th><th>供应商</th><th>发票号</th><th>金额</th><th>状态</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

async function loadInvoiceImportHistory(projectId) {
  const container = document.getElementById("invoice-import-history-container");
  if (!container) return;
  try {
    const imports = await window.AppUtils.fetchJson(
      `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports`,
      null,
      "加载导入历史失败"
    );
    container.innerHTML = renderInvoiceImportHistory(imports);
  } catch (_) {
    container.innerHTML = '';
  }
}

function setupInvoiceImportHandlers(projectId, summary) {
  const panel = document.getElementById("project-cost-summary-panel");
  if (!panel) return;

  const openBtn = panel.querySelector(".invoice-import-open-btn");
  if (!openBtn) return;

  openBtn.addEventListener("click", () => {
    const panelContainer = document.getElementById("invoice-import-panel-container");
    if (!panelContainer) return;
    if (panelContainer.innerHTML.trim()) {
      panelContainer.innerHTML = '';
      openBtn.textContent = "导入发票文本";
      return;
    }
    openBtn.textContent = "收起";
    const supplierOptions = (summary && summary.supplierRows || [])
      .map(r => `<option value="${esc(r.supplierDisplay)}" data-supplier-id="${esc(r.supplierId || '')}" data-cost-record-id="${esc(r.costRecordId || '')}">${esc(r.supplierDisplay)}</option>`)
      .join('');
    panelContainer.innerHTML = `
      <div class="invoice-text-import-panel" id="invoice-import-form-panel">
        <h3>导入发票文本</h3>
        <p class="invoice-import-desc">粘贴供应商发票 / 收据文字，系统会尝试识别供应商、发票号、日期和含税总额。</p>
        <textarea class="invoice-import-textarea" id="invoice-raw-text" placeholder="在此粘贴发票原文…"></textarea>
        <div class="invoice-import-actions">
          <button class="btn-primary-xs" id="invoice-parse-btn">解析</button>
          <button class="btn-xs" id="invoice-cancel-btn">取消</button>
          <span id="invoice-parse-msg" style="font-size:12px;color:var(--muted)"></span>
        </div>
        <div id="invoice-parse-result-area"></div>
      </div>`;

    document.getElementById("invoice-cancel-btn").addEventListener("click", () => {
      panelContainer.innerHTML = '';
      openBtn.textContent = "导入发票文本";
    });

    document.getElementById("invoice-parse-btn").addEventListener("click", async () => {
      const rawText = (document.getElementById("invoice-raw-text") || {}).value || '';
      if (!rawText.trim()) {
        document.getElementById("invoice-parse-msg").textContent = "请先粘贴发票文字。";
        return;
      }
      const parseBtn = document.getElementById("invoice-parse-btn");
      const msg = document.getElementById("invoice-parse-msg");
      parseBtn.disabled = true;
      msg.textContent = "解析中...";
      try {
        const record = await window.AppUtils.fetchJson(
          `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rawText }),
          },
          "解析失败"
        );
        msg.textContent = '';
        renderInvoiceParseResult(record, projectId, summary, supplierOptions);
      } catch (err) {
        msg.textContent = `解析失败：${err.message}`;
        parseBtn.disabled = false;
      }
    });
  });
}

function renderInvoiceParseResult(record, projectId, summary, supplierOptions) {
  const area = document.getElementById("invoice-parse-result-area");
  if (!area) return;

  const projectCurrency = (summary && summary.currency) || 'EUR';
  const invoiceCurrency = record.currency || 'RSD';
  const currenciesDiffer = invoiceCurrency !== projectCurrency;

  const failedCls = record.parseStatus === 'failed' ? 'parse-failed' : '';
  const confScore = record.matchConfidence != null ? Number(record.matchConfidence) : 0;
  const confCls = confScore >= 70 ? '' : confScore >= 30 ? 'conf-low' : 'conf-zero';
  const fmtNum = v => v != null ? String(v) : '—';

  // Currency section: if same currency, show editable cost input; if different, show conversion input
  const currencySection = currenciesDiffer ? `
      <div class="invoice-currency-warning">
        ⚠ 发票币种 <strong>${esc(invoiceCurrency)}</strong> 与项目币种 <strong>${esc(projectCurrency)}</strong> 不同。
        发票原始金额仅供参考，必须在下方填写 <strong>${esc(projectCurrency)}</strong> 折算金额，否则无法写入。
      </div>
      <div class="invoice-confirm-row">
        <label>发票金额 (${esc(invoiceCurrency)})</label>
        <span class="invoice-orig-amount-display">${esc(fmtNum(record.totalWithTax))} ${esc(invoiceCurrency)}（参考，不写入）</span>
      </div>
      <div class="invoice-confirm-row">
        <label>折算金额 (${esc(projectCurrency)}) <span style="color:#c44">*</span></label>
        <input type="number" id="ici-converted-${esc(record.id)}" placeholder="必填，${esc(projectCurrency)} 等值金额" min="0" step="0.01">
      </div>` : `
      <div class="invoice-confirm-row">
        <label>实际总成本 (${esc(projectCurrency)})</label>
        <input type="number" id="ici-cost-${esc(record.id)}" value="${record.totalWithTax != null ? record.totalWithTax : ''}" min="0" step="0.01" placeholder="含税总额">
      </div>`;

  area.innerHTML = `
    <div class="invoice-parse-result ${failedCls}">
      <h4>解析结果 ${record.parseStatus === 'failed' ? '<span style="color:#c44;font-size:12px">（未识别总金额，请手动填写）</span>' : ''}</h4>
      ${record.parseError ? `<p class="invoice-parse-error-msg">⚠ ${esc(record.parseError)}</p>` : ''}
      <dl class="invoice-parse-grid">
        <dt>识别供应商</dt><dd>${esc(record.parsedSupplierName || '—')}</dd>
        <dt>PIB</dt><dd>${esc(record.parsedSupplierPib || '—')}</dd>
        <dt>发票号</dt><dd>${esc(record.invoiceNumber || '—')}</dd>
        <dt>发票日期</dt><dd>${esc(record.invoiceDate || '—')}</dd>
        <dt>发票币种</dt><dd>${esc(record.currency || '—')}</dd>
        <dt>不含税金额</dt><dd>${esc(fmtNum(record.subtotalWithoutTax))}</dd>
        <dt>PDV 税额</dt><dd>${esc(fmtNum(record.taxAmount))}</dd>
        <dt>含税总额</dt><dd><strong>${esc(fmtNum(record.totalWithTax))}</strong> ${esc(record.currency || '')}</dd>
        <dt>匹配建议</dt><dd>${esc(record.suggestedSupplierDisplay || '—')}
          <span class="invoice-match-confidence ${esc(confCls)}">${esc(String(confScore))}%</span>
        </dd>
        <dt>匹配原因</dt><dd>${esc(record.matchReason || '—')}</dd>
      </dl>
      <div class="invoice-confirm-form" id="invoice-confirm-form-${esc(record.id)}">
        <h4>人工确认</h4>
        <input type="hidden" id="ici-supplier-id-${esc(record.id)}" value="${esc(record.suggestedSupplierId || '')}">
        <input type="hidden" id="ici-cost-record-id-${esc(record.id)}" value="">
        <div class="invoice-confirm-row">
          <label>目标供应商</label>
          <select id="ici-supplier-${esc(record.id)}">
            <option value="">—— 请选择或直接输入 ——</option>
            ${supplierOptions}
          </select>
        </div>
        <div class="invoice-confirm-row">
          <label>供应商名称</label>
          <input type="text" id="ici-supplier-display-${esc(record.id)}" value="${esc(record.suggestedSupplierDisplay || record.parsedSupplierName || '')}" placeholder="供应商显示名">
        </div>
        ${currencySection}
        <div class="invoice-confirm-row">
          <label>成本状态</label>
          <select id="ici-status-${esc(record.id)}">
            <option value="confirmed">confirmed（已确认）</option>
            <option value="estimated">estimated（暂估）</option>
            <option value="pending">pending（待确认）</option>
          </select>
        </div>
        <div class="invoice-confirm-row">
          <label>发票号</label>
          <input type="text" id="ici-invnum-${esc(record.id)}" value="${esc(record.invoiceNumber || '')}" placeholder="发票号">
        </div>
        <div class="invoice-confirm-row">
          <label>发票日期</label>
          <input type="date" id="ici-invdate-${esc(record.id)}" value="${esc(record.invoiceDate || '')}">
        </div>
        <div class="invoice-confirm-row">
          <label>备注</label>
          <input type="text" id="ici-notes-${esc(record.id)}" placeholder="可选备注">
        </div>
        <div class="invoice-confirm-actions">
          <button class="btn-primary-xs" id="ici-apply-btn-${esc(record.id)}">写入供应商总成本</button>
          <button class="btn-xs btn-danger-xs" id="ici-reject-btn-${esc(record.id)}">标记不用 / 驳回</button>
          <span id="ici-msg-${esc(record.id)}" style="font-size:12px;color:var(--muted)"></span>
        </div>
      </div>
    </div>`;

  // Sync select → display input + hidden supplier/costRecord IDs
  const sel = document.getElementById(`ici-supplier-${record.id}`);
  const dispInput = document.getElementById(`ici-supplier-display-${record.id}`);
  const supplierIdInput = document.getElementById(`ici-supplier-id-${record.id}`);
  const costRecordIdInput = document.getElementById(`ici-cost-record-id-${record.id}`);

  if (sel) {
    // Pre-select suggested
    if (record.suggestedSupplierDisplay) {
      for (const opt of sel.options) {
        if (opt.value === record.suggestedSupplierDisplay) {
          sel.value = record.suggestedSupplierDisplay;
          if (supplierIdInput) supplierIdInput.value = opt.getAttribute('data-supplier-id') || '';
          if (costRecordIdInput) costRecordIdInput.value = opt.getAttribute('data-cost-record-id') || '';
          break;
        }
      }
    }
    sel.addEventListener("change", () => {
      const opt = sel.options[sel.selectedIndex];
      if (sel.value && dispInput) dispInput.value = sel.value;
      if (supplierIdInput) supplierIdInput.value = opt ? (opt.getAttribute('data-supplier-id') || '') : '';
      if (costRecordIdInput) costRecordIdInput.value = opt ? (opt.getAttribute('data-cost-record-id') || '') : '';
    });
  }

  const applyBtn = document.getElementById(`ici-apply-btn-${record.id}`);
  const rejectBtn = document.getElementById(`ici-reject-btn-${record.id}`);
  const msgEl = document.getElementById(`ici-msg-${record.id}`);

  applyBtn && applyBtn.addEventListener("click", async () => {
    const supplierDisplay = (document.getElementById(`ici-supplier-display-${record.id}`) || {}).value || '';
    if (!supplierDisplay.trim()) { msgEl.textContent = "请填写供应商名称。"; return; }

    const supplierId = (document.getElementById(`ici-supplier-id-${record.id}`) || {}).value || '';
    const targetCostRecordId = (document.getElementById(`ici-cost-record-id-${record.id}`) || {}).value || '';

    // Build the cost amount fields based on currency match
    let amountFields = {};
    if (currenciesDiffer) {
      const convVal = (document.getElementById(`ici-converted-${record.id}`) || {}).value;
      if (!convVal || isNaN(Number(convVal)) || Number(convVal) < 0) {
        msgEl.textContent = `请填写 ${projectCurrency} 折算金额（必填）。`; return;
      }
      amountFields = { projectCurrencyAmount: Number(convVal) };
    } else {
      const costVal = (document.getElementById(`ici-cost-${record.id}`) || {}).value;
      const actualTotalCost = costVal !== '' ? Number(costVal) : null;
      if (actualTotalCost !== null && (isNaN(actualTotalCost) || actualTotalCost < 0)) {
        msgEl.textContent = "实际总成本必须 >= 0。"; return;
      }
      amountFields = { actualTotalCost };
    }

    applyBtn.disabled = true;
    msgEl.textContent = "写入中...";
    try {
      await window.AppUtils.fetchJson(
        `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports/${encodeURIComponent(record.id)}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierDisplay,
            supplierId,
            ...(targetCostRecordId ? { targetCostRecordId } : {}),
            ...amountFields,
            costStatus: (document.getElementById(`ici-status-${record.id}`) || {}).value || 'confirmed',
            invoiceNumber: (document.getElementById(`ici-invnum-${record.id}`) || {}).value || '',
            invoiceDate: (document.getElementById(`ici-invdate-${record.id}`) || {}).value || null,
            notes: (document.getElementById(`ici-notes-${record.id}`) || {}).value || '',
            useSupplierTotal: true,
          }),
        },
        "写入失败"
      );
      msgEl.textContent = "✓ 已写入供应商总成本";
      msgEl.style.color = "#1a7a3c";
      await loadAndRenderProjectCostSummary(projectId);
    } catch (err) {
      msgEl.textContent = `写入失败：${err.message}`;
      applyBtn.disabled = false;
    }
  });

  rejectBtn && rejectBtn.addEventListener("click", async () => {
    const reason = window.prompt("驳回原因（可留空）") || '';
    rejectBtn.disabled = true;
    msgEl.textContent = "处理中...";
    try {
      await window.AppUtils.fetchJson(
        `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports/${encodeURIComponent(record.id)}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
        "驳回失败"
      );
      msgEl.textContent = "已驳回";
      msgEl.style.color = "#6c757d";
      await loadInvoiceImportHistory(projectId);
      const panelContainer = document.getElementById("invoice-import-panel-container");
      if (panelContainer) panelContainer.innerHTML = '';
      const openBtn = document.querySelector(".invoice-import-open-btn");
      if (openBtn) openBtn.textContent = "导入发票文本";
    } catch (err) {
      msgEl.textContent = `驳回失败：${err.message}`;
      rejectBtn.disabled = false;
    }
  });
}

bootstrap();
