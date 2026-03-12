const state = {
  templates: [],
  meta: null,
};

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
      <label><span>\u7528\u8f66\u7c7b\u578b</span><select name="detailType">${createOptionList(vehicleDetailTypeOptions, defaults?.detailType || "pickup", "vehicleDetailTypeLabels")}</select></label>
      <label><span>\u8f66\u578b</span><input name="vehicleModel" value="${defaults?.vehicleModel || ""}" placeholder="\u4f8b\u5982\uff1a\u5954\u9a70 V \u7ea7" /></label>
      <label><span>\u8f66\u8f86\u6570</span><input name="vehicleCount" type="number" min="1" step="1" value="${defaults?.vehicleCount || 1}" /></label>
      <label><span>\u8ba1\u4ef7\u5355\u4f4d</span><select name="pricingUnit">${createOptionList(vehiclePricingUnitOptions, defaults?.pricingUnit || "trip", "vehiclePricingUnitLabels")}</select></label>
      <label><span>\u6210\u672c\u5355\u4ef7</span><input name="costUnitPrice" type="number" min="0" step="0.01" value="${defaults?.costUnitPrice ?? ""}" placeholder="0.00" /></label>
      <label><span>\u9500\u552e\u5355\u4ef7</span><input name="priceUnitPrice" type="number" min="0" step="0.01" value="${defaults?.priceUnitPrice ?? ""}" placeholder="0.00" /></label>
      <label><span>\u5e01\u79cd</span><select name="currency">${createOptionList(currencies, defaults?.currency || quoteCurrency || "EUR", "currencyLabels")}</select></label>
      <label><span>\u6210\u672c\u5c0f\u8ba1</span><input name="costSubtotal" value="${window.AppUtils.formatCurrency(0, defaults?.currency || quoteCurrency || "EUR")}" readonly /></label>
      <label><span>\u9500\u552e\u5c0f\u8ba1</span><input name="priceSubtotal" value="${window.AppUtils.formatCurrency(0, defaults?.currency || quoteCurrency || "EUR")}" readonly /></label>
      <label class="vehicle-detail-note"><span>\u5907\u6ce8</span><input name="notes" value="${defaults?.notes || ""}" placeholder="\u4f8b\u5982\uff1a\u542b\u9ad8\u901f\u3001\u53f8\u673a\u61c2\u4e2d\u6587" /></label>
      <div class="vehicle-detail-actions">
        <button type="button" class="ghost mini-button delete-vehicle-detail">\u5220\u9664\u7528\u8f66\u660e\u7ec6</button>
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
          <strong>\u62a5\u4ef7\u9879\u76ee</strong>
          <p class="meta">\u9009\u62e9\u670d\u52a1\u7c7b\u578b\u540e\uff0c\u53ef\u7ee7\u7eed\u7f16\u8f91\u540d\u79f0\u3001\u5e01\u79cd\u3001\u6570\u91cf\u3001\u6210\u672c\u4e0e\u552e\u4ef7\uff1b\u9152\u5e97\u3001\u7528\u8f66\u3001\u5bfc\u6e38\u548c\u7ffb\u8bd1\u7c7b\u578b\u652f\u6301\u660e\u7ec6\u5f55\u5165\u3002</p>
        </div>
        <button type="button" class="ghost mini-button delete-item">\u5220\u9664\u6b64\u9879</button>
      </div>
      <div class="item-card-grid quote-item-grid quote-item-grid-wide">
        <label class="field-block field-span-1"><span>\u670d\u52a1\u7c7b\u578b</span><select name="type">${createOptionList(types, "hotel", "quoteItemTypeLabels")}</select></label>
        <label class="field-block field-span-2"><span>\u670d\u52a1\u540d\u79f0</span><input name="name" placeholder="\u4f8b\u5982\uff1a\u8d1d\u5c14\u683c\u83b1\u5fb7\u5546\u52a1\u9152\u5e97 / \u5546\u52a1\u8f66\u670d\u52a1 / \u5bfc\u6e38\u670d\u52a1" /></label>
        <label class="field-block field-span-1 simple-pricing-field"><span>\u9879\u76ee\u5e01\u79cd</span><select name="currency">${createOptionList(currencies, defaultCurrency, "currencyLabels")}</select></label>
        <label class="field-block field-span-1"><span>\u5355\u4f4d</span><input name="unit" placeholder="\u4f8b\u5982\uff1a\u9879 / \u8d9f / \u4eba / \u5929" value="\u9879" /></label>
        <label class="field-block field-span-2"><span>\u4f9b\u5e94\u5546</span><input name="supplier" placeholder="\u4f8b\u5982\uff1a\u5f53\u5730\u9152\u5e97\u3001\u8f66\u961f\u3001\u5730\u63a5\u4f9b\u5e94\u5546" /></label>
        <label class="field-block field-span-1 simple-pricing-field"><span>\u6570\u91cf</span><input name="quantity" type="number" step="1" placeholder="1" value="1" min="1" /></label>
        <label class="field-block field-span-1 simple-pricing-field"><span>\u6210\u672c\u5355\u4ef7</span><input name="cost" type="number" step="0.01" placeholder="0.00" min="0" /></label>
        <label class="field-block field-span-1 simple-pricing-field"><span>\u9500\u552e\u5355\u4ef7</span><input name="price" type="number" step="0.01" placeholder="0.00" min="0" /></label>
        <label class="field-block field-span-3"><span>\u5907\u6ce8\u8bf4\u660e</span><input name="notes" placeholder="\u4f8b\u5982\uff1a\u542b\u65e9\u9910\u3001\u53f8\u673a\u4f1a\u4e2d\u6587\u3001\u6309\u5b9e\u9645\u4eba\u6570\u7ed3\u7b97" /></label>
      </div>
      <section class="hotel-detail-box hidden">
        <div class="panel-head form-section-head-row hotel-detail-head">
          <div>
            <h3>\u9152\u5e97\u660e\u7ec6</h3>
            <p class="meta">\u652f\u6301\u540c\u4e00\u5bb6\u9152\u5e97\u4e0b\u5f55\u5165\u591a\u4e2a\u623f\u578b\u3001\u623f\u95f4\u6570\u3001\u665a\u6570\u3001\u6bcf\u665a\u6210\u672c\u4ef7\u548c\u6bcf\u665a\u9500\u552e\u4ef7\u3002</p>
            <p class="hotel-detail-tip">\u9ed8\u8ba4\u6309\u5f53\u524d\u884c\u7a0b\u5929\u6570\u5e26\u51fa\u665a\u6570\uff0c\u540e\u7eed\u53ef\u6309\u623f\u578b\u5355\u72ec\u8c03\u6574\u3002</p>
          </div>
          <button type="button" class="ghost add-hotel-detail">\u65b0\u589e\u623f\u578b\u660e\u7ec6</button>
        </div>
        <div class="hotel-detail-list stack"></div>
        <div class="hotel-detail-summary">
          <span>\u9152\u5e97\u5408\u8ba1</span>
          <strong class="hotel-total-value">\u6210\u672c ${window.AppUtils.formatCurrency(0, defaultCurrency)} / \u9500\u552e ${window.AppUtils.formatCurrency(0, defaultCurrency)}</strong>
        </div>
      </section>
      <section class="vehicle-detail-box hidden">
        <div class="panel-head form-section-head-row vehicle-detail-head">
          <div>
            <h3>\u7528\u8f66\u660e\u7ec6</h3>
            <p class="meta">\u652f\u6301\u540c\u4e00\u6761\u7528\u8f66\u9879\u76ee\u4e0b\u5f55\u5165\u63a5\u673a\u3001\u9001\u673a\u3001\u5168\u5929\u7b49\u591a\u6761\u660e\u7ec6\uff0c\u5e76\u81ea\u52a8\u6c47\u603b\u6210\u672c\u4e0e\u9500\u552e\u91d1\u989d\u3002</p>
          </div>
          <button type="button" class="ghost add-vehicle-detail">\u65b0\u589e\u7528\u8f66\u660e\u7ec6</button>
        </div>
        <div class="vehicle-detail-list stack"></div>
        <div class="vehicle-detail-summary">
          <span>\u7528\u8f66\u5408\u8ba1</span>
          <strong class="vehicle-total-value">\u6210\u672c ${window.AppUtils.formatCurrency(0, defaultCurrency)} / \u9500\u552e ${window.AppUtils.formatCurrency(0, defaultCurrency)}</strong>
        </div>
      </section>
      <section class="service-detail-box hidden">
        <div class="panel-head form-section-head-row service-detail-head">
          <div>
            <h3>\u670d\u52a1\u660e\u7ec6</h3>
            <p class="meta">\u5bfc\u6e38\u548c\u7ffb\u8bd1\u9879\u76ee\u53ef\u6309\u89d2\u8272\u3001\u8bed\u8a00\u3001\u670d\u52a1\u65f6\u957f\u62c6\u5206\u591a\u6761\u660e\u7ec6\uff0c\u5e76\u81ea\u52a8\u6c47\u603b\u6210\u672c\u4e0e\u9500\u552e\u91d1\u989d\u3002</p>
          </div>
          <button type="button" class="ghost add-service-detail">\u65b0\u589e\u670d\u52a1\u660e\u7ec6</button>
        </div>
        <div class="service-detail-list stack"></div>
        <div class="service-detail-summary">
          <span>\u670d\u52a1\u5408\u8ba1</span>
          <strong class="service-total-value">\u6210\u672c ${window.AppUtils.formatCurrency(0, defaultCurrency)} / \u9500\u552e ${window.AppUtils.formatCurrency(0, defaultCurrency)}</strong>
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
    costUnitPrice: Number(detailRow.querySelector('[name="costUnitPrice"]').value || 0),
    priceUnitPrice: Number(detailRow.querySelector('[name="priceUnitPrice"]').value || 0),
    currency: detailRow.querySelector('[name="currency"]').value,
    notes: detailRow.querySelector('[name="notes"]').value.trim(),
  })).filter((detail) => detail.vehicleModel || detail.notes || detail.detailType !== "pickup" || detail.pricingUnit !== "trip" || detail.vehicleCount !== 1 || detail.costUnitPrice !== 0 || detail.priceUnitPrice !== 0);
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

