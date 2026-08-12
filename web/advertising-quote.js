(() => {
  const headers = () => ({ Authorization: `Bearer ${window.AuthStore?.getToken() || ""}`, "Content-Type": "application/json" });
  const form = document.querySelector("#adv-form");
  const itemsEl = document.querySelector("#adv-items");
  const groupsEl = document.querySelector("#adv-groups");
  const params = new URLSearchParams(location.search);
  const labels = window.AppUi?.advertising || {};
  let catalog;
  let quote = {};
  let groups = [];
  let isV2 = true;
  let timer;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const uid = (prefix) => `${prefix}-${crypto.randomUUID()}`;
  const number = (control) => Number(control.value || 0);
  document.querySelectorAll("[data-adv-label]").forEach((node) => { node.textContent = labels[node.dataset.advLabel] || node.dataset.advLabel; });
  form.elements.mode.value = params.get("mode") || "standard";

  const renderGroupOptions = (selected) => `<option value="">未分组</option>${groups.map((group) => `<option value="${esc(group.id)}" ${group.id === selected ? "selected" : ""}>${esc(group.nameZh)}</option>`).join("")}`;
  function renderGroups() {
    document.querySelector("#adv-groups-panel").classList.toggle("hidden", isV2 || form.elements.mode.value !== "project");
    groupsEl.innerHTML = groups.map((group, index) => `<article class="advertising-group" data-group-id="${esc(group.id)}"><header class="adv-group-head"><div><span>分组 ${index + 1}</span><strong>${esc(group.nameZh || "未命名分组")}</strong></div><p>分组小计 <strong data-group-subtotal>0.00 ${esc(form.elements.currency.value)}</strong></p></header><div class="advertising-grid adv-group-fields"><label>分组名称<input data-gkey="nameZh" value="${esc(group.nameZh || "")}"></label><label>英文名称<input data-gkey="nameEn" value="${esc(group.nameEn || "")}"></label><label>说明<input data-gkey="notes" value="${esc(group.notes || "")}"></label></div><div class="adv-inline-actions"><button type="button" data-up ${index === 0 ? "disabled" : ""}>上移</button><button type="button" data-down ${index === groups.length - 1 ? "disabled" : ""}>下移</button><button class="adv-danger-action" type="button" data-delete>删除分组</button></div></article>`).join("");
    groupsEl.querySelectorAll(".advertising-group").forEach((row, index) => {
      row.oninput = () => { row.querySelectorAll("[data-gkey]").forEach((control) => { groups[index][control.dataset.gkey] = control.value; }); refreshItemGroupOptions(); preview(); };
      row.querySelector("[data-up]").onclick = () => moveGroup(index, -1);
      row.querySelector("[data-down]").onclick = () => moveGroup(index, 1);
      row.querySelector("[data-delete]").onclick = () => { if (confirm("删除分组后，产品将变为未分组。")) { const id = groups[index].id; groups.splice(index, 1); itemsEl.querySelectorAll("[data-key=groupId]").forEach((control) => { if (control.value === id) control.value = ""; }); renderGroups(); refreshItemGroupOptions(); preview(); } };
    });
  }
  function moveGroup(index, delta) { const target = index + delta; [groups[index], groups[target]] = [groups[target], groups[index]]; renderGroups(); refreshItemGroupOptions(); preview(); }
  function refreshItemGroupOptions() { itemsEl.querySelectorAll("[data-key=groupId]").forEach((select) => { const value = select.value; select.innerHTML = renderGroupOptions(value); select.value = value; }); }
  function refreshItemOrder() { const rows = [...itemsEl.querySelectorAll(".advertising-item")]; rows.forEach((row, index) => { row.querySelector(".adv-item-head span").textContent = `产品 ${index + 1}`; row.querySelector("[data-up]").disabled = index === 0; row.querySelector("[data-down]").disabled = index === rows.length - 1; }); }

  function itemTemplate(item = {}) {
    const row = document.createElement("article");
    row.className = "advertising-item";
    row.dataset.itemId = item.id || uid("ADI");
    row.innerHTML = `<header class="adv-item-head"><div><span>产品 ${itemsEl.children.length + 1}</span><h3 data-item-heading>${esc(item.name || "未命名产品")}</h3></div><div class="adv-inline-actions"><button type="button" data-up>上移</button><button type="button" data-down>下移</button><button class="adv-danger-action" type="button" data-remove>删除</button></div></header><div class="advertising-grid adv-item-fields"><label class="adv-field-group">项目分组<select data-key="groupId">${renderGroupOptions(item.groupId)}</select></label><label class="adv-field-name">产品名称<input data-key="name" value="${esc(item.name || "")}" required></label><label class="adv-field-name-en">英文名称<input data-key="nameEn" value="${esc(item.nameEn || "")}"></label><label class="adv-field-material">材料<select data-key="materialId">${catalog.materials.map((entry) => `<option value="${esc(entry.id)}" ${entry.id === item.materialId ? "selected" : ""}>${esc(entry.nameZh)} · ${esc(entry.specification)}</option>`).join("")}</select></label><label>宽度<input data-key="width" type="number" min="1" value="${esc(item.width || 1000)}"></label><label>高度<input data-key="height" type="number" min="1" value="${esc(item.height || 1000)}"></label><label>尺寸单位<select data-key="sizeUnit"><option>mm</option><option>cm</option><option>m</option></select></label><label>数量<input data-key="quantity" type="number" min="1" value="${esc(item.quantity || 1)}"></label><label>面数<select data-key="sides"><option value="1">单面</option><option value="2">双面</option></select></label><fieldset class="adv-process-panel" data-processes><legend>加工工艺</legend></fieldset><label>材料销售价覆盖<input data-key="materialSaleUnitPrice" type="number" min="0" step="0.01" value="${esc(item.materialSaleUnitPrice ?? "")}"></label><label>手工调整<input data-key="manualAdjustment" type="number" step="0.01" value="${esc(item.manualAdjustment || 0)}"></label><label class="adv-field-notes">备注<input data-key="notes" value="${esc(item.notes || "")}"></label></div>`;
    const material = row.querySelector("[data-key=materialId]");
    const box = row.querySelector("[data-processes]");
    const sync = () => {
      const selected = new Map((item.processes || []).map((entry) => [entry.processId, entry]));
      const ids = catalog.rules.filter((entry) => entry.materialId === material.value && entry.isActive !== false).map((entry) => entry.processId);
      const available = catalog.processes.filter((entry) => ids.includes(entry.id));
      box.innerHTML = `<legend>加工工艺</legend>${available.map((entry) => `<label><input type="checkbox" data-process-id="${esc(entry.id)}" ${selected.has(entry.id) ? "checked" : ""}><span>${esc(entry.nameZh)}</span>${entry.requiresManualQuote ? `<input class="${selected.has(entry.id) ? "" : "hidden"}" type="number" min="0" step="0.01" data-process-price value="${esc(selected.get(entry.id)?.actualSalePrice ?? "")}" ${selected.has(entry.id) ? "" : "disabled"}>` : ""}</label>`).join("")}`;
      box.querySelectorAll("[data-process-id]").forEach((control) => { control.onchange = () => { const price = control.closest("label").querySelector("[data-process-price]"); if (price) { price.disabled = !control.checked; price.classList.toggle("hidden", !control.checked); } preview(); }; });
    };
    material.onchange = () => { item.processes = []; sync(); preview(); };
    row.querySelector("[data-key=sizeUnit]").value = item.sizeUnit || "mm";
    row.querySelector("[data-key=sides]").value = String(item.sides || 1);
    sync();
    row.querySelector("[data-remove]").onclick = () => { row.remove(); refreshItemOrder(); preview(); };
    row.querySelector("[data-up]").onclick = () => moveItem(row, -1);
    row.querySelector("[data-down]").onclick = () => moveItem(row, 1);
    row.querySelector("[data-key=name]").oninput = (event) => { row.querySelector("[data-item-heading]").textContent = event.target.value || "未命名产品"; };
    row.addEventListener("input", preview);
    itemsEl.append(row);
    refreshItemOrder();
  }
  function moveItem(row, delta) { const sibling = delta < 0 ? row.previousElementSibling : row.nextElementSibling; if (sibling) itemsEl.insertBefore(delta < 0 ? row : sibling, delta < 0 ? sibling : row); refreshItemOrder(); preview(); }
  function itemPayload(row, index) {
    const get = (key) => row.querySelector(`[data-key=${key}]`).value;
    const savedItem = (quote.items || []).find((item) => item.id === row.dataset.itemId) || {};
    const materialSaleControl = row.querySelector("[data-key=materialSaleUnitPrice]");
    const result = { ...savedItem, id: row.dataset.itemId, groupId: get("groupId") || null, name: get("name"), nameEn: get("nameEn"), materialId: get("materialId"), width: Number(get("width")), height: Number(get("height")), sizeUnit: get("sizeUnit"), quantity: Number(get("quantity")), sides: Number(get("sides")), manualAdjustment: get("manualAdjustment") === "" || Number(get("manualAdjustment")) === Number(savedItem.manualAdjustment || 0) ? savedItem.manualAdjustment : Number(get("manualAdjustment")), notes: get("notes"), position: index, processes: [...row.querySelectorAll("[data-process-id]:checked")].map((control, position) => { const savedProcess = (savedItem.processes || []).find((process) => process.processId === control.dataset.processId) || {}; const price = control.closest("label").querySelector("[data-process-price]"); return { ...savedProcess, id: savedProcess.id || uid("ADP"), processId: control.dataset.processId, position, ...(price && price.value !== "" ? { actualSalePrice: Number(price.value) } : {}) }; }) };
    if (materialSaleControl) {
      if (materialSaleControl.value === "") delete result.materialSaleUnitPrice;
      else result.materialSaleUnitPrice = Number(materialSaleControl.value);
    }
    return result;
  }

  function basePayload() {
    return { entityId: form.elements.entityId.value, clientName: form.elements.clientName.value, projectName: form.elements.projectName.value, mode: form.elements.mode.value, language: form.elements.language.value, currency: form.elements.currency.value, vatMode: form.elements.vatMode.value, vatRate: 20, discountPercent: number(form.elements.discountPercent), fixedDiscount: number(form.elements.fixedDiscount), adjustmentReason: form.elements.adjustmentReason.value };
  }
  function v1Payload() {
    const legacyQuote = structuredClone(quote);
    delete legacyQuote.pricingEngine;
    delete legacyQuote.fxSnapshot;
    delete legacyQuote.bomLines;
    const savedInstallationFee = (quote.additionalFees || []).find((fee) => fee.category === "installation");
    const installationPrice = number(form.elements.installationPrice);
    const additionalFees = (quote.additionalFees || []).flatMap((fee) => fee === savedInstallationFee ? (installationPrice > 0 ? [{ ...fee, saleUnitPrice: installationPrice }] : []) : [fee]);
    if (!savedInstallationFee && installationPrice > 0) additionalFees.push({ id: uid("ADF"), category: "installation", name: "安装", quantity: 1, saleUnitPrice: installationPrice, position: additionalFees.length });
    return { ...legacyQuote, ...basePayload(), currency: quote.currency || "EUR", groups: groups.map((group, position) => ({ ...group, position })), minimumProcessingFee: number(form.elements.minimumProcessingFee), minimumOrderAmount: number(form.elements.minimumOrderAmount), adjustment: number(form.elements.adjustment), items: [...document.querySelectorAll(".advertising-item")].map(itemPayload), delivery: { ...(quote.delivery || {}), enabled: form.elements.deliveryEnabled.checked, quantity: number(form.elements.deliveryQuantity), saleUnitPrice: number(form.elements.deliveryPrice) }, additionalFees };
  }
  function v2Payload() {
    const savedItem = quote.items?.[0] || {};
    return {
      ...basePayload(),
      pricingEngine: "bom_v2",
      items: [{
        id: savedItem.id,
        name: form.elements.productName.value,
        nameEn: form.elements.productNameEn.value,
        bomTemplateCode: "pvc_uv_board_v1",
        width: number(form.elements.width),
        height: number(form.elements.height),
        sizeUnit: form.elements.sizeUnit.value,
        quantity: number(form.elements.quantity),
        sides: number(form.elements.sides),
        laborHours: number(form.elements.laborHours),
        installationQuantity: number(form.elements.installationQuantity),
        transportTrips: number(form.elements.transportTrips),
        designHours: number(form.elements.designHours),
        notes: form.elements.notes.value,
      }],
    };
  }
  function payload() { return isV2 ? v2Payload() : v1Payload(); }

  function renderTotals(result) {
    const currency = result.quoteCurrency || form.elements.currency.value;
    document.querySelector("#adv-subtotal").textContent = `${Number(result.subtotalExcludingVat || 0).toFixed(2)} ${currency}`;
    document.querySelector("#adv-vat").textContent = `${Number(result.vatAmount || 0).toFixed(2)} ${currency}`;
    document.querySelector("#adv-total").textContent = `${Number(result.totalIncludingVat || 0).toFixed(2)} ${currency}`;
    if (!isV2) groupsEl.querySelectorAll(".advertising-group").forEach((row) => { const sum = (result.items || []).filter((item) => item.groupId === row.dataset.groupId).reduce((total, item) => total + Number(item.saleAmount || 0), 0); row.querySelector("[data-group-subtotal]").textContent = `${sum.toFixed(2)} ${currency}`; });
  }
  function renderFxSnapshot(snapshot) {
    const target = document.querySelector("#adv-fx-value");
    target.textContent = snapshot ? `${snapshot.baseCurrency}/${snapshot.quoteCurrency} · ${Number(snapshot.rate).toFixed(4)} · ${snapshot.rateDate} · ${snapshot.source}` : labels.fxAfterSave;
  }
  function preview() {
    clearTimeout(timer);
    const status = document.querySelector("#adv-calc-status");
    status.textContent = "正在重新计算…";
    const calculateUrl = quote.id ? `/api/advertising/quotes/${encodeURIComponent(quote.id)}/calculate` : "/api/advertising/quotes/calculate";
    timer = setTimeout(() => fetch(calculateUrl, { method: "POST", headers: headers(), body: JSON.stringify(payload()) }).then(async (response) => { const result = await response.json(); if (!response.ok || result.error) throw new Error(result.error || "金额计算失败"); renderTotals(result); status.textContent = "金额已更新"; }).catch((error) => { status.textContent = `计算失败：${error.message}`; }), 180);
  }
  function setEditorMode() {
    document.querySelector("#adv-pricing-engine").value = isV2 ? "bom_v2" : "legacy_v1";
    document.querySelector("#adv-v1-editor").hidden = isV2;
    document.querySelector("#adv-v2-editor").hidden = !isV2;
    document.querySelector("#adv-v1-editor").querySelectorAll("input, select, textarea").forEach((control) => { control.disabled = isV2; });
    document.querySelector("#adv-v2-editor").querySelectorAll("input, select, textarea").forEach((control) => { control.disabled = !isV2; });
    document.querySelectorAll(".adv-v1-only").forEach((node) => { node.hidden = isV2; });
    document.querySelector("#adv-currency-field").classList.toggle("hidden", !isV2);
    form.elements.currency.disabled = !isV2;
    renderGroups();
  }
  function populateV2(item = {}) {
    const values = { productName: item.name || labels.pvcUvBoard, productNameEn: item.nameEn || labels.pvcUvBoardEn, width: item.width ?? 1, height: item.height ?? 1, sizeUnit: item.sizeUnit || "m", quantity: item.quantity ?? 1, sides: item.sides ?? 1, laborHours: item.laborHours ?? 0, installationQuantity: item.installationQuantity ?? 0, transportTrips: item.transportTrips ?? 0, designHours: item.designHours ?? 0, notes: item.notes || "" };
    Object.entries(values).forEach(([key, value]) => { form.elements[key].value = value; });
  }
  const load = () => Promise.all([
    fetch("/api/advertising/catalog", { headers: headers() }).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "广告价格库加载失败。"); return result; }),
    params.get("id") ? fetch(`/api/advertising/quotes/${encodeURIComponent(params.get("id"))}`, { headers: headers() }).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "广告报价加载失败。"); return result; }) : Promise.resolve({}),
  ]).then(([loadedCatalog, loadedQuote]) => {
    catalog = loadedCatalog;
    quote = loadedQuote;
    isV2 = quote.id ? quote.pricingEngine === "bom_v2" : true;
    groups = quote.groups || [];
    form.elements.entityId.innerHTML = catalog.entities.map((entity) => `<option value="${esc(entity.id)}">${esc(entity.nameEn || entity.nameZh || entity.code)}</option>`).join("");
    ["entityId", "clientName", "projectName", "mode", "language", "currency", "vatMode", "minimumProcessingFee", "minimumOrderAmount", "discountPercent", "fixedDiscount", "adjustment", "adjustmentReason"].forEach((key) => { if (quote[key] !== undefined && form.elements[key]) form.elements[key].value = quote[key]; });
    if (!quote.currency) form.elements.currency.value = "EUR";
    setEditorMode();
    if (isV2) populateV2(quote.items?.[0]);
    else {
      if (quote.delivery) { form.elements.deliveryEnabled.checked = quote.delivery.enabled; form.elements.deliveryQuantity.value = quote.delivery.quantity || 1; form.elements.deliveryPrice.value = quote.delivery.saleUnitPrice || 150; }
      const installationFee = (quote.additionalFees || []).find((fee) => fee.category === "installation");
      form.elements.installationPrice.value = installationFee?.saleUnitPrice ?? 0;
      (quote.items?.length ? quote.items : [{}]).forEach(itemTemplate);
    }
    renderFxSnapshot(quote.id && isV2 ? quote.fxSnapshot : null);
    if (quote.calculationSnapshot) renderTotals(quote.calculationSnapshot);
    preview();
  }).catch((error) => alert(error.message));
  if (window.__AUTH_READY__) load(); else document.addEventListener("authReady", load, { once: true });

  document.querySelector("#adv-add-group").onclick = () => { groups.push({ id: uid("ADG"), nameZh: `分组 ${groups.length + 1}`, nameEn: "", notes: "" }); renderGroups(); refreshItemGroupOptions(); };
  document.querySelector("#adv-add-item").onclick = () => itemTemplate({});
  form.elements.mode.onchange = renderGroups;
  form.addEventListener("input", preview);
  document.querySelector("#adv-save").onclick = () => {
    if (!form.reportValidity()) return;
    const body = payload();
    if (!isV2 && quote.id && body.adjustment !== Number(quote.adjustment || 0) && !body.adjustmentReason.trim()) { alert("手工调价必须填写原因。"); return; }
    fetch(quote.id ? `/api/advertising/quotes/${encodeURIComponent(quote.id)}` : "/api/advertising/quotes", { method: quote.id ? "PUT" : "POST", headers: headers(), body: JSON.stringify(body) }).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); quote = result; isV2 = quote.pricingEngine === "bom_v2"; history.replaceState(null, "", `?id=${encodeURIComponent(result.id)}`); renderFxSnapshot(isV2 ? quote.fxSnapshot : null); renderTotals(quote.calculationSnapshot || quote); alert(`已保存 ${result.quoteNumber}`); }).catch((error) => alert(error.message));
  };

  function printQuote(internal = false) {
    if (!quote.id) { alert("请先保存报价。"); return; }
    const calculation = quote.calculationSnapshot || {};
    const visible = (quote.items || []).filter((item) => item.customerVisible !== false);
    const rows = visible.map((item) => { const calculated = (calculation.items || []).find((entry) => entry.id === item.id) || item; return { name: item.name || "广告产品", quantity: item.quantity || 1, amount: Number(calculated.saleAmount || 0), cost: internal ? Number(calculated.costAmount || 0) : null }; });
    for (const fee of (calculation.additionalFees || []).filter((entry) => entry.customerVisible !== false && entry.category !== "delivery")) rows.push({ name: fee.nameZh || fee.name || fee.category || "附加服务", quantity: fee.quantity || 1, amount: Number(fee.saleAmount || 0), cost: internal ? Number(fee.costAmount || 0) : null });
    const summary = [["最低订单补差", calculation.minimumOrderSurcharge], ["配送费", calculation.deliverySale], ["加急费", calculation.urgentSale], ["折扣", -Number(calculation.discountAmount || 0)], ["整单调整", calculation.adjustment], ["VAT", calculation.vatAmount]];
    for (const [name, value] of summary) { const amount = Number(value || 0); if (Math.abs(amount) > 0.0001) rows.push({ name, quantity: 1, amount, cost: null }); }
    const total = Number(calculation.totalIncludingVat ?? calculation.subtotalExcludingVat ?? 0);
    const detail = rows.reduce((sum, row) => sum + row.amount, 0);
    const difference = Number((total - detail).toFixed(2));
    if (Math.abs(difference) > 0.0001) rows.push({ name: "其他已计入金额", quantity: 1, amount: difference, cost: null });
    const company = quote.entitySnapshot || {};
    const popup = window.open("about:blank", "_blank");
    if (!popup) { alert("浏览器阻止了打印窗口，请允许弹窗后重试。"); return; }
    popup.opener = null;
    const rowHtml = rows.map((row) => `<tr><td>${esc(row.name)}</td><td>${esc(row.quantity)}</td>${internal ? `<td>${row.cost === null ? "—" : Number(row.cost).toFixed(2)}</td>` : ""}<td>${Number(row.amount).toFixed(2)}</td></tr>`).join("");
    popup.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(quote.quoteNumber || "广告报价")}</title><style>@page{size:A4;margin:15mm}body{font-family:Arial,"PingFang SC",sans-serif;color:#172033}header{border-bottom:2px solid #193b63;margin-bottom:24px}h1{font-size:26px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd5df;padding:8px;text-align:left}th{background:#edf3f8}.total{text-align:right;font-size:22px;font-weight:700;margin-top:20px}.internal{color:#a33;font-weight:700}@media print{button{display:none}}</style></head><body><header><strong>${esc(company.nameEn || company.nameZh || company.code || "")}</strong>${internal ? '<p class="internal">内部核算版 / INTERNAL USE ONLY</p>' : ""}<h1>广告制作报价 / Advertising Production Quotation</h1><p>编号：${esc(quote.quoteNumber || "")} 客户：${esc(quote.clientName || "")} 项目：${esc(quote.projectName || "")}</p></header><table><thead><tr><th>项目</th><th>数量</th>${internal ? "<th>成本</th>" : ""}<th>金额 (${esc(quote.currency || "EUR")})</th></tr></thead><tbody>${rowHtml}</tbody></table><p class="total">总计：${esc(quote.currency || "EUR")} ${total.toFixed(2)}</p><button onclick="window.print()">打印 / 保存为 PDF</button><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250))<\/script></body></html>`);
    popup.document.close();
  }
  async function download(format, internal = false) { if (format === "pdf") { printQuote(internal); return; } if (!quote.id) { alert("请先保存报价。"); return; } const response = await fetch(`/api/advertising/quotes/${encodeURIComponent(quote.id)}/export/${format}${internal ? "?internal=1" : ""}`, { method: "POST", headers: headers() }); if (!response.ok) { const result = await response.json(); alert(result.error); return; } const blob = await response.blob(); const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = (response.headers.get("content-disposition")?.match(/filename="([^"]+)"/) || [])[1] || `${quote.quoteNumber}.${format === "docx" ? "docx" : "pdf"}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 1000); }
  document.querySelector("#adv-export-docx").onclick = () => download("docx");
  document.querySelector("#adv-export-pdf").onclick = () => download("pdf");
  document.querySelector("#adv-export-internal-docx").onclick = () => download("docx", true);
  document.querySelector("#adv-export-internal-pdf").onclick = () => download("pdf", true);
  const revealInternalExports = () => { if (window.can("advertising_quote.cost_view")) { document.querySelector("#adv-export-internal-docx").classList.remove("hidden"); document.querySelector("#adv-export-internal-pdf").classList.remove("hidden"); } };
  if (window.__AUTH_READY__) revealInternalExports(); else document.addEventListener("authReady", revealInternalExports, { once: true });
})();
