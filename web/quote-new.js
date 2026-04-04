const state = {
  templates: [],
  meta: null,
  pricingMode: "standard",
};

function getListFallbackForMode(mode) {
  return mode === "project_based" ? "/project-quotes.html" : "/standard-quotes.html";
}

window._allItemTypes = Array.isArray(window._allItemTypes) ? window._allItemTypes : [];
window._groupTypes = Array.isArray(window._groupTypes) ? window._groupTypes : [];

async function preloadProjectTypeMeta() {
  try {
    const [itemTypes, groupTypes] = await Promise.all([
      window.AppUtils.fetchJson("/api/quote-item-types", null, "?????????????????"),
      window.AppUtils.fetchJson("/api/project-group-types", null, "??????????????????"),
    ]);
    window._allItemTypes = Array.isArray(itemTypes) ? itemTypes : [];
    window._groupTypes = Array.isArray(groupTypes) ? groupTypes : [];
  } catch (error) {
    console.warn("[init] preloadProjectTypeMeta failed:", error);
    window._allItemTypes = Array.isArray(window._allItemTypes) ? window._allItemTypes : [];
    window._groupTypes = Array.isArray(window._groupTypes) ? window._groupTypes : [];
  }
  console.log("[init] _allItemTypes:", window._allItemTypes);
  console.log("[init] _groupTypes:", window._groupTypes);
}
let projectBasedTypeObserver = null;
let projectBasedTypeSyncScheduled = false;
let projectBasedTypeSyncing = false;

function normalizeCodeList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim().toLowerCase()).filter(Boolean);
  }
  if (value === null || value === undefined || value === "") {
    return [];
  }
  return String(value)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeGroupTypeRecord(record) {
  if (!record || typeof record !== "object") return null;
  const code = String(record.code || record.groupCode || "").trim().toLowerCase();
  if (!code) return null;
  return {
    id: record.id || null,
    code,
    nameZh: record.nameZh || record.name_zh || code,
    isActive: record.isActive !== false && record.is_active !== false,
    sortOrder: Number(record.sortOrder ?? record.sort_order ?? 0),
  };
}

function normalizeItemTypeRecord(record) {
  if (!record || typeof record !== "object") return null;
  const code = String(record.code || record.itemType || "").trim().toLowerCase();
  if (!code) return null;
  return {
    id: record.id || null,
    code,
    nameZh: record.nameZh || record.name_zh || code,
    isActive: record.isActive !== false && record.is_active !== false,
    sortOrder: Number(record.sortOrder ?? record.sort_order ?? 0),
    projectGroupCodes: normalizeCodeList(record.projectGroupCodes ?? record.project_group_codes),
    projectGroupId: record.projectGroupId || record.project_group_id || null,
  };
}