function getItemRows() {
  return Array.from(document.querySelectorAll(".item-card")).map((row) => ({
    type: row.querySelector('[name="type"]').value,
    name: row.querySelector('[name="name"]').value.trim(),
    unit: row.querySelector('[name="unit"]').value.trim(),
    supplier: row.querySelector('[name="supplier"]').value.trim(),
    currency: row.querySelector('[name="currency"]').value,
    cost: Number(row.querySelector('[name="cost"]').value || 0),
    price: Number(row.querySelector('[name="price"]').value || 0),
    quantity: Number(row.querySelector('[name="quantity"]').value || 0),
    notes: row.querySelector('[name="notes"]').value.trim(),
    hotelDetails: getHotelDetailRows(row),
    vehicleDetails: getVehicleDetailRows(row),
    serviceDetails: getServiceDetailRows(row),
  })).filter((item) => item.name || item.supplier || item.cost || item.price || item.quantity !== 1 || item.notes || item.hotelDetails.length > 0 || item.vehicleDetails.length > 0 || item.serviceDetails.length > 0);
}
function calculateHotelSubtotals(detail) {
  return {
    costSubtotal: Number(detail.roomCount || 0) * Number(detail.nights || 0) * Number(detail.costNightlyRate || 0),
    priceSubtotal: Number(detail.roomCount || 0) * Number(detail.nights || 0) * Number(detail.priceNightlyRate || 0),
  };
}

