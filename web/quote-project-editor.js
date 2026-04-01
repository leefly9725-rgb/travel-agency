window.ProjectEditor = (function () {
  let containerEl = null;
  let currencyCode = "EUR";
  let viewMode = "internal";
  let groupSeed = 0;
  let itemSeed = 0;
  let groupTypeCache = null;
  let itemTypeCache = null;
  let masterDataPromise = null;
  let quotationActionHandler = null;
  const COLUMN_WIDTH_STORAGE_KEY = "project_quote_editor_column_widths";
  const COLUMN_CONFIG = {
    type: { className: "proj-col-type", defaultWidth: 132, minWidth: 120 },
    name: { className: "proj-col-name", defaultWidth: 180, minWidth: 160, resizable: true, multiline: true, maxHeight: 88 },
    spec: { className: "proj-col-spec", defaultWidth: 172, minWidth: 148, resizable: true, multiline: true, maxHeight: 88 },
    unit: { className: "proj-col-unit", defaultWidth: 72, minWidth: 68 },
    qty: { className: "proj-col-qty", defaultWidth: 96, minWidth: 90 },
    costUnit: { className: "proj-col-cost-unit", defaultWidth: 112, minWidth: 108 },
    salesUnit: { className: "proj-col-sales-unit", defaultWidth: 112, minWidth: 108 },
    remarks: { className: "proj-col-remarks", defaultWidth: 248, minWidth: 188, resizable: true, multiline: true, maxHeight: 104 },
    costSubtotal: { className: "proj-col-cost-subtotal", defaultWidth: 128, minWidth: 118, resizable: true },
    salesSubtotal: { className: "proj-col-sales-subtotal", defaultWidth: 128, minWidth: 118, resizable: true },
    margin: { className: "proj-col-margin", defaultWidth: 92, minWidth: 84 },
    actions: { className: "proj-col-actions", defaultWidth: 144, minWidth: 144, fixed: true },
  };
  let columnWidths = {};
  let activeResizeState = null;
  let supplierCatalogCache = null;
  let supplierCatalogPromise = null;
  let serviceSuggestionRequestSeq = 0;
  let serviceSuggestionState = {
    rowEl: null,
    inputEl: null,
    boxEl: null,
    items: [],
    activeIndex: -1,
  };
  let serviceSuggestionHandlersBound = false;

  const DEFAULT_GROUP_TYPES = [
    { code: "event", nameZh: "活动服务", isActive: true, sortOrder: 1 },
    { code: "travel", nameZh: "旅游接待", isActive: true, sortOrder: 2 },
    { code: "mixed", nameZh: "综合服务", isActive: true, sortOrder: 3 },
  ];

  const DEFAULT_ITEM_TYPES = [
    { code: "hotel", nameZh: "酒店", isActive: true, sortOrder: 1, projectGroupCodes: ["travel", "mixed"], defaultUnit: "间", supplierCategoryCodes: [] },
    { code: "transport", nameZh: "用车", isActive: true, sortOrder: 2, projectGroupCodes: ["travel", "mixed"], defaultUnit: "辆", supplierCategoryCodes: [] },
    { code: "guide_translation", nameZh: "导游/翻译", isActive: true, sortOrder: 3, projectGroupCodes: ["travel", "mixed"], defaultUnit: "人天", supplierCategoryCodes: [] },
    { code: "driver_guide", nameZh: "司兼导", isActive: true, sortOrder: 4, projectGroupCodes: ["travel", "mixed"], defaultUnit: "人天", supplierCategoryCodes: [] },
    { code: "ticket", nameZh: "门票", isActive: true, sortOrder: 5, projectGroupCodes: ["travel", "mixed"], defaultUnit: "张", supplierCategoryCodes: [] },
    { code: "fuel", nameZh: "油费", isActive: true, sortOrder: 6, projectGroupCodes: ["travel", "mixed"], defaultUnit: "次", supplierCategoryCodes: [] },
    { code: "toll_parking", nameZh: "过路/停车", isActive: true, sortOrder: 7, projectGroupCodes: ["travel", "mixed"], defaultUnit: "次", supplierCategoryCodes: [] },
    { code: "venue_service", nameZh: "场地服务", isActive: true, sortOrder: 8, projectGroupCodes: ["event", "mixed"], defaultUnit: "项", supplierCategoryCodes: [] },
    { code: "build_production", nameZh: "搭建制作", isActive: true, sortOrder: 9, projectGroupCodes: ["event", "mixed"], defaultUnit: "项", supplierCategoryCodes: [] },
    { code: "av_lighting", nameZh: "AV / 灯光音响", isActive: true, sortOrder: 10, projectGroupCodes: ["event", "mixed"], defaultUnit: "套", supplierCategoryCodes: [] },
    { code: "design_print", nameZh: "设计印刷", isActive: true, sortOrder: 11, projectGroupCodes: ["event", "mixed"], defaultUnit: "项", supplierCategoryCodes: [] },
    { code: "staffing_execution", nameZh: "人员执行", isActive: true, sortOrder: 12, projectGroupCodes: ["event", "mixed"], defaultUnit: "人天", supplierCategoryCodes: [] },
    { code: "catering_refreshments", nameZh: "餐饮茶歇", isActive: true, sortOrder: 13, projectGroupCodes: ["event", "mixed"], defaultUnit: "人次", supplierCategoryCodes: [] },
    { code: "logistics_transport", nameZh: "物流运输", isActive: true, sortOrder: 14, projectGroupCodes: ["event", "mixed"], defaultUnit: "项", supplierCategoryCodes: [] },
    { code: "material_purchase", nameZh: "物料采购", isActive: true, sortOrder: 15, projectGroupCodes: ["event", "mixed"], defaultUnit: "项", supplierCategoryCodes: [] },
    { code: "misc", nameZh: "杂项", isActive: true, sortOrder: 16, projectGroupCodes: ["travel", "event", "mixed"], defaultUnit: "项", supplierCategoryCodes: [] },
  ];

  const LEGACY_ITEM_LABELS = {
    catalog_item: "场地服务",
    av_equipment: "AV / 灯光音响",
    print_display: "设计印刷",
    decoration: "搭建制作",
    personnel: "人员执行",
    logistics: "物流运输",
    event_material: "物料采购",
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function nextGroupId() {
    groupSeed += 1;
    return "group-" + groupSeed;
  }

  function nextItemId() {
    itemSeed += 1;
    return "item-" + itemSeed;
  }

  function asArray(value) {
    return Array.isArray(value) ? value : (value ? [value] : []);
  }

  function normalizeCodeList(value) {
    return asArray(value).map((entry) => String(entry || "").trim().toLowerCase()).filter(Boolean);
  }

  function sortByOrder(list) {
    return [...list].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }

  function normalizeGroupType(record, fallback) {
    const base = fallback || {};
    const code = String(record?.code || base.code || "").trim().toLowerCase();
    if (!code) return null;
    return {
      id: record?.id || base.id || null,
      code,
      nameZh: code === "mixed"
        ? "综合服务"
        : String(record?.nameZh || record?.name_zh || base.nameZh || code).trim(),
      isActive: record?.isActive !== undefined
        ? Boolean(record.isActive)
        : (record?.is_active !== undefined ? Boolean(record.is_active) : (base.isActive !== undefined ? Boolean(base.isActive) : true)),
      sortOrder: Number(record?.sortOrder ?? record?.sort_order ?? base.sortOrder ?? 0),
    };
  }

  function normalizeItemType(record, fallback) {
    const base = fallback || {};
    const code = String(record?.code || base.code || "").trim().toLowerCase();
    if (!code) return null;
    const groups = normalizeCodeList(record?.projectGroupCodes || record?.project_group_codes || base.projectGroupCodes || ["mixed"]);
    return {
      code,
      nameZh: String(record?.nameZh || record?.name_zh || base.nameZh || LEGACY_ITEM_LABELS[code] || code).trim(),
      isActive: record?.isActive !== undefined
        ? Boolean(record.isActive)
        : (record?.is_active !== undefined ? Boolean(record.is_active) : (base.isActive !== undefined ? Boolean(base.isActive) : true)),
      sortOrder: Number(record?.sortOrder ?? record?.sort_order ?? base.sortOrder ?? 0),
      projectGroupCodes: groups.length > 0 ? groups : ["mixed"],
      defaultUnit: String(record?.defaultUnit || record?.default_unit || base.defaultUnit || "项").trim() || "项",
      supplierCategoryCodes: normalizeCodeList(record?.supplierCategoryCodes || record?.supplier_category_codes || base.supplierCategoryCodes || []),
    };
  }

  async function loadProjectGroupTypes() {
    if (groupTypeCache) return groupTypeCache;
    try {
      const result = await window.AppUtils.fetchJson("/api/project-group-types", null, "加载项目组分类失败");
      const remoteList = Array.isArray(result) ? result : asArray(result?.items || result?.projectGroupTypes);
      if (remoteList.length > 0) {
        groupTypeCache = sortByOrder(remoteList.map((item) => normalizeGroupType(item)).filter(Boolean));
      } else {
        groupTypeCache = sortByOrder(DEFAULT_GROUP_TYPES.map((item) => normalizeGroupType(item)).filter(Boolean));
      }
    } catch (_) {
      groupTypeCache = sortByOrder(DEFAULT_GROUP_TYPES.map((item) => normalizeGroupType(item)).filter(Boolean));
    }
    return groupTypeCache;
  }

  function resolveProjectGroupId(uuid) {
    if (!uuid || !groupTypeCache) return null;
    const found = groupTypeCache.find((g) => g.id && g.id === uuid);
    return found ? found.code : null;
  }

  async function loadItemTypes() {
    if (itemTypeCache) return itemTypeCache;
    try {
      // Load group types first so resolveProjectGroupId can map UUID → code
      const groups = await loadProjectGroupTypes();
      void groups; // groupTypeCache is now populated

      const result = await window.AppUtils.fetchJson("/api/quote-item-types", null, "加载服务类型失败");
      const remoteList = Array.isArray(result) ? result : asArray(result?.items || result?.types);

      if (remoteList.length > 0) {
        // Primary path: use remote data as-is; resolve project_group_id UUID → projectGroupCodes
        const converted = remoteList.map((item) => {
          const pgId = item.project_group_id || item.projectGroupId;
          const pgCode = pgId ? resolveProjectGroupId(pgId) : null;
          const enriched = pgCode ? { ...item, projectGroupCodes: [pgCode] } : item;
          return normalizeItemType(enriched);
        }).filter(Boolean);
        itemTypeCache = sortByOrder(converted.filter((item) => item.isActive !== false));
      } else {
        // Fallback: remote returned nothing, use hardcoded defaults
        itemTypeCache = sortByOrder(DEFAULT_ITEM_TYPES.map((item) => normalizeItemType(item)).filter(Boolean));
      }
    } catch (_) {
      itemTypeCache = sortByOrder(DEFAULT_ITEM_TYPES.map((item) => normalizeItemType(item)).filter(Boolean));
    }
    return itemTypeCache;
  }

  function ensureMasterDataLoaded() {
    if (!masterDataPromise) {
      masterDataPromise = Promise.all([loadProjectGroupTypes(), loadItemTypes()]);
    }
    return masterDataPromise;
  }

  function getGroupTypeOptions() {
    return groupTypeCache || DEFAULT_GROUP_TYPES;
  }

  function getAllowedItemTypes(groupType) {
    const normalizedGroupType = String(groupType || "travel").trim().toLowerCase();
    const source = itemTypeCache || [];
    const filtered = source.filter((item) => {
      const groups = normalizeCodeList(item.projectGroupCodes);
      return normalizedGroupType === "mixed" || groups.length === 0 || groups.includes(normalizedGroupType) || groups.includes("mixed");
    });
    return sortByOrder(filtered);
  }

  function formatMoney(value) {
    if (window.AppUtils?.formatCurrency) {
      return window.AppUtils.formatCurrency(Number(value) || 0, currencyCode);
    }
    return `${currencyCode} ${(Number(value) || 0).toFixed(2)}`;
  }

  function autoSizeField(textarea, options = {}) {
    if (!textarea) return;
    const minHeight = Number(options.minHeight || 28);
    const maxHeight = Number(options.maxHeight || 72);
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${Math.max(nextHeight, minHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  function autoSizeRemarks(textarea) {
    autoSizeField(textarea, { minHeight: 28, maxHeight: 72 });
  }

  function autoSizeTextCell(textarea) {
    const field = textarea?.dataset?.autosizeField || "itemName";
    const maxHeight = field === "remarks" ? 104 : 88;
    autoSizeField(textarea, { minHeight: 32, maxHeight });
  }

  function getDefaultColumnWidths() {
    return Object.fromEntries(Object.entries(COLUMN_CONFIG).map(([key, config]) => [key, config.defaultWidth]));
  }

  function clampColumnWidth(key, value) {
    const config = COLUMN_CONFIG[key];
    if (!config) return Number(value) || 0;
    return Math.max(config.minWidth || config.defaultWidth, Math.round(Number(value) || config.defaultWidth));
  }

  function loadColumnWidths() {
    const defaults = getDefaultColumnWidths();
    try {
      const raw = window.localStorage?.getItem(COLUMN_WIDTH_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return defaults;
      return Object.fromEntries(Object.keys(COLUMN_CONFIG).map((key) => [key, clampColumnWidth(key, parsed[key] ?? defaults[key])]));
    } catch (_) {
      return defaults;
    }
  }

  function persistColumnWidths() {
    try {
      window.localStorage?.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(columnWidths));
    } catch (_) {}
  }

  function applyColumnWidths(root = containerEl) {
    if (!root) return;
    Object.entries(COLUMN_CONFIG).forEach(([key, config]) => {
      const width = clampColumnWidth(key, columnWidths[key] ?? config.defaultWidth);
      root.querySelectorAll(`col.${config.className}`).forEach((col) => {
        col.style.width = `${width}px`;
      });
      root.querySelectorAll(`th.${config.className}, td.${config.className}`).forEach((cell) => {
        cell.style.width = `${width}px`;
        cell.style.minWidth = `${config.minWidth || width}px`;
      });
    });
  }

  function setColumnWidth(key, value, options = {}) {
    if (!COLUMN_CONFIG[key]) return;
    columnWidths[key] = clampColumnWidth(key, value);
    applyColumnWidths();
    if (options.persist !== false) persistColumnWidths();
  }

  function resetColumnWidths() {
    columnWidths = getDefaultColumnWidths();
    try {
      window.localStorage?.removeItem(COLUMN_WIDTH_STORAGE_KEY);
    } catch (_) {}
    applyColumnWidths();
  }

  function renderColumnHeader(key, label, options = {}) {
    const config = COLUMN_CONFIG[key];
    const extraClasses = options.classes ? ` ${options.classes}` : "";
    if (!config?.resizable) {
      return `<th class="${config.className}${extraClasses}" data-col-key="${key}">${label}</th>`;
    }
    return `<th class="${config.className}${extraClasses}" data-col-key="${key}"><div class="proj-col-head"><span>${label}</span><button type="button" class="proj-col-resizer" data-col-key="${key}" aria-label="调整${label}列宽"></button></div></th>`;
  }

  function stopColumnResize() {
    if (!activeResizeState) return;
    activeResizeState = null;
    document.body.classList.remove("proj-column-resizing");
    window.removeEventListener("pointermove", handleColumnResizeMove);
    window.removeEventListener("pointerup", stopColumnResize);
    persistColumnWidths();
  }

  function handleColumnResizeMove(event) {
    if (!activeResizeState) return;
    event.preventDefault();
    const delta = event.clientX - activeResizeState.startX;
    setColumnWidth(activeResizeState.key, activeResizeState.startWidth + delta, { persist: false });
  }

  function beginColumnResize(event) {
    const key = event.currentTarget?.dataset?.colKey;
    if (!key || !COLUMN_CONFIG[key]?.resizable) return;
    event.preventDefault();
    event.stopPropagation();
    activeResizeState = {
      key,
      startX: event.clientX,
      startWidth: clampColumnWidth(key, columnWidths[key] ?? COLUMN_CONFIG[key].defaultWidth),
    };
    document.body.classList.add("proj-column-resizing");
    window.addEventListener("pointermove", handleColumnResizeMove);
    window.addEventListener("pointerup", stopColumnResize);
  }

  function bindColumnResizeHandles(scope = containerEl) {
    if (!scope) return;
    scope.querySelectorAll(".proj-col-resizer").forEach((handle) => {
      if (handle.dataset.bound === "1") return;
      handle.dataset.bound = "1";
      handle.addEventListener("pointerdown", beginColumnResize);
    });
  }

  function applyViewMode() {
    if (!containerEl) return;
    const hidden = viewMode === "client";
    containerEl.querySelectorAll(".view-internal").forEach((el) => {
      el.style.display = hidden ? "none" : "";
    });
  }

  function createEmptyItem(groupType) {
    const allowed = getAllowedItemTypes(groupType);
    const first = allowed[0] || null;
    return {
      _id: nextItemId(),
      itemType: first?.code || "",
      itemName: "",
      specification: "",
      unit: first?.defaultUnit || "项",
      quantity: 1,
      costUnitPrice: 0,
      salesUnitPrice: 0,
      remarks: "",
      supplierDisplay: "",
      supplierId: "",
      supplierCatalogItemId: "",
    };
  }

  function refreshGroupTotals(groupEl) {
    let totalCost = 0;
    let totalSales = 0;
    groupEl.querySelectorAll("tbody tr[data-item-id]").forEach((row) => {
      const qty = Number(row.querySelector("[name='quantity']")?.value || 0);
      const cost = Number(row.querySelector("[name='costUnitPrice']")?.value || 0);
      const sales = Number(row.querySelector("[name='salesUnitPrice']")?.value || 0);
      totalCost += qty * cost;
      totalSales += qty * sales;
      const costSubtotal = qty * cost;
      const salesSubtotal = qty * sales;
      const margin = salesSubtotal > 0 ? (((salesSubtotal - costSubtotal) / salesSubtotal) * 100).toFixed(1) + "%" : "—";
      row.querySelector("[data-field='costSubtotal']").textContent = costSubtotal > 0 ? formatMoney(costSubtotal) : "—";
      row.querySelector("[data-field='salesSubtotal']").textContent = salesSubtotal > 0 ? formatMoney(salesSubtotal) : "—";
      row.querySelector("[data-field='margin']").textContent = margin;
    });
    const totalProfit = totalSales - totalCost;
    groupEl.querySelector(".group-cost-total").textContent = formatMoney(totalCost);
    groupEl.querySelector(".group-sales-total").textContent = formatMoney(totalSales);
    groupEl.querySelector(".group-profit-total").textContent = formatMoney(totalProfit);
    const badge = groupEl.querySelector(".proj-group-badge");
    if (badge) badge.textContent = totalSales > 0 ? `销售 ${formatMoney(totalSales)}` : "";
  }

  function refreshSummary() {
    if (!containerEl) return;
    let totalCost = 0;
    let totalSales = 0;
    containerEl.querySelectorAll(".project-group").forEach((groupEl) => {
      groupEl.querySelectorAll("tbody tr[data-item-id]").forEach((row) => {
        const qty = Number(row.querySelector("[name='quantity']")?.value || 0);
        const cost = Number(row.querySelector("[name='costUnitPrice']")?.value || 0);
        const sales = Number(row.querySelector("[name='salesUnitPrice']")?.value || 0);
        totalCost += qty * cost;
        totalSales += qty * sales;
      });
    });
    const totalProfit = totalSales - totalCost;
    const margin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) + "%" : "0.0%";
    const byId = (id) => containerEl.querySelector("#" + id);
    if (byId("proj-sum-cost")) byId("proj-sum-cost").textContent = formatMoney(totalCost);
    if (byId("proj-sum-sales")) byId("proj-sum-sales").textContent = formatMoney(totalSales);
    if (byId("proj-sum-profit")) byId("proj-sum-profit").textContent = formatMoney(totalProfit);
    if (byId("proj-sum-margin")) byId("proj-sum-margin").textContent = margin;
  }

  function syncRowUnit(rowEl) {
    const typeCode = rowEl.querySelector("[name='itemType']")?.value || "misc";
    const itemType = (itemTypeCache || []).find((item) => item.code === typeCode);
    const unitInput = rowEl.querySelector("[name='unit']");
    if (!unitInput) return;
    const systemUnit = itemType?.defaultUnit || "项";
    if (!unitInput.value || unitInput.value === unitInput.dataset.systemUnit) {
      unitInput.value = systemUnit;
    }
    unitInput.dataset.systemUnit = systemUnit;
  }

  const CATALOG_CATEGORY_LABELS = {
    av_equipment:    'AV设备',
    stage_structure: '舞台搭建',
    print_display:   '印刷展示',
    decoration:      '装饰物料',
    furniture:       '家具桌椅',
    personnel:       '人员服务',
    logistics:       '物流运输',
    management:      '管理费用',
  };


  function getCatalogCategoryLabel(category) {
    if (!category) return "\u672a\u5206\u7c7b";
    return CATALOG_CATEGORY_LABELS[category] || category;
  }

  function normalizeCatalogItem(rawItem) {
    return {
      id: rawItem?.id || "",
      supplierId: rawItem?.supplierId || rawItem?.supplier_id || "",
      supplierName: rawItem?.supplierName || rawItem?.supplier_name || rawItem?.supplierDisplay || "",
      category: String(rawItem?.category || rawItem?.supplierCategory || rawItem?.supplier_category || "").trim(),
      nameZh: String(rawItem?.nameZh || rawItem?.name_zh || rawItem?.itemName || "").trim(),
      spec: String(rawItem?.spec || rawItem?.specification || "").trim(),
      unit: String(rawItem?.unit || "").trim(),
      costPrice: rawItem?.costPrice ?? rawItem?.cost_price ?? rawItem?.costUnitPrice ?? null,
    };
  }

  function applyCatalogItemToRow(rowEl, item) {
    const nameInput = rowEl.querySelector('[name="itemName"]');
    const specInput = rowEl.querySelector('[name="specification"]');
    const unitInput = rowEl.querySelector('[name="unit"]');
    const costInput = rowEl.querySelector('[name="costUnitPrice"]');
    const supplierIdInput = rowEl.querySelector('[name="supplierId"]');
    const supplierCatalogItemIdInput = rowEl.querySelector('[name="supplierCatalogItemId"]');
    const supplierDisplayInput = rowEl.querySelector('[name="supplierDisplay"], [name="supplierName"]');
    const supplierDisplay = item.supplierName || item.supplierId || "";

    if (nameInput) nameInput.value = item.nameZh || "";
    if (specInput) specInput.value = item.spec || "";
    if (unitInput) {
      unitInput.value = item.unit || "";
      unitInput.dataset.systemUnit = item.unit || "";
    }
    if (costInput) {
      costInput.value = item.costPrice != null && item.costPrice !== "" ? Number(item.costPrice) : "";
    }
    if (supplierIdInput) supplierIdInput.value = item.supplierId || "";
    if (supplierCatalogItemIdInput) supplierCatalogItemIdInput.value = item.id || "";
    if (supplierDisplayInput) supplierDisplayInput.value = supplierDisplay;

    rowEl.dataset.supplierId = item.supplierId || "";
    rowEl.dataset.supplierCatalogItemId = item.id || "";
    rowEl.dataset.supplierDisplay = supplierDisplay;
  }

  function ensureSupplierCatalogLoaded() {
    if (supplierCatalogCache) return Promise.resolve(supplierCatalogCache);
    if (!supplierCatalogPromise) {
      supplierCatalogPromise = window.AppUtils.fetchJson('/api/supplier-items', null, '\u52a0\u8f7d\u4f9b\u5e94\u5546\u76ee\u5f55\u5931\u8d25')
        .then((data) => {
          supplierCatalogCache = (Array.isArray(data) ? data : (data.items || []))
            .map(normalizeCatalogItem)
            .filter((item) => item.nameZh);
          return supplierCatalogCache;
        })
        .catch((error) => {
          supplierCatalogPromise = null;
          throw error;
        });
    }
    return supplierCatalogPromise;
  }

  function getRowItemTypeMeta(rowEl) {
    const typeCode = String(rowEl?.querySelector('[name="itemType"]')?.value || "misc").trim().toLowerCase();
    return (itemTypeCache || []).find((item) => item.code === typeCode) || null;
  }

  function getRowSupplierCategoryCodes(rowEl) {
    return normalizeCodeList(getRowItemTypeMeta(rowEl)?.supplierCategoryCodes || []);
  }

  function buildCatalogSearchText(item) {
    return [item.nameZh, item.spec, item.supplierName, item.category].filter(Boolean).join(" ").toLowerCase();
  }

  function scoreCatalogSuggestion(item, keyword, preferredCategories) {
    const normalizedKeyword = String(keyword || "").trim().toLowerCase();
    if (!normalizedKeyword) return null;
    const name = String(item.nameZh || "").toLowerCase();
    const spec = String(item.spec || "").toLowerCase();
    const supplierName = String(item.supplierName || "").toLowerCase();
    const category = String(item.category || "").toLowerCase();
    const searchText = buildCatalogSearchText(item);
    if (!searchText.includes(normalizedKeyword)) return null;
    let score = 0;
    if (name.startsWith(normalizedKeyword)) score += 120;
    else if (name.includes(normalizedKeyword)) score += 80;
    if (spec.includes(normalizedKeyword)) score += 30;
    if (supplierName.includes(normalizedKeyword)) score += 16;
    if (category.includes(normalizedKeyword)) score += 12;
    if (preferredCategories.includes(category)) score += 36;
    return score;
  }

  async function findCatalogSuggestions(rowEl, keyword) {
    const allItems = await ensureSupplierCatalogLoaded();
    const preferredCategories = getRowSupplierCategoryCodes(rowEl);
    return allItems
      .map((item) => ({ item, score: scoreCatalogSuggestion(item, keyword, preferredCategories) }))
      .filter((entry) => entry.score !== null)
      .sort((a, b) => b.score - a.score || String(a.item.nameZh || "").localeCompare(String(b.item.nameZh || ""), "zh-Hans-CN"))
      .slice(0, 8)
      .map((entry) => entry.item);
  }

  function getServiceSuggestionBox(rowEl) {
    return rowEl?.querySelector('.service-suggestion-box') || null;
  }

  function closeServiceSuggestions() {
    if (serviceSuggestionState.rowEl) {
      serviceSuggestionState.rowEl.classList.remove("service-suggestion-open");
    }
    const boxEl = serviceSuggestionState.boxEl || getServiceSuggestionBox(serviceSuggestionState.rowEl);
    if (boxEl) {
      boxEl.hidden = true;
      boxEl.innerHTML = "";
    }
    serviceSuggestionState = { rowEl: null, inputEl: null, boxEl: null, items: [], activeIndex: -1 };
  }

  function setActiveServiceSuggestion(index) {
    const boxEl = serviceSuggestionState.boxEl;
    const items = boxEl ? Array.from(boxEl.querySelectorAll('.service-suggestion-item')) : [];
    if (!items.length) {
      serviceSuggestionState.activeIndex = -1;
      return;
    }
    const nextIndex = Math.max(0, Math.min(index, items.length - 1));
    serviceSuggestionState.activeIndex = nextIndex;
    items.forEach((itemEl, itemIndex) => {
      const isActive = itemIndex === nextIndex;
      itemEl.classList.toggle('active', isActive);
      itemEl.setAttribute('aria-selected', isActive ? "true" : "false");
      if (isActive) itemEl.scrollIntoView({ block: "nearest" });
    });
  }

  function applySuggestionToRow(rowEl, item, inputEl) {
    if (!rowEl || !item) return;
    applyCatalogItemToRow(rowEl, item);
    rowEl.querySelectorAll('.proj-cell-textarea').forEach(autoSizeTextCell);
    closeServiceSuggestions();
    refreshGroupTotals(rowEl.closest('.project-group'));
    refreshSummary();
    if (inputEl) {
      inputEl.focus();
      if (typeof inputEl.setSelectionRange === "function") {
        const end = inputEl.value.length;
        inputEl.setSelectionRange(end, end);
      }
    }
  }

  function renderServiceSuggestions(rowEl, inputEl, items) {
    const boxEl = getServiceSuggestionBox(rowEl);
    if (!boxEl) return;
    if (!items.length) {
      closeServiceSuggestions();
      return;
    }
    if (serviceSuggestionState.rowEl && serviceSuggestionState.rowEl !== rowEl) {
      serviceSuggestionState.rowEl.classList.remove("service-suggestion-open");
    }
    serviceSuggestionState = { rowEl, inputEl, boxEl, items, activeIndex: -1 };
    rowEl.classList.add("service-suggestion-open");
    boxEl.hidden = false;
    boxEl.style.minWidth = Math.ceil(inputEl?.getBoundingClientRect?.().width || inputEl?.offsetWidth || 0) + "px";
    boxEl.innerHTML = items.map((item, index) => {
      const nameLabel = escapeHtml(item.nameZh || "\u672a\u547d\u540d\u670d\u52a1");
      const supplierLabel = escapeHtml(item.supplierName || item.supplierId || "-");
      const specLabel = escapeHtml(item.spec || "\u65e0\u89c4\u683c\u8bf4\u660e");
      const categoryLabel = escapeHtml(getCatalogCategoryLabel(item.category || ""));
      const unitLabel = escapeHtml(item.unit || "-");
      const priceLabel = item.costPrice != null && item.costPrice !== "" ? formatMoney(item.costPrice) : "-";
      const metaParts = [categoryLabel, supplierLabel].filter((part) => part && part !== "-");
      const metaLabel = metaParts.length ? metaParts.join(" \u00b7 ") : "\u672a\u914d\u7f6e\u4f9b\u5e94\u5546";
      return [
        "<button type=\"button\" class=\"service-suggestion-item\" data-index=\"" + index + "\" aria-selected=\"false\">",
        "<span class=\"service-suggestion-main\">",
        "<strong title=\"" + nameLabel + "\">" + nameLabel + "</strong>",
        "<span class=\"service-suggestion-sub\" title=\"" + specLabel + "\">" + specLabel + "</span>",
        "<span class=\"service-suggestion-meta\" title=\"" + metaLabel + "\">" + metaLabel + "</span>",
        "</span>",
        "<span class=\"service-suggestion-unit\" title=\"" + unitLabel + "\">" + unitLabel + "</span>",
        "<span class=\"service-suggestion-price\" title=\"" + priceLabel + "\">" + priceLabel + "</span>",
        "</button>"
      ].join("");
    }).join("");
    boxEl.querySelectorAll('.service-suggestion-item').forEach((itemEl) => {
      itemEl.addEventListener("mousedown", (event) => event.preventDefault());
      itemEl.addEventListener("click", () => {
        const index = Number(itemEl.dataset.index || -1);
        applySuggestionToRow(rowEl, items[index], inputEl);
      });
    });
  }

  async function updateServiceSuggestions(rowEl, inputEl) {
    const keyword = String(inputEl?.value || "").trim();
    if (!keyword) {
      if (serviceSuggestionState.rowEl === rowEl) closeServiceSuggestions();
      return;
    }
    const requestSeq = ++serviceSuggestionRequestSeq;
    try {
      const items = await findCatalogSuggestions(rowEl, keyword);
      if (requestSeq !== serviceSuggestionRequestSeq) return;
      if (!document.body.contains(inputEl) || String(inputEl.value || "").trim() !== keyword) return;
      renderServiceSuggestions(rowEl, inputEl, items);
    } catch (_) {
      if (serviceSuggestionState.rowEl === rowEl) closeServiceSuggestions();
    }
  }

  function handleServiceNameKeydown(event, rowEl, inputEl) {
    const isActiveRow = serviceSuggestionState.rowEl === rowEl;
    const hasSuggestions = isActiveRow && serviceSuggestionState.items.length > 0;
    if (event.key === "Escape") {
      if (isActiveRow) {
        event.preventDefault();
        closeServiceSuggestions();
      }
      return;
    }
    if (!hasSuggestions) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = serviceSuggestionState.activeIndex + 1 >= serviceSuggestionState.items.length ? 0 : serviceSuggestionState.activeIndex + 1;
      setActiveServiceSuggestion(nextIndex);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = serviceSuggestionState.activeIndex <= 0 ? serviceSuggestionState.items.length - 1 : serviceSuggestionState.activeIndex - 1;
      setActiveServiceSuggestion(nextIndex);
      return;
    }
    if (event.key === "Enter" && serviceSuggestionState.activeIndex >= 0) {
      event.preventDefault();
      applySuggestionToRow(rowEl, serviceSuggestionState.items[serviceSuggestionState.activeIndex], inputEl);
    }
  }

  function bindServiceSuggestionGlobalEvents() {
    if (serviceSuggestionHandlersBound) return;
    serviceSuggestionHandlersBound = true;
    document.addEventListener("mousedown", (event) => {
      const target = event.target;
      if (!serviceSuggestionState.rowEl) return;
      if (serviceSuggestionState.rowEl.contains(target)) return;
      closeServiceSuggestions();
    }, true);
  }

  function openCatalogPicker(rowEl) {
    const overlay = document.createElement('div');
    overlay.className = 'catalog-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'catalog-modal';
    modal.innerHTML = `
      <div class="catalog-modal-header">
        <h3>\u4ece\u4f9b\u5e94\u5546\u76ee\u5f55\u9009\u62e9</h3>
        <div class="catalog-header-spacer"></div>
        <button type="button" id="catalog-close-btn" class="catalog-close-btn" aria-label="\u5173\u95ed">\u00d7</button>
      </div>
      <div class="catalog-modal-body">
        <aside class="catalog-sidebar" id="catalog-sidebar">
          <div class="catalog-empty catalog-empty-sidebar">\u52a0\u8f7d\u4e2d...</div>
        </aside>
        <section class="catalog-main">
          <div class="catalog-main-toolbar">
            <input id="catalog-search" class="catalog-modal-search" type="text" placeholder="\u641c\u7d22\u7269\u6599\u540d\u79f0..." />
            <div id="catalog-toolbar-summary" class="catalog-toolbar-summary"></div>
          </div>
          <div class="catalog-list-header">
            <div>\u4f9b\u5e94\u5546</div>
            <div>\u7269\u6599\u540d\u79f0</div>
            <div>\u89c4\u683c</div>
            <div>\u5355\u4f4d</div>
            <div>\u6210\u672c\u4ef7</div>
            <div>\u9009\u7528</div>
          </div>
          <div id="catalog-list" class="catalog-list-wrap">
            <div class="catalog-empty">\u52a0\u8f7d\u4e2d...</div>
          </div>
        </section>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const sidebarEl = modal.querySelector('#catalog-sidebar');
    const searchEl = modal.querySelector('#catalog-search');
    const listEl = modal.querySelector('#catalog-list');
    const summaryEl = modal.querySelector('#catalog-toolbar-summary');
    let allItems = [];
    let activeCategory = '';

    const closeModal = () => {
      document.removeEventListener('keydown', onKeydown);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    const onKeydown = (event) => {
      if (event.key === 'Escape') closeModal();
    };

    function getFilteredItems() {
      const keyword = searchEl.value.trim().toLowerCase();
      return allItems.filter((item) => {
        const inCategory = !activeCategory || item.category === activeCategory;
        const searchText = [item.nameZh, item.spec, item.supplierName, item.supplierId]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const matchesKeyword = !keyword || searchText.includes(keyword);
        return inCategory && matchesKeyword;
      });
    }

    function renderCategories() {
      const categories = Array.from(new Set(allItems.map((item) => item.category).filter(Boolean)))
        .sort((a, b) => getCatalogCategoryLabel(a).localeCompare(getCatalogCategoryLabel(b), 'zh-Hans-CN'));
      const defs = [
        { value: '', label: '\u5168\u90e8\u7c7b\u522b', count: allItems.length },
        ...categories.map((category) => ({
          value: category,
          label: getCatalogCategoryLabel(category),
          count: allItems.filter((item) => item.category === category).length,
        })),
      ];

      sidebarEl.innerHTML = defs.map((category) => `
        <button type="button" class="catalog-cat-btn${category.value === activeCategory ? ' active' : ''}" data-category="${escapeHtml(category.value)}">
          <span class="catalog-cat-label">${escapeHtml(category.label)}</span>
          <span class="catalog-cat-count">${category.count}</span>
        </button>
      `).join('');

      sidebarEl.querySelectorAll('.catalog-cat-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeCategory = btn.dataset.category || '';
          renderCategories();
          renderList(getFilteredItems());
        });
      });
    }

    function renderList(items) {
      const currentLabel = activeCategory ? getCatalogCategoryLabel(activeCategory) : '\u5168\u90e8\u7c7b\u522b';
      summaryEl.textContent = `${currentLabel} | ${items.length} \u6761`;

      if (!items.length) {
        listEl.innerHTML = '<div class="catalog-empty">\u6682\u65e0\u5339\u914d\u8bb0\u5f55</div>';
        return;
      }

      listEl.innerHTML = items.map((item) => `
        <div class="catalog-item-row" data-item-id="${escapeHtml(String(item.id || ''))}">
          <div class="catalog-item-supplier" title="${escapeHtml(item.supplierName || item.supplierId || '-')}">${escapeHtml(item.supplierName || item.supplierId || '-')}</div>
          <div class="catalog-col-name">
            <div class="catalog-item-name-main">${escapeHtml(item.nameZh || '')}</div>
            <div class="catalog-item-meta">${escapeHtml(getCatalogCategoryLabel(item.category || ''))}</div>
          </div>
          <div class="catalog-item-meta" title="${escapeHtml(item.spec || '-')}">${escapeHtml(item.spec || '-')}</div>
          <div class="catalog-item-unit">${escapeHtml(item.unit || '-')}</div>
          <div class="catalog-item-price">${item.costPrice != null && item.costPrice !== '' ? formatMoney(item.costPrice) : '-'}</div>
          <div class="catalog-col-actions">
            <button type="button" class="catalog-select-btn catalog-pick-row">\u9009\u7528</button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('.catalog-pick-row').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rowData = btn.closest('.catalog-item-row');
          const itemId = rowData?.dataset.itemId;
          const item = allItems.find((entry) => String(entry.id) === String(itemId));
          if (!item) return;
          applyCatalogItemToRow(rowEl, item);
          closeModal();
          refreshGroupTotals(rowEl.closest('.project-group'));
          refreshSummary();
        });
      });
    }

    function applyFilter() {
      renderList(getFilteredItems());
    }

    document.addEventListener('keydown', onKeydown);
    modal.querySelector('#catalog-close-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal();
    });
    searchEl.addEventListener('input', applyFilter);

    ensureSupplierCatalogLoaded()
      .then((items) => {
        allItems = items;
        renderCategories();
        applyFilter();
      })
      .catch(() => {
        sidebarEl.innerHTML = '<div class="catalog-empty catalog-empty-sidebar">\u52a0\u8f7d\u5931\u8d25</div>';
        listEl.innerHTML = '<div class="catalog-empty">\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5</div>';
        summaryEl.textContent = '';
      });
  }
  function bindRowEvents(rowEl, groupEl) {
    const nameInput = rowEl.querySelector('[name="itemName"]');

    rowEl.querySelectorAll("input, select, textarea").forEach((field) => {
      field.addEventListener("input", () => {
        if (["itemName", "specification", "remarks"].includes(field.name)) autoSizeTextCell(field);
        if (field.name === "itemType") syncRowUnit(rowEl);
        if (field.name === "itemName") updateServiceSuggestions(rowEl, field);
        refreshGroupTotals(groupEl);
        refreshSummary();
      });
      field.addEventListener("change", () => {
        if (field.name === "itemType") {
          syncRowUnit(rowEl);
          if (serviceSuggestionState.rowEl === rowEl && nameInput) updateServiceSuggestions(rowEl, nameInput);
        }
        refreshGroupTotals(groupEl);
        refreshSummary();
      });
    });

    if (nameInput) {
      nameInput.addEventListener("focus", () => updateServiceSuggestions(rowEl, nameInput));
      nameInput.addEventListener("keydown", (event) => handleServiceNameKeydown(event, rowEl, nameInput));
    }

    rowEl.querySelectorAll(".proj-cell-textarea").forEach(autoSizeTextCell);
    rowEl.querySelector(".pick-catalog-btn")?.addEventListener("click", () => {
      closeServiceSuggestions();
      openCatalogPicker(rowEl);
    });
    rowEl.querySelector(".delete-item-btn").addEventListener("click", () => {
      if (serviceSuggestionState.rowEl === rowEl) closeServiceSuggestions();
      rowEl.remove();
      const tbody = groupEl.querySelector(".items-tbody");
      if (!tbody.querySelector("tr[data-item-id]")) {
        tbody.appendChild(renderEmptyRow());
      }
      refreshGroupTotals(groupEl);
      refreshSummary();
    });
  }

  function renderEmptyRow() {
    const tr = document.createElement("tr");
    tr.className = "empty-row";
    tr.innerHTML = '<td colspan="12">暂无明细，点击下方按钮添加。</td>';
    return tr;
  }

  function renderItemRow(itemData, groupType) {
    const allowed = getAllowedItemTypes(groupType);
    const tr = document.createElement("tr");
    const item = { ...createEmptyItem(groupType), ...(itemData || {}) };
    tr.dataset.itemId = item._id || nextItemId();
    tr.dataset.supplierId = item.supplierId || "";
    tr.dataset.supplierCatalogItemId = item.supplierCatalogItemId || "";
    tr.dataset.supplierDisplay = item.supplierDisplay || item.supplierName || "";
    const currentType = String(item.itemType || allowed[0]?.code || "misc").trim().toLowerCase();
    const currentTypeMeta = (itemTypeCache || []).find((entry) => entry.code === currentType);
    const options = [...allowed];
    if (currentType && !options.some((entry) => entry.code === currentType)) {
      if (currentTypeMeta) options.push(currentTypeMeta);
    }
    const unit = item.unit || currentTypeMeta?.defaultUnit || "项";
    tr.innerHTML = `
      <td class="proj-col-type">
        <select class="cell-input item-type-sel proj-cell-input-type" name="itemType">
          ${options.map((entry) => `<option value="${entry.code}"${entry.code === currentType ? " selected" : ""}>${entry.nameZh}</option>`).join("")}
        </select>
      </td>
      <td class="proj-col-name"><div class="service-name-wrap"><textarea class="cell-input proj-cell-textarea proj-cell-textarea-name" name="itemName" rows="1" data-autosize-field="itemName" placeholder="\u670d\u52a1\u540d\u79f0">${escapeHtml(item.itemName || "")}</textarea><div class="service-suggestion-box" hidden></div></div></td>
      <td class="proj-col-spec"><textarea class="cell-input proj-cell-textarea proj-cell-textarea-spec" name="specification" rows="1" data-autosize-field="specification" placeholder="规格 / 说明">${escapeHtml(item.specification || "")}</textarea></td>
      <td class="proj-col-unit"><input class="cell-input proj-cell-input-unit" name="unit" value="${escapeHtml(unit)}" data-system-unit="${escapeHtml(unit)}" placeholder="单位" /></td>
      <td class="proj-col-qty"><input class="cell-input proj-cell-input-number" name="quantity" type="number" min="0" step="0.01" value="${Number(item.quantity || 1)}" /></td>
      <td class="proj-col-cost-unit view-internal"><input class="cell-input proj-cell-input-number" name="costUnitPrice" type="number" min="0" step="0.01" value="${item.costUnitPrice ? Number(item.costUnitPrice) : ""}" placeholder="0.00" /></td>
      <td class="proj-col-sales-unit"><input class="cell-input proj-cell-input-number" name="salesUnitPrice" type="number" min="0" step="0.01" value="${item.salesUnitPrice ? Number(item.salesUnitPrice) : ""}" placeholder="0.00" /></td>
      <td class="proj-col-remarks remarks-cell"><textarea class="cell-input proj-cell-textarea remarks-textarea" name="remarks" rows="1" data-autosize-field="remarks" placeholder="备注">${escapeHtml(item.remarks || "")}</textarea></td>
      <td class="proj-col-cost-subtotal view-internal computed-cell r" data-field="costSubtotal">—</td>
      <td class="proj-col-sales-subtotal computed-cell r" data-field="salesSubtotal">—</td>
      <td class="proj-col-margin view-internal computed-cell r" data-field="margin">—</td>
      <td class="proj-col-actions proj-row-actions"><div class="proj-row-action-stack"><button type="button" class="ghost mini-button proj-row-action-btn pick-catalog-btn">从库选</button><button type="button" class="ghost mini-button proj-row-action-btn delete-item-btn">删除</button></div></td>
    `;
    return tr;
  }

  function rebuildItemTypeOptions(groupEl) {
    const groupType = groupEl.querySelector("[name='projectType']")?.value || "travel";
    const allowed = getAllowedItemTypes(groupType);
    groupEl.querySelectorAll("tbody tr[data-item-id]").forEach((rowEl) => {
      const select = rowEl.querySelector("[name='itemType']");
      if (!select) return;
      const currentValue = String(select.value || "").trim().toLowerCase();
      if (allowed.length === 0) {
        select.innerHTML = '<option value="" disabled selected>— 请在基础数据维护中添加 —</option>';
      } else {
        select.innerHTML = allowed.map((entry) =>
          `<option value="${entry.code}"${entry.code === currentValue ? " selected" : ""}>${entry.nameZh}</option>`
        ).join("");
        if (!allowed.some((entry) => entry.code === currentValue)) {
          select.value = allowed[0].code;
        }
        syncRowUnit(rowEl);
      }
    });
  }

  function extractRowData(rowEl) {
    return {
      _id: rowEl.dataset.itemId || nextItemId(),
      itemType: rowEl.querySelector("[name='itemType']")?.value || "misc",
      itemName: rowEl.querySelector("[name='itemName']")?.value?.trim() || "",
      specification: rowEl.querySelector("[name='specification']")?.value?.trim() || "",
      unit: rowEl.querySelector("[name='unit']")?.value?.trim() || "",
      quantity: Number(rowEl.querySelector("[name='quantity']")?.value || 0),
      costUnitPrice: Number(rowEl.querySelector("[name='costUnitPrice']")?.value || 0),
      salesUnitPrice: Number(rowEl.querySelector("[name='salesUnitPrice']")?.value || 0),
      remarks: rowEl.querySelector("[name='remarks']")?.value || "",
      supplierDisplay: rowEl.querySelector("[name='supplierDisplay'], [name='supplierName']")?.value?.trim()
        || rowEl.dataset.supplierDisplay || "",
      supplierId: rowEl.querySelector("[name='supplierId']")?.value?.trim()
        || rowEl.dataset.supplierId || "",
      supplierCatalogItemId: rowEl.querySelector("[name='supplierCatalogItemId']")?.value?.trim()
        || rowEl.dataset.supplierCatalogItemId || "",
      extraJson: {},
    };
  }

  function extractGroupData(groupEl) {
    return {
      _id: groupEl.dataset.groupId || nextGroupId(),
      projectType: groupEl.querySelector("[name='projectType']")?.value || "travel",
      projectTitle: groupEl.querySelector("[name='projectTitle']")?.value?.trim() || "",
      items: Array.from(groupEl.querySelectorAll("tbody tr[data-item-id]")).map(extractRowData),
    };
  }

  function renderGroup(groupData) {
    const group = {
      _id: groupData?._id || nextGroupId(),
      projectType: String(groupData?.projectType || "travel").trim().toLowerCase() || "travel",
      projectTitle: groupData?.projectTitle || "",
      items: Array.isArray(groupData?.items) ? groupData.items : [],
    };
    const groupEl = document.createElement("div");
    groupEl.className = "project-group";
    groupEl.dataset.groupId = group._id;
    groupEl.innerHTML = `
      <div class="project-group-header">
        <label class="project-group-classifier">
          <span>项目组分类</span>
          <select class="proj-type-select" name="projectType">
            ${getGroupTypeOptions().map((entry) => `<option value="${entry.code}"${entry.code === group.projectType ? " selected" : ""}>${entry.nameZh}</option>`).join("")}
          </select>
        </label>
        <input class="proj-title-input" name="projectTitle" value="${escapeHtml(group.projectTitle)}" placeholder="项目组名称" />
        <span class="group-totals-badge proj-group-badge view-internal"></span>
        <div class="proj-header-actions">
          <button type="button" class="ghost mini-button add-item-btn" style="width:auto">新增明细</button>
          <button type="button" class="ghost mini-button delete-group-btn" style="width:auto">删除组</button>
        </div>
      </div>
      <div class="project-group-body">
        <div class="proj-table-scroll">
          <table class="proj-item-table">
            <colgroup>
              <col class="proj-col-type" />
              <col class="proj-col-name" />
              <col class="proj-col-spec" />
              <col class="proj-col-unit" />
              <col class="proj-col-qty" />
              <col class="proj-col-cost-unit view-internal" />
              <col class="proj-col-sales-unit" />
              <col class="proj-col-remarks" />
              <col class="proj-col-cost-subtotal view-internal" />
              <col class="proj-col-sales-subtotal" />
              <col class="proj-col-margin view-internal" />
              <col class="proj-col-actions" />
            </colgroup>
            <thead>
              <tr>
                ${renderColumnHeader("type", "服务类型")}
                ${renderColumnHeader("name", "服务名称")}
                ${renderColumnHeader("spec", "规格 / 说明")}
                ${renderColumnHeader("unit", "单位")}
                ${renderColumnHeader("qty", "数量", { classes: "r" })}
                ${renderColumnHeader("costUnit", "成本单价", { classes: "r view-internal" })}
                ${renderColumnHeader("salesUnit", "销售单价", { classes: "r" })}
                ${renderColumnHeader("remarks", "备注")}
                ${renderColumnHeader("costSubtotal", "成本小计", { classes: "r view-internal" })}
                ${renderColumnHeader("salesSubtotal", "销售小计", { classes: "r" })}
                ${renderColumnHeader("margin", "毛利率", { classes: "r view-internal" })}
                <th class="proj-col-actions proj-actions-th"></th>
              </tr>
            </thead>
            <tbody class="items-tbody"></tbody>
          </table>
        </div>
        <div class="proj-group-totals view-internal">
          <span>成本合计：<strong class="group-cost-total">—</strong></span>
          <span>销售合计：<strong class="group-sales-total">—</strong></span>
          <span>利润：<strong class="group-profit-total">—</strong></span>
        </div>
      </div>
    `;

    const tbody = groupEl.querySelector(".items-tbody");
    const items = group.items.length > 0 ? group.items : [createEmptyItem(group.projectType)];
    items.forEach((item) => {
      const rowEl = renderItemRow(item, group.projectType);
      tbody.appendChild(rowEl);
      bindRowEvents(rowEl, groupEl);
    });
    if (!tbody.querySelector("tr[data-item-id]")) {
      tbody.appendChild(renderEmptyRow());
    }

    groupEl.querySelector(".add-item-btn").addEventListener("click", () => {
      tbody.querySelector(".empty-row")?.remove();
      const nextGroupType = groupEl.querySelector("[name='projectType']").value;
      const rowEl = renderItemRow(createEmptyItem(nextGroupType), nextGroupType);
      tbody.appendChild(rowEl);
      bindRowEvents(rowEl, groupEl);
      applyColumnWidths(groupEl);
      refreshGroupTotals(groupEl);
      refreshSummary();
      applyViewMode();
    });

    groupEl.querySelector(".delete-group-btn").addEventListener("click", () => {
      const allGroups = containerEl?.querySelectorAll(".project-group") || [];
      if (allGroups.length <= 1 && !window.confirm("确定删除最后一个项目组吗？")) return;
      if (serviceSuggestionState.rowEl && groupEl.contains(serviceSuggestionState.rowEl)) closeServiceSuggestions();
      groupEl.remove();
      refreshSummary();
    });

    groupEl.querySelector("[name='projectType']").addEventListener("change", () => {
      rebuildItemTypeOptions(groupEl);
      refreshGroupTotals(groupEl);
      refreshSummary();
    });

    groupEl.querySelector("[name='projectTitle']").addEventListener("input", refreshSummary);
    applyColumnWidths(groupEl);
    bindColumnResizeHandles(groupEl);
    refreshGroupTotals(groupEl);
    return groupEl;
  }

  function rerenderOptionsFromMasterData() {
    if (!containerEl) return;
    containerEl.querySelectorAll(".project-group").forEach((groupEl) => {
      const groupSelect = groupEl.querySelector("[name='projectType']");
      const currentValue = groupSelect?.value || "travel";
      if (groupSelect) {
        groupSelect.innerHTML = getGroupTypeOptions().map((entry) => `<option value="${entry.code}"${entry.code === currentValue ? " selected" : ""}>${entry.nameZh}</option>`).join("");
      }
      rebuildItemTypeOptions(groupEl);
      refreshGroupTotals(groupEl);
    });
    refreshSummary();
  }

  function renderShell(groups) {
    containerEl.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <div>
            <h3 style="margin-bottom:6px">项目型报价</h3>
            <span>按项目组分类录入服务明细</span>
          </div>
          <div class="proj-toolbar-actions">
            <button type="button" class="ghost mini-button proj-toolbar-btn proj-toolbar-btn-secondary" id="proj-add-group-btn" style="width:auto">新增项目组</button>
            <button type="button" class="ghost mini-button proj-toolbar-btn proj-toolbar-btn-muted" id="proj-reset-width-btn" style="width:auto">恢复默认列宽</button>
            <button type="button" class="ghost mini-button proj-toolbar-btn proj-toolbar-btn-utility" id="proj-toggle-view-btn" style="width:auto">切换客户视图</button>
            <button type="button" class="ghost mini-button proj-toolbar-btn proj-toolbar-btn-primary" id="proj-generate-quotation-btn" style="width:auto">生成报价单</button>
          </div>
        </div>
        <div id="proj-groups-list"></div>
        <div class="proj-summary-panel">
          <div class="panel-label">报价汇总</div>
          <div class="proj-summary-metrics">
            <div class="metric-item view-internal">
              <span>成本合计</span>
              <strong id="proj-sum-cost">—</strong>
            </div>
            <div class="metric-item accent">
              <span>销售合计</span>
              <strong id="proj-sum-sales">—</strong>
            </div>
            <div class="metric-item view-internal">
              <span>利润</span>
              <strong id="proj-sum-profit">—</strong>
            </div>
            <div class="metric-item view-internal">
              <span>综合毛利率</span>
              <strong id="proj-sum-margin">—</strong>
            </div>
          </div>
        </div>
      </div>
    `;

    closeServiceSuggestions();
    const groupsList = containerEl.querySelector("#proj-groups-list");
    const initialGroups = Array.isArray(groups) && groups.length > 0 ? groups : [{ projectType: "travel", projectTitle: "", items: [] }];
    initialGroups.forEach((group) => {
      groupsList.appendChild(renderGroup(group));
    });

    containerEl.querySelector("#proj-add-group-btn").addEventListener("click", () => {
      groupsList.appendChild(renderGroup({ projectType: "travel", projectTitle: "", items: [] }));
      applyColumnWidths();
      bindColumnResizeHandles();
      refreshSummary();
      applyViewMode();
    });

    containerEl.querySelector("#proj-reset-width-btn").addEventListener("click", () => {
      resetColumnWidths();
    });

    containerEl.querySelector("#proj-toggle-view-btn").addEventListener("click", () => {
      viewMode = viewMode === "internal" ? "client" : "internal";
      containerEl.querySelector("#proj-toggle-view-btn").textContent = viewMode === "client" ? "切换内部视图" : "切换客户视图";
      applyViewMode();
    });

    containerEl.querySelector("#proj-generate-quotation-btn").addEventListener("click", () => {
      if (typeof quotationActionHandler === "function") {
        quotationActionHandler();
      }
    });

    containerEl.querySelectorAll(".proj-cell-textarea").forEach(autoSizeTextCell);
    applyColumnWidths();
    bindColumnResizeHandles();
    refreshSummary();
    applyViewMode();
  }

  return {
    init(container, groups, currency) {
      containerEl = container;
      currencyCode = currency || "EUR";
      viewMode = "internal";
      bindServiceSuggestionGlobalEvents();
      columnWidths = loadColumnWidths();
      ensureMasterDataLoaded()
        .catch(() => {})
        .finally(() => {
          renderShell(groups || []);
        });
    },

    getGroups() {
      if (!containerEl) return [];
      return Array.from(containerEl.querySelectorAll(".project-group")).map(extractGroupData);
    },

    getSummary() {
      if (!containerEl) {
        return { totalCost: 0, totalSales: 0, totalProfit: 0 };
      }
      let totalCost = 0;
      let totalSales = 0;
      containerEl.querySelectorAll(".project-group tbody tr[data-item-id]").forEach((rowEl) => {
        const qty = Number(rowEl.querySelector("[name='quantity']")?.value || 0);
        const cost = Number(rowEl.querySelector("[name='costUnitPrice']")?.value || 0);
        const sales = Number(rowEl.querySelector("[name='salesUnitPrice']")?.value || 0);
        totalCost += qty * cost;
        totalSales += qty * sales;
      });
      return {
        totalCost,
        totalSales,
        totalProfit: totalSales - totalCost,
      };
    },

    setViewMode(mode) {
      viewMode = mode === "client" ? "client" : "internal";
      applyViewMode();
    },

    setCurrency(currency) {
      currencyCode = currency || "EUR";
      if (!containerEl) return;
      containerEl.querySelectorAll(".project-group").forEach(refreshGroupTotals);
      refreshSummary();
    },

    setQuotationAction(handler) {
      quotationActionHandler = typeof handler === "function" ? handler : null;
    },
  };
})();
