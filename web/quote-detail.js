function isFlaggedReview(record) {
  return record?.dataQuality?.reviewStatus === "flagged_review";
}

function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatTs(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return "—"; }
}

function isManagerOrAdmin() {
  const roles = window.__CURRENT_USER__?.roles || [];
  return roles.includes("admin") || roles.includes("manager");
}

const STATUS_CLS   = { draft: "s-draft", pending: "s-pending", approved: "s-approved", rejected: "s-rejected" };
const EXEC_CLS     = { preparing: "e-preparing", executing: "e-executing", completed: "e-completed" };
const STATUS_LABEL = { draft: "草稿", pending: "待审批", approved: "已批准", rejected: "已拒绝" };
const EXEC_LABEL   = { preparing: "筹备中", executing: "执行中", completed: "已完成" };

// ── Detail sub-blocks (unchanged from original) ───────────────────────────────
function renderVehicleDetailBlock(item, quoteCurrency) {
  if (!item.vehicleDetails || item.vehicleDetails.length === 0) return "";
  return `
    <div class="vehicle-detail-preview section-spacing-sm">
      ${item.vehicleDetails.map((detail) => `
        <div class="table-row table-row-wide table-row-split">
          <div>
            <strong>${window.AppUi.getLabel("vehicleDetailTypeLabels", detail.detailType)} / ${detail.vehicleModel}</strong>
            <p class="meta preview-subline">${detail.vehicleCount} 车 / 计费 ${detail.billingQuantity} ${window.AppUi.getLabel("vehiclePricingUnitLabels", detail.pricingUnit)} / 币种 ${window.AppUi.getLabel("currencyLabels", detail.currency)}</p>
            <p class="meta preview-subline">成本 ${window.AppUtils.formatCurrency(detail.costSubtotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}）/ 销售 ${window.AppUtils.formatCurrency(detail.priceSubtotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}）</p>
            <p class="meta preview-subline">${detail.notes || "无备注"}</p>
          </div>
          <div class="table-row-values">
            <span>成本 ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}</span>
            <strong>销售 ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}</strong>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderServiceDetailBlock(item, quoteCurrency) {
  if (!item.serviceDetails || item.serviceDetails.length === 0) return "";
  return `
    <div class="service-detail-preview section-spacing-sm">
      ${item.serviceDetails.map((detail) => `
        <div class="table-row table-row-wide table-row-split">
          <div>
            <strong>${window.AppUi.getLabel("serviceRoleLabels", detail.serviceRole)} / ${window.AppUi.getLabel("serviceLanguageLabels", detail.serviceLanguage)}</strong>
            <p class="meta preview-subline">${window.AppUi.getLabel("serviceDurationLabels", detail.serviceDuration)} / 数量 ${detail.quantity} / 币种 ${window.AppUi.getLabel("currencyLabels", detail.currency)}</p>
            <p class="meta preview-subline">成本 ${window.AppUtils.formatCurrency(detail.costSubtotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}）/ 销售 ${window.AppUtils.formatCurrency(detail.priceSubtotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}）</p>
            <p class="meta preview-subline">${detail.notes || "无备注"}</p>
          </div>
          <div class="table-row-values">
            <span>成本 ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}</span>
            <strong>销售 ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}</strong>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderHotelDetailBlock(item, quoteCurrency) {
  if (!item.hotelDetails || item.hotelDetails.length === 0) return "";
  return `
    <div class="hotel-detail-preview section-spacing-sm">
      ${item.hotelDetails.map((detail) => `
        <div class="table-row table-row-wide table-row-split">
          <div>
            <strong>${detail.roomType}</strong>
            <p class="meta preview-subline">${detail.roomCount} 间 / ${detail.nights} 晚 / 币种 ${window.AppUi.getLabel("currencyLabels", detail.currency)}</p>
            <p class="meta preview-subline">成本 ${window.AppUtils.formatCurrency(detail.costSubtotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}）/ 销售 ${window.AppUtils.formatCurrency(detail.priceSubtotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}）</p>
            <p class="meta preview-subline">${detail.notes || "无备注"}</p>
          </div>
          <div class="table-row-values">
            <span>成本 ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}</span>
            <strong>销售 ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}</strong>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderMealDetailBlock(item, quoteCurrency) {
  if (!item.mealDetails) return "";
  const detail = item.mealDetails;
  return `
    <div class="meal-detail-preview section-spacing-sm">
      <div class="table-row table-row-wide">
        <div>
          <strong>计价方式：人数 × 餐次 × 餐标</strong>
          <p class="meta preview-subline">用餐人数 ${detail.mealPeople} 人 / 行程天数 ${detail.tripDays} 天 / 币种 ${window.AppUi.getLabel("currencyLabels", detail.currency)}</p>
          <p class="meta preview-subline">午餐 ${detail.includeLunch ? "计算" : "不计算"}，次数 ${detail.lunchCount}，总额 ${window.AppUtils.formatCurrency(detail.lunchTotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.lunchTotal, quoteCurrency)}）</p>
          <p class="meta preview-subline">晚餐 ${detail.includeDinner ? "计算" : "不计算"}，次数 ${detail.dinnerCount}，总额 ${window.AppUtils.formatCurrency(detail.dinnerTotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.dinnerTotal, quoteCurrency)}）</p>
          <p class="meta preview-subline">首日午餐：${detail.firstDayLunch ? "包含" : "不含"} / 首日晚餐：${detail.firstDayDinner ? "包含" : "不含"} / 末日午餐：${detail.lastDayLunch ? "包含" : "不含"} / 末日晚餐：${detail.lastDayDinner ? "包含" : "不含"}</p>
        </div>
        <div class="table-row-values">
          <span>用餐合计</span>
          <strong>${window.AppUtils.formatCurrency(detail.totalAmount, quoteCurrency)}</strong>
        </div>
      </div>
    </div>
  `;
}

// ── Approval info block ───────────────────────────────────────────────────────
function renderApprovalBlock(quote) {
  if (!quote.ownerId && !quote.submittedAt && !quote.reviewedAt) return "";
  const showRejectNote = (quote.status === "rejected") && quote.reviewNote;
  return `
    <div class="panel subpanel section-spacing">
      <div class="panel-head"><h2>审批信息</h2></div>
      <div class="detail-grid">
        <div class="metric"><span>负责人</span><strong>${esc(quote.ownerName || quote.ownerId || "未指定")}</strong></div>
        <div class="metric"><span>提交时间</span><strong>${formatTs(quote.submittedAt)}</strong></div>
        <div class="metric"><span>审批人</span><strong>${esc(quote.reviewerName || quote.reviewerId || "未审批")}</strong></div>
        <div class="metric"><span>审批时间</span><strong>${formatTs(quote.reviewedAt)}</strong></div>
      </div>
      ${showRejectNote ? `
        <div class="review-note section-spacing-sm">
          <strong>拒绝原因</strong>
          <p>${esc(quote.reviewNote)}</p>
        </div>
      ` : ""}
    </div>
  `;
}

// ── Action buttons (role + status driven) ────────────────────────────────────
function renderActionButtons(quote) {
  const container = document.getElementById("quote-action-row");
  if (!container) return;
  // Remove any previously rendered workflow buttons to avoid duplicates on re-render
  container.querySelectorAll(".workflow-btn").forEach(b => b.remove());

  const isAdmin = isManagerOrAdmin();
  const status = quote.status || "draft";

  if (!isAdmin) {
    if (status === "draft") {
      const btn = document.createElement("button");
      btn.className = "button-link small-link workflow-btn";
      btn.style.cssText = "background:var(--accent);color:#fff;border:none;cursor:pointer";
      btn.textContent = "提交审批";
      btn.addEventListener("click", () => submitForReview(quote.id, btn));
      container.insertBefore(btn, container.firstChild);
    } else if (status === "rejected") {
      const btn = document.createElement("button");
      btn.className = "button-link small-link workflow-btn";
      btn.style.cssText = "background:var(--accent);color:#fff;border:none;cursor:pointer";
      btn.textContent = "重开草稿";
      btn.addEventListener("click", () => reopenQuote(quote.id, btn));
      container.insertBefore(btn, container.firstChild);
    }
  } else {
    if (status === "pending") {
      const rejectBtn = document.createElement("button");
      rejectBtn.className = "button-link small-link workflow-btn";
      rejectBtn.style.cssText = "background:var(--error-text);color:#fff;border:none;cursor:pointer;margin-left:8px";
      rejectBtn.textContent = "拒绝";
      rejectBtn.addEventListener("click", () => showRejectDialog(quote.id));

      const approveBtn = document.createElement("button");
      approveBtn.className = "button-link small-link workflow-btn";
      approveBtn.style.cssText = "background:#2e7d32;color:#fff;border:none;cursor:pointer";
      approveBtn.textContent = "批准";
      approveBtn.addEventListener("click", () => approveQuote(quote.id, approveBtn));

      container.insertBefore(rejectBtn, container.firstChild);
      container.insertBefore(approveBtn, container.firstChild);
    } else if (status === "approved" || status === "rejected") {
      const reopenBtn = document.createElement("button");
      reopenBtn.className = "button-link small-link workflow-btn";
      reopenBtn.style.cssText = "background:var(--accent);color:#fff;border:none;cursor:pointer";
      reopenBtn.textContent = "重开草稿";
      reopenBtn.addEventListener("click", () => reopenQuote(quote.id, reopenBtn));
      container.insertBefore(reopenBtn, container.firstChild);
    }
  }

  // 复制报价按钮（仅标准报价可用，放在删除之前）
  if ((quote.pricingMode || "standard") !== "project_based") {
    const cloneBtn = document.createElement("button");
    cloneBtn.className = "button-link small-link workflow-btn";
    cloneBtn.style.cssText = "background:transparent;color:var(--accent);border:1.5px solid var(--accent);cursor:pointer;margin-left:8px";
    cloneBtn.textContent = "复制报价";
    cloneBtn.addEventListener("click", () => cloneQuote(quote.id, cloneBtn));
    container.appendChild(cloneBtn);
  }

  // 客户报价单按钮（仅标准报价，在新标签打开）
  if ((quote.pricingMode || "standard") !== "project_based") {
    const sqLink = document.createElement("a");
    sqLink.className = "button-link small-link workflow-btn";
    sqLink.style.cssText = "margin-left:8px;text-decoration:none;display:inline-block";
    sqLink.textContent = "客户报价单";
    sqLink.href = "/standard-quotation.html?id=" + encodeURIComponent(quote.id) + "&lang=bi&taxMode=included&showTerms=1";
    sqLink.target = "_blank";
    sqLink.rel = "noopener noreferrer";
    container.appendChild(sqLink);

    const shareBtn = document.createElement("button");
    shareBtn.className = "button-link small-link workflow-btn";
    shareBtn.style.cssText = "background:transparent;color:var(--accent);border:1.5px solid var(--accent);cursor:pointer;margin-left:8px";
    shareBtn.textContent = "生成客户分享链接";
    shareBtn.addEventListener("click", () => generateCustomerShareLink(quote.id, shareBtn));
    container.appendChild(shareBtn);
  }

  // 删除按钮（追加到行尾，与主操作保持视觉距离）
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "button-link small-link workflow-btn";
  deleteBtn.style.cssText = "background:transparent;color:var(--error-text);border:1.5px solid var(--error-text);cursor:pointer;margin-left:16px";
  deleteBtn.textContent = "删除报价";
  deleteBtn.addEventListener("click", () => deleteQuote(quote.id, quote.projectName || quote.quoteNumber));
  container.appendChild(deleteBtn);
}

// ── Workflow action functions ──────────────────────────────────────────────────
async function submitForReview(quoteId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "提交中…"; }
  try {
    await window.AppUtils.fetchJson(
      `/api/quotes/${encodeURIComponent(quoteId)}/submit`,
      { method: "POST" },
      "提交审批失败，请稍后重试"
    );
    window.AppUtils.setFlash("已提交审批，等待经理/管理员审核。", "success");
    window.location.reload();
  } catch (e) {
    window.AppUtils.showMessage("quote-message", e.message, "error");
    if (btn) { btn.disabled = false; btn.textContent = "提交审批"; }
  }
}

async function approveQuote(quoteId, btn) {
  if (!window.confirm("确认批准此报价单？")) return;
  if (btn) { btn.disabled = true; btn.textContent = "处理中…"; }
  try {
    await window.AppUtils.fetchJson(
      `/api/quotes/${encodeURIComponent(quoteId)}/review`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve", note: "" }) },
      "批准失败，请稍后重试"
    );
    window.AppUtils.setFlash("报价单已批准，请刷新后确认执行状态是否已更新为「执行中」。", "success");
    window.location.reload();
  } catch (e) {
    window.AppUtils.showMessage("quote-message", e.message, "error");
    if (btn) { btn.disabled = false; btn.textContent = "批准"; }
  }
}

function showRejectDialog(quoteId) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000";
  overlay.innerHTML = `
    <div style="background:var(--panel);border-radius:12px;padding:28px;width:420px;max-width:calc(100vw - 32px);box-shadow:0 8px 32px rgba(0,0,0,0.18)">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 16px">填写拒绝原因</h2>
      <textarea id="reject-note-input" placeholder="请填写拒绝原因（必填）" style="width:100%;height:100px;padding:8px 10px;box-sizing:border-box;border:1.5px solid var(--line);border-radius:8px;font:inherit;resize:vertical;background:var(--bg);color:var(--ink)"></textarea>
      <div id="reject-error" style="font-size:12px;color:var(--error-text);margin-top:6px;display:none"></div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
        <button id="reject-cancel" style="padding:8px 18px;border-radius:8px;border:1.5px solid var(--line);background:transparent;color:var(--ink);font-size:13px;font-weight:600;cursor:pointer">取消</button>
        <button id="reject-confirm" style="padding:8px 18px;border-radius:8px;border:none;background:var(--error-text);color:#fff;font-size:13px;font-weight:600;cursor:pointer">确认拒绝</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const textarea   = overlay.querySelector("#reject-note-input");
  const errorEl    = overlay.querySelector("#reject-error");
  const cancelBtn  = overlay.querySelector("#reject-cancel");
  const confirmBtn = overlay.querySelector("#reject-confirm");

  cancelBtn.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  textarea.focus();

  confirmBtn.addEventListener("click", async () => {
    const note = textarea.value.trim();
    if (!note) { errorEl.textContent = "拒绝原因不能为空"; errorEl.style.display = "block"; return; }
    confirmBtn.disabled = true; confirmBtn.textContent = "处理中…";
    try {
      await window.AppUtils.fetchJson(
        `/api/quotes/${encodeURIComponent(quoteId)}/review`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", note }) },
        "拒绝操作失败，请稍后重试"
      );
      overlay.remove();
      window.AppUtils.setFlash("报价单已拒绝。", "success");
      window.location.reload();
    } catch (e) {
      errorEl.textContent = e.message; errorEl.style.display = "block";
      confirmBtn.disabled = false; confirmBtn.textContent = "确认拒绝";
    }
  });
}

async function reopenQuote(quoteId, btn) {
  if (!window.confirm("确认将此报价单打回重改？报价单将恢复为草稿状态。")) return;
  if (btn) { btn.disabled = true; btn.textContent = "处理中…"; }
  try {
    await window.AppUtils.fetchJson(
      `/api/quotes/${encodeURIComponent(quoteId)}/reopen`,
      { method: "POST" },
      "打回重改失败，请稍后重试"
    );
    window.AppUtils.setFlash("报价单已打回重改，可重新编辑并再次提交。", "success");
    window.location.reload();
  } catch (e) {
    window.AppUtils.showMessage("quote-message", e.message, "error");
    if (btn) { btn.disabled = false; btn.textContent = "打回重改"; }
  }
}

async function cloneQuote(quoteId, btn) {
  if (!window.confirm("确认复制此报价单？将生成一份新的草稿报价，内容与原报价相同。")) return;
  if (btn) { btn.disabled = true; btn.textContent = "复制中…"; }
  try {
    const result = await window.AppUtils.fetchJson(
      `/api/quotes/${encodeURIComponent(quoteId)}/clone`,
      { method: "POST" },
      "复制报价失败，请稍后重试"
    );
    window.AppUtils.setFlash("报价已复制，正在跳转到新报价详情页。", "success");
    window.location.href = `/quote-detail.html?id=${encodeURIComponent(result.id)}`;
  } catch (e) {
    window.AppUtils.showMessage("quote-message", e.message, "error");
    if (btn) { btn.disabled = false; btn.textContent = "复制报价"; }
  }
}

function formatShareExpiresAt(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function requestCustomerShareToken(quoteId) {
  const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const token = window.AuthStore?.getToken() || (isDev ? "dev-bypass-token" : "");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`/api/customer-standard-quotations/${encodeURIComponent(quoteId)}/share-token`, {
    method: "POST",
    headers,
    body: JSON.stringify({ validityDays: 30 }),
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    // Ignore response parse failures here; status-based handling below is enough.
  }
  if (!response.ok) {
    const err = new Error("share-token request failed");
    err.status = response.status;
    throw err;
  }
  return payload;
}

async function copyCustomerShareLink(link, inputEl, statusEl) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(link);
      statusEl.textContent = "已复制客户分享链接";
      statusEl.style.color = "var(--success-text,#2e7d32)";
      return;
    } catch {
      // Fall through to manual selection.
    }
  }
  inputEl.focus();
  inputEl.select();
  statusEl.textContent = "已选中链接，请手动复制。";
  statusEl.style.color = "var(--text-secondary,#666)";
}

function showCustomerShareDialog(link, expiresAt) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:16px";
  overlay.innerHTML = `
    <div style="background:var(--panel);border-radius:12px;padding:24px;width:560px;max-width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.18)">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 8px">客户分享链接已生成</h2>
      <p style="font-size:13px;color:var(--text-secondary,#666);margin:0 0 14px">默认 30 天有效，请仅发送给对应客户。</p>
      <input id="customer-share-link-input" readonly value="${esc(link)}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--bg);color:var(--ink)" />
      <p id="customer-share-expires" style="font-size:12px;color:var(--text-secondary,#666);margin:8px 0 0">${expiresAt ? `有效期至：${esc(expiresAt)}` : "有效期：默认 30 天"}</p>
      <p id="customer-share-status" style="font-size:12px;min-height:18px;margin:8px 0 0"></p>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;flex-wrap:wrap">
        <button id="customer-share-copy" style="padding:8px 18px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer">复制链接</button>
        <button id="customer-share-open" style="padding:8px 18px;border-radius:8px;border:1.5px solid var(--accent);background:transparent;color:var(--accent);font-size:13px;font-weight:600;cursor:pointer">打开客户报价单</button>
        <button id="customer-share-close" style="padding:8px 18px;border-radius:8px;border:1.5px solid var(--line);background:transparent;color:var(--ink);font-size:13px;font-weight:600;cursor:pointer">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const inputEl = overlay.querySelector("#customer-share-link-input");
  const statusEl = overlay.querySelector("#customer-share-status");
  overlay.querySelector("#customer-share-copy").addEventListener("click", () => copyCustomerShareLink(link, inputEl, statusEl));
  overlay.querySelector("#customer-share-open").addEventListener("click", () => window.open(link, "_blank", "noopener,noreferrer"));
  overlay.querySelector("#customer-share-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  inputEl.focus();
  inputEl.select();
}

async function generateCustomerShareLink(quoteId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "生成中..."; }
  try {
    const payload = await requestCustomerShareToken(quoteId);
    const link = payload.url ? new URL(payload.url, window.location.origin).toString() : "";
    if (!link) throw new Error("empty share url");
    showCustomerShareDialog(link, formatShareExpiresAt(payload.expiresAt));
  } catch (e) {
    let message = "客户分享链接生成失败，请稍后重试。";
    if (e && (e.status === 401 || e.status === 403)) {
      message = "当前账号无权限生成客户分享链接，请重新登录或联系管理员。";
    } else if (e && e.status === 404) {
      message = "报价单不存在，无法生成客户分享链接。";
    } else if (!e || !e.status) {
      message = "网络异常，客户分享链接生成失败。";
    }
    window.AppUtils.showMessage("quote-message", message, "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "生成客户分享链接"; }
  }
}

async function deleteQuote(quoteId, quoteName) {
  if (!window.confirm(`确认删除报价单「${quoteName}」？\n\n此操作不可撤销，删除后数据将无法恢复。`)) return;
  try {
    await window.AppUtils.fetchJson(
      `/api/quotes/${encodeURIComponent(quoteId)}`,
      { method: "DELETE" },
      "删除失败，请稍后重试"
    );
    window.AppUtils.setFlash("报价单已删除。", "success");
    const fallback = "/standard-quotes.html";
    window.location.href = window.AppReturn ? window.AppReturn.getReturnUrl(fallback) : fallback;
  } catch (e) {
    window.AppUtils.showMessage("quote-message", e.message, "error");
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
let cachedQuote = null;

async function bootstrap() {
  window.AppUtils.applyFlash("quote-message");
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    document.getElementById("quote-detail").innerHTML = window.AppUtils.renderEmptyState("未找到报价编号", "请从报价列表重新进入详情页。");
    return;
  }

  try {
    const quote = await window.AppUtils.fetchJson(`/api/quotes/${encodeURIComponent(id)}`, null, "报价详情加载失败，请稍后重试。");
    cachedQuote = quote;
    const projectArchiveId = quote.projectId || quote.id;
    const status = quote.status || "draft";
    const execStatus = quote.executionStatus || quote.execution_status || "preparing";
    const items = Array.isArray(quote.items) ? quote.items : [];
    const container = document.getElementById("quote-detail");

    container.innerHTML = `
      <div class="panel-head panel-head-wrap">
        <div>
          <div class="title-row">
            <h1>${quote.projectName}</h1>
            ${isFlaggedReview(quote) ? '<span class="review-badge">待复核</span>' : ""}
            <span class="status-badge ${STATUS_CLS[status] || "s-draft"}">${esc(STATUS_LABEL[status] || status)}</span>
            <span class="status-badge ${EXEC_CLS[execStatus] || "e-preparing"}">${esc(EXEC_LABEL[execStatus] || execStatus)}</span>
          </div>
          <p class="meta">${quote.quoteNumber} / ${quote.clientName}</p>
        </div>
        <div class="action-row" id="quote-action-row">
          <a class="button-link small-link" href="/quote-new.html?id=${encodeURIComponent(quote.id)}">编辑报价</a>
          <a class="button-link small-link" href="/documents.html?quoteId=${encodeURIComponent(quote.id)}">查看文档数据</a>
          <a class="button-link small-link" href="/project-detail.html?id=${encodeURIComponent(projectArchiveId)}">项目主档</a>
        </div>
      </div>
      ${isFlaggedReview(quote) ? `
        <div class="review-note section-spacing">
          <strong>待复核提示</strong>
          <p>${quote.dataQuality.note || "该报价记录已标记为待复核，正式业务使用前请先完成人工检查。"}</p>
        </div>
      ` : ""}
      ${renderApprovalBlock(quote)}
      <div class="detail-grid section-spacing">
        <div class="metric"><span>客户</span><strong>${quote.clientName}</strong></div>
        <div class="metric"><span>联系人</span><strong>${quote.contactName}</strong></div>
        <div class="metric"><span>联系电话</span><strong>${quote.contactPhone || "暂无"}</strong></div>
        <div class="metric"><span>行程日期</span><strong>${quote.startDate} ~ ${quote.endDate}</strong></div>
        <div class="metric"><span>行程天数</span><strong>${quote.travelDays} 天</strong></div>
        <div class="metric"><span>出行人数（PAX）</span><strong>${quote.paxCount || "未填写"}</strong></div>
        <div class="metric"><span>主要目的地</span><strong>${quote.destination}</strong></div>
        <div class="metric"><span>文档输出语言</span><strong>${window.AppUi.getLabel("languageLabels", quote.language)}</strong></div>
        <div class="metric"><span>报价币种</span><strong>${window.AppUi.getLabel("currencyLabels", quote.currency)}</strong></div>
        <div class="metric"><span>成本合计</span><strong>${window.AppUtils.formatCurrency(quote.totalCost, quote.currency)}</strong></div>
        <div class="metric"><span>售价合计</span><strong>${window.AppUtils.formatCurrency(quote.totalPrice, quote.currency)}</strong></div>
        <div class="metric"><span>毛利</span><strong>${window.AppUtils.formatCurrency(quote.grossProfit, quote.currency)}</strong></div>
        <div class="metric"><span>毛利率</span><strong>${quote.grossMargin}%</strong></div>
      </div>
      <div class="panel subpanel section-spacing">
        <div class="panel-head"><h2>报价项明细</h2><span>${items.length} 项</span></div>
        <div class="table-like">
          ${items.length > 0 ? items.map((item) => `
            <div class="table-row table-row-wide table-row-split">
              <div>
                <strong>${window.AppUi.getLabel("quoteItemTypeLabels", item.type)} / ${item.name}</strong>
                <p class="meta preview-subline">${item.type === "hotel"
                  ? `酒店成本合计 ${window.AppUtils.formatCurrency(item.totalCost, quote.currency)} / 酒店售价合计 ${window.AppUtils.formatCurrency(item.totalPrice, quote.currency)}`
                  : item.type === "dining" && item.mealDetails
                    ? `用餐合计 ${window.AppUtils.formatCurrency(item.mealDetails.totalAmountOriginal, item.mealDetails.currency)}，折算后 ${window.AppUtils.formatCurrency(item.totalPrice, quote.currency)}`
                    : `${item.quantity} ${item.unit}，原币种 ${window.AppUtils.formatCurrency(item.totalPriceOriginal, item.currency)}，折算后 ${window.AppUtils.formatCurrency(item.totalPrice, quote.currency)}`}</p>
                ${item.type === "hotel" ? renderHotelDetailBlock(item, quote.currency) : ""}
                ${item.type === "vehicle" ? renderVehicleDetailBlock(item, quote.currency) : ""}
                ${["guide", "interpreter"].includes(item.type) ? renderServiceDetailBlock(item, quote.currency) : ""}
                ${item.type === "dining" ? renderMealDetailBlock(item, quote.currency) : ""}
              </div>
              <div class="table-row-values">
                <span>成本 ${window.AppUtils.formatCurrency(item.totalCost, quote.currency)}</span>
                <strong>销售 ${window.AppUtils.formatCurrency(item.totalPrice, quote.currency)}</strong>
              </div>
            </div>
          `).join("") : '<p class="empty">这份报价还没有报价项。</p>'}
        </div>
      </div>
      <div class="panel subpanel section-spacing">
        <div class="panel-head"><h2>特殊需求 / 备注</h2></div>
        <p>${quote.notes || "暂无"}</p>
      </div>
    `;

    renderActionButtons(quote);
  } catch (error) {
    document.getElementById("quote-detail").innerHTML = window.AppUtils.renderEmptyState("报价详情不可用", error.message);
    window.AppUtils.showMessage("quote-message", error.message, "error");
  }
}

bootstrap();

document.addEventListener("authReady", function () {
  if (cachedQuote) renderActionButtons(cachedQuote);
});