function calculateVehicleSubtotals(detail) {
  return {
    costSubtotal: Number(detail.vehicleCount || 0) * Number(detail.costUnitPrice || 0),
    priceSubtotal: Number(detail.vehicleCount || 0) * Number(detail.priceUnitPrice || 0),
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
  row.querySelector(totalSelector).textContent = `\u6210\u672c ${window.AppUtils.formatCurrency(totalCostOriginal, quoteCurrency || "EUR")} / \u9500\u552e ${window.AppUtils.formatCurrency(totalPriceOriginal, quoteCurrency || "EUR")}`;
}

function refreshHotelItemSummary(row, quoteCurrency) {
  refreshDetailSummary(row, getHotelDetailRows(row), calculateHotelSubtotals, '.hotel-total-value', '\u9152\u5e97', quoteCurrency);
}

function refreshVehicleItemSummary(row, quoteCurrency) {
  refreshDetailSummary(row, getVehicleDetailRows(row), calculateVehicleSubtotals, '.vehicle-total-value', '\u7528\u8f66', quoteCurrency);
}

function refreshServiceItemSummary(row, quoteCurrency) {
  refreshDetailSummary(row, getServiceDetailRows(row), calculateServiceSubtotals, '.service-total-value', '\u670d\u52a1', quoteCurrency);
}

function toggleDetailFields(row) {
  const type = row.querySelector('[name="type"]').value;
  const hotelBox = row.querySelector('.hotel-detail-box');
  const vehicleBox = row.querySelector('.vehicle-detail-box');
  const serviceBox = row.querySelector('.service-detail-box');
  const simpleFields = row.querySelectorAll('.simple-pricing-field');

  if (type === "hotel") {
    hotelBox.classList.remove("hidden");
    vehicleBox.classList.add("hidden");
    serviceBox.classList.add("hidden");
    simpleFields.forEach((field) => field.classList.add("hidden"));
    return;
  }

  if (type === "vehicle") {
    hotelBox.classList.add("hidden");
    vehicleBox.classList.remove("hidden");
    serviceBox.classList.add("hidden");
    simpleFields.forEach((field) => field.classList.add("hidden"));
    return;
  }

  if (["guide", "interpreter"].includes(type)) {
    hotelBox.classList.add("hidden");
    vehicleBox.classList.add("hidden");
    serviceBox.classList.remove("hidden");
    simpleFields.forEach((field) => field.classList.add("hidden"));
    return;
  }

  hotelBox.classList.add("hidden");
  vehicleBox.classList.add("hidden");
  serviceBox.classList.add("hidden");
  simpleFields.forEach((field) => field.classList.remove("hidden"));
}

function validateQuoteForm(form) {
  if (!form.reportValidity()) {
    return false;
  }

  if (Number(form.travelDays.value || 0) <= 0) {
    window.AppUtils.showMessage("quote-message", "\u8bf7\u5148\u586b\u5199\u6b63\u786e\u7684\u884c\u7a0b\u5f00\u59cb\u65e5\u671f\u548c\u7ed3\u675f\u65e5\u671f\u3002", "error");
    return false;
  }

  if (Number(form.paxCount.value || 0) <= 0) {
    window.AppUtils.showMessage("quote-message", "\u8bf7\u586b\u5199\u6b63\u786e\u7684\u51fa\u884c\u4eba\u6570\uff08PAX\uff09\u3002", "error");
    return false;
  }

  const items = getItemRows();
  if (items.length === 0) {
    window.AppUtils.showMessage("quote-message", "\u8bf7\u81f3\u5c11\u5f55\u5165\u4e00\u6761\u62a5\u4ef7\u9879\u76ee\u3002", "error");
    return false;
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.name) {
      window.AppUtils.showMessage("quote-message", `\u8bf7\u586b\u5199\u7b2c ${index + 1} \u6761\u62a5\u4ef7\u9879\u76ee\u7684\u670d\u52a1\u540d\u79f0\u3002`, "error");
      return false;
    }

    if (item.type === "hotel") {
      if (item.hotelDetails.length === 0) {
        window.AppUtils.showMessage("quote-message", `\u7b2c ${index + 1} \u6761\u9152\u5e97\u9879\u76ee\u8bf7\u81f3\u5c11\u5f55\u5165\u4e00\u6761\u623f\u578b\u660e\u7ec6\u3002`, "error");
        return false;
      }
      for (let detailIndex = 0; detailIndex < item.hotelDetails.length; detailIndex += 1) {
        const detail = item.hotelDetails[detailIndex];
        if (!detail.roomType) {
          window.AppUtils.showMessage("quote-message", `\u8bf7\u586b\u5199\u7b2c ${index + 1} \u6761\u9152\u5e97\u9879\u76ee\u7b2c ${detailIndex + 1} \u6761\u623f\u578b\u660e\u7ec6\u7684\u623f\u578b\u540d\u79f0\u3002`, "error");
          return false;
        }
        if (detail.roomCount <= 0 || detail.nights <= 0) {
          window.AppUtils.showMessage("quote-message", `\u7b2c ${index + 1} \u6761\u9152\u5e97\u9879\u76ee\u7b2c ${detailIndex + 1} \u6761\u623f\u578b\u660e\u7ec6\u7684\u623f\u95f4\u6570\u548c\u665a\u6570\u5fc5\u987b\u5927\u4e8e 0\u3002`, "error");
          return false;
        }
      }
      continue;
    }

    if (item.type === "vehicle") {
      if (item.vehicleDetails.length === 0) {
        window.AppUtils.showMessage("quote-message", `\u7b2c ${index + 1} \u6761\u7528\u8f66\u9879\u76ee\u8bf7\u81f3\u5c11\u5f55\u5165\u4e00\u6761\u7528\u8f66\u660e\u7ec6\u3002`, "error");
        return false;
      }
      for (let detailIndex = 0; detailIndex < item.vehicleDetails.length; detailIndex += 1) {
        const detail = item.vehicleDetails[detailIndex];
        if (!detail.vehicleModel) {
          window.AppUtils.showMessage("quote-message", `\u8bf7\u586b\u5199\u7b2c ${index + 1} \u6761\u7528\u8f66\u9879\u76ee\u7b2c ${detailIndex + 1} \u6761\u660e\u7ec6\u7684\u8f66\u578b\u3002`, "error");
          return false;
        }
        if (detail.vehicleCount <= 0) {
          window.AppUtils.showMessage("quote-message", `\u7b2c ${index + 1} \u6761\u7528\u8f66\u9879\u76ee\u7b2c ${detailIndex + 1} \u6761\u660e\u7ec6\u7684\u8f66\u8f86\u6570\u5fc5\u987b\u5927\u4e8e 0\u3002`, "error");
          return false;
        }
      }
      continue;
    }

    if (["guide", "interpreter"].includes(item.type)) {
      if (item.serviceDetails.length === 0) {
        window.AppUtils.showMessage("quote-message", `\u7b2c ${index + 1} \u6761\u670d\u52a1\u9879\u76ee\u8bf7\u81f3\u5c11\u5f55\u5165\u4e00\u6761\u670d\u52a1\u660e\u7ec6\u3002`, "error");
        return false;
      }
      for (let detailIndex = 0; detailIndex < item.serviceDetails.length; detailIndex += 1) {
        const detail = item.serviceDetails[detailIndex];
        if (detail.quantity <= 0) {
          window.AppUtils.showMessage("quote-message", `\u7b2c ${index + 1} \u6761\u670d\u52a1\u9879\u76ee\u7b2c ${detailIndex + 1} \u6761\u660e\u7ec6\u7684\u6570\u91cf\u5fc5\u987b\u5927\u4e8e 0\u3002`, "error");
          return false;
        }
      }
      continue;
    }

    if (!item.unit) {
      window.AppUtils.showMessage("quote-message", `\u8bf7\u586b\u5199\u7b2c ${index + 1} \u6761\u62a5\u4ef7\u9879\u76ee\u7684\u5355\u4f4d\u3002`, "error");
      return false;
    }
    if (item.quantity <= 0) {
      window.AppUtils.showMessage("quote-message", `\u7b2c ${index + 1} \u6761\u62a5\u4ef7\u9879\u76ee\u7684\u6570\u91cf\u5fc5\u987b\u5927\u4e8e 0\u3002`, "error");
      return false;
    }
    if (item.cost < 0 || item.price < 0) {
      window.AppUtils.showMessage("quote-message", `\u7b2c ${index + 1} \u6761\u62a5\u4ef7\u9879\u76ee\u7684\u91d1\u989d\u4e0d\u80fd\u4e3a\u8d1f\u6570\u3002`, "error");
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
  return `<div class="vehicle-preview-lines">${item.vehicleDetails.map((detail) => `<p class="meta preview-subline">${getVehicleDetailTypeLabel(detail.detailType)} / ${detail.vehicleModel} / ${detail.vehicleCount} \u8f66 / ${getVehiclePricingUnitLabel(detail.pricingUnit)} / \u6210\u672c ${window.AppUtils.formatCurrency(detail.costSubtotalOriginal, detail.currency)}\uff08\u6298\u7b97 ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}\uff09/ \u9500\u552e ${window.AppUtils.formatCurrency(detail.priceSubtotalOriginal, detail.currency)}\uff08\u6298\u7b97 ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}\uff09</p>`).join("")}</div>`;
}

