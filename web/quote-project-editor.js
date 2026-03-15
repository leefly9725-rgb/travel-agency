// ── 项目型报价编辑器 ──────────────────────────────────────────────────────────
// window.ProjectEditor 提供统一 API：
//   init(container, groups, currency)  – 初始化编辑器
//   getGroups()                        – 读取当前所有分组数据
//   getSummary()                       – 读取汇总金额
//   setViewMode('internal'|'client')   – 切换内部/客户视图
//   setCurrency(currency)              – 更新货币（重新格式化显示）

window.ProjectEditor = (function () {
  // ── 内部状态 ────────────────────────────────────────────────────────────────
  let _container   = null;
  let _currency    = "EUR";
  let _viewMode    = "internal";
  let _groupCounter = 0;
  let _supplierItems = [];
  let _supplierMap   = {};   // id → supplier name
  let _catalogLoaded = false;

  // ── 明细类型（精简为5种，驱动录入逻辑）────────────────────────────────────
  const ITEM_TYPES = [
    { value: "hotel",             label: "酒店"      },
    { value: "transport",         label: "用车"      },
    { value: "guide_translation", label: "导游/翻译" },
    { value: "catalog_item",      label: "目录项目"  },
    { value: "misc",              label: "杂项"      },
  ];

  const GROUP_TYPES = [
    { value: "travel", label: "旅游接待" },
    { value: "event",  label: "活动服务" },
    { value: "mixed",  label: "综合项目" },
  ];

  const GROUP_TYPE_ITEM_TYPES = {
    travel: [
      { value: "hotel",             label: "酒店"      },
      { value: "transport",         label: "用车"      },
      { value: "guide_translation", label: "导游/翻译" },
      { value: "misc",              label: "杂项"      },
    ],
    event: [
      { value: "catalog_item",      label: "目录项目"  },
      { value: "misc",              label: "杂项"      },
    ],
    mixed: [
      { value: "hotel",             label: "酒店"      },
      { value: "transport",         label: "用车"      },
      { value: "guide_translation", label: "导游/翻译" },
      { value: "catalog_item",      label: "目录项目"  },
      { value: "misc",              label: "杂项"      },
    ],
  };

  function _getAllowedTypes(groupEl) {
    const groupType = groupEl.querySelector("[name='projectType']")?.value || "event";
    return GROUP_TYPE_ITEM_TYPES[groupType] || ITEM_TYPES;
  }

  const SPEC_LABELS = {
    hotel:            "房型",
    transport:        "车型/路线",
    guide_translation:"语言/时长",
    catalog_item:     "规格",
    misc:             "规格",
  };

  // 各行类型的默认单位——可扩展为从类型主数据读取 default_unit
  const TYPE_DEFAULT_UNIT = {
    hotel:             "间",
    transport:         "辆",
    guide_translation: "天",
    catalog_item:      "项",
    misc:              "项",
    av_equipment:      "台",
    print_display:     "项",
    decoration:        "项",
    personnel:         "人天",
    logistics:         "项",
  };

  function _getDefaultUnit(iType) {
    return TYPE_DEFAULT_UNIT[iType] || "项";
  }

  // 不同项目组类型 × 行类型的录入提示
  const GROUP_ITEM_NAME_HINTS = {
    travel: {
      hotel:            "例：Superior 双床房 / 四星标准间",
      transport:        "例：商务中巴 Mercedes Sprinter",
      guide_translation:"例：中塞双语全程导游",
      misc:             "例：景区门票 / 餐费 / 小费",
    },
    event: {
      catalog_item:     "例：LED 墙 8×3m 含运输安装",
      misc:             "例：现场礼仪 / 活动统筹服务费",
    },
    mixed: {
      hotel:            "例：双人标准间",
      transport:        "例：机场接送车",
      guide_translation:"例：翻译服务",
      catalog_item:     "例：展架展台物料",
      misc:             "例：杂项费用",
    },
  };

  const CATALOG_CATS = [
    { value: "",               label: "全部" },
    { value: "av_equipment",   label: "音视频设备" },
    { value: "stage_structure",label: "舞台结构"   },
    { value: "print_display",  label: "印刷展示"   },
    { value: "decoration",     label: "装饰物料"   },
    { value: "furniture",      label: "家具桌椅"   },
    { value: "personnel",      label: "人员服务"   },
    { value: "logistics",      label: "物流设备"   },
    { value: "management",     label: "管理服务"   },
  ];

  // ── 工具函数 ────────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function fmt(amount) {
    return window.AppUtils.formatCurrency(Number(amount) || 0, _currency);
  }

  function _generateId() {
    return "item-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  }

  function applyViewMode() {
    if (!_container) return;
    const isClient = _viewMode === "client";
    _container.querySelectorAll(".view-internal").forEach((el) => {
      el.style.display = isClient ? "none" : "";
    });
  }

  // ── 明细行渲染 ──────────────────────────────────────────────────────────────
  function createItemRow(item, groupEl, allowedTypes) {
    const tr    = document.createElement("tr");
    const types = allowedTypes || ITEM_TYPES;
    tr.dataset.itemId = item._id || _generateId();
    item._id = tr.dataset.itemId;

    const extra         = item.extraJson || {};
    const nights        = Number(extra.nights || 1);
    const transportDays = Number(extra.transportDays || 1);
    const iType         = item.itemType || "misc";
    const isHotel       = iType === "hotel";
    const isTransport   = iType === "transport";
    const isCatalog     = iType === "catalog_item";
    const specLabel     = SPEC_LABELS[iType] || "规格";
    const qtyUnitLabel  = isHotel ? "间" : isTransport ? "辆" : "";

    const groupType = groupEl?.querySelector("[name='projectType']")?.value || "event";
    const nameHint  = (GROUP_ITEM_NAME_HINTS[groupType] || {})[iType] || "名称";

    const qty      = Number(item.quantity || 1);
    const costUnit = Number(item.costUnitPrice || 0);
    const salesUnit= Number(item.salesUnitPrice || 0);
    const n        = isHotel ? Math.max(nights, 1) : 1;
    const costSub  = Math.round(qty * n * costUnit  * 100) / 100;
    const salesSub = Math.round(qty * n * salesUnit * 100) / 100;
    const margin   = salesSub > 0 ? ((salesSub - costSub) / salesSub * 100).toFixed(1) + "%" : "—";

    // store catalog category as data attr for save mapping
    if (item.itemCategory) tr.dataset.catalogCategory = item.itemCategory;

    tr.innerHTML = `
      <td>
        <select class="cell-input item-type-sel" name="itemType" style="min-width:88px;height:28px;padding:2px 4px;font-size:12px">
          ${types.map((t) => `<option value="${t.value}"${iType === t.value ? " selected" : ""}>${t.label}</option>`).join("")}
        </select>
      </td>
      <td><input class="cell-input" name="itemName" value="${esc(item.itemName || "")}" placeholder="${esc(nameHint)}" style="min-width:110px" /></td>
      <td><input class="cell-input spec-input" name="specification" value="${esc(item.specification || "")}" placeholder="${esc(specLabel)}" style="min-width:72px" /></td>
      <td><input class="cell-input" name="unit" value="${esc(item.unit || _getDefaultUnit(iType))}" placeholder="单位" style="width:44px" data-system-unit="${esc(_getDefaultUnit(iType))}" /></td>
      <td class="qty-td">
        <div class="qty-stack">
          <div class="qty-main-line">
            <input class="cell-input qty-input" name="quantity" type="number" min="0" step="1" value="${qty}" />
            <span class="qty-unit-label">${qtyUnitLabel}</span>
          </div>
          <div class="qty-sub-line nights-marker"${isHotel ? "" : ' style="display:none"'}>
            <input class="cell-input qty-input" name="nights" type="number" min="1" step="1" value="${nights}" title="晚数" />
            <span class="qty-unit-label">晚</span>
          </div>
          <div class="qty-sub-line transport-days-marker"${isTransport ? "" : ' style="display:none"'}>
            <input class="cell-input qty-input" name="transportDays" type="number" min="1" step="1" value="${transportDays}" title="天数" />
            <span class="qty-unit-label">天</span>
          </div>
        </div>
      </td>
      <td class="view-internal">
        <input class="cell-input" name="costUnitPrice" type="number" min="0" step="0.01"
          value="${costUnit > 0 ? costUnit : ""}" placeholder="0.00" style="width:78px;text-align:right" />
      </td>
      <td>
        <input class="cell-input" name="salesUnitPrice" type="number" min="0" step="0.01"
          value="${salesUnit > 0 ? salesUnit : ""}" placeholder="0.00" style="width:78px;text-align:right" />
      </td>
      <td class="view-internal computed-cell r" data-field="costSubtotal">${costSub > 0 ? fmt(costSub) : "—"}</td>
      <td class="computed-cell r" data-field="salesSubtotal">${salesSub > 0 ? fmt(salesSub) : "—"}</td>
      <td class="view-internal computed-cell r" data-field="margin">${margin}</td>
      <td class="view-internal supplier-col">
        <input class="cell-input" name="supplierDisplay" value="${esc(item.supplierDisplay || "")}" placeholder="供应商" style="min-width:72px" readonly tabindex="-1" />
        <input type="hidden" name="supplierId" value="${esc(item.supplierId || "")}" />
        <input type="hidden" name="supplierCatalogItemId" value="${esc(item.supplierCatalogItemId || "")}" />
      </td>
      <td><input class="cell-input" name="remarks" value="${esc(item.remarks || "")}" placeholder="备注" style="min-width:72px" /></td>
      <td>
        <div style="display:flex;gap:3px;align-items:center;justify-content:flex-end">
          ${isCatalog ? '<button type="button" class="catalog-select-btn catalog-btn" title="从价格库选择" style="padding:4px 8px;font-size:11px">从库选</button>' : '<span style="width:4px"></span>'}
          <button type="button" class="ghost mini-button delete-item-btn" title="删除此行" style="padding:4px 7px;font-size:11px;color:#b84040">✕</button>
        </div>
      </td>
    `;

    // 输入联动
    tr.querySelectorAll("input, select").forEach((input) => {
      input.addEventListener("input",  () => _updateRow(tr, groupEl));
      input.addEventListener("change", () => {
        _updateRow(tr, groupEl);
        if (input.name === "itemType") _syncRowType(tr);
      });
    });

    tr.querySelector(".delete-item-btn").addEventListener("click", () => {
      tr.remove();
      const tbody = groupEl.querySelector(".items-tbody");
      if (!tbody.querySelector("tr[data-item-id]")) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="13">暂无明细，点击下方按钮添加。</td></tr>';
      }
      _refreshGroupTotals(groupEl);
      _refreshSummary();
    });

    const catalogBtn = tr.querySelector(".catalog-btn");
    if (catalogBtn) {
      catalogBtn.addEventListener("click", () => _openCatalogPicker(tr, groupEl));
    }

    return tr;
  }

  function _syncRowType(tr) {
    const iType       = tr.querySelector("[name='itemType']").value;
    const isHotel     = iType === "hotel";
    const isTransport = iType === "transport";
    const isCatalog   = iType === "catalog_item";

    // qty 区：单位标签
    const qtyUnitLabel = tr.querySelector(".qty-unit-label");
    if (qtyUnitLabel) qtyUnitLabel.textContent = isHotel ? "间" : isTransport ? "辆" : "";

    // qty 区：hotel 晚数行
    const nightsLine = tr.querySelector(".nights-marker");
    if (nightsLine) nightsLine.style.display = isHotel ? "" : "none";

    // qty 区：transport 天数行
    const transportLine = tr.querySelector(".transport-days-marker");
    if (transportLine) transportLine.style.display = isTransport ? "" : "none";

    // spec 占位符
    const specInput = tr.querySelector(".spec-input");
    if (specInput) specInput.placeholder = SPEC_LABELS[iType] || "规格";

    // name 占位符（按项目组类型 + 行类型）
    const groupEl   = tr.closest(".project-group");
    const groupType = groupEl?.querySelector("[name='projectType']")?.value || "event";
    const nameInput = tr.querySelector("[name='itemName']");
    if (nameInput && !nameInput.value) {
      nameInput.placeholder = (GROUP_ITEM_NAME_HINTS[groupType] || {})[iType] || "名称";
    }

    // unit 自动联动：仅当当前单位仍等于系统上次设定的默认值时才跟随类型切换，用户已手动修改则保留
    const unitInput = tr.querySelector("[name='unit']");
    if (unitInput) {
      const newDefault = _getDefaultUnit(iType);
      if (!unitInput.value || unitInput.value === unitInput.dataset.systemUnit) {
        unitInput.value = newDefault;
      }
      unitInput.dataset.systemUnit = newDefault;
    }

    const actionsCell = tr.querySelector("td:last-child > div");
    if (actionsCell) {
      const existing = actionsCell.querySelector(".catalog-btn");
      if (isCatalog && !existing) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "catalog-select-btn catalog-btn";
        btn.title = "从价格库选择";
        btn.textContent = "从库选";
        btn.style.cssText = "padding:4px 8px;font-size:11px";
        btn.addEventListener("click", () => _openCatalogPicker(tr, tr.closest(".project-group")));
        actionsCell.insertBefore(btn, actionsCell.querySelector(".delete-item-btn"));
      } else if (!isCatalog && existing) {
        existing.remove();
        // clear catalog data when switching away
        tr.querySelector("[name='supplierId']").value = "";
        tr.querySelector("[name='supplierCatalogItemId']").value = "";
        tr.querySelector("[name='supplierDisplay']").value = "";
        tr.dataset.catalogCategory = "";
      }
    }
  }

  function _updateRow(tr, groupEl) {
    const iType     = tr.querySelector("[name='itemType']").value;
    const qty       = Number(tr.querySelector("[name='quantity']").value || 0);
    const nightsEl  = tr.querySelector("[name='nights']");
    const nights    = iType === "hotel" ? Math.max(Number(nightsEl ? nightsEl.value : 1), 1) : 1;
    const costUnit  = Number(tr.querySelector("[name='costUnitPrice']").value  || 0);
    const salesUnit = Number(tr.querySelector("[name='salesUnitPrice']").value || 0);
    const costSub   = Math.round(qty * nights * costUnit  * 100) / 100;
    const salesSub  = Math.round(qty * nights * salesUnit * 100) / 100;
    const margin    = salesSub > 0 ? ((salesSub - costSub) / salesSub * 100).toFixed(1) + "%" : "—";

    tr.querySelector("[data-field='costSubtotal']").textContent  = costSub  > 0 ? fmt(costSub)  : "—";
    tr.querySelector("[data-field='salesSubtotal']").textContent = salesSub > 0 ? fmt(salesSub) : "—";
    tr.querySelector("[data-field='margin']").textContent        = margin;

    _refreshGroupTotals(groupEl);
    _refreshSummary();
  }

  // ── 分组操作 ────────────────────────────────────────────────────────────────
  function _addItemToGroup(groupEl, defaults) {
    const tbody = groupEl.querySelector(".items-tbody");
    const emptyRow = tbody.querySelector(".empty-row");
    if (emptyRow) emptyRow.remove();
    const allowedTypes = _getAllowedTypes(groupEl);
    const defaultType = allowedTypes[0]?.value || "misc";
    const item = { itemType: defaultType, unit: _getDefaultUnit(defaultType), quantity: 1, ...defaults };
    const tr = createItemRow(item, groupEl, allowedTypes);
    tbody.appendChild(tr);
    tr.querySelector("[name='itemName']")?.focus();
    _refreshGroupTotals(groupEl);
    _refreshSummary();
    applyViewMode();
  }

  function _refreshGroupTotals(groupEl) {
    let cost = 0, sales = 0;
    groupEl.querySelectorAll(".items-tbody tr[data-item-id]").forEach((tr) => {
      const iType     = tr.querySelector("[name='itemType']").value;
      const qty       = Number(tr.querySelector("[name='quantity']").value || 0);
      const nightsEl  = tr.querySelector("[name='nights']");
      const nights    = iType === "hotel" ? Math.max(Number(nightsEl ? nightsEl.value : 1), 1) : 1;
      const costUnit  = Number(tr.querySelector("[name='costUnitPrice']").value  || 0);
      const salesUnit = Number(tr.querySelector("[name='salesUnitPrice']").value || 0);
      cost  += qty * nights * costUnit;
      sales += qty * nights * salesUnit;
    });
    cost  = Math.round(cost  * 100) / 100;
    sales = Math.round(sales * 100) / 100;
    const profit = Math.round((sales - cost) * 100) / 100;

    const get = (cls) => groupEl.querySelector(cls);
    if (get(".group-cost-total"))   get(".group-cost-total").textContent   = fmt(cost);
    if (get(".group-sales-total"))  get(".group-sales-total").textContent  = fmt(sales);
    if (get(".group-profit-total")) get(".group-profit-total").textContent = profit >= 0 ? fmt(profit) : "(" + fmt(-profit) + ")";
    if (get(".group-totals-badge")) get(".group-totals-badge").textContent = sales > 0 ? "销售 " + fmt(sales) + "  利润 " + fmt(profit) : "";
  }

  function _refreshSummary() {
    if (!_container) return;
    let totalCost = 0, totalSales = 0;
    _container.querySelectorAll(".project-group .items-tbody tr[data-item-id]").forEach((tr) => {
      const iType     = tr.querySelector("[name='itemType']").value;
      const qty       = Number(tr.querySelector("[name='quantity']").value || 0);
      const nightsEl  = tr.querySelector("[name='nights']");
      const nights    = iType === "hotel" ? Math.max(Number(nightsEl ? nightsEl.value : 1), 1) : 1;
      const costUnit  = Number(tr.querySelector("[name='costUnitPrice']").value  || 0);
      const salesUnit = Number(tr.querySelector("[name='salesUnitPrice']").value || 0);
      totalCost  += qty * nights * costUnit;
      totalSales += qty * nights * salesUnit;
    });
    totalCost  = Math.round(totalCost  * 100) / 100;
    totalSales = Math.round(totalSales * 100) / 100;
    const totalProfit = Math.round((totalSales - totalCost) * 100) / 100;
    const margin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : "0.0";

    const el = (id) => _container.querySelector("#" + id);
    if (el("proj-sum-cost"))   el("proj-sum-cost").textContent   = fmt(totalCost);
    if (el("proj-sum-sales"))  el("proj-sum-sales").textContent  = fmt(totalSales);
    if (el("proj-sum-profit")) el("proj-sum-profit").textContent = fmt(totalProfit);
    if (el("proj-sum-margin")) el("proj-sum-margin").textContent = margin + "%";
  }

  // ── 从 DOM 提取分组数据 ──────────────────────────────────────────────────────
  function _extractGroupData(groupEl) {
    const projectType  = groupEl.querySelector("[name='projectType']").value;
    const projectTitle = groupEl.querySelector("[name='projectTitle']").value.trim();
    const items = [];

    groupEl.querySelectorAll(".items-tbody tr[data-item-id]").forEach((tr, ii) => {
      const iType          = tr.querySelector("[name='itemType']").value;
      const nightsEl       = tr.querySelector("[name='nights']");
      const transportDaysEl= tr.querySelector("[name='transportDays']");
      const nights         = iType === "hotel" ? Math.max(Number(nightsEl ? nightsEl.value : 1), 1) : 1;
      const transportDays  = iType === "transport" ? Math.max(Number(transportDaysEl ? transportDaysEl.value : 1), 1) : 1;
      const qty      = Number(tr.querySelector("[name='quantity']").value || 1);
      const costUnit = Number(tr.querySelector("[name='costUnitPrice']").value  || 0);
      const salesUnit= Number(tr.querySelector("[name='salesUnitPrice']").value || 0);
      const costSub  = Math.round(qty * nights * costUnit  * 100) / 100;
      const salesSub = Math.round(qty * nights * salesUnit * 100) / 100;

      // catalog_item → save as misc on backend; store catalogCategory in extraJson
      const backendType = iType === "catalog_item" ? "misc" : iType;
      const catalogCat  = iType === "catalog_item" ? (tr.dataset.catalogCategory || "") : "";
      const extraJson   = iType === "hotel"
        ? { nights }
        : iType === "transport"
          ? { transportDays }
          : iType === "catalog_item"
            ? { catalogCategory: catalogCat }
            : {};

      items.push({
        _id:                   tr.dataset.itemId,
        itemType:              backendType,
        itemCategory:          catalogCat,
        itemName:              tr.querySelector("[name='itemName']").value.trim(),
        specification:         tr.querySelector("[name='specification']").value.trim(),
        unit:                  tr.querySelector("[name='unit']").value.trim(),
        quantity:              qty,
        currency:              _currency,
        costUnitPrice:         costUnit,
        salesUnitPrice:        salesUnit,
        costSubtotal:          costSub,
        salesSubtotal:         salesSub,
        supplierId:            tr.querySelector("[name='supplierId']").value,
        supplierCatalogItemId: tr.querySelector("[name='supplierCatalogItemId']").value,
        supplierDisplay:       tr.querySelector("[name='supplierDisplay']").value,
        remarks:               tr.querySelector("[name='remarks']").value.trim(),
        sortOrder:             ii,
        extraJson,
      });
    });

    const cost  = items.reduce((s, i) => s + i.costSubtotal,  0);
    const sales = items.reduce((s, i) => s + i.salesSubtotal, 0);

    return {
      _id:                groupEl.dataset.groupId,
      projectType,
      projectTitle,
      sortOrder:          Array.from(_container.querySelectorAll("#proj-groups-list .project-group")).indexOf(groupEl),
      projectCostTotal:   Math.round(cost  * 100) / 100,
      projectSalesTotal:  Math.round(sales * 100) / 100,
      projectProfitTotal: Math.round((sales - cost) * 100) / 100,
      items,
    };
  }

  // ── 供应商价格库选择器（左右布局）─────────────────────────────────────────
  function _openCatalogPicker(tr, groupEl) {
    let picker = document.getElementById("catalog-picker-overlay");

    if (!picker) {
      picker = document.createElement("div");
      picker.id = "catalog-picker-overlay";
      picker.className = "catalog-modal-overlay";
      picker.style.display = "none";

      picker.innerHTML = `
        <div class="catalog-modal">
          <div class="catalog-modal-header">
            <h3>价格库</h3>
            <input id="catalog-search" class="catalog-modal-search" placeholder="搜索名称、规格、供应商…" autocomplete="off" />
            <button type="button" id="catalog-close-btn" class="ghost mini-button" style="width:auto;flex-shrink:0;border-radius:8px">关闭</button>
          </div>
          <div class="catalog-modal-body">
            <div class="catalog-sidebar">
              ${CATALOG_CATS.map((c) =>
                `<button type="button" class="catalog-cat-btn${c.value === "" ? " active" : ""}" data-cat="${c.value}">${c.label}</button>`
              ).join("")}
            </div>
            <div class="catalog-main">
              <div class="catalog-list-header">
                <span>名称 / 规格</span>
                <span>供应商</span>
                <span>单位</span>
                <span>成本价</span>
                <span></span>
              </div>
              <div id="catalog-items-list"></div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(picker);

      document.getElementById("catalog-close-btn").addEventListener("click", () => {
        picker.style.display = "none";
      });
      picker.addEventListener("click", (e) => {
        if (e.target === picker) picker.style.display = "none";
      });

      document.getElementById("catalog-search").addEventListener("input", () => {
        if (picker._render) picker._render();
      });

      picker.querySelectorAll(".catalog-cat-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          picker.querySelectorAll(".catalog-cat-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          picker._activeCat = btn.dataset.cat;
          if (picker._render) picker._render();
        });
      });

      picker._activeCat = "";

      picker._render = function () {
        const q   = (document.getElementById("catalog-search").value || "").toLowerCase();
        const cat = picker._activeCat || "";
        const filtered = _supplierItems.filter((item) => {
          if (item.isActive === false) return false;
          if (cat && item.category !== cat) return false;
          if (q) {
            const name = (item.nameZh || "").toLowerCase();
            const spec = (item.spec   || "").toLowerCase();
            const sup  = (_supplierMap[item.supplierId] || "").toLowerCase();
            if (!name.includes(q) && !spec.includes(q) && !sup.includes(q)) return false;
          }
          return true;
        });

        const listEl = document.getElementById("catalog-items-list");
        if (!listEl) return;

        if (filtered.length === 0) {
          listEl.innerHTML = '<div class="catalog-empty">暂无匹配条目，请调整关键词或分类。</div>';
          return;
        }

        listEl.innerHTML = filtered.map((item) => {
          const supName  = esc(_supplierMap[item.supplierId] || "");
          const catLabel = window.AppUi
            ? esc(window.AppUi.getLabel("supplierItemCategoryLabels", item.category || "") || "")
            : esc(item.category || "");
          return `
            <div class="catalog-item-row" data-item-id="${esc(String(item.id))}">
              <div>
                <div class="catalog-item-name-main">${esc(item.nameZh || "")}</div>
                <div class="catalog-item-meta">${esc(item.spec || "")}${item.spec && catLabel ? " · " : ""}${catLabel}</div>
              </div>
              <div class="catalog-item-supplier">${supName}</div>
              <div class="catalog-item-unit">${esc(item.unit || "")}</div>
              <div class="catalog-item-price">${window.AppUtils.formatCurrency(item.costPrice || 0, _currency)}</div>
              <button type="button" class="catalog-select-btn">选用</button>
            </div>
          `;
        }).join("");

        listEl.querySelectorAll(".catalog-item-row").forEach((row) => {
          row.addEventListener("click", () => {
            const found = _supplierItems.find((i) => String(i.id) === row.dataset.itemId);
            if (found) {
              _fillFromCatalog(picker._currentTr, picker._currentGroupEl, found);
              picker.style.display = "none";
            }
          });
        });
      };
    }

    // update target row/group for this open (fixes stale closure bug)
    picker._currentTr       = tr;
    picker._currentGroupEl  = groupEl;
    picker.style.display    = "flex";

    if (!_catalogLoaded) {
      const listEl = document.getElementById("catalog-items-list");
      if (listEl) listEl.innerHTML = '<div class="catalog-empty">加载中…</div>';

      Promise.all([
        window.AppUtils.fetchJson("/api/supplier-items", null, "价格库加载失败"),
        window.AppUtils.fetchJson("/api/suppliers",      null, "供应商列表加载失败"),
      ]).then(([itemsResult, suppliersResult]) => {
        _supplierItems = Array.isArray(itemsResult) ? itemsResult : (itemsResult.items || []);
        const suppliers = Array.isArray(suppliersResult) ? suppliersResult : (suppliersResult.suppliers || []);
        suppliers.forEach((s) => { _supplierMap[s.id] = s.name; });
        _catalogLoaded = true;
        if (picker._render) picker._render();
      }).catch(() => {
        _catalogLoaded = true;
        if (picker._render) picker._render();
      });
    } else if (picker._render) {
      picker._render();
    }
  }

  function _fillFromCatalog(tr, groupEl, catalogItem) {
    if (!tr) return;
    tr.querySelector("[name='itemName']").value          = catalogItem.nameZh  || "";
    tr.querySelector("[name='specification']").value     = catalogItem.spec    || "";
    tr.querySelector("[name='unit']").value              = catalogItem.unit    || "项";
    tr.querySelector("[name='costUnitPrice']").value     = catalogItem.costPrice || 0;
    tr.querySelector("[name='supplierId']").value        = catalogItem.supplierId || "";
    tr.querySelector("[name='supplierCatalogItemId']").value = String(catalogItem.id);
    tr.querySelector("[name='supplierDisplay']").value   = _supplierMap[catalogItem.supplierId] || "";
    tr.dataset.catalogCategory = catalogItem.category || "";
    _updateRow(tr, groupEl);
  }

  // ── 分组渲染 ────────────────────────────────────────────────────────────────
  function _renderGroup(group) {
    const groupId = group._id || ("group-" + (++_groupCounter));
    const div = document.createElement("div");
    div.dataset.groupId = groupId;
    div.className = "project-group group-type-" + (group.projectType || "event");

    div.innerHTML = `
      <div class="project-group-header">
        <select class="proj-type-select" name="projectType">
          ${GROUP_TYPES.map((t) => `<option value="${t.value}"${group.projectType === t.value ? " selected" : ""}>${t.label}</option>`).join("")}
        </select>
        <input name="projectTitle" class="proj-title-input"
          value="${esc(group.projectTitle || "")}"
          placeholder="项目组名称（如：第一天接机 / 开幕式物料）" />
        <span class="group-totals-badge proj-group-badge view-internal"></span>
        <div class="proj-header-actions">
          <button type="button" class="ghost mini-button collapse-btn">折叠</button>
          <button type="button" class="ghost mini-button copy-btn">复制</button>
          <button type="button" class="ghost mini-button delete-btn">删除</button>
        </div>
      </div>

      <div class="project-group-body">
        <div style="overflow-x:auto">
          <table class="proj-item-table">
            <thead>
              <tr>
                <th style="min-width:90px">类型</th>
                <th style="min-width:120px">名称</th>
                <th style="min-width:80px">规格</th>
                <th style="width:46px">单位</th>
                <th class="r" style="width:80px">数量</th>
                <th class="r view-internal" style="width:82px">成本单价</th>
                <th class="r" style="width:82px">销售单价</th>
                <th class="r view-internal" style="width:86px">成本小计</th>
                <th class="r" style="width:86px">销售小计</th>
                <th class="r view-internal" style="width:58px">毛利率</th>
                <th class="view-internal supplier-col" style="min-width:80px">供应商</th>
                <th style="min-width:80px">备注</th>
                <th style="width:68px"></th>
              </tr>
            </thead>
            <tbody class="items-tbody">
              <tr class="empty-row">
                <td colspan="13">暂无明细，点击下方按钮添加。</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="proj-group-footer">
          <button type="button" class="proj-add-btn add-item-btn">＋ 新增明细</button>
        </div>

        <div class="proj-group-totals view-internal">
          <span>成本合计：<strong class="group-cost-total">—</strong></span>
          <span>销售合计：<strong class="group-sales-total">—</strong></span>
          <span>利润：<strong class="group-profit-total">—</strong></span>
        </div>
      </div>
    `;

    // 分组操作绑定
    div.querySelector(".delete-btn").addEventListener("click", () => {
      const allGroups = _container.querySelectorAll("#proj-groups-list .project-group");
      if (allGroups.length <= 1 && !confirm("确定删除最后一个项目组吗？")) return;
      div.remove();
      _refreshSummary();
    });

    div.querySelector(".copy-btn").addEventListener("click", () => {
      const data = _extractGroupData(div);
      const copy = JSON.parse(JSON.stringify(data));
      copy._id = null;
      copy.projectTitle = (copy.projectTitle || "") + "（复制）";
      copy.items = copy.items.map((i) => { const n = { ...i }; n._id = null; return n; });
      const newDiv = _renderGroup(copy);
      div.parentNode.insertBefore(newDiv, div.nextSibling);
      const tbody = newDiv.querySelector(".items-tbody");
      copy.items.forEach((item) => {
        tbody.querySelector(".empty-row")?.remove();
        tbody.appendChild(createItemRow(item, newDiv));
      });
      _refreshGroupTotals(newDiv);
      _refreshSummary();
      applyViewMode();
    });

    div.querySelector(".collapse-btn").addEventListener("click", () => {
      const body = div.querySelector(".project-group-body");
      const isCollapsed = body.style.display === "none";
      body.style.display = isCollapsed ? "" : "none";
      div.querySelector(".collapse-btn").textContent = isCollapsed ? "折叠" : "展开";
    });

    // 明细添加按钮
    div.querySelector(".add-item-btn").addEventListener("click", () => _addItemToGroup(div, {}));

    // 项目类型变更时，更新 CSS class、类型下拉、行 hints
    div.querySelector("[name='projectType']").addEventListener("change", () => {
      const newType     = div.querySelector("[name='projectType']").value;
      div.className     = "project-group group-type-" + newType;
      const allowedTypes = _getAllowedTypes(div);
      div.querySelectorAll(".items-tbody tr[data-item-id]").forEach((tr) => {
        const sel = tr.querySelector(".item-type-sel");
        if (sel) {
          const currentVal = sel.value;
          sel.innerHTML = allowedTypes.map((t) => `<option value="${t.value}"${currentVal === t.value ? " selected" : ""}>${t.label}</option>`).join("");
          if (!allowedTypes.find((t) => t.value === currentVal)) {
            sel.value = allowedTypes[0]?.value || "misc";
          }
        }
        _syncRowType(tr);
      });
    });

    // 渲染已有 items（从 DB 加载时，按分组类型过滤可用类型）
    const tbody = div.querySelector(".items-tbody");
    if (Array.isArray(group.items) && group.items.length > 0) {
      const allowedTypes = GROUP_TYPE_ITEM_TYPES[group.projectType] || ITEM_TYPES;
      tbody.querySelector(".empty-row")?.remove();
      group.items.forEach((item) => tbody.appendChild(createItemRow(item, div, allowedTypes)));
    }

    _refreshGroupTotals(div);
    return div;
  }

  // ── 公开 API ────────────────────────────────────────────────────────────────
  return {
    init(container, groups, currency) {
      _container    = container;
      _currency     = currency || "EUR";
      _viewMode     = "internal";
      _groupCounter = 0;

      container.innerHTML = `
        <div style="margin-top:18px">
          <div class="proj-editor-toolbar">
            <h2>项目组 &amp; 明细</h2>
            <button type="button" id="proj-toggle-view-btn" class="proj-toggle-view-btn">切换客户视图</button>
            <button type="button" id="proj-add-group-btn" class="proj-add-group-btn">＋ 新增项目组</button>
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
                <span>毛利润</span>
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

      const groupsList = container.querySelector("#proj-groups-list");

      container.querySelector("#proj-add-group-btn").addEventListener("click", () => {
        const newGroup = { projectType: "event", projectTitle: "", items: [] };
        const newDiv   = _renderGroup(newGroup);
        groupsList.appendChild(newDiv);
        newDiv.querySelector("[name='projectTitle']")?.focus();
        _refreshSummary();
        applyViewMode();
      });

      container.querySelector("#proj-toggle-view-btn").addEventListener("click", () => {
        _viewMode = _viewMode === "internal" ? "client" : "internal";
        container.querySelector("#proj-toggle-view-btn").textContent =
          _viewMode === "client" ? "切换内部视图" : "切换客户视图";
        applyViewMode();
      });

      // 渲染初始分组（新建时默认一个空分组）
      const initGroups = Array.isArray(groups) && groups.length > 0
        ? groups
        : [{ projectType: "event", projectTitle: "", items: [] }];
      initGroups.forEach((g) => groupsList.appendChild(_renderGroup(g)));

      applyViewMode();
      _refreshSummary();
    },

    getGroups() {
      if (!_container) return [];
      return Array.from(_container.querySelectorAll("#proj-groups-list .project-group"))
        .map(_extractGroupData);
    },

    getSummary() {
      if (!_container) return { totalCost: 0, totalSales: 0, totalProfit: 0 };
      let totalCost = 0, totalSales = 0;
      _container.querySelectorAll(".project-group .items-tbody tr[data-item-id]").forEach((tr) => {
        const iType     = tr.querySelector("[name='itemType']").value;
        const qty       = Number(tr.querySelector("[name='quantity']").value || 0);
        const nightsEl  = tr.querySelector("[name='nights']");
        const nights    = iType === "hotel" ? Math.max(Number(nightsEl ? nightsEl.value : 1), 1) : 1;
        const costUnit  = Number(tr.querySelector("[name='costUnitPrice']").value  || 0);
        const salesUnit = Number(tr.querySelector("[name='salesUnitPrice']").value || 0);
        totalCost  += qty * nights * costUnit;
        totalSales += qty * nights * salesUnit;
      });
      totalCost  = Math.round(totalCost  * 100) / 100;
      totalSales = Math.round(totalSales * 100) / 100;
      return {
        totalCost,
        totalSales,
        totalProfit: Math.round((totalSales - totalCost) * 100) / 100,
      };
    },

    setViewMode(mode) {
      _viewMode = mode;
      applyViewMode();
    },

    setCurrency(currency) {
      _currency = currency;
      if (_container) {
        _container.querySelectorAll(".project-group").forEach(_refreshGroupTotals);
        _refreshSummary();
      }
    },
  };
})();