function getNormalizedGroupTypes() {
  return (window._groupTypes || [])
    .map(normalizeGroupTypeRecord)
    .filter((record) => record && record.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getNormalizedItemTypes() {
  return (window._allItemTypes || [])
    .map(normalizeItemTypeRecord)
    .filter((record) => record && record.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function resolveGroupType(projectGroupId) {
  const groups = getNormalizedGroupTypes();
  if (!projectGroupId) return null;
  const raw = String(projectGroupId).trim().toLowerCase();
  return groups.find((group) => group.id === projectGroupId || group.code === raw) || null;
}

function getAllowedProjectBasedItemTypes(projectGroupId) {
  const groups = getNormalizedGroupTypes();
  const mixedGroup = groups.find((group) => group.code === "mixed") || null;
  const currentGroup = resolveGroupType(projectGroupId);
  const types = getNormalizedItemTypes();

  if (!currentGroup || currentGroup.code === "mixed") {
    return types;
  }

  return types.filter((type) => {
    const codes = type.projectGroupCodes || [];
    if (codes.length > 0) {
      return codes.includes(currentGroup.code) || codes.includes("mixed");
    }
    if (type.projectGroupId) {
      return type.projectGroupId === currentGroup.id || type.projectGroupId === mixedGroup?.id;
    }
    return true;
  });
}

function buildServiceTypeOptions(currentValue, projectGroupId) {
  const normalizedValue = String(currentValue || "").trim().toLowerCase();
  const allowed = getAllowedProjectBasedItemTypes(projectGroupId);
  const allowedCodes = new Set(allowed.map((type) => type.code));
  const selectedCode = allowedCodes.has(normalizedValue)
    ? normalizedValue
    : (allowedCodes.has("misc") ? "misc" : (allowed[0]?.code || "misc"));

  return allowed.map((type) => {
    const selected = type.code === selectedCode ? " selected" : "";
    return `<option value="${type.code}"${selected}>${type.nameZh}</option>`;
  }).join("");
}

function rebuildAllServiceTypeSelects(projectGroupId, scope) {
  const root = scope || document.getElementById("project-groups-editor");
  if (!root) return;
  projectBasedTypeSyncing = true;
  try {
    const groups = root.matches?.(".project-group") ? [root] : Array.from(root.querySelectorAll(".project-group"));
    groups.forEach((groupEl) => {
      const groupSelect = groupEl.querySelector("[name='projectType']");
      const resolvedGroupId = projectGroupId || groupSelect?.value || "mixed";
      const allowed = getAllowedProjectBasedItemTypes(resolvedGroupId);
      const fallbackValue = allowed.find((type) => type.code === "misc")?.code || allowed[0]?.code || "misc";
      groupEl.querySelectorAll("select[name='itemType'], .item-type-sel").forEach((select) => {
        const currentValue = String(select.value || "").trim().toLowerCase();
        const nextValue = allowed.some((type) => type.code === currentValue) ? currentValue : fallbackValue;
        select.innerHTML = buildServiceTypeOptions(nextValue, resolvedGroupId);
        if (select.value !== nextValue) {
          select.value = nextValue;
        }
        if (currentValue !== select.value) {
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    });
  } finally {
    projectBasedTypeSyncing = false;
  }
}

function scheduleProjectBasedTypeSync(projectGroupId, scope) {
  if (projectBasedTypeSyncScheduled) return;
  projectBasedTypeSyncScheduled = true;
  window.requestAnimationFrame(() => {
    projectBasedTypeSyncScheduled = false;
    rebuildAllServiceTypeSelects(projectGroupId, scope);
  });
}

function attachProjectBasedTypeSync(container) {
  if (!container) return;
  if (container.dataset.serviceTypeSyncBound === "1") {
    scheduleProjectBasedTypeSync(null, container);
    return;
  }
  container.dataset.serviceTypeSyncBound = "1";

  container.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches("[name='projectType']")) {
      const groupEl = target.closest(".project-group");
      scheduleProjectBasedTypeSync(target.value, groupEl || container);
    }
  });

  container.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(".add-item-btn")) {
      scheduleProjectBasedTypeSync(null, container);
    }
  });

  if (projectBasedTypeObserver) {
    projectBasedTypeObserver.disconnect();
  }
  projectBasedTypeObserver = new MutationObserver((mutations) => {
    if (projectBasedTypeSyncing) return;
    const shouldSync = mutations.some((mutation) => mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0);
    if (shouldSync) {
      scheduleProjectBasedTypeSync(null, container);
    }
  });
  projectBasedTypeObserver.observe(container, { childList: true, subtree: true });

  scheduleProjectBasedTypeSync(null, container);
}

function syncReturnLinks(form) {
  const fallback = getListFallbackForMode(state.pricingMode);
  if (window.AppReturn) {
    window.AppReturn.applyReturnLink('#quote-back-link', fallback);
    const cancelLink = form ? form.querySelector('.ghost-link') : null;
    if (cancelLink) cancelLink.href = window.AppReturn.getReturnUrl(fallback);
  }
}

const vehicleDetailTypeOptions = ["pickup", "dropoff", "full_day"];
const vehiclePricingUnitOptions = ["trip", "full_day"];
const serviceRoleOptions = ["guide", "interpreter"];
const serviceLanguageOptions = ["zh", "zh-sr", "zh-en"];
const serviceDurationOptions = ["full_day", "hour"];

function createOptionList(values, selectedValue, groupName) {
  return values.map((value) => {
    const label = groupName ? window.AppUi.getLabel(groupName, value) : value;
    const selected = value === selectedValue ? "selected" : "";
    return `<option value="${value}" ${selected}>${label}</option>`;
  }).join("");
}

function getLanguageLabel(value) {
  return window.AppUi.getLabel("languageLabels", value);
}

function getCurrencyLabel(value) {
  return window.AppUi.getLabel("currencyLabels", value);
}

function getVehicleDetailTypeLabel(value) {
  return window.AppUi.getLabel("vehicleDetailTypeLabels", value);
}

function getVehiclePricingUnitLabel(value) {
  return window.AppUi.getLabel("vehiclePricingUnitLabels", value);
}

function getServiceRoleLabel(value) {
  return window.AppUi.getLabel("serviceRoleLabels", value);
}

function getServiceLanguageLabel(value) {
  return window.AppUi.getLabel("serviceLanguageLabels", value);
}

function getServiceDurationLabel(value) {
  return window.AppUi.getLabel("serviceDurationLabels", value);
}

function createTemplateOptionList(selectedValue) {
  return state.templates.map((template) => {
    const selected = template.id === selectedValue ? "selected" : "";
    return `<option value="${template.id}" ${selected}>${template.name}</option>`;
  }).join("");
}

function findTemplateById(templateId) {
  return state.templates.find((template) => template.id === templateId) || null;
}

function getBlankTemplate() {
  return state.templates.find((template) => template.items.length === 0) || state.templates[0] || null;
}

function createHotelDetailRow(currencies, defaults, quoteCurrency) {
  return `
    <div class="hotel-detail-row">
      <label><span>\u623f\u578b\u540d\u79f0</span><input name="roomType" value="${defaults?.roomType || ""}" placeholder="\u4f8b\u5982\uff1a\u6807\u51c6\u53cc\u5e8a\u623f" /></label>
      <label><span>\u623f\u95f4\u6570</span><input name="roomCount" type="number" min="1" step="1" value="${defaults?.roomCount || 1}" /></label>
      <label><span>\u665a\u6570</span><input name="nights" type="number" min="1" step="1" value="${defaults?.nights || 1}" /></label>
      <label><span>\u6210\u672c\u5355\u4ef7\uff08\u6bcf\u665a\uff09</span><input name="costNightlyRate" type="number" min="0" step="0.01" value="${defaults?.costNightlyRate ?? ""}" placeholder="0.00" /></label>
      <label><span>\u9500\u552e\u5355\u4ef7\uff08\u6bcf\u665a\uff09</span><input name="priceNightlyRate" type="number" min="0" step="0.01" value="${defaults?.priceNightlyRate ?? ""}" placeholder="0.00" /></label>
      <label><span>\u5e01\u79cd</span><select name="currency">${createOptionList(currencies, defaults?.currency || quoteCurrency || "EUR", "currencyLabels")}</select></label>
      <label><span>\u6210\u672c\u5c0f\u8ba1</span><input name="costSubtotal" value="${window.AppUtils.formatCurrency(0, defaults?.currency || quoteCurrency || "EUR")}" readonly /></label>
      <label><span>\u9500\u552e\u5c0f\u8ba1</span><input name="priceSubtotal" value="${window.AppUtils.formatCurrency(0, defaults?.currency || quoteCurrency || "EUR")}" readonly /></label>
      <label class="hotel-detail-note"><span>\u5907\u6ce8</span><input name="notes" value="${defaults?.notes || ""}" placeholder="\u4f8b\u5982\uff1a\u542b\u65e9\u3001\u53ef\u52a0\u5e8a" /></label>
      <div class="hotel-detail-actions">
        <button type="button" class="ghost mini-button duplicate-hotel-detail">\u590d\u5236\u623f\u578b\u660e\u7ec6</button>
        <button type="button" class="ghost mini-button delete-hotel-detail">\u5220\u9664\u623f\u578b\u660e\u7ec6</button>
      </div>
    </div>
  `;
}

function createVehicleDetailRow(currencies, defaults, quoteCurrency) {
  return `
    <div class="vehicle-detail-row">
      <label><span>用车类型</span><select name="detailType">${createOptionList(vehicleDetailTypeOptions, defaults?.detailType || "pickup", "vehicleDetailTypeLabels")}</select></label>
      <label><span>车型</span><input name="vehicleModel" value="${defaults?.vehicleModel || ""}" placeholder="例如：奔驰 V 级" /></label>
      <label><span>车辆数</span><input name="vehicleCount" type="number" min="1" step="1" value="${defaults?.vehicleCount || 1}" /></label>
      <label><span>计价单位</span><select name="pricingUnit">${createOptionList(vehiclePricingUnitOptions, defaults?.pricingUnit || "trip", "vehiclePricingUnitLabels")}</select></label>
      <label><span>计费数量（趟/天）</span><input name="billingQuantity" type="number" min="1" step="1" value="${defaults?.billingQuantity || 1}" /></label>
      <label><span>成本单价</span><input name="costUnitPrice" type="number" min="0" step="0.01" value="${defaults?.costUnitPrice ?? ""}" placeholder="0.00" /></label>
      <label><span>销售单价</span><input name="priceUnitPrice" type="number" min="0" step="0.01" value="${defaults?.priceUnitPrice ?? ""}" placeholder="0.00" /></label>
      <label><span>币种</span><select name="currency">${createOptionList(currencies, defaults?.currency || quoteCurrency || "EUR", "currencyLabels")}</select></label>
      <label><span>成本小计</span><input name="costSubtotal" value="${window.AppUtils.formatCurrency(0, defaults?.currency || quoteCurrency || "EUR")}" readonly /></label>
      <label><span>销售小计</span><input name="priceSubtotal" value="${window.AppUtils.formatCurrency(0, defaults?.currency || quoteCurrency || "EUR")}" readonly /></label>
      <label class="vehicle-detail-note"><span>备注</span><input name="notes" value="${defaults?.notes || ""}" placeholder="例如：含高速、司机懂中文" /></label>
      <div class="vehicle-detail-actions">
        <button type="button" class="ghost mini-button delete-vehicle-detail">删除用车明细</button>
      </div>
    </div>
  `;
}

function createServiceDetailRow(currencies, defaults, quoteCurrency) {
  return `
    <div class="service-detail-row">
      <label><span>\u670d\u52a1\u89d2\u8272</span><select name="serviceRole">${createOptionList(serviceRoleOptions, defaults?.serviceRole || "guide", "serviceRoleLabels")}</select></label>
      <label><span>\u8bed\u8a00</span><select name="serviceLanguage">${createOptionList(serviceLanguageOptions, defaults?.serviceLanguage || "zh", "serviceLanguageLabels")}</select></label>
      <label><span>\u670d\u52a1\u65f6\u957f</span><select name="serviceDuration">${createOptionList(serviceDurationOptions, defaults?.serviceDuration || "full_day", "serviceDurationLabels")}</select></label>
      <label><span>\u6570\u91cf</span><input name="quantity" type="number" min="1" step="1" value="${defaults?.quantity || 1}" /></label>
      <label><span>\u6210\u672c\u5355\u4ef7</span><input name="costUnitPrice" type="number" min="0" step="0.01" value="${defaults?.costUnitPrice ?? ""}" placeholder="0.00" /></label>
      <label><span>\u9500\u552e\u5355\u4ef7</span><input name="priceUnitPrice" type="number" min="0" step="0.01" value="${defaults?.priceUnitPrice ?? ""}" placeholder="0.00" /></label>
      <label><span>\u5e01\u79cd</span><select name="currency">${createOptionList(currencies, defaults?.currency || quoteCurrency || "EUR", "currencyLabels")}</select></label>
      <label><span>\u6210\u672c\u5c0f\u8ba1</span><input name="costSubtotal" value="${window.AppUtils.formatCurrency(0, defaults?.currency || quoteCurrency || "EUR")}" readonly /></label>
      <label><span>\u9500\u552e\u5c0f\u8ba1</span><input name="priceSubtotal" value="${window.AppUtils.formatCurrency(0, defaults?.currency || quoteCurrency || "EUR")}" readonly /></label>
      <label class="service-detail-note"><span>\u5907\u6ce8</span><input name="notes" value="${defaults?.notes || ""}" placeholder="\u4f8b\u5982\uff1a\u719f\u6089\u5546\u52a1\u966a\u540c\u6d41\u7a0b" /></label>
      <div class="service-detail-actions">
        <button type="button" class="ghost mini-button delete-service-detail">\u5220\u9664\u670d\u52a1\u660e\u7ec6</button>
      </div>
    </div>
  `;
}
function createItemRow(types, currencies, defaultCurrency) {
  return `
    <section class="item-card quote-item-row">
      <div class="item-card-head">
        <div>
          <strong>报价项目</strong>
          <p class="meta">选择服务类型后，可继续编辑名称、币种、供应商和备注；酒店、用车、导游翻译与用餐类型支持专用录入模型。</p>
        </div>
        <button type="button" class="ghost mini-button delete-item">删除此项</button>
      </div>
      <div class="item-card-grid quote-item-grid quote-item-grid-wide">
        <label class="field-block field-span-1"><span>服务类型</span><select name="type">${createOptionList(types, "hotel", "quoteItemTypeLabels")}</select></label>
        <label class="field-block field-span-2"><span>服务名称</span><input name="name" placeholder="例如：贝尔格莱德商务酒店 / 商务车服务 / 商务午餐 / 商务晚餐" /></label>
        <label class="field-block field-span-1"><span>项目币种</span><select name="currency">${createOptionList(currencies, defaultCurrency, "currencyLabels")}</select></label>
        <label class="field-block field-span-1 common-unit-field"><span>单位</span><input name="unit" placeholder="例如：项 / 趟 / 人 / 天" value="项" /></label>
        <label class="field-block field-span-2"><span>供应商</span><input name="supplier" placeholder="例如：当地酒店、车队、餐厅、地接供应商" /></label>
        <label class="field-block field-span-1 simple-pricing-field meal-generic-field"><span>数量</span><input name="quantity" type="number" step="1" placeholder="1" value="1" min="1" /></label>
        <label class="field-block field-span-1 simple-pricing-field meal-generic-field"><span>成本单价</span><input name="cost" type="number" step="0.01" placeholder="0.00" min="0" /></label>
        <label class="field-block field-span-1 simple-pricing-field meal-generic-field"><span>销售单价</span><input name="price" type="number" step="0.01" placeholder="0.00" min="0" /></label>
        <label class="field-block field-span-1 hotel-summary-field hidden"><span>总房间数</span><input name="hotelRoomTotal" readonly /></label>
        <label class="field-block field-span-1 hotel-summary-field hidden"><span>成本合计</span><input name="hotelCostTotal" readonly /></label>
        <label class="field-block field-span-1 hotel-summary-field hidden"><span>销售合计</span><input name="hotelPriceTotal" readonly /></label>
        <label class="field-block field-span-1 vehicle-summary-field hidden"><span>成本合计</span><input name="vehicleCostTotal" readonly /></label>
        <label class="field-block field-span-1 vehicle-summary-field hidden"><span>销售合计</span><input name="vehiclePriceTotal" readonly /></label>
        <label class="field-block field-span-3"><span>备注说明</span><input name="notes" placeholder="例如：安排午餐和晚餐、司机会中文、按实际人数结算" /></label>
      </div>
      <p class="meta hotel-summary-tip hotel-summary-field hidden">金额由酒店明细自动汇总，如需修改请编辑酒店明细。</p>
      <section class="hotel-detail-box hidden">
        <div class="panel-head form-section-head-row hotel-detail-head">
          <div>
            <h3>酒店明细</h3>
            <p class="meta">支持同一家酒店下录入多个房型、房间数、晚数、每晚成本价和每晚销售价。</p>
            <p class="hotel-detail-tip">默认按当前行程天数带出晚数，后续可按房型单独调整。</p>
          </div>
          <button type="button" class="ghost add-hotel-detail">新增房型明细</button>
        </div>
        <div class="hotel-detail-list stack"></div>
        <div class="hotel-detail-summary">
          <span>酒店合计</span>
          <strong class="hotel-total-value">成本 ${window.AppUtils.formatCurrency(0, defaultCurrency)} / 销售 ${window.AppUtils.formatCurrency(0, defaultCurrency)}</strong>
        </div>
      </section>
      <p class="meta vehicle-summary-tip vehicle-summary-field hidden">金额由用车明细自动汇总，如需修改请编辑用车明细。</p>
      <section class="vehicle-detail-box hidden">
        <div class="panel-head form-section-head-row vehicle-detail-head">
          <div>
            <h3>用车明细</h3>
            <p class="meta">支持同一条用车项目下录入接机、送机、全天等多条明细，并自动汇总成本与销售金额。</p>
          </div>
          <button type="button" class="ghost add-vehicle-detail">新增用车明细</button>
        </div>
        <div class="vehicle-detail-list stack"></div>
        <div class="vehicle-detail-summary">
          <span>用车合计</span>
          <strong class="vehicle-total-value">成本 ${window.AppUtils.formatCurrency(0, defaultCurrency)} / 销售 ${window.AppUtils.formatCurrency(0, defaultCurrency)}</strong>
        </div>
      </section>
      <section class="service-detail-box hidden">
        <div class="panel-head form-section-head-row service-detail-head">
          <div>
            <h3>服务明细</h3>
            <p class="meta">导游和翻译项目可按角色、语言、服务时长拆分多条明细，并自动汇总成本与销售金额。</p>
          </div>
          <button type="button" class="ghost add-service-detail">新增服务明细</button>
        </div>
        <div class="service-detail-list stack"></div>
        <div class="service-detail-summary">
          <span>服务合计</span>
          <strong class="service-total-value">成本 ${window.AppUtils.formatCurrency(0, defaultCurrency)} / 销售 ${window.AppUtils.formatCurrency(0, defaultCurrency)}</strong>
        </div>
      </section>
      <section class="meal-detail-box hidden">
        <div class="panel-head">
          <div>
            <h3>用餐专用录入区</h3>
            <p class="meta">用餐不含早餐，仅按午餐与晚餐自动计算。项目币种、供应商和备注说明请在上方基础字段填写。</p>
            <p class="meal-formula-note">计价方式：人数 × 餐次 × 餐标</p>
          </div>
        </div>
        <div class="review-note meal-legacy-note hidden"></div>
        <div class="meal-detail-panels">
          <section class="meal-detail-panel">
            <h4>基础信息</h4>
            <div class="meal-detail-grid">
              <label><span>用餐人数</span><input name="mealPeople" type="number" min="0" step="1" value="0" /></label>
              <label><span>行程天数</span><input name="mealTripDays" type="number" min="0" step="1" value="0" /></label>
            </div>
          </section>
          <section class="meal-detail-panel">
            <h4>餐次设置</h4>
            <div class="meal-toggle-grid">
              <label class="meal-toggle"><input name="includeLunch" type="checkbox" checked /><span>是否计算午餐</span></label>
              <label><span>午餐餐标</span><input name="lunchPrice" type="number" min="0" step="0.01" value="0" /></label>
              <label class="meal-toggle"><input name="includeDinner" type="checkbox" checked /><span>是否计算晚餐</span></label>
              <label><span>晚餐餐标</span><input name="dinnerPrice" type="number" min="0" step="0.01" value="0" /></label>
            </div>
          </section>
          <section class="meal-detail-panel">
            <h4>首尾天规则</h4>
            <div class="meal-toggle-grid">
              <label class="meal-toggle"><input name="firstDayLunch" type="checkbox" checked /><span>首日是否包含午餐</span></label>
              <label class="meal-toggle"><input name="firstDayDinner" type="checkbox" checked /><span>首日是否包含晚餐</span></label>
              <label class="meal-toggle"><input name="lastDayLunch" type="checkbox" checked /><span>末日是否包含午餐</span></label>
              <label class="meal-toggle"><input name="lastDayDinner" type="checkbox" checked /><span>末日是否包含晚餐</span></label>
            </div>
          </section>
          <section class="meal-detail-panel meal-result-panel">
            <h4>自动计算结果</h4>
            <div class="meal-result-grid">
              <label><span>午餐次数</span><input name="lunchCount" readonly /></label>
              <label><span>晚餐次数</span><input name="dinnerCount" readonly /></label>
              <label><span>午餐总额</span><input name="lunchTotal" readonly /></label>
              <label><span>晚餐总额</span><input name="dinnerTotal" readonly /></label>
              <label><span>用餐合计</span><input name="mealTotal" readonly /></label>
            </div>
          </section>
        </div>
      </section>
    </section>
  `;
}

function getHotelDetailRows(row) {
  return Array.from(row.querySelectorAll(".hotel-detail-row")).map((detailRow) => ({
    roomType: detailRow.querySelector('[name="roomType"]').value.trim(),
    roomCount: Number(detailRow.querySelector('[name="roomCount"]').value || 0),
    nights: Number(detailRow.querySelector('[name="nights"]').value || 0),
    costNightlyRate: Number(detailRow.querySelector('[name="costNightlyRate"]').value || 0),
    priceNightlyRate: Number(detailRow.querySelector('[name="priceNightlyRate"]').value || 0),
    currency: detailRow.querySelector('[name="currency"]').value,
    notes: detailRow.querySelector('[name="notes"]').value.trim(),
  })).filter((detail) => detail.roomType || detail.notes || detail.roomCount !== 1 || detail.nights !== 1 || detail.costNightlyRate !== 0 || detail.priceNightlyRate !== 0);
}

function getVehicleDetailRows(row) {
  return Array.from(row.querySelectorAll(".vehicle-detail-row")).map((detailRow) => ({
    detailType: detailRow.querySelector('[name="detailType"]').value,
    vehicleModel: detailRow.querySelector('[name="vehicleModel"]').value.trim(),
    vehicleCount: Number(detailRow.querySelector('[name="vehicleCount"]').value || 0),
    pricingUnit: detailRow.querySelector('[name="pricingUnit"]').value,
    billingQuantity: Number(detailRow.querySelector('[name="billingQuantity"]').value || 0),
    costUnitPrice: Number(detailRow.querySelector('[name="costUnitPrice"]').value || 0),
    priceUnitPrice: Number(detailRow.querySelector('[name="priceUnitPrice"]').value || 0),
    currency: detailRow.querySelector('[name="currency"]').value,
    notes: detailRow.querySelector('[name="notes"]').value.trim(),
  })).filter((detail) => detail.vehicleModel || detail.notes || detail.detailType !== "pickup" || detail.pricingUnit !== "trip" || detail.vehicleCount !== 1 || detail.billingQuantity !== 1 || detail.costUnitPrice !== 0 || detail.priceUnitPrice !== 0);
}

function getServiceDetailRows(row) {
  return Array.from(row.querySelectorAll(".service-detail-row")).map((detailRow) => ({
    serviceRole: detailRow.querySelector('[name="serviceRole"]').value,
    serviceLanguage: detailRow.querySelector('[name="serviceLanguage"]').value,
    serviceDuration: detailRow.querySelector('[name="serviceDuration"]').value,
    quantity: Number(detailRow.querySelector('[name="quantity"]').value || 0),
    costUnitPrice: Number(detailRow.querySelector('[name="costUnitPrice"]').value || 0),
    priceUnitPrice: Number(detailRow.querySelector('[name="priceUnitPrice"]').value || 0),
    currency: detailRow.querySelector('[name="currency"]').value,
    notes: detailRow.querySelector('[name="notes"]').value.trim(),
  })).filter((detail) => detail.notes || detail.serviceRole !== "guide" || detail.serviceLanguage !== "zh" || detail.serviceDuration !== "full_day" || detail.quantity !== 1 || detail.costUnitPrice !== 0 || detail.priceUnitPrice !== 0);
}

function calculateMealSummary(detail) {
  const mealPeople = Math.max(Number(detail.mealPeople || 0), 0);
  const tripDays = Math.max(Number(detail.tripDays || 0), 0);
  const includeLunch = Boolean(detail.includeLunch);
  const lunchPrice = Math.max(Number(detail.lunchPrice || 0), 0);
  const includeDinner = Boolean(detail.includeDinner);
  const dinnerPrice = Math.max(Number(detail.dinnerPrice || 0), 0);
  const firstDayLunch = Boolean(detail.firstDayLunch);
  const firstDayDinner = Boolean(detail.firstDayDinner);
  const lastDayLunch = Boolean(detail.lastDayLunch);
  const lastDayDinner = Boolean(detail.lastDayDinner);

  let lunchCount = 0;
  if (includeLunch) {
    lunchCount = tripDays;
    if (!firstDayLunch) {
      lunchCount -= 1;
    }
    if (!lastDayLunch) {
      lunchCount -= 1;
    }
    lunchCount = Math.max(lunchCount, 0);
  }

  let dinnerCount = 0;
  if (includeDinner) {
    dinnerCount = tripDays;
    if (!firstDayDinner) {
      dinnerCount -= 1;
    }
    if (!lastDayDinner) {
      dinnerCount -= 1;
    }
    dinnerCount = Math.max(dinnerCount, 0);
  }

  const lunchTotal = mealPeople * lunchCount * lunchPrice;
  const dinnerTotal = mealPeople * dinnerCount * dinnerPrice;
  const totalAmount = lunchTotal + dinnerTotal;

  return {
    mealPeople,
    tripDays,
    includeLunch,
    lunchPrice,
    includeDinner,
    dinnerPrice,
    firstDayLunch,
    firstDayDinner,
    lastDayLunch,
    lastDayDinner,
    lunchCount,
    dinnerCount,
    lunchTotal,
    dinnerTotal,
    totalAmount,
  };
}

function getMealDetails(row) {
  const currency = row.querySelector('[name="currency"]').value || "EUR";
  const detail = {
    mealPeople: Number(row.querySelector('[name="mealPeople"]').value || 0),
    tripDays: Number(row.querySelector('[name="mealTripDays"]').value || 0),
    includeLunch: row.querySelector('[name="includeLunch"]').checked,
    lunchPrice: Number(row.querySelector('[name="lunchPrice"]').value || 0),
    includeDinner: row.querySelector('[name="includeDinner"]').checked,
    dinnerPrice: Number(row.querySelector('[name="dinnerPrice"]').value || 0),
    firstDayLunch: row.querySelector('[name="firstDayLunch"]').checked,
    firstDayDinner: row.querySelector('[name="firstDayDinner"]').checked,
    lastDayLunch: row.querySelector('[name="lastDayLunch"]').checked,
    lastDayDinner: row.querySelector('[name="lastDayDinner"]').checked,
    currency,
  };

  return {
    ...detail,
    ...calculateMealSummary(detail),
  };
}

function getItemRows() {
  return Array.from(document.querySelectorAll(".item-card")).map((row) => {
    const type = row.querySelector('[name="type"]').value;
    const isLegacyDining = type === "dining" && row.dataset.legacyDining === "true" && row.dataset.mealTouched !== "true";
    const mealDetails = type === "dining" && !isLegacyDining ? getMealDetails(row) : null;
    return {
      type,
      name: row.querySelector('[name="name"]').value.trim(),
      unit: row.querySelector('[name="unit"]').value.trim(),
      supplier: row.querySelector('[name="supplier"]').value.trim(),
      currency: row.querySelector('[name="currency"]').value,
      cost: mealDetails ? 0 : Number(row.querySelector('[name="cost"]').value || 0),
      price: mealDetails ? 0 : Number(row.querySelector('[name="price"]').value || 0),
      quantity: mealDetails ? 1 : Number(row.querySelector('[name="quantity"]').value || 0),
      notes: row.querySelector('[name="notes"]').value.trim(),
      hotelDetails: getHotelDetailRows(row),
      vehicleDetails: getVehicleDetailRows(row),
      serviceDetails: getServiceDetailRows(row),
      mealDetails,
    };
  }).filter((item) => item.name || item.supplier || item.cost || item.price || item.quantity !== 1 || item.notes || item.hotelDetails.length > 0 || item.vehicleDetails.length > 0 || item.serviceDetails.length > 0 || item.mealDetails);
}
function calculateHotelSubtotals(detail) {
  return {
    costSubtotal: Number(detail.roomCount || 0) * Number(detail.nights || 0) * Number(detail.costNightlyRate || 0),
    priceSubtotal: Number(detail.roomCount || 0) * Number(detail.nights || 0) * Number(detail.priceNightlyRate || 0),
  };
}

function calculateVehicleSubtotals(detail) {
  return {
    costSubtotal: Number(detail.vehicleCount || 0) * Number(detail.billingQuantity || 0) * Number(detail.costUnitPrice || 0),
    priceSubtotal: Number(detail.vehicleCount || 0) * Number(detail.billingQuantity || 0) * Number(detail.priceUnitPrice || 0),
  };
}

function calculateServiceSubtotals(detail) {
  return {
    costSubtotal: Number(detail.quantity || 0) * Number(detail.costUnitPrice || 0),
    priceSubtotal: Number(detail.quantity || 0) * Number(detail.priceUnitPrice || 0),
  };
}

function refreshMoneyInputs(detailRow, calculator) {
  const currency = detailRow.querySelector('[name="currency"]').value || "EUR";
  const totals = calculator();
  detailRow.querySelector('[name="costSubtotal"]').value = window.AppUtils.formatCurrency(totals.costSubtotal, currency);
  detailRow.querySelector('[name="priceSubtotal"]').value = window.AppUtils.formatCurrency(totals.priceSubtotal, currency);
}

function refreshHotelDetailRow(detailRow) {
  refreshMoneyInputs(detailRow, () => calculateHotelSubtotals({
    roomCount: detailRow.querySelector('[name="roomCount"]').value,
    nights: detailRow.querySelector('[name="nights"]').value,
    costNightlyRate: detailRow.querySelector('[name="costNightlyRate"]').value,
    priceNightlyRate: detailRow.querySelector('[name="priceNightlyRate"]').value,
  }));
}

function refreshVehicleDetailRow(detailRow) {
  refreshMoneyInputs(detailRow, () => calculateVehicleSubtotals({
    vehicleCount: detailRow.querySelector('[name="vehicleCount"]').value,
    billingQuantity: detailRow.querySelector('[name="billingQuantity"]').value,
    costUnitPrice: detailRow.querySelector('[name="costUnitPrice"]').value,
    priceUnitPrice: detailRow.querySelector('[name="priceUnitPrice"]').value,
  }));
}

function refreshServiceDetailRow(detailRow) {
  refreshMoneyInputs(detailRow, () => calculateServiceSubtotals({
    quantity: detailRow.querySelector('[name="quantity"]').value,
    costUnitPrice: detailRow.querySelector('[name="costUnitPrice"]').value,
    priceUnitPrice: detailRow.querySelector('[name="priceUnitPrice"]').value,
  }));
}

function refreshDetailSummary(row, detailRows, calculator, totalSelector, unitValue, quoteCurrency) {
  const totalCostOriginal = detailRows.reduce((sum, detail) => sum + calculator(detail).costSubtotal, 0);
  const totalPriceOriginal = detailRows.reduce((sum, detail) => sum + calculator(detail).priceSubtotal, 0);
  row.querySelector('[name="cost"]').value = totalCostOriginal ? totalCostOriginal.toFixed(2) : "";
  row.querySelector('[name="price"]').value = totalPriceOriginal ? totalPriceOriginal.toFixed(2) : "";
  row.querySelector('[name="quantity"]').value = 1;
  row.querySelector('[name="unit"]').value = unitValue;
  row.querySelector(totalSelector).textContent = `成本 ${window.AppUtils.formatCurrency(totalCostOriginal, quoteCurrency || "EUR")} / 销售 ${window.AppUtils.formatCurrency(totalPriceOriginal, quoteCurrency || "EUR")}`;
}

function refreshHotelItemSummary(row, quoteCurrency) {
  const detailRows = getHotelDetailRows(row);
  refreshDetailSummary(row, detailRows, calculateHotelSubtotals, '.hotel-total-value', '酒店', quoteCurrency);
  const totalRoomCount = detailRows.reduce((sum, detail) => sum + Number(detail.roomCount || 0), 0);
  const totalCostOriginal = detailRows.reduce((sum, detail) => sum + calculateHotelSubtotals(detail).costSubtotal, 0);
  const totalPriceOriginal = detailRows.reduce((sum, detail) => sum + calculateHotelSubtotals(detail).priceSubtotal, 0);
  row.querySelector('[name="hotelRoomTotal"]').value = `${totalRoomCount} 间`;
  row.querySelector('[name="hotelCostTotal"]').value = window.AppUtils.formatCurrency(totalCostOriginal, quoteCurrency || 'EUR');
  row.querySelector('[name="hotelPriceTotal"]').value = window.AppUtils.formatCurrency(totalPriceOriginal, quoteCurrency || 'EUR');
}

function refreshVehicleItemSummary(row, quoteCurrency) {
  const detailRows = getVehicleDetailRows(row);
  refreshDetailSummary(row, detailRows, calculateVehicleSubtotals, '.vehicle-total-value', '用车', quoteCurrency);
  const totalCostOriginal = detailRows.reduce((sum, detail) => sum + calculateVehicleSubtotals(detail).costSubtotal, 0);
  const totalPriceOriginal = detailRows.reduce((sum, detail) => sum + calculateVehicleSubtotals(detail).priceSubtotal, 0);
  row.querySelector('[name="vehicleCostTotal"]').value = window.AppUtils.formatCurrency(totalCostOriginal, quoteCurrency || 'EUR');
  row.querySelector('[name="vehiclePriceTotal"]').value = window.AppUtils.formatCurrency(totalPriceOriginal, quoteCurrency || 'EUR');
}

function refreshServiceItemSummary(row, quoteCurrency) {
  refreshDetailSummary(row, getServiceDetailRows(row), calculateServiceSubtotals, '.service-total-value', '服务', quoteCurrency);
}

function refreshMealItemSummary(row, quoteCurrency) {
  if (row.querySelector('[name="type"]').value !== "dining") {
    return;
  }
  const detail = getMealDetails(row);
  const currency = row.querySelector('[name="currency"]').value || quoteCurrency || "EUR";
  row.querySelector('[name="unit"]').value = '用餐';
  row.querySelector('[name="quantity"]').value = 1;
  row.querySelector('[name="cost"]').value = detail.totalAmount ? detail.totalAmount.toFixed(2) : '';
  row.querySelector('[name="price"]').value = detail.totalAmount ? detail.totalAmount.toFixed(2) : '';
  row.querySelector('[name="lunchCount"]').value = `${detail.lunchCount} 次`;
  row.querySelector('[name="dinnerCount"]').value = `${detail.dinnerCount} 次`;
  row.querySelector('[name="lunchTotal"]').value = window.AppUtils.formatCurrency(detail.lunchTotal, currency);
  row.querySelector('[name="dinnerTotal"]').value = window.AppUtils.formatCurrency(detail.dinnerTotal, currency);
  row.querySelector('[name="mealTotal"]').value = window.AppUtils.formatCurrency(detail.totalAmount, currency);
}

function toggleDetailFields(row) {
  const type = row.querySelector('[name="type"]').value;
  const hotelBox = row.querySelector('.hotel-detail-box');
  const vehicleBox = row.querySelector('.vehicle-detail-box');
  const serviceBox = row.querySelector('.service-detail-box');
  const mealBox = row.querySelector('.meal-detail-box');
  const simpleFields = row.querySelectorAll('.simple-pricing-field');
  const hotelSummaryFields = row.querySelectorAll('.hotel-summary-field');
  const vehicleSummaryFields = row.querySelectorAll('.vehicle-summary-field');
  const commonUnitFields = row.querySelectorAll('.common-unit-field');

  hotelBox.classList.add("hidden");
  vehicleBox.classList.add("hidden");
  serviceBox.classList.add("hidden");
  mealBox.classList.add("hidden");
  simpleFields.forEach((field) => field.classList.remove("hidden"));
  commonUnitFields.forEach((field) => field.classList.remove("hidden"));
  hotelSummaryFields.forEach((field) => field.classList.add("hidden"));
  vehicleSummaryFields.forEach((field) => field.classList.add("hidden"));

  if (type === "hotel") {
    hotelBox.classList.remove("hidden");
    simpleFields.forEach((field) => field.classList.add("hidden"));
    commonUnitFields.forEach((field) => field.classList.add("hidden"));
    hotelSummaryFields.forEach((field) => field.classList.remove("hidden"));
    return;
  }

  if (type === "vehicle") {
    vehicleBox.classList.remove("hidden");
    simpleFields.forEach((field) => field.classList.add("hidden"));
    commonUnitFields.forEach((field) => field.classList.add("hidden"));
    vehicleSummaryFields.forEach((field) => field.classList.remove("hidden"));
    return;
  }

  if (["guide", "interpreter"].includes(type)) {
    serviceBox.classList.remove("hidden");
    simpleFields.forEach((field) => field.classList.add("hidden"));
    return;
  }

  if (type === "dining") {
    mealBox.classList.remove("hidden");
    simpleFields.forEach((field) => field.classList.add("hidden"));
    commonUnitFields.forEach((field) => field.classList.add("hidden"));
    vehicleSummaryFields.forEach((field) => field.classList.add("hidden"));
    return;
  }

  hotelBox.classList.add("hidden");
  vehicleBox.classList.add("hidden");
  serviceBox.classList.add("hidden");
  mealBox.classList.add("hidden");
  simpleFields.forEach((field) => field.classList.remove("hidden"));
  commonUnitFields.forEach((field) => field.classList.remove("hidden"));
  hotelSummaryFields.forEach((field) => field.classList.add("hidden"));
  vehicleSummaryFields.forEach((field) => field.classList.add("hidden"));
}

function validateQuoteForm(form) {
  if (!form.reportValidity()) {
    return false;
  }

  if (Number(form.travelDays.value || 0) <= 0) {
    window.AppUtils.showMessage("quote-message", "请先填写正确的行程开始日期和结束日期。", "error");
    return false;
  }

  if (Number(form.paxCount.value || 0) <= 0) {
    window.AppUtils.showMessage("quote-message", "请填写正确的出行人数（PAX）。", "error");
    return false;
  }

  const items = getItemRows();
  if (items.length === 0) {
    window.AppUtils.showMessage("quote-message", "请至少录入一条报价项目。", "error");
    return false;
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.name) {
      window.AppUtils.showMessage("quote-message", `请填写第 ${index + 1} 条报价项目的服务名称。`, "error");
      return false;
    }

    if (item.type === "hotel") {
      if (item.hotelDetails.length === 0) {
        window.AppUtils.showMessage("quote-message", `第 ${index + 1} 条酒店项目请至少录入一条房型明细。`, "error");
        return false;
      }
      for (let detailIndex = 0; detailIndex < item.hotelDetails.length; detailIndex += 1) {
        const detail = item.hotelDetails[detailIndex];
        if (!detail.roomType) {
          window.AppUtils.showMessage("quote-message", `请填写第 ${index + 1} 条酒店项目第 ${detailIndex + 1} 条房型明细的房型名称。`, "error");
          return false;
        }
        if (detail.roomCount <= 0 || detail.nights <= 0) {
          window.AppUtils.showMessage("quote-message", `第 ${index + 1} 条酒店项目第 ${detailIndex + 1} 条房型明细的房间数和晚数必须大于 0。`, "error");
          return false;
        }
      }
      continue;
    }

    if (item.type === "vehicle") {
      if (item.vehicleDetails.length === 0) {
        window.AppUtils.showMessage("quote-message", `第 ${index + 1} 条用车项目请至少录入一条用车明细。`, "error");
        return false;
      }
      for (let detailIndex = 0; detailIndex < item.vehicleDetails.length; detailIndex += 1) {
        const detail = item.vehicleDetails[detailIndex];
        if (!detail.vehicleModel) {
          window.AppUtils.showMessage("quote-message", `请填写第 ${index + 1} 条用车项目第 ${detailIndex + 1} 条明细的车型。`, "error");
          return false;
        }
        if (detail.vehicleCount <= 0) {
          window.AppUtils.showMessage("quote-message", `第 ${index + 1} 条用车项目第 ${detailIndex + 1} 条明细的车辆数必须大于 0。`, "error");
          return false;
        }
        if (detail.billingQuantity <= 0) {
          window.AppUtils.showMessage("quote-message", `第 ${index + 1} 条用车项目第 ${detailIndex + 1} 条明细的计费数量必须大于 0。`, "error");
          return false;
        }
      }
      continue;
    }

    if (["guide", "interpreter"].includes(item.type)) {
      if (item.serviceDetails.length === 0) {
        window.AppUtils.showMessage("quote-message", `第 ${index + 1} 条服务项目请至少录入一条服务明细。`, "error");
        return false;
      }
      for (let detailIndex = 0; detailIndex < item.serviceDetails.length; detailIndex += 1) {
        const detail = item.serviceDetails[detailIndex];
        if (detail.quantity <= 0) {
          window.AppUtils.showMessage("quote-message", `第 ${index + 1} 条服务项目第 ${detailIndex + 1} 条明细的数量必须大于 0。`, "error");
          return false;
        }
      }
      continue;
    }

    if (item.type === "dining" && item.mealDetails) {
      const detail = item.mealDetails;
      if (detail.mealPeople < 0 || detail.tripDays < 0 || detail.lunchPrice < 0 || detail.dinnerPrice < 0) {
        window.AppUtils.showMessage("quote-message", `第 ${index + 1} 条用餐项目的专用录入数据不能为负数。`, "error");
        return false;
      }
      continue;
    }

    if (!item.unit) {
      window.AppUtils.showMessage("quote-message", `请填写第 ${index + 1} 条报价项目的单位。`, "error");
      return false;
    }
    if (item.quantity <= 0) {
      window.AppUtils.showMessage("quote-message", `第 ${index + 1} 条报价项目的数量必须大于 0。`, "error");
      return false;
    }
    if (item.cost < 0 || item.price < 0) {
      window.AppUtils.showMessage("quote-message", `第 ${index + 1} 条报价项目的金额不能为负数。`, "error");
      return false;
    }
  }

  return true;
}
function buildMajorCostSummary(items, quoteCurrency) {
  if (items.length === 0) {
    return '<p class="empty compact-empty">\u6682\u65e0\u62a5\u4ef7\u9879\u76ee</p>';
  }

  const ranked = [...items].sort((left, right) => (right.totalCost || 0) - (left.totalCost || 0)).slice(0, 3);
  return `
    <div class="preview-list">
      ${ranked.map((item) => `
        <div class="simple-row compact-row">
          <span>${window.AppUi.getLabel("quoteItemTypeLabels", item.type)} / ${item.name}</span>
          <strong>${window.AppUtils.formatCurrency(item.totalCost, quoteCurrency)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderDateSummary(form) {
  if (!form.startDate.value || !form.endDate.value) {
    return "\u672a\u5b8c\u6210";
  }
  return `${form.startDate.value} ~ ${form.endDate.value}`;
}

function renderHotelPreview(item, quoteCurrency) {
  if (!item.hotelDetails || item.hotelDetails.length === 0) {
    return "";
  }
  return `<div class="hotel-preview-lines">${item.hotelDetails.map((detail) => `<p class="meta preview-subline">${detail.roomType} / ${detail.roomCount} \u95f4 / ${detail.nights} \u665a / \u6210\u672c ${window.AppUtils.formatCurrency(detail.costSubtotalOriginal, detail.currency)}\uff08\u6298\u7b97 ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}\uff09/ \u9500\u552e ${window.AppUtils.formatCurrency(detail.priceSubtotalOriginal, detail.currency)}\uff08\u6298\u7b97 ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}\uff09</p>`).join("")}</div>`;
}