function renderServicePreview(item, quoteCurrency) {
  if (!item.serviceDetails || item.serviceDetails.length === 0) {
    return "";
  }
  return `<div class="service-preview-lines">${item.serviceDetails.map((detail) => `<p class="meta preview-subline">${getServiceRoleLabel(detail.serviceRole)} / ${getServiceLanguageLabel(detail.serviceLanguage)} / ${getServiceDurationLabel(detail.serviceDuration)} / \u6570\u91cf ${detail.quantity} / \u6210\u672c ${window.AppUtils.formatCurrency(detail.costSubtotalOriginal, detail.currency)}\uff08\u6298\u7b97 ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}\uff09/ \u9500\u552e ${window.AppUtils.formatCurrency(detail.priceSubtotalOriginal, detail.currency)}\uff08\u6298\u7b97 ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}\uff09</p>`).join("")}</div>`;
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
              <p class="meta preview-subline">${["hotel", "vehicle", "guide", "interpreter"].includes(item.type) ? `\u6210\u672c\u5408\u8ba1\uff1a${window.AppUtils.formatCurrency(item.totalCost, quoteCurrency)} / \u9500\u552e\u5408\u8ba1\uff1a${window.AppUtils.formatCurrency(item.totalPrice, quoteCurrency)}` : `\u539f\u5e01\u79cd\uff1a${window.AppUtils.formatCurrency(item.totalPriceOriginal, item.currency)}\uff0c\u6298\u7b97\u540e\uff1a${window.AppUtils.formatCurrency(item.totalPrice, quoteCurrency)}`}</p>
              ${item.type === "hotel" ? renderHotelPreview(item, quoteCurrency) : ""}
              ${item.type === "vehicle" ? renderVehiclePreview(item, quoteCurrency) : ""}
              ${["guide", "interpreter"].includes(item.type) ? renderServicePreview(item, quoteCurrency) : ""}
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
    <section class="form-section quote-items-section"><div class="form-section-head form-section-head-row"><div><h2>\u62a5\u4ef7\u9879\u76ee</h2><p class="meta">\u9152\u5e97\u3001\u7528\u8f66\u3001\u5bfc\u6e38\u548c\u7ffb\u8bd1\u9879\u76ee\u652f\u6301\u660e\u7ec6\u5f55\u5165\uff0c\u7cfb\u7edf\u4f1a\u81ea\u52a8\u6c47\u603b\u6210\u672c\u548c\u9500\u552e\u91d1\u989d\u3002</p></div><div class="template-actions"><a class="button-link small-link" href="/templates.html">\u7ba1\u7406\u6a21\u677f</a><button type="button" id="add-item">\u65b0\u589e\u62a5\u4ef7\u9879\u76ee</button></div></div><div class="template-toolbar"><label class="template-selector"><span>\u5feb\u901f\u63d2\u5165\u6a21\u677f</span><select id="template-select" name="templateKey">${createTemplateOptionList(selectedTemplateId)}</select></label><div class="template-actions"><button type="button" id="apply-template" class="ghost">\u63d2\u5165\u6a21\u677f\u9879\u76ee</button></div></div><p id="template-description" class="meta template-description">${defaultTemplate ? defaultTemplate.description : "\u6682\u65e0\u6a21\u677f\u8bf4\u660e\u3002"}</p><div id="items-container" class="stack"></div></section>
    <div class="button-row"><button type="submit">\u4fdd\u5b58\u62a5\u4ef7</button><a class="button-link ghost-link" href="/quotes.html">\u8fd4\u56de\u5217\u8868</a></div>
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
  return { roomType: item?.name || "", roomCount: 1, nights: Number(item?.quantity || form.travelDays.value || 1) || 1, costNightlyRate: item?.cost ?? "", priceNightlyRate: item?.price ?? "", currency: item?.currency || form.currency.value || meta.defaultQuoteCurrency || "EUR", notes: item?.notes || "" };
}

