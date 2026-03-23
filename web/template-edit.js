function createOptionList(values, selectedValue, groupName) {
  return values.map((value) => {
    const label = groupName ? window.AppUi.getLabel(groupName, value) : value;
    const selected = value === selectedValue ? "selected" : "";
    return `<option value="${value}" ${selected}>${label}</option>`;
  }).join("");
}

function createTemplateItemRow(types, currencies, defaults) {
  return `
    <section class="item-card quote-item-row">
      <div class="item-card-head">
        <div>
          <strong>模板项目</strong>
          <p class="meta">定义默认的服务类型、名称、单位、币种和数量。</p>
        </div>
        <button type="button" class="ghost mini-button delete-item">删除此项</button>
      </div>
      <div class="item-card-grid quote-item-grid quote-item-grid-wide">
        <label class="field-block field-span-1"><span>服务类型</span><select name="type">${createOptionList(types, defaults?.type || "hotel", "quoteItemTypeLabels")}</select></label>
        <label class="field-block field-span-2"><span>默认服务名称</span><input name="name" value="${defaults?.name || ""}" placeholder="例如：商务酒店标准间" /></label>
        <label class="field-block field-span-1"><span>默认币种</span><select name="currency">${createOptionList(currencies, defaults?.currency || "EUR", "currencyLabels")}</select></label>
        <label class="field-block field-span-1"><span>单位</span><input name="unit" value="${defaults?.unit || "项"}" placeholder="例如：间夜 / 趟 / 人 / 天" /></label>
        <label class="field-block field-span-1"><span>默认数量</span><input name="quantity" type="number" min="1" step="1" value="${defaults?.quantity || 1}" /></label>
        <label class="field-block field-span-3"><span>备注说明</span><input name="notes" value="${defaults?.notes || ""}" placeholder="例如：含早餐、按实际人数调整" /></label>
      </div>
    </section>
  `;
}

function getTemplateItems() {
  return Array.from(document.querySelectorAll(".item-card")).map((row) => ({
    type: row.querySelector('[name="type"]').value,
    name: row.querySelector('[name="name"]').value.trim(),
    unit: row.querySelector('[name="unit"]').value.trim(),
    currency: row.querySelector('[name="currency"]').value,
    quantity: Number(row.querySelector('[name="quantity"]').value || 0),
    notes: row.querySelector('[name="notes"]').value.trim(),
  })).filter((item) => item.name || item.notes || item.quantity !== 1);
}

function validateTemplateForm(form) {
  if (!form.reportValidity()) {
    return false;
  }

  const items = getTemplateItems();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.name) {
      window.AppUtils.showMessage("template-message", `请填写第 ${index + 1} 条模板项目的默认服务名称。`, "error");
      return false;
    }
    if (!item.unit) {
      window.AppUtils.showMessage("template-message", `请填写第 ${index + 1} 条模板项目的单位。`, "error");
      return false;
    }
    if (item.quantity <= 0) {
      window.AppUtils.showMessage("template-message", `第 ${index + 1} 条模板项目的默认数量必须大于 0。`, "error");
      return false;
    }
  }

  return true;
}

async function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  if (window.AppReturn) {
    window.AppReturn.applyReturnLink("#template-back-link", "/templates.html");
  }
  const editingId = params.get("id");
  const meta = await window.AppUtils.fetchJson("/api/meta", null, "页面初始化失败，请稍后重试。");
  const form = document.getElementById("template-form");
  form.innerHTML = `
    <input type="hidden" name="templateId" />
    <section class="form-section">
      <div class="form-section-head">
        <div>
          <h2>模板信息</h2>
          <p class="meta">模板名称和说明会展示给业务同事，用于快速识别场景。</p>
        </div>
      </div>
      <div class="form-grid form-grid-wide section-grid section-grid-wide">
        <label><span>模板名称</span><input name="name" placeholder="例如：商务接待基础模板" required /></label>
        <label><span>模板说明</span><input name="description" placeholder="例如：适合商务拜访、客户接待、短期差旅行程" /></label>
      </div>
    </section>

    <section class="form-section quote-items-section">
      <div class="form-section-head form-section-head-row">
        <div>
          <h2>模板报价项目</h2>
          <p class="meta">模板只保存常用默认项，插入报价后仍可继续编辑。</p>
        </div>
        <button type="button" id="add-template-item">新增模板项目</button>
      </div>
      <div id="template-items-container" class="stack"></div>
    </section>

    <div class="button-row">
      <button type="submit">保存模板</button>
      <a class="button-link ghost-link" href="/templates.html">返回列表</a>
    </div>
  `;

  window.AppUtils.setChineseValidity(form);
  if (window.AppReturn) {
    const listLink = form.querySelector(".ghost-link");
    if (listLink) listLink.href = window.AppReturn.getReturnUrl("/templates.html");
  }
  const itemsContainer = document.getElementById("template-items-container");

  function addTemplateItem(defaults) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = createTemplateItemRow(meta.supportedQuoteItemTypes, meta.supportedCurrencies, defaults);
    const row = wrapper.firstElementChild;
    itemsContainer.appendChild(row);
    row.querySelector(".delete-item").addEventListener("click", () => {
      row.remove();
    });
  }

  document.getElementById("add-template-item").addEventListener("click", () => {
    addTemplateItem({ currency: meta.defaultItemCurrency || "EUR" });
  });

  if (editingId) {
    const template = await window.AppUtils.fetchJson(`/api/templates/${encodeURIComponent(editingId)}`, null, "模板详情加载失败，请稍后重试。");
    form.templateId.value = template.id;
    form.name.value = template.name;
    form.description.value = template.description || "";
    document.getElementById("template-form-title").textContent = "编辑模板";
    document.getElementById("template-form-mode").textContent = template.isBuiltIn ? "内置模板" : "编辑模式";
    template.items.forEach((item) => addTemplateItem(item));
  } else {
    addTemplateItem({ type: "hotel", currency: meta.defaultItemCurrency || "EUR", unit: "间夜", quantity: 1 });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    window.AppUtils.hideMessage("template-message");
    if (!validateTemplateForm(form)) {
      return;
    }

    try {
      const payload = {
        name: form.name.value.trim(),
        description: form.description.value.trim(),
        items: getTemplateItems(),
      };
      const requestUrl = form.templateId.value ? `/api/templates/${encodeURIComponent(form.templateId.value)}` : "/api/templates";
      const requestMethod = form.templateId.value ? "PUT" : "POST";
      await window.AppUtils.fetchJson(requestUrl, {
        method: requestMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, requestMethod === "PUT" ? "更新模板失败，请稍后重试。" : "保存模板失败，请稍后重试。");

      window.AppUtils.setFlash(requestMethod === "PUT" ? "模板已更新。" : "模板已保存。", "success");
      window.location.href = window.AppReturn ? window.AppReturn.getReturnUrl("/templates.html") : "/templates.html";
    } catch (error) {
      window.AppUtils.showMessage("template-message", error.message, "error");
    }
  });
}

bootstrap().catch((error) => {
  window.AppUtils.showMessage("template-message", error.message, "error");
});
