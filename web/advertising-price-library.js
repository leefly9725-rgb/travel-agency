(() => {
  const headers = () => ({ Authorization: `Bearer ${window.AuthStore?.getToken() || ''}`, 'Content-Type': 'application/json' });
  const table = document.querySelector('#adv-library-table');
  const dialog = document.querySelector('#adv-library-dialog');
  const form = document.querySelector('#adv-library-form');
  const fields = document.querySelector('#adv-library-fields');
  const labels = window.AppUi?.advertising || {};
  let catalog;
  let tab = 'materials';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const definitions = {
    materials: [['nameZh', '材料名称'], ['nameEn', '英文名称'], ['specification', '规格'], ['thicknessMm', '厚度 (mm)', 'number'], ['unit', '单位'], ['currency', labels.currency, 'currency'], ['effectiveFrom', labels.effectiveFrom, 'date'], ['costPrice', '成本价', 'number'], ['suggestedSalePrice', '建议售价', 'number'], ['defaultMarkupRate', '加价率 (%)', 'number'], ['minimumSalePrice', '最低售价', 'number'], ['supplierName', '供应商'], ['notes', '备注']],
    processes: [['nameZh', '工艺名称'], ['nameEn', '英文名称'], ['unit', '计价单位'], ['currency', labels.currency, 'currency'], ['effectiveFrom', labels.effectiveFrom, 'date'], ['costPrice', '成本价', 'number'], ['suggestedSalePrice', '建议售价', 'number'], ['defaultMarkupRate', '加价率 (%)', 'number'], ['defaultMinimumFee', '最低加工费', 'number'], ['supportsDoubleSide', '支持双面', 'checkbox'], ['isActive', '启用', 'checkbox'], ['notes', '备注']],
    services: [['nameZh', '服务名称'], ['nameEn', '英文名称'], ['category', '类别'], ['unit', '单位'], ['currency', labels.currency, 'currency'], ['effectiveFrom', labels.effectiveFrom, 'date'], ['costPrice', '成本价', 'number'], ['suggestedSalePrice', '建议售价', 'number'], ['isActive', '启用', 'checkbox']],
    rules: [['materialId', '材料', 'material-select'], ['processId', '工艺', 'process-select'], ['costPriceOverride', '成本覆盖', 'number'], ['suggestedSalePriceOverride', '售价覆盖', 'number'], ['defaultMinimumFeeOverride', '最低费覆盖', 'number'], ['isActive', '允许', 'checkbox']]
  };
  const tabLabels = { materials: '材料', processes: '工艺', rules: '关联规则', services: '服务费用' };
  const columns = {
    materials: [['nameZh', '材料'], ['specification', '规格'], ['unit', '单位'], ['costPrice', '成本价'], ['suggestedSalePrice', '建议售价'], ['minimumSalePrice', '最低售价'], ['activePriceVersion', labels.activeVersion], ['currency', labels.currency], ['effectiveFrom', labels.effectiveFrom]],
    processes: [['nameZh', '工艺'], ['unit', '单位'], ['costPrice', '成本价'], ['suggestedSalePrice', '建议售价'], ['defaultMinimumFee', '最低费'], ['activePriceVersion', labels.activeVersion], ['currency', labels.currency], ['effectiveFrom', labels.effectiveFrom], ['isActive', '状态']],
    rules: [['materialId', '材料'], ['processId', '工艺'], ['suggestedSalePriceOverride', '售价覆盖'], ['defaultMinimumFeeOverride', '最低费覆盖'], ['isActive', '状态']],
    services: [['nameZh', '服务'], ['category', '类别'], ['unit', '单位'], ['costPrice', '成本价'], ['suggestedSalePrice', '建议售价'], ['activePriceVersion', labels.activeVersion], ['currency', labels.currency], ['effectiveFrom', labels.effectiveFrom], ['isActive', '状态']]
  };

  const recordName = (type, id) => catalog[type]?.find(item => item.id === id)?.nameZh || '未找到对应项';
  const cellValue = (row, key) => {
    if (key === 'materialId') return recordName('materials', row[key]);
    if (key === 'processId') return recordName('processes', row[key]);
    if (key === 'activePriceVersion') return row.activePriceVersion?.versionNumber ?? '—';
    if (typeof row[key] === 'boolean') return row[key] ? '启用' : '停用';
    return row[key] ?? '—';
  };

  function updateTabs() {
    const buttons = [...document.querySelectorAll('[data-tab]')];
    buttons.forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
  }

  function render() {
    updateTabs();
    const rows = catalog[tab] || [];
    const displayColumns = columns[tab].filter(([key]) => key === 'nameZh' || rows.some(row => Object.prototype.hasOwnProperty.call(row, key)));
    const body = rows.length
      ? `<div class="adv-table-scroll"><table class="adv-library-table"><thead><tr>${displayColumns.map(([, label]) => `<th>${esc(label)}</th>`).join('')}<th><span class="sr-only">操作</span></th></tr></thead><tbody>${rows.map(row => `<tr>${displayColumns.map(([key]) => `<td>${esc(cellValue(row, key))}</td>`).join('')}<td><button class="adv-table-action" type="button" data-id="${esc(row.id)}">编辑</button></td></tr>`).join('')}</tbody></table></div>`
      : `<div class="adv-library-empty"><strong>暂无${esc(tabLabels[tab])}记录</strong><p>点击右上角按钮创建第一条记录。</p></div>`;
    table.innerHTML = `<div class="adv-library-toolbar"><div><strong>${tabLabels[tab]}</strong><span>${rows.length} 条记录</span></div><button class="adv-button adv-button-primary" type="button" id="adv-library-add">新增${tabLabels[tab]}</button></div>${body}`;
    table.querySelectorAll('[data-id]').forEach(button => { button.onclick = () => open(rows.find(item => item.id === button.dataset.id)); });
    document.querySelector('#adv-library-add').onclick = () => open({ isActive: true });
  }

  const selectOptions = (type, selected) => (catalog[type] || []).map(item => `<option value="${esc(item.id)}" ${item.id === selected ? 'selected' : ''}>${esc(item.nameZh)}${item.specification ? ` · ${esc(item.specification)}` : ''}</option>`).join('');

  function fieldMarkup(row, [key, label, type = 'text']) {
    if (type === 'material-select') return `<label>${esc(label)}<select name="${esc(key)}" required>${selectOptions('materials', row[key])}</select></label>`;
    if (type === 'process-select') return `<label>${esc(label)}<select name="${esc(key)}" required>${selectOptions('processes', row[key])}</select></label>`;
    if (type === 'checkbox') return `<label class="adv-toggle-field"><input name="${esc(key)}" type="checkbox" ${row[key] !== false ? 'checked' : ''}><span><strong>${esc(label)}</strong><small>点击切换当前状态</small></span></label>`;
    if (type === 'currency') return `<label>${esc(label)}<select name="${esc(key)}"><option value="EUR" ${row[key] === 'EUR' ? 'selected' : ''}>EUR</option><option value="RSD" ${row[key] === 'RSD' ? 'selected' : ''}>RSD</option></select></label>`;
    const precision = type === 'number' ? 'step="0.01"' : '';
    return `<label>${esc(label)}<input name="${esc(key)}" type="${esc(type)}" ${precision} value="${esc(row[key])}" ${key === 'nameZh' ? 'required' : ''}></label>`;
  }

  function visibleDefinitions(row) {
    const protectedKeys = new Set(['costPrice', 'defaultMarkupRate', 'supplierName']);
    return definitions[tab].filter(([key]) => !protectedKeys.has(key) || (!row.id ? window.can('advertising_quote.cost_view') : Object.prototype.hasOwnProperty.call(row, key)));
  }

  function renderVersionHistory(versions = []) {
    const today = new Date().toISOString().slice(0, 10);
    const list = document.querySelector('#adv-version-history-list');
    list.innerHTML = versions.length ? versions.map(version => {
      const future = String(version.effectiveFrom || '') > today;
      const prices = [['costUnitPrice', labels.cost], ['saleUnitPrice', labels.salePrice], ['minimumSaleUnitPrice', labels.minimumSaleUnitPrice], ['minimumCharge', labels.minimumCharge]]
        .filter(([key]) => Object.prototype.hasOwnProperty.call(version, key))
        .map(([key, label]) => `<span>${label} ${esc(version[key])}</span>`).join('');
      return `<article class="adv-version-row ${future ? 'is-future' : ''}"><header><strong>${esc(labels.priceVersion)} ${esc(version.versionNumber)}</strong><span class="adv-version-status">${esc(future ? labels.versionFuture : labels.versionActive)}</span></header><p>${esc(version.currency)} · ${esc(labels.effectiveFrom)} ${esc(version.effectiveFrom)}</p><p>${prices}</p><small>${esc(version.changeReason)}</small></article>`;
    }).join('') : `<p class="adv-library-loading">${esc(labels.noVersionHistory)}</p>`;
  }

  async function open(row) {
    row = { currency: 'EUR', effectiveFrom: new Date().toISOString().slice(0, 10), ...row };
    form.elements.id.value = row.id || '';
    fields.innerHTML = visibleDefinitions(row).map(definition => fieldMarkup(row, definition)).join('');
    form.elements.adjustmentReason.value = '';
    renderVersionHistory([]);
    if (row.id && tab !== 'rules') {
      const query = new URLSearchParams({ catalogType: tab, catalogId: row.id });
      const response = await fetch(`/api/advertising/price-versions?${query}`, { headers: headers() });
      const versions = await response.json();
      if (!response.ok) { alert(versions.error || 'ADVERTISING_PRICE_VERSION_UNAVAILABLE'); return; }
      renderVersionHistory(versions);
    }
    dialog.showModal();
  }

  async function load() {
    if (!window.can('advertising_catalog.manage')) { location.href = '/error.html?reason=no_permission'; return; }
    try {
      const response = await fetch('/api/advertising/catalog', { headers: headers() });
      if (response.status === 403) throw new Error('无管理员权限');
      catalog = await response.json();
      render();
    } catch (error) {
      const message = document.querySelector('#adv-library-message');
      message.classList.remove('hidden');
      message.textContent = error.message;
    }
  }

  if (window.__AUTH_READY__) load(); else document.addEventListener('authReady', load, { once: true });
  document.querySelectorAll('[data-adv-label]').forEach(node => { node.textContent = labels[node.dataset.advLabel] || node.dataset.advLabel; });

  const tabs = [...document.querySelectorAll('[data-tab]')];
  tabs.forEach((button, index) => {
    button.onclick = () => { tab = button.dataset.tab; render(); };
    button.onkeydown = event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    };
  });

  document.querySelector('#adv-library-save').onclick = async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const id = form.elements.id.value;
    const payload = { adjustmentReason: form.elements.adjustmentReason.value };
    for (const [key, , type] of definitions[tab]) {
      const input = form.elements[key];
      if (!input) continue;
      payload[key] = type === 'checkbox' ? input.checked : type === 'number' ? (input.value === '' ? null : Number(input.value)) : input.value;
    }
    const response = await fetch(`/api/advertising/${tab}${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) { alert(result.error); return; }
    dialog.close();
    catalog = await fetch('/api/advertising/catalog', { headers: headers() }).then(item => item.json());
    render();
  };
})();