function buildVehicleDetailDefaults(detail, form, meta) {
  return { detailType: detail?.detailType || "pickup", vehicleModel: detail?.vehicleModel || "", vehicleCount: detail?.vehicleCount || 1, pricingUnit: detail?.pricingUnit || "trip", costUnitPrice: detail?.costUnitPrice ?? "", priceUnitPrice: detail?.priceUnitPrice ?? "", currency: detail?.currency || form.currency.value || meta.defaultQuoteCurrency || "EUR", notes: detail?.notes || "" };
}

function buildLegacyVehicleDetailDefaults(item, form, meta) {
  return { detailType: "pickup", vehicleModel: item?.name || "", vehicleCount: Number(item?.quantity || 1) || 1, pricingUnit: item?.unit === "\u5168\u5929" ? "full_day" : "trip", costUnitPrice: item?.cost ?? "", priceUnitPrice: item?.price ?? "", currency: item?.currency || form.currency.value || meta.defaultQuoteCurrency || "EUR", notes: item?.notes || "" };
}

function buildServiceDetailDefaults(detail, form, meta, fallbackRole) {
  return { serviceRole: detail?.serviceRole || fallbackRole || "guide", serviceLanguage: detail?.serviceLanguage || "zh", serviceDuration: detail?.serviceDuration || "full_day", quantity: detail?.quantity || 1, costUnitPrice: detail?.costUnitPrice ?? "", priceUnitPrice: detail?.priceUnitPrice ?? "", currency: detail?.currency || form.currency.value || meta.defaultQuoteCurrency || "EUR", notes: detail?.notes || "" };
}