function renderVehiclePreview(item, quoteCurrency) {
  if (!item.vehicleDetails || item.vehicleDetails.length === 0) {
    return "";
  }
  return `<div class="vehicle-preview-lines">${item.vehicleDetails.map((detail) => `<p class="meta preview-subline">${getVehicleDetailTypeLabel(detail.detailType)} / ${detail.vehicleModel} / ${detail.vehicleCount} 车 / 计费 ${detail.billingQuantity} ${getVehiclePricingUnitLabel(detail.pricingUnit)} / 成本 ${window.AppUtils.formatCurrency(detail.costSubtotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}）/ 销售 ${window.AppUtils.formatCurrency(detail.priceSubtotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}）</p>`).join("")}</div>`;
}

function renderServicePreview(item, quoteCurrency) {
  if (!item.serviceDetails || item.serviceDetails.length === 0) {
    return "";
  }
  return `<div class="service-preview-lines">${item.serviceDetails.map((detail) => `<p class="meta preview-subline">${getServiceRoleLabel(detail.serviceRole)} / ${getServiceLanguageLabel(detail.serviceLanguage)} / ${getServiceDurationLabel(detail.serviceDuration)} / 数量 ${detail.quantity} / 成本 ${window.AppUtils.formatCurrency(detail.costSubtotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}）/ 销售 ${window.AppUtils.formatCurrency(detail.priceSubtotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}）</p>`).join("")}</div>`;
}

function renderMealPreview(item, quoteCurrency) {
  if (!item.mealDetails) {
    return "";
  }
  const detail = item.mealDetails;
  return `<div class="meal-preview-lines"><p class="meta preview-subline">计价方式：人数 × 餐次 × 餐标</p><p class="meta preview-subline">用餐人数 ${detail.mealPeople} 人 / 行程天数 ${detail.tripDays} 天 / 午餐 ${detail.lunchCount} 次 / 晚餐 ${detail.dinnerCount} 次</p><p class="meta preview-subline">午餐 ${window.AppUtils.formatCurrency(detail.lunchTotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.lunchTotal, quoteCurrency)}）/ 晚餐 ${window.AppUtils.formatCurrency(detail.dinnerTotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.dinnerTotal, quoteCurrency)}）</p></div>`;
}

async function renderPreview(form) {
  const items = getItemRows();
  const preview = document.getElementById("quote-preview");
  const quoteCurrency = form.currency.value || "EUR";
  const baseSummary = `
    <section class="preview-summary-grid">
      <div class="preview-stat"><span>\u62a5\u4ef7\u5e01\u79cd</span><strong>${getCurrencyLabel(quoteCurrency)}</strong></div>
      <div class="preview-stat"><span>\u62a5\u4ef7\u9879\u6570\u91cf</span><strong>${items.length}</strong></div>
      <div class="preview-stat"><span>\u6587\u6863\u8f93\u51fa\u8bed\u8a00</span><strong>${getLanguageLabel(form.language.value || "zh-CN")}</strong></div>
      <div class="preview-stat"><span>\u884c\u7a0b\u65e5\u671f</span><strong>${renderDateSummary(form)}</strong></div>
    </section>
  `;

  if (items.length === 0) {
    preview.innerHTML = `${baseSummary}<section class="preview-block"><div class="panel-head"><h3>\u4e3b\u8981\u6210\u672c\u9879</h3></div><p class="empty compact-empty">\u8bf7\u5148\u65b0\u589e\u5e76\u586b\u5199\u62a5\u4ef7\u9879\u76ee\u3002</p></section><section class="preview-block"><div class="panel-head"><h3>\u8d39\u7528\u6c47\u603b</h3></div><div class="detail-grid preview-metrics-grid"><div class="metric"><span>\u6210\u672c\u5408\u8ba1</span><strong>${window.AppUtils.formatCurrency(0, quoteCurrency)}</strong></div><div class="metric"><span>\u552e\u4ef7\u5408\u8ba1</span><strong>${window.AppUtils.formatCurrency(0, quoteCurrency)}</strong></div><div class="metric"><span>\u6bdb\u5229</span><strong>${window.AppUtils.formatCurrency(0, quoteCurrency)}</strong></div><div class="metric"><span>\u6bdb\u5229\u7387</span><strong>0%</strong></div></div></section>`;
    return;
  }

  const totals = await window.AppUtils.fetchJson("/api/quotes/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, baseCurrency: quoteCurrency }),
  }, "\u62a5\u4ef7\u9884\u89c8\u8ba1\u7b97\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002");

  preview.innerHTML = `
    ${baseSummary}
    <section class="preview-block">
      <div class="panel-head"><h3>\u8d39\u7528\u6c47\u603b</h3></div>
      <div class="detail-grid preview-metrics-grid">
        <div class="metric"><span>\u6210\u672c\u5408\u8ba1</span><strong>${window.AppUtils.formatCurrency(totals.totalCost, quoteCurrency)}</strong></div>
        <div class="metric"><span>\u552e\u4ef7\u5408\u8ba1</span><strong>${window.AppUtils.formatCurrency(totals.totalPrice, quoteCurrency)}</strong></div>
        <div class="metric"><span>\u6bdb\u5229</span><strong>${window.AppUtils.formatCurrency(totals.grossProfit, quoteCurrency)}</strong></div>
        <div class="metric"><span>\u6bdb\u5229\u7387</span><strong>${totals.grossMargin}%</strong></div>
      </div>
    </section>
    <section class="preview-block">
      <div class="panel-head"><h3>\u4e3b\u8981\u6210\u672c\u9879</h3></div>
      ${buildMajorCostSummary(totals.items, quoteCurrency)}
    </section>
    <section class="preview-block">
      <div class="panel-head"><h3>\u62a5\u4ef7\u9879\u76ee\u6982\u89c8</h3></div>
      <div class="preview-list">
        ${totals.items.map((item) => `
          <div class="simple-row preview-row-stack">
            <div>
              <span>${window.AppUi.getLabel("quoteItemTypeLabels", item.type)} / ${item.name}</span>
              <p class="meta preview-subline">${["hotel", "vehicle", "guide", "interpreter"].includes(item.type) ? `成本合计：${window.AppUtils.formatCurrency(item.totalCost, quoteCurrency)} / 销售合计：${window.AppUtils.formatCurrency(item.totalPrice, quoteCurrency)}` : item.type === "dining" && item.mealDetails ? `用餐合计：${window.AppUtils.formatCurrency(item.mealDetails.totalAmountOriginal, item.mealDetails.currency)}，折算后：${window.AppUtils.formatCurrency(item.totalPrice, quoteCurrency)}` : `原币种：${window.AppUtils.formatCurrency(item.totalPriceOriginal, item.currency)}，折算后：${window.AppUtils.formatCurrency(item.totalPrice, quoteCurrency)}`}</p>
              ${item.type === "hotel" ? renderHotelPreview(item, quoteCurrency) : ""}
              ${item.type === "vehicle" ? renderVehiclePreview(item, quoteCurrency) : ""}
              ${["guide", "interpreter"].includes(item.type) ? renderServicePreview(item, quoteCurrency) : ""}
              ${item.type === "dining" ? renderMealPreview(item, quoteCurrency) : ""}
            </div>
            <strong>${window.AppUtils.formatCurrency(item.totalPrice, quoteCurrency)}</strong>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function buildForm(meta) {
  const defaultTemplate = getBlankTemplate();
  const selectedTemplateId = defaultTemplate ? defaultTemplate.id : "";
  const form = document.getElementById("quote-form");
  form.innerHTML = `
    <input type="hidden" name="quoteId" />
    <section class="form-section"><div class="form-section-head"><div><h2>\u57fa\u7840\u4fe1\u606f</h2><p class="meta">\u5148\u786e\u8ba4\u62a5\u4ef7\u5355\u7f16\u53f7\u3001\u9879\u76ee\u540d\u79f0\u3001\u5ba2\u6237\u4e0e\u8f93\u51fa\u8bbe\u7f6e\u3002</p></div></div><div class="form-grid form-grid-wide section-grid section-grid-wide"><label><span>\u62a5\u4ef7\u5355\u53f7</span><input name="quoteNumber" readonly /></label><label><span>\u9879\u76ee\u540d\u79f0</span><input name="projectName" placeholder="\u4f8b\u5982\uff1a\u585e\u5c14\u7ef4\u4e9a\u5546\u52a1\u63a5\u5f85 3 \u65e5\u884c\u7a0b" required /></label><label><span>\u5ba2\u6237\u540d\u79f0</span><input name="clientName" placeholder="\u4f8b\u5982\uff1a\u67d0\u67d0\u4f01\u4e1a\u4ee3\u8868\u56e2" required /></label><label><span>\u6587\u6863\u8f93\u51fa\u8bed\u8a00</span><select name="language">${createOptionList(meta.supportedLanguages, "zh-CN", "languageLabels")}</select></label><label><span>\u62a5\u4ef7\u5e01\u79cd</span><select name="currency">${createOptionList(meta.supportedCurrencies, meta.defaultQuoteCurrency || "EUR", "currencyLabels")}</select></label></div></section>
    <section class="form-section"><div class="form-section-head"><div><h2>\u8054\u7cfb\u4fe1\u606f</h2><p class="meta">\u586b\u5199\u5ba2\u6237\u8054\u7cfb\u4eba\uff0c\u4fbf\u4e8e\u540e\u7eed\u786e\u8ba4\u548c\u4fee\u6539\u62a5\u4ef7\u3002</p></div></div><div class="form-grid form-grid-wide section-grid section-grid-wide"><label><span>\u8054\u7cfb\u4eba\u59d3\u540d</span><input name="contactName" placeholder="\u586b\u5199\u5bf9\u63a5\u4eba\u59d3\u540d" required /></label><label><span>\u8054\u7cfb\u4eba\u7535\u8bdd / WhatsApp</span><input name="contactPhone" placeholder="\u4f8b\u5982\uff1a+381 60 123 4567" /></label></div></section>
    <section class="form-section"><div class="form-section-head"><div><h2>\u884c\u7a0b\u4fe1\u606f</h2><p class="meta">\u5f55\u5165\u8d77\u6b62\u65e5\u671f\u540e\uff0c\u7cfb\u7edf\u4f1a\u81ea\u52a8\u8ba1\u7b97\u884c\u7a0b\u5929\u6570\u3002</p></div></div><div class="form-grid form-grid-wide section-grid section-grid-wide"><label><span>\u884c\u7a0b\u5f00\u59cb\u65e5\u671f</span><input type="date" name="startDate" required /></label><label><span>\u884c\u7a0b\u7ed3\u675f\u65e5\u671f</span><input type="date" name="endDate" required /></label><label><span>\u884c\u7a0b\u5929\u6570</span><input type="number" name="travelDays" readonly /></label><label><span>\u4e3b\u8981\u76ee\u7684\u5730</span><input name="destination" value="Belgrade" required /></label><label><span>\u51fa\u884c\u4eba\u6570\uff08PAX\uff09</span><input type="number" name="paxCount" min="1" value="2" placeholder="\u4f8b\u5982\uff1a12" required /></label></div><label><span>\u7279\u6b8a\u9700\u6c42 / \u5907\u6ce8</span><textarea name="notes" rows="4" placeholder="\u4f8b\u5982\uff1a\u9700\u4e2d\u82f1\u53cc\u8bed\u63a5\u5f85\u3001VIP \u63a5\u673a\u3001\u5b89\u6392\u7d20\u98df\u9910\u98df\u7b49"></textarea></label></section>
    <section class="form-section quote-items-section"><div class="form-section-head form-section-head-row"><div><h2>报价项目</h2><p class="meta">酒店、用车、导游和翻译项目支持明细录入，系统会自动汇总成本和销售金额。</p></div><div class="template-actions"><a class="button-link small-link" href="/templates.html">管理模板</a><button type="button" class="add-item-trigger">新增报价项目</button></div></div><div class="template-toolbar"><label class="template-selector"><span>快速插入模板</span><select id="template-select" name="templateKey">${createTemplateOptionList(selectedTemplateId)}</select></label><div class="template-actions"><button type="button" id="apply-template" class="ghost">插入模板项目</button></div></div><p id="template-description" class="meta template-description">${defaultTemplate ? defaultTemplate.description : "暂无模板说明。"}</p><div id="items-container" class="stack"></div><div class="quote-items-footer"><button type="button" class="add-item-trigger secondary-add-button">继续新增报价项目</button><p class="meta">当前报价项目较多时，可直接在底部继续追加。</p></div></section>
    <div class="button-row"><button type="submit">\u4fdd\u5b58\u62a5\u4ef7</button><a class="button-link ghost-link" href="${getListFallbackForMode(state.pricingMode)}">\u8fd4\u56de\u5217\u8868</a></div>
  `;
  return form;
}
function updateTravelDays(form) {
  if (!form.startDate.value || !form.endDate.value) {
    form.travelDays.value = "";
    return;
  }
  if (form.endDate.value < form.startDate.value) {
    window.AppUtils.showMessage("quote-message", "\u884c\u7a0b\u7ed3\u675f\u65e5\u671f\u4e0d\u80fd\u65e9\u4e8e\u884c\u7a0b\u5f00\u59cb\u65e5\u671f\u3002", "error");
    form.travelDays.value = "";
    return;
  }
  window.AppUtils.hideMessage("quote-message");
  form.travelDays.value = window.AppUtils.calculateInclusiveDays(form.startDate.value, form.endDate.value);
}

function buildHotelDetailDefaults(detail, form, meta) {
  const fallbackRate = detail?.nightlyRate ?? "";
  return { roomType: detail?.roomType || "", roomCount: detail?.roomCount || 1, nights: detail?.nights || Number(form.travelDays.value || 1) || 1, costNightlyRate: detail?.costNightlyRate ?? fallbackRate, priceNightlyRate: detail?.priceNightlyRate ?? fallbackRate, currency: detail?.currency || form.currency.value || meta.defaultQuoteCurrency || "EUR", notes: detail?.notes || "" };
}

function buildLegacyHotelDetailDefaults(item, form, meta) {
  const hasLegacyAmounts = Number(item?.cost || 0) > 0 || Number(item?.price || 0) > 0 || Number(item?.quantity || 0) > 0;
  return { roomType: item?.name || "", roomCount: Number(item?.quantity || 0) || 0, nights: Number(item?.quantity || form.travelDays.value || 1) || 1, costNightlyRate: hasLegacyAmounts ? item?.cost ?? "" : "", priceNightlyRate: hasLegacyAmounts ? item?.price ?? "" : "", currency: item?.currency || form.currency.value || meta.defaultQuoteCurrency || "EUR", notes: item?.notes || "" };
}

function getDefaultVehicleBillingQuantity(pricingUnit, form) {
  return pricingUnit === "full_day" ? Math.max(Number(form.travelDays.value || 1), 1) : 1;
}

function buildVehicleDetailDefaults(detail, form, meta) {
  const pricingUnit = detail?.pricingUnit || "trip";
  return { detailType: detail?.detailType || "pickup", vehicleModel: detail?.vehicleModel || "", vehicleCount: detail?.vehicleCount || 1, pricingUnit, billingQuantity: Number(detail?.billingQuantity || getDefaultVehicleBillingQuantity(pricingUnit, form)) || 1, costUnitPrice: detail?.costUnitPrice ?? "", priceUnitPrice: detail?.priceUnitPrice ?? "", currency: detail?.currency || form.currency.value || meta.defaultQuoteCurrency || "EUR", notes: detail?.notes || "" };
}

function buildLegacyVehicleDetailDefaults(item, form, meta) {
  const pricingUnit = item?.unit === "全天" ? "full_day" : "trip";
  return { detailType: "pickup", vehicleModel: item?.name || "", vehicleCount: Number(item?.quantity || 1) || 1, pricingUnit, billingQuantity: getDefaultVehicleBillingQuantity(pricingUnit, form), costUnitPrice: item?.cost ?? "", priceUnitPrice: item?.price ?? "", currency: item?.currency || form.currency.value || meta.defaultQuoteCurrency || "EUR", notes: item?.notes || "" };
}

function buildServiceDetailDefaults(detail, form, meta, fallbackRole) {
  return { serviceRole: detail?.serviceRole || fallbackRole || "guide", serviceLanguage: detail?.serviceLanguage || "zh", serviceDuration: detail?.serviceDuration || "full_day", quantity: detail?.quantity || 1, costUnitPrice: detail?.costUnitPrice ?? "", priceUnitPrice: detail?.priceUnitPrice ?? "", currency: detail?.currency || form.currency.value || meta.defaultQuoteCurrency || "EUR", notes: detail?.notes || "" };
}

function buildLegacyServiceDetailDefaults(item, form, meta) {
  return { serviceRole: item?.type === "interpreter" ? "interpreter" : "guide", serviceLanguage: "zh", serviceDuration: "full_day", quantity: Number(item?.quantity || 1) || 1, costUnitPrice: item?.cost ?? "", priceUnitPrice: item?.price ?? "", currency: item?.currency || form.currency.value || meta.defaultQuoteCurrency || "EUR", notes: item?.notes || "" };
}

function buildMealDetailDefaults(detail, form, meta) {
  return {
    mealPeople: Number(detail?.mealPeople ?? form.paxCount.value ?? 0) || 0,
    tripDays: Number(detail?.tripDays ?? form.travelDays.value ?? 0) || 0,
    includeLunch: detail?.includeLunch ?? true,
    lunchPrice: Number(detail?.lunchPrice ?? 0) || 0,
    includeDinner: detail?.includeDinner ?? true,
    dinnerPrice: Number(detail?.dinnerPrice ?? 0) || 0,
    firstDayLunch: detail?.firstDayLunch ?? true,
    firstDayDinner: detail?.firstDayDinner ?? true,
    lastDayLunch: detail?.lastDayLunch ?? true,
    lastDayDinner: detail?.lastDayDinner ?? true,
    currency: detail?.currency || form.currency.value || meta.defaultQuoteCurrency || "EUR",
  };
}

function buildLegacyMealDetailDefaults(item, form, meta) {
  return {
    mealPeople: Number(form.paxCount.value || 0) || 0,
    tripDays: Number(form.travelDays.value || 0) || 0,
    includeLunch: true,
    lunchPrice: 0,
    includeDinner: true,
    dinnerPrice: 0,
    firstDayLunch: true,
    firstDayDinner: true,
    lastDayLunch: true,
    lastDayDinner: true,
    currency: item?.currency || form.currency.value || meta.defaultQuoteCurrency || "EUR",
  };
}

async function bootstrap() {
  window.AppUtils.applyFlash("quote-message");
  const params = new URLSearchParams(window.location.search);
  const editingId = params.get("id");
  let meta = {
    supportedLanguages: ["zh-CN", "en", "sr"],
    supportedCurrencies: ["EUR", "RSD", "KM", "ALL", "RMB"],
    supportedQuoteItemTypes: [],
    defaultQuoteCurrency: "EUR",
    defaultItemCurrency: "EUR",
    nextQuoteNumber: "",
  };
  let templates = [];
  try {
    [meta, templates] = await Promise.all([
      window.AppUtils.fetchJson("/api/meta", null, "\u9875\u9762\u521d\u59cb\u5316\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002"),
      window.AppUtils.fetchJson("/api/templates", null, "\u6a21\u677f\u6570\u636e\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002"),
    ]);
  } catch (err) {
    window.AppUtils.showMessage("quote-message", err.message, "error");
  }
  state.meta = meta;
  state.templates = templates;
  await preloadProjectTypeMeta();

  const form = buildForm(meta);
  const itemsContainer = document.getElementById("items-container");
  syncReturnLinks(form);

  // ── 报价模式切换 ─────────────────────────────────────────────────────────────
  const standardEditorGrid = document.getElementById("standard-editor-grid");
  const projectModeWrapper = document.getElementById("project-mode-wrapper");
  const projectGroupsEditor = document.getElementById("project-groups-editor");
  const modeRadioStandard = document.getElementById("mode-radio-standard");
  const modeRadioProject = document.getElementById("mode-radio-project");
  const quoteItemsSection = form.querySelector(".quote-items-section");

  const previewAside = document.getElementById("preview-aside");

  function openProjectQuotationFromEditor() {
    const quoteId = String(form.quoteId.value || "").trim();
    if (!quoteId) {
      window.AppUtils.showMessage("quote-message", "\u8bf7\u5148\u4fdd\u5b58\u62a5\u4ef7\uff0c\u518d\u751f\u6210\u62a5\u4ef7\u5355", "error");
      return;
    }
    // 生成客户报价单前：统一补分类检查
    if (window.ProjectEditor && typeof window.ProjectEditor.checkAndClassifyItems === "function") {
      window.ProjectEditor.checkAndClassifyItems().then((confirmed) => {
        if (!confirmed) return;
        const target = `/project-quotation.html?id=${encodeURIComponent(quoteId)}`;
        const nextUrl = window.AppReturn
          ? window.AppReturn.withReturn(target, window.AppReturn.getCurrentPath())
          : target;
        window.open(nextUrl, "_blank", "noopener");
      });
    } else {
      const target = `/project-quotation.html?id=${encodeURIComponent(quoteId)}`;
      const nextUrl = window.AppReturn
        ? window.AppReturn.withReturn(target, window.AppReturn.getCurrentPath())
        : target;
      window.open(nextUrl, "_blank", "noopener");
    }
  }

  if (window.ProjectEditor && typeof window.ProjectEditor.setQuotationAction === "function") {
    window.ProjectEditor.setQuotationAction(openProjectQuotationFromEditor);
  }

  function activatePricingMode(mode, initialGroups, currency) {
    state.pricingMode = mode;
    if (mode === "project_based") {
      if (modeRadioProject) modeRadioProject.checked = true;
      // 移除 <head> 阶段添加的初始化隐藏类，防止 JS 接管后 CSS 状态残留
      document.documentElement.classList.remove("initializing-project");
      // 进入项目型模式后隐藏模式切换栏（不需要再切换）
      const modeSelectorPanel = document.getElementById("mode-selector-panel");
      if (modeSelectorPanel) modeSelectorPanel.style.display = "none";
      // 隐藏标准报价项目区和预览面板，保留表单头部（基础信息/联系信息/行程信息）
      if (quoteItemsSection) quoteItemsSection.style.display = "none";
      if (previewAside)     previewAside.style.display = "none";
      // 单列布局
      if (standardEditorGrid) standardEditorGrid.style.gridTemplateColumns = "1fr";
      // 展示项目编辑区
      if (projectModeWrapper) projectModeWrapper.style.display = "";
      // 初始化项目编辑器
      if (projectGroupsEditor && window.ProjectEditor) {
        // ProjectEditor manages its own service-type selects (event→supplier-category,
        // travel→item-type). Do NOT call attachProjectBasedTypeSync here: its
        // rebuildAllServiceTypeSelects scans .item-type-sel and overwrites the
        // supplier-category options that ProjectEditor already rendered correctly.
        window.ProjectEditor.init(projectGroupsEditor, initialGroups || [], currency || form.currency.value || "EUR");
      }
      // 更新页面标题标签
      const titleEl = document.getElementById("quote-form-title");
      if (titleEl) {
        titleEl.textContent = "项目型报价单";
      }
      const subtitleEl = document.getElementById("quote-form-subtitle");
      if (subtitleEl) {
        subtitleEl.textContent = "大型活动 / 会议 / 展会 – 可混合旅游接待与活动服务项目。";
      }
    } else {
      if (modeRadioStandard) modeRadioStandard.checked = true;
      const modeSelectorPanel = document.getElementById("mode-selector-panel");
      if (modeSelectorPanel) modeSelectorPanel.style.display = "";
      if (quoteItemsSection) quoteItemsSection.style.display = "";
      if (previewAside)     previewAside.style.display = "";
      if (standardEditorGrid) standardEditorGrid.style.gridTemplateColumns = "";
      if (projectModeWrapper) projectModeWrapper.style.display = "none";
    }
  }

  if (modeRadioStandard) {
    modeRadioStandard.addEventListener("change", () => {
      if (modeRadioStandard.checked) activatePricingMode("standard", [], form.currency.value);
    });
  }
  if (modeRadioProject) {
    modeRadioProject.addEventListener("change", () => {
      if (modeRadioProject.checked) activatePricingMode("project_based", [], form.currency.value);
    });
  }

  // 若 URL 带有 mode=project_based，自动激活并同步返回链接
  const urlSearchParams = new URLSearchParams(window.location.search);
  if (urlSearchParams.get("mode") === "project_based") {
    activatePricingMode("project_based", [], form.currency.value || "EUR");
    syncReturnLinks(form); // 模式确定后重新同步，确保返回链接指向 project-quotes.html
  }
  // ── 报价模式切换结束 ─────────────────────────────────────────────────────────
  const templateSelect = document.getElementById("template-select");
  const templateDescription = document.getElementById("template-description");

  function bindDetailInputs(detailRow, row, refreshDetail, refreshSummary) {
    detailRow.querySelectorAll('input, select').forEach((input) => {
      input.addEventListener('input', () => {
        refreshDetail(detailRow);
        refreshSummary(row, form.currency.value);
        renderPreview(form).catch((error) => window.AppUtils.showMessage('quote-message', error.message, 'error'));
      });
      input.addEventListener('change', () => {
        refreshDetail(detailRow);
        refreshSummary(row, form.currency.value);
        renderPreview(form).catch((error) => window.AppUtils.showMessage('quote-message', error.message, 'error'));
      });
    });
  }

  function addHotelDetailRow(row, defaults) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = createHotelDetailRow(meta.supportedCurrencies, defaults, form.currency.value || meta.defaultQuoteCurrency || 'EUR');
    const detailRow = wrapper.firstElementChild;
    row.querySelector('.hotel-detail-list').appendChild(detailRow);
    bindDetailInputs(detailRow, row, refreshHotelDetailRow, refreshHotelItemSummary);
    detailRow.querySelector('.delete-hotel-detail').addEventListener('click', () => {
      detailRow.remove();
      refreshHotelItemSummary(row, form.currency.value);
      renderPreview(form).catch((error) => window.AppUtils.showMessage('quote-message', error.message, 'error'));
    });
    detailRow.querySelector('.duplicate-hotel-detail').addEventListener('click', () => {
      addHotelDetailRow(row, { roomType: detailRow.querySelector('[name="roomType"]').value.trim(), roomCount: Number(detailRow.querySelector('[name="roomCount"]').value || 1), nights: Number(detailRow.querySelector('[name="nights"]').value || Number(form.travelDays.value || 1) || 1), costNightlyRate: Number(detailRow.querySelector('[name="costNightlyRate"]').value || 0), priceNightlyRate: Number(detailRow.querySelector('[name="priceNightlyRate"]').value || 0), currency: detailRow.querySelector('[name="currency"]').value, notes: detailRow.querySelector('[name="notes"]').value.trim() });
      window.AppUtils.showMessage('quote-message', '\u5df2\u590d\u5236\u4e00\u6761\u623f\u578b\u660e\u7ec6\uff0c\u53ef\u7ee7\u7eed\u5fae\u8c03\u623f\u578b\u3001\u6210\u672c\u4ef7\u548c\u9500\u552e\u4ef7\u3002', 'success');
      renderPreview(form).catch((error) => window.AppUtils.showMessage('quote-message', error.message, 'error'));
    });
    refreshHotelDetailRow(detailRow);
    refreshHotelItemSummary(row, form.currency.value);
  }

  function addVehicleDetailRow(row, defaults) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = createVehicleDetailRow(meta.supportedCurrencies, defaults, form.currency.value || meta.defaultQuoteCurrency || 'EUR');
    const detailRow = wrapper.firstElementChild;
    row.querySelector('.vehicle-detail-list').appendChild(detailRow);
    bindDetailInputs(detailRow, row, refreshVehicleDetailRow, refreshVehicleItemSummary);
    const billingQuantityInput = detailRow.querySelector('[name="billingQuantity"]');
    const pricingUnitInput = detailRow.querySelector('[name="pricingUnit"]');
    billingQuantityInput.addEventListener('input', () => {
      billingQuantityInput.dataset.userChanged = 'true';
    });
    billingQuantityInput.addEventListener('change', () => {
      billingQuantityInput.dataset.userChanged = 'true';
    });
    pricingUnitInput.addEventListener('change', () => {
      if (!billingQuantityInput.dataset.userChanged) {
        billingQuantityInput.value = getDefaultVehicleBillingQuantity(pricingUnitInput.value, form);
      }
      refreshVehicleDetailRow(detailRow);
      refreshVehicleItemSummary(row, form.currency.value);
      renderPreview(form).catch((error) => window.AppUtils.showMessage('quote-message', error.message, 'error'));
    });
    detailRow.querySelector('.delete-vehicle-detail').addEventListener('click', () => {
      detailRow.remove();
      refreshVehicleItemSummary(row, form.currency.value);
      renderPreview(form).catch((error) => window.AppUtils.showMessage('quote-message', error.message, 'error'));
    });
    refreshVehicleDetailRow(detailRow);
    refreshVehicleItemSummary(row, form.currency.value);
  }

  function addServiceDetailRow(row, defaults) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = createServiceDetailRow(meta.supportedCurrencies, defaults, form.currency.value || meta.defaultQuoteCurrency || 'EUR');
    const detailRow = wrapper.firstElementChild;
    row.querySelector('.service-detail-list').appendChild(detailRow);
    bindDetailInputs(detailRow, row, refreshServiceDetailRow, refreshServiceItemSummary);
    detailRow.querySelector('.delete-service-detail').addEventListener('click', () => {
      detailRow.remove();
      refreshServiceItemSummary(row, form.currency.value);
      renderPreview(form).catch((error) => window.AppUtils.showMessage('quote-message', error.message, 'error'));
    });
    refreshServiceDetailRow(detailRow);
    refreshServiceItemSummary(row, form.currency.value);
  }

  function setMealFieldValues(row, defaults) {
    row.querySelector('[name="mealPeople"]').value = defaults.mealPeople ?? 0;
    row.querySelector('[name="mealTripDays"]').value = defaults.tripDays ?? 0;
    row.querySelector('[name="includeLunch"]').checked = defaults.includeLunch ?? true;
    row.querySelector('[name="lunchPrice"]').value = defaults.lunchPrice ?? 0;
    row.querySelector('[name="includeDinner"]').checked = defaults.includeDinner ?? true;
    row.querySelector('[name="dinnerPrice"]').value = defaults.dinnerPrice ?? 0;
    row.querySelector('[name="firstDayLunch"]').checked = defaults.firstDayLunch ?? true;
    row.querySelector('[name="firstDayDinner"]').checked = defaults.firstDayDinner ?? true;
    row.querySelector('[name="lastDayLunch"]').checked = defaults.lastDayLunch ?? true;
    row.querySelector('[name="lastDayDinner"]').checked = defaults.lastDayDinner ?? true;
  }

  function refreshMealLegacyNote(row) {
    const note = row.querySelector('.meal-legacy-note');
    if (row.dataset.legacyDining === 'true' && row.dataset.mealTouched !== 'true' && row._legacyDiningData) {
      const legacy = row._legacyDiningData;
      note.classList.remove('hidden');
      note.innerHTML = `<strong>旧版用餐结构</strong><p>该用餐项目仍按旧版字段读取：${legacy.quantity} ${legacy.unit || '项'}，原金额 ${window.AppUtils.formatCurrency((Number(legacy.price || 0) || 0) * (Number(legacy.quantity || 0) || 0), legacy.currency || row.querySelector('[name="currency"]').value || 'EUR')}。当前页面可正常查看和保存；如需升级，请在下方用餐专用录入区调整后再保存。</p>`;
      return;
    }
    note.classList.add('hidden');
    note.innerHTML = '';
  }

  function bindMealInputs(row) {
    if (row.dataset.mealBound === "true") {
      return;
    }
    row.dataset.mealBound = "true";
    row.querySelectorAll('.meal-detail-box input').forEach((input) => {
      const markTouched = () => {
        if (row.dataset.legacyDining === 'true') {
          row.dataset.mealTouched = 'true';
        }
        if (input.name === 'mealTripDays') {
          input.dataset.userChanged = 'true';
        }
        refreshMealItemSummary(row, form.currency.value);
        refreshMealLegacyNote(row);
        renderPreview(form).catch((error) => window.AppUtils.showMessage('quote-message', error.message, 'error'));
      };
      input.addEventListener('input', markTouched);
      input.addEventListener('change', markTouched);
    });
  }

  function initializeMealDetails(row, defaults) {
    setMealFieldValues(row, defaults);
    bindMealInputs(row);
    refreshMealItemSummary(row, form.currency.value);
    refreshMealLegacyNote(row);
  }

  function bindPreviewRefresh(row) {
    row.querySelectorAll('input, select').forEach((input) => {
      input.addEventListener('input', () => renderPreview(form).catch((error) => window.AppUtils.showMessage('quote-message', error.message, 'error')));
      input.addEventListener('change', () => renderPreview(form).catch((error) => window.AppUtils.showMessage('quote-message', error.message, 'error')));
    });
  }
  function addItemRow(defaults = {}) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = createItemRow(meta.supportedQuoteItemTypes, meta.supportedCurrencies, form.currency.value || meta.defaultItemCurrency || "EUR");
    const row = wrapper.firstElementChild;
    itemsContainer.appendChild(row);

    const typeField = row.querySelector('[name="type"]');
    const nameField = row.querySelector('[name="name"]');
    const unitField = row.querySelector('[name="unit"]');
    const supplierField = row.querySelector('[name="supplier"]');
    const currencyField = row.querySelector('[name="currency"]');
    const quantityField = row.querySelector('[name="quantity"]');
    const costField = row.querySelector('[name="cost"]');
    const priceField = row.querySelector('[name="price"]');
    const notesField = row.querySelector('[name="notes"]');

    typeField.value = defaults.type || "hotel";
    nameField.value = defaults.name || "";
    unitField.value = defaults.unit || "项";
    supplierField.value = defaults.supplier || "";
    currencyField.value = defaults.currency || form.currency.value || meta.defaultItemCurrency || "EUR";
    quantityField.value = defaults.quantity || 1;
    costField.value = defaults.cost ?? "";
    priceField.value = defaults.price ?? "";
    notesField.value = defaults.notes || "";

    row.dataset.legacyDining = defaults.type === 'dining' && !defaults.mealDetails && (Number(defaults.quantity || 0) > 0 || Number(defaults.price || 0) > 0 || Number(defaults.cost || 0) > 0 || Boolean(defaults.unit)) ? 'true' : 'false';
    row.dataset.mealTouched = 'false';
    row._legacyDiningData = row.dataset.legacyDining === 'true'
      ? { unit: defaults.unit || '项', quantity: Number(defaults.quantity || 0), cost: Number(defaults.cost || 0), price: Number(defaults.price || 0), currency: defaults.currency || form.currency.value || meta.defaultItemCurrency || 'EUR' }
      : null;

    const ensureHotelDetails = () => {
      if (row.querySelectorAll(".hotel-detail-row").length > 0) {
        refreshHotelItemSummary(row, form.currency.value);
        return;
      }
      const detailDefaults = Array.isArray(defaults.hotelDetails) && defaults.hotelDetails.length > 0
        ? defaults.hotelDetails.map((detail) => buildHotelDetailDefaults(detail, form, meta))
        : defaults.type === "hotel"
          ? [buildLegacyHotelDetailDefaults(defaults, form, meta)]
          : [buildHotelDetailDefaults(null, form, meta)];
      detailDefaults.forEach((detail) => addHotelDetailRow(row, detail));
    };

    const ensureVehicleDetails = () => {
      if (row.querySelectorAll(".vehicle-detail-row").length > 0) {
        refreshVehicleItemSummary(row, form.currency.value);
        return;
      }
      const detailDefaults = Array.isArray(defaults.vehicleDetails) && defaults.vehicleDetails.length > 0
        ? defaults.vehicleDetails.map((detail) => buildVehicleDetailDefaults(detail, form, meta))
        : defaults.type === "vehicle"
          ? [buildLegacyVehicleDetailDefaults(defaults, form, meta)]
          : [buildVehicleDetailDefaults(null, form, meta)];
      detailDefaults.forEach((detail) => addVehicleDetailRow(row, detail));
    };

    const ensureServiceDetails = () => {
      if (row.querySelectorAll(".service-detail-row").length > 0) {
        refreshServiceItemSummary(row, form.currency.value);
        return;
      }
      const fallbackRole = typeField.value === "interpreter" ? "interpreter" : "guide";
      const detailDefaults = Array.isArray(defaults.serviceDetails) && defaults.serviceDetails.length > 0
        ? defaults.serviceDetails.map((detail) => buildServiceDetailDefaults(detail, form, meta, fallbackRole))
        : ["guide", "interpreter"].includes(defaults.type)
          ? [buildLegacyServiceDetailDefaults(defaults, form, meta)]
          : [buildServiceDetailDefaults(null, form, meta, fallbackRole)];
      detailDefaults.forEach((detail) => addServiceDetailRow(row, detail));
    };

    const ensureMealDetails = () => {
      const detailDefaults = defaults.mealDetails
        ? buildMealDetailDefaults(defaults.mealDetails, form, meta)
        : defaults.type === 'dining' && row.dataset.legacyDining === 'true'
          ? buildLegacyMealDetailDefaults(defaults, form, meta)
          : buildMealDetailDefaults(null, form, meta);
      initializeMealDetails(row, detailDefaults);
    };

    const genericNamePlaceholder = "例如：贝尔格莱德商务酒店 / 商务车服务 / 商务午餐 / 商务晚餐";
    const genericNotesPlaceholder = "例如：安排午餐和晚餐、司机会中文、按实际人数结算";

    const applyTypeFieldHints = () => {
      nameField.placeholder = genericNamePlaceholder;
      notesField.placeholder = genericNotesPlaceholder;

      if (typeField.value === "dining") {
        nameField.placeholder = "例如：商务午餐 / 晚餐安排 / 欢迎晚宴";
        notesField.placeholder = "例如：不含早餐；可按首尾天实际餐次调整";
        if (!nameField.value.trim()) {
          nameField.value = "商务午餐 / 晚餐安排";
        }
        if (!unitField.value.trim() || ["酒店", "用车", "服务", "项"].includes(unitField.value.trim())) {
          unitField.value = "用餐";
        }
        if (!notesField.value.trim()) {
          notesField.value = "默认不含早餐，可按首尾天实际餐次和人数调整。";
        }
        return;
      }

      if (typeField.value === "hotel") {
        nameField.placeholder = "例如：贝尔格莱德商务酒店 / 诺维萨德酒店";
      } else if (typeField.value === "vehicle") {
        nameField.placeholder = "例如：商务车服务 / 机场接送 / 全天用车";
      } else if (["guide", "interpreter"].includes(typeField.value)) {
        nameField.placeholder = "例如：中文导游服务 / 商务翻译服务";
      }
    };

    const syncTypeUI = () => {
      toggleDetailFields(row);
      if (typeField.value === "hotel") {
        unitField.value = "酒店";
        ensureHotelDetails();
      } else if (typeField.value === "vehicle") {
        unitField.value = "用车";
        ensureVehicleDetails();
      } else if (["guide", "interpreter"].includes(typeField.value)) {
        unitField.value = "服务";
        ensureServiceDetails();
      } else if (typeField.value === "dining") {
        unitField.value = "用餐";
        ensureMealDetails();
      } else if (!unitField.value.trim() || ["酒店", "用车", "服务", "用餐"].includes(unitField.value.trim())) {
        unitField.value = "项";
      }

      applyTypeFieldHints();
      refreshMealLegacyNote(row);
      renderPreview(form).catch((error) => window.AppUtils.showMessage("quote-message", error.message, "error"));
    };

    row.querySelector(".delete-item").addEventListener("click", () => {
      const itemName = nameField.value.trim() || "该报价项目";
      if (!window.confirm(`确认删除“${itemName}”吗？`)) {
        return;
      }
      row.remove();
      renderPreview(form).catch((error) => window.AppUtils.showMessage("quote-message", error.message, "error"));
    });

    row.querySelector(".add-hotel-detail").addEventListener("click", () => {
      addHotelDetailRow(row, buildHotelDetailDefaults(null, form, meta));
      renderPreview(form).catch((error) => window.AppUtils.showMessage("quote-message", error.message, "error"));
    });

    row.querySelector(".add-vehicle-detail").addEventListener("click", () => {
      addVehicleDetailRow(row, buildVehicleDetailDefaults(null, form, meta));
      renderPreview(form).catch((error) => window.AppUtils.showMessage("quote-message", error.message, "error"));
    });

    row.querySelector(".add-service-detail").addEventListener("click", () => {
      const fallbackRole = typeField.value === "interpreter" ? "interpreter" : "guide";
      addServiceDetailRow(row, buildServiceDetailDefaults(null, form, meta, fallbackRole));
      renderPreview(form).catch((error) => window.AppUtils.showMessage("quote-message", error.message, "error"));
    });

    typeField.addEventListener("change", () => {
      if (typeField.value === "guide" || typeField.value === "interpreter") {
        row.querySelectorAll('.service-detail-row [name="serviceRole"]').forEach((input) => {
          input.value = typeField.value === "interpreter" ? "interpreter" : "guide";
        });
      }
      syncTypeUI();
    });

    currencyField.addEventListener("change", () => {
      row.querySelectorAll('.hotel-detail-row [name="currency"], .vehicle-detail-row [name="currency"], .service-detail-row [name="currency"]').forEach((input) => {
        if (!input.dataset.userChanged) {
          input.value = currencyField.value;
        }
      });
      refreshHotelItemSummary(row, form.currency.value);
      refreshVehicleItemSummary(row, form.currency.value);
      refreshServiceItemSummary(row, form.currency.value);
      refreshMealItemSummary(row, form.currency.value);
      if (row._legacyDiningData) {
        row._legacyDiningData.currency = currencyField.value;
      }
    });

    bindPreviewRefresh(row);
    window.AppUtils.setChineseValidity(row);
    syncTypeUI();
    return row;
  }

  function clearItemRows() {
    itemsContainer.innerHTML = "";
  }

  function updateTemplateDescription() {
    const template = findTemplateById(templateSelect.value);
    templateDescription.textContent = template?.description || "暂无模板说明。";
  }

  function applyTemplate() {
    const template = findTemplateById(templateSelect.value);
    if (!template) {
      window.AppUtils.showMessage("quote-message", "请选择可用模板后再插入。", "error");
      return;
    }

    const existingItems = getItemRows();
    let mode = "replace";
    if (existingItems.length > 0) {
      const append = window.confirm("当前已录入报价项目。点击“确定”将把模板项目追加到现有项目后；点击“取消”可继续选择是否替换现有项目。");
      if (!append) {
        const replace = window.confirm("是否用模板项目替换当前已录入的报价项目？点击“确定”替换，点击“取消”则不执行插入。");
        if (!replace) {
          return;
        }
        mode = "replace";
      } else {
        mode = "append";
      }
    }

    if (mode === "replace") {
      clearItemRows();
    }

    template.items.forEach((item) => addItemRow({
      ...item,
      currency: item.currency || form.currency.value || meta.defaultItemCurrency || "EUR",
    }));

    if (template.items.length === 0 && mode === "replace") {
      addItemRow({
        type: "hotel",
        currency: form.currency.value || meta.defaultItemCurrency || "EUR",
      });
    }

    renderPreview(form).catch((error) => window.AppUtils.showMessage("quote-message", error.message, "error"));
    window.AppUtils.showMessage("quote-message", `已插入模板“${template.name}”。`, "success");
  }

  async function loadQuoteForEdit(quoteId) {
    const quote = await window.AppUtils.fetchJson(`/api/quotes/${encodeURIComponent(quoteId)}`, null, "报价数据加载失败，请稍后重试。");

    form.quoteId.value = quote.id;
    form.quoteNumber.value = quote.quoteNumber || meta.nextQuoteNumber || "";
    form.projectName.value = quote.projectName || "";
    form.clientName.value = quote.clientName || "";
    form.contactName.value = quote.contactName || "";
    form.contactPhone.value = quote.contactPhone || "";
    form.language.value = quote.language || "zh-CN";
    form.currency.value = quote.currency || meta.defaultQuoteCurrency || "EUR";
    form.startDate.value = quote.startDate || quote.tripDate || "";
    form.endDate.value = quote.endDate || quote.tripDate || "";
    form.destination.value = quote.destination || "Belgrade";
    form.paxCount.value = quote.paxCount || 1;
    form.notes.value = quote.notes || "";
    updateTravelDays(form);

    clearItemRows();

    if (quote.pricingMode === "project_based") {
      // 切换至项目型模式，并同步返回链接
      activatePricingMode("project_based", quote.projectGroups || [], quote.currency || "EUR");
      syncReturnLinks(form);
    } else {
      (quote.items || []).forEach((item) => addItemRow(item));
      if (!quote.items || quote.items.length === 0) {
        addItemRow({
          type: "hotel",
          currency: form.currency.value || meta.defaultItemCurrency || "EUR",
        });
      }
      await renderPreview(form);
    }

    const titleEl = document.getElementById("quote-form-title") || document.getElementById("proj-form-title");
    if (titleEl) titleEl.textContent = quote.pricingMode === "project_based" ? "编辑项目型报价单" : "编辑报价单";
    const projTitleEl = document.getElementById("proj-form-title");
    if (projTitleEl) projTitleEl.textContent = "编辑项目型报价单";
    const formTitleEl = document.getElementById("quote-form-title");
    if (formTitleEl) formTitleEl.textContent = quote.pricingMode === "project_based" ? "编辑项目型报价单" : "编辑报价单";
    document.getElementById("quote-form-mode").textContent = "编辑模式";
  }

  const today = window.AppUtils.getToday();
  form.quoteNumber.value = meta.nextQuoteNumber || "";
  form.language.value = "zh-CN";
  form.currency.value = meta.defaultQuoteCurrency || "EUR";
  form.startDate.value = today;
  form.endDate.value = today;
  form.destination.value = "Belgrade";
  form.paxCount.value = 2;
  updateTravelDays(form);
  window.AppUtils.setChineseValidity(form);

  form.startDate.addEventListener("change", () => {
    if (!form.endDate.value || form.endDate.value < form.startDate.value) {
      form.endDate.value = form.startDate.value;
    }
    updateTravelDays(form);
    document.querySelectorAll('.hotel-detail-row [name="nights"]').forEach((input) => {
      if (!input.dataset.userChanged) {
        input.value = Number(form.travelDays.value || 1) || 1;
      }
    });
    document.querySelectorAll('.vehicle-detail-row').forEach((detailRow) => {
      const pricingUnitInput = detailRow.querySelector('[name="pricingUnit"]');
      const billingQuantityInput = detailRow.querySelector('[name="billingQuantity"]');
      if (pricingUnitInput && billingQuantityInput && pricingUnitInput.value === "full_day" && !billingQuantityInput.dataset.userChanged) {
        billingQuantityInput.value = getDefaultVehicleBillingQuantity(pricingUnitInput.value, form);
      }
    });
    document.querySelectorAll('.hotel-detail-row').forEach((detailRow) => refreshHotelDetailRow(detailRow));
    document.querySelectorAll('.vehicle-detail-row').forEach((detailRow) => refreshVehicleDetailRow(detailRow));
    document.querySelectorAll('.meal-detail-box [name="mealTripDays"]').forEach((input) => {
      if (!input.dataset.userChanged) {
        input.value = Number(form.travelDays.value || 0) || 0;
      }
    });
    document.querySelectorAll('.item-card').forEach((row) => {
      refreshHotelItemSummary(row, form.currency.value);
      refreshVehicleItemSummary(row, form.currency.value);
      refreshMealItemSummary(row, form.currency.value);
    });
    renderPreview(form).catch((error) => window.AppUtils.showMessage("quote-message", error.message, "error"));
  });


  form.endDate.addEventListener("change", () => {
    updateTravelDays(form);
    document.querySelectorAll('.hotel-detail-row [name="nights"]').forEach((input) => {
      if (!input.dataset.userChanged) {
        input.value = Number(form.travelDays.value || 1) || 1;
      }
    });
    document.querySelectorAll('.vehicle-detail-row').forEach((detailRow) => {
      const pricingUnitInput = detailRow.querySelector('[name="pricingUnit"]');
      const billingQuantityInput = detailRow.querySelector('[name="billingQuantity"]');
      if (pricingUnitInput && billingQuantityInput && pricingUnitInput.value === "full_day" && !billingQuantityInput.dataset.userChanged) {
        billingQuantityInput.value = getDefaultVehicleBillingQuantity(pricingUnitInput.value, form);
      }
    });
    document.querySelectorAll('.hotel-detail-row').forEach((detailRow) => refreshHotelDetailRow(detailRow));
    document.querySelectorAll('.vehicle-detail-row').forEach((detailRow) => refreshVehicleDetailRow(detailRow));
    document.querySelectorAll('.meal-detail-box [name="mealTripDays"]').forEach((input) => {
      if (!input.dataset.userChanged) {
        input.value = Number(form.travelDays.value || 0) || 0;
      }
    });
    document.querySelectorAll('.item-card').forEach((row) => {
      refreshHotelItemSummary(row, form.currency.value);
      refreshVehicleItemSummary(row, form.currency.value);
      refreshMealItemSummary(row, form.currency.value);
    });
    renderPreview(form).catch((error) => window.AppUtils.showMessage("quote-message", error.message, "error"));
  });

  form.currency.addEventListener("change", () => {
    document.querySelectorAll('.item-card').forEach((row) => {
      refreshHotelItemSummary(row, form.currency.value);
      refreshVehicleItemSummary(row, form.currency.value);
      refreshServiceItemSummary(row, form.currency.value);
      refreshMealItemSummary(row, form.currency.value);
    });
    renderPreview(form).catch((error) => window.AppUtils.showMessage("quote-message", error.message, "error"));
  });

  ["projectName", "clientName", "contactName", "contactPhone", "language", "destination", "paxCount", "notes"].forEach((fieldName) => {
    form[fieldName].addEventListener("input", () => {
      renderPreview(form).catch((error) => window.AppUtils.showMessage("quote-message", error.message, "error"));
    });
    form[fieldName].addEventListener("change", () => {
      renderPreview(form).catch((error) => window.AppUtils.showMessage("quote-message", error.message, "error"));
    });
  });

  document.querySelectorAll(".add-item-trigger").forEach((button) => {
    button.addEventListener("click", () => {
      addItemRow({
        type: "hotel",
        currency: form.currency.value || meta.defaultItemCurrency || "EUR",
      });
      window.AppUtils.hideMessage("quote-message");
    });
  });

  updateTemplateDescription();

  if (editingId) {
    await loadQuoteForEdit(editingId);
  } else {
    addItemRow({
      type: "hotel",
      currency: form.currency.value || meta.defaultItemCurrency || "EUR",
    });
    await renderPreview(form);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const isProjectMode = state.pricingMode === "project_based";

    if (isProjectMode) {
      // 项目型模式：只校验基础信息
      if (!form.clientName.value.trim() || !form.projectName.value.trim() || !form.contactName.value.trim()) {
        window.AppUtils.showMessage("quote-message", "请填写客户名称、项目名称和联系人。", "error");
        return;
      }
      // 保存前统一补分类检查
      if (window.ProjectEditor && typeof window.ProjectEditor.checkAndClassifyItems === "function") {
        const classified = await window.ProjectEditor.checkAndClassifyItems();
        if (!classified) return;
      }
    } else {
      if (!validateQuoteForm(form)) {
        return;
      }
    }

    const projectGroups = isProjectMode && window.ProjectEditor ? window.ProjectEditor.getGroups() : [];
    const projectSummary = isProjectMode && window.ProjectEditor
      ? window.ProjectEditor.getSummary()
      : { totalCost: 0, totalSales: 0, totalProfit: 0 };

    const payload = {
      quoteNumber: form.quoteNumber.value,
      projectName: form.projectName.value.trim(),
      clientName: form.clientName.value.trim(),
      contactName: form.contactName.value.trim(),
      contactPhone: form.contactPhone.value.trim(),
      language: form.language.value,
      currency: form.currency.value,
      startDate: form.startDate.value,
      endDate: form.endDate.value,
      destination: form.destination.value.trim() || "Belgrade",
      paxCount: Number(form.paxCount.value || 0),
      notes: form.notes.value.trim(),
      pricingMode: state.pricingMode,
      items: isProjectMode ? [] : getItemRows(),
      projectGroups: isProjectMode ? projectGroups : [],
      totalCost: isProjectMode ? projectSummary.totalCost : undefined,
      totalSales: isProjectMode ? projectSummary.totalSales : undefined,
      totalProfit: isProjectMode ? projectSummary.totalProfit : undefined,
    };

    const isEditing = Boolean(form.quoteId.value);
    const url = isEditing ? `/api/quotes/${encodeURIComponent(form.quoteId.value)}` : "/api/quotes";
    const method = isEditing ? "PUT" : "POST";

    try {
      const savedQuote = await window.AppUtils.fetchJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, isEditing ? "报价更新失败，请稍后重试。" : "报价保存失败，请稍后重试。");

      window.AppUtils.setFlash(isEditing ? "报价已更新。" : "报价已保存。", "success");
      const fallback = getListFallbackForMode(state.pricingMode);
      const explicitReturn = window.AppReturn ? window.AppReturn.getReturnParam() : "";
      if (explicitReturn) {
        window.location.href = explicitReturn;
      } else if (isProjectMode) {
        window.location.href = fallback;
      } else {
        const detailUrl = `/quote-detail.html?id=${encodeURIComponent(savedQuote.id)}`;
        window.location.href = window.AppReturn ? window.AppReturn.withReturn(detailUrl, fallback) : detailUrl;
      }
    } catch (error) {
      window.AppUtils.showMessage("quote-message", error.message, "error");
    }
  });
}

bootstrap().catch((error) => {
  window.AppUtils.showMessage("quote-message", error.message || "报价页面初始化失败，请稍后重试。", "error");
});











