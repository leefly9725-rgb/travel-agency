const EXECUTION_STATUS_LABELS = {
  pending: "待处理",
  in_progress: "进行中",
  done: "已完成",
  cancelled: "已取消",
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
    ["总项数", total, "total"],
    ["待处理", pending, "pending"],
    ["进行中", inProgress, "progress"],
    ["已完成", done, "done"],
    ["供应商已确认", confirmed, "confirmed"],
  ];
  return `
    <div class="ei-stats-grid" aria-label="执行清单统计">
      ${stats.map(([label, value, key]) => `
        <div class="ei-stat-card ei-stat-${key}">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `).join("")}
    </div>
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

  return `
    <section class="panel project-workspace-header">
      <div class="project-workspace-main">
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
      <div class="project-workspace-facts">
        <div class="project-fact"><span>日期范围</span><strong>${esc(getProjectDateRange(project))}</strong></div>
        <div class="project-fact"><span>PAX</span><strong>${project.paxCount != null ? esc(String(project.paxCount)) : "—"}</strong></div>
        <div class="project-fact"><span>目的地</span><strong>${esc(project.destination || "—")}</strong></div>
      </div>
      ${renderStatusPanel(project.status, project.id)}
    </section>

    ${renderMasterPanel(project)}

    <div id="execution-items-container">
      <section class="panel">
        <div class="panel-head"><h2>项目执行清单</h2></div>
        <p style="color:#888;font-size:13px;margin:8px 0">加载中…</p>
      </section>
    </div>

    <section class="panel auxiliary-panel">
      <details class="collapsible-panel" open>
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

    <section class="panel auxiliary-panel">
      <details class="collapsible-panel">
        <summary class="panel-summary"><h2>报价快照 · 明细</h2></summary>
        ${renderSnapshotGroups(snap.projectGroups, currency)}
      </details>
    </section>

    <section class="panel auxiliary-panel">
      <details class="collapsible-panel">
        <summary class="panel-summary"><h2>汇总</h2></summary>
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
    const rows = groupItems.map((item) => `
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
        </td>
        <td class="ei-cell ei-cell-actions">
          <button type="button" class="button-link small-link ei-edit-btn" data-item-id="${esc(item.id)}">编辑</button>
          <button type="button" class="button-link small-link danger-link ei-delete-btn" data-item-id="${esc(item.id)}">删除</button>
        </td>
      </tr>
    `).join("");

    return `
      <div class="ei-group supplier-execution-group">
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
    const patch = {};
    for (const [k, v] of formData.entries()) {
      if (k === "applyToSameSupplier") continue;
      patch[k] = (v === "" && NULL_ON_EMPTY.has(k)) ? null : v;
    }
    if (patch.quantity !== undefined && patch.quantity !== null) patch.quantity = Number(patch.quantity);

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
    } else {
      container.innerHTML = renderArchiveProject(project);
    }
  } catch (error) {
    window.AppUtils.showMessage("project-message", error.message, "error");
    document.getElementById("project-detail").innerHTML = window.AppUtils.renderEmptyState("项目详情不可用", error.message);
  }
}

bootstrap();