function buildLegacyServiceDetailDefaults(item, form, meta) {
  return { serviceRole: item?.type === "interpreter" ? "interpreter" : "guide", serviceLanguage: "zh", serviceDuration: "full_day", quantity: Number(item?.quantity || 1) || 1, costUnitPrice: item?.cost ?? "", priceUnitPrice: item?.price ?? "", currency: item?.currency || form.currency.value || meta.defaultQuoteCurrency || "EUR", notes: item?.notes || "" };
}

async function bootstrap() {
  window.AppUtils.applyFlash("quote-message");
  const params = new URLSearchParams(window.location.search);
  const editingId = params.get("id");
  const [meta, templates] = await Promise.all([
    window.AppUtils.fetchJson("/api/meta", null, "\u9875\u9762\u521d\u59cb\u5316\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002"),
    window.AppUtils.fetchJson("/api/templates", null, "\u6a21\u677f\u6570\u636e\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002"),
  ]);
  state.meta = meta;
  state.templates = templates;

  const form = buildForm(meta);
  const itemsContainer = document.getElementById("items-container");
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
      } else if (!unitField.value.trim() || ["酒店", "用车", "服务"].includes(unitField.value.trim())) {
        unitField.value = "项";
      }

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
    (quote.items || []).forEach((item) => addItemRow(item));
    if (!quote.items || quote.items.length === 0) {
      addItemRow({
        type: "hotel",
        currency: form.currency.value || meta.defaultItemCurrency || "EUR",
      });
    }

    document.getElementById("quote-form-title").textContent = "编辑报价单";
    document.getElementById("quote-form-subtitle").textContent = "用于调整客户信息、行程安排和服务明细，保存后会重新计算全部报价汇总。";
    document.getElementById("quote-form-mode").textContent = "编辑模式";
    await renderPreview(form);
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
    document.querySelectorAll('.hotel-detail-row').forEach((detailRow) => refreshHotelDetailRow(detailRow));
    document.querySelectorAll('.item-card').forEach((row) => refreshHotelItemSummary(row, form.currency.value));
    renderPreview(form).catch((error) => window.AppUtils.showMessage("quote-message", error.message, "error"));
  });

  form.endDate.addEventListener("change", () => {
    updateTravelDays(form);
    document.querySelectorAll('.hotel-detail-row [name="nights"]').forEach((input) => {
      if (!input.dataset.userChanged) {
        input.value = Number(form.travelDays.value || 1) || 1;
      }
    });
    document.querySelectorAll('.hotel-detail-row').forEach((detailRow) => refreshHotelDetailRow(detailRow));
    document.querySelectorAll('.item-card').forEach((row) => refreshHotelItemSummary(row, form.currency.value));
    renderPreview(form).catch((error) => window.AppUtils.showMessage("quote-message", error.message, "error"));
  });

  form.currency.addEventListener("change", () => {
    document.querySelectorAll('.item-card').forEach((row) => {
      refreshHotelItemSummary(row, form.currency.value);
      refreshVehicleItemSummary(row, form.currency.value);
      refreshServiceItemSummary(row, form.currency.value);
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

  document.getElementById("add-item").addEventListener("click", () => {
    addItemRow({
      type: "hotel",
      currency: form.currency.value || meta.defaultItemCurrency || "EUR",
    });
    window.AppUtils.hideMessage("quote-message");
  });

  templateSelect.addEventListener("change", updateTemplateDescription);
  document.getElementById("apply-template").addEventListener("click", applyTemplate);

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
    if (!validateQuoteForm(form)) {
      return;
    }

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
      destination: form.destination.value.trim(),
      paxCount: Number(form.paxCount.value || 0),
      notes: form.notes.value.trim(),
      items: getItemRows(),
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
      window.location.href = `/quote-detail.html?id=${encodeURIComponent(savedQuote.id)}`;
    } catch (error) {
      window.AppUtils.showMessage("quote-message", error.message, "error");
    }
  });
}

bootstrap().catch((error) => {
  window.AppUtils.showMessage("quote-message", error.message || "报价页面初始化失败，请稍后重试。", "error");
});
