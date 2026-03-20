/*
 * Step 3 active block builders.
 *
 * This module owns quotation block generation for the composer path.
 * Preview and PDF must consume the same block output.
 */

(function () {
  function normalizeBlock(block) {
    return {
      id: block.id,
      type: block.type,
      html: block.html || '',
      className: block.className || '',
      keepWithNext: Boolean(block.keepWithNext),
      measureMode: block.measureMode || 'natural',
      minHeight: Number(block.minHeight || 0),
      meta: block.meta || {},
    };
  }

  function createBlock(id, type, options) {
    const config = options || {};
    const className = config.className ? ` ${config.className}` : '';
    const blockType = type ? ` data-block-type="${type}"` : '';
    const wrapperStyle = config.wrapperStyle ? ` style="${config.wrapperStyle}"` : '';
    return normalizeBlock({
      id,
      type,
      html: `<div class="qp-compose-block${className}"${wrapperStyle} data-block-id="${id}"${blockType}>${config.html || ''}</div>`,
      className: config.className || '',
      keepWithNext: config.keepWithNext,
      measureMode: config.measureMode || 'natural',
      minHeight: config.minHeight || 0,
      meta: config.meta || {},
    });
  }

  function getRuntime(runtime) {
    const ctx = runtime || {};
    const utils = ctx.utils || {};
    return {
      state: ctx.state || {},
      company: ctx.company || {},
      staticTerms: ctx.staticTerms || {},
      groupLabels: ctx.groupLabels || {},
      utils: {
        esc: utils.esc,
        getText: utils.getText,
        biTitle: utils.biTitle,
        money: utils.money,
        tableHead: utils.tableHead,
      },
    };
  }

  function renderCoverContent(vm, runtime) {
    const { company, utils } = getRuntime(runtime);
    const { esc, money } = utils;

    const destParts = [
      vm.destination ? esc(vm.destination) : '',
      vm.startDate && vm.endDate
        ? `${esc(vm.startDate)} ~ ${esc(vm.endDate)}`
        : vm.startDate ? esc(vm.startDate) : '',
    ].filter(Boolean);
    const destLine = destParts.length > 0
      ? destParts.map((p, i) => i === 0
          ? `<span>${p}</span>`
          : `<span style="color:#C9A84C;margin:0 4px;">|</span><span>${p}</span>`
        ).join('')
      : '';

    const paxText = vm.paxCount !== '' ? `${esc(String(vm.paxCount))} 人` : '—';
    const contactDetail = [esc(vm.contactName || ''), esc(vm.contactPhone || '')].filter(Boolean).join(' · ') || '—';

    return `
      <div style="display:flex;flex-direction:column;width:100%;height:100%;background:#F5F2EC;font-family:Arial,sans-serif;overflow:hidden;">

        <!-- 右上角几何装饰 -->
        <svg style="position:absolute;top:0;right:0;width:260px;height:260px;pointer-events:none;z-index:1;" viewBox="0 0 260 260">
          <polygon points="260,0 260,260 0,0" fill="#1B2A4A" opacity="0.06"/>
          <polygon points="260,0 260,170 90,0" fill="#C9A84C" opacity="0.11"/>
          <polygon points="260,0 260,70 190,0" fill="#1B2A4A" opacity="0.09"/>
        </svg>
        <!-- 左下角几何装饰 -->
        <svg style="position:absolute;bottom:56px;left:0;width:180px;height:180px;pointer-events:none;z-index:1;" viewBox="0 0 180 180">
          <polygon points="0,180 180,180 0,0" fill="#1B2A4A" opacity="0.05"/>
          <polygon points="0,180 110,180 0,70" fill="#C9A84C" opacity="0.08"/>
        </svg>

        <!-- Header -->
        <div style="flex-shrink:0;background:#1B2A4A;padding:18px 32px;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:2;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="/assets/logo.png" style="height:32px;width:auto;display:block;flex-shrink:0;">
            <div>
              <div style="font-size:15px;font-weight:700;color:#F5F2EC;letter-spacing:1px;">${esc(company.cn)}</div>
              <div style="font-size:8px;letter-spacing:3px;color:#C9A84C;margin-top:3px;text-transform:uppercase;">${esc(company.en)}</div>
            </div>
          </div>
          <div style="text-align:right;font-size:9px;color:#7B8FAD;line-height:1.9;">
            <div>Belgrade, Serbia</div>
            <div>${esc(company.contact)}</div>
            <div>PIB: ${esc(company.pib)}</div>
          </div>
        </div>

        <!-- 米白主体区 -->
        <div style="flex:1;min-height:0;padding:28px 32px 32px;position:relative;z-index:2;display:flex;flex-direction:column;">
          <!-- 报价编号徽章 -->
          <div style="position:absolute;top:8px;right:8px;border:1px solid rgba(201,168,76,0.55);border-radius:4px;padding:5px 11px;text-align:right;">
            <div style="font-size:7px;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;">Quote No.</div>
            <div style="font-size:10px;color:#1B2A4A;font-weight:700;letter-spacing:1px;margin-top:2px;">${esc(vm.quoteNumber || '—')}</div>
          </div>
          <!-- 内容 -->
          <div style="font-size:9px;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;margin-bottom:16px;">CLIENT QUOTATION · 客户报价书</div>
          <div style="font-size:38px;font-weight:700;color:#1B2A4A;line-height:1.1;margin-bottom:4px;">${esc(vm.projectName || '—')}</div>
          <div style="font-size:11px;color:#6B7280;display:flex;align-items:center;flex-wrap:wrap;gap:0;margin-bottom:26px;">${destLine}</div>
          <div style="width:44px;height:3px;background:#C9A84C;border-radius:2px;margin-bottom:20px;"></div>
          <div style="font-size:8px;letter-spacing:3px;color:#7B8FAD;text-transform:uppercase;margin-bottom:6px;">CLIENT · 客户</div>
          <div style="font-size:20px;font-weight:700;color:#1B2A4A;line-height:1.25;margin-bottom:18px;">${esc(vm.clientName || '—')}</div>
          <div style="display:flex;gap:36px;">
            <div>
              <div style="font-size:8px;letter-spacing:2px;color:#7B8FAD;text-transform:uppercase;margin-bottom:3px;">CONTACT · 联系人</div>
              <div style="font-size:12px;color:#1B2A4A;font-weight:500;">${contactDetail}</div>
            </div>
            <div>
              <div style="font-size:8px;letter-spacing:2px;color:#7B8FAD;text-transform:uppercase;margin-bottom:3px;">PAX · 人数</div>
              <div style="font-size:12px;color:#1B2A4A;font-weight:500;">${paxText}</div>
            </div>
          </div>
          <div style="flex:1;min-height:0;"></div>
        </div>

        <!-- 深蓝 meta 腰带 -->
        <div style="flex-shrink:0;background:#1B2A4A;padding:18px 32px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;position:relative;z-index:2;">
          <div><div style="font-size:7px;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin-bottom:4px;">报价日期</div><div style="font-size:13px;color:#F5F2EC;font-weight:600;">${esc(vm.quoteDate || '—')}</div></div>
          <div><div style="font-size:7px;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin-bottom:4px;">有效期至</div><div style="font-size:13px;color:#F5F2EC;font-weight:600;">${esc(vm.validUntil || '—')}</div></div>
          <div><div style="font-size:7px;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin-bottom:4px;">币种</div><div style="font-size:13px;color:#F5F2EC;font-weight:600;">${esc(vm.currency || 'EUR')}</div></div>
          <div><div style="font-size:7px;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin-bottom:4px;">服务模块</div><div style="font-size:13px;color:#F5F2EC;font-weight:600;">${vm.groups.length} 个</div></div>
        </div>

        <!-- 金色总价栏 -->
        <div style="flex-shrink:0;background:#C9A84C;padding:20px 32px;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:2;">
          <div style="font-size:9px;letter-spacing:2px;color:#1B2A4A;text-transform:uppercase;font-weight:700;">GRAND TOTAL · 客户报价总额</div>
          <div style="display:flex;align-items:baseline;gap:8px;">
            <span style="font-size:12px;color:#1B2A4A;opacity:0.65;">${esc(vm.currency || 'EUR')}</span>
            <span style="font-size:30px;font-weight:700;color:#1B2A4A;">${money(vm.totalSales, vm.currency)}</span>
          </div>
        </div>

        <!-- 页脚 -->
        <div style="flex-shrink:0;background:#F5F2EC;padding:12px 32px;display:flex;justify-content:space-between;border-top:1px solid #D4CCBE;position:relative;z-index:2;">
          <span style="font-size:9px;color:#7B8FAD;letter-spacing:1px;">${esc(company.legal)}</span>
          <span style="font-size:9px;color:#7B8FAD;letter-spacing:1px;">${esc(vm.quoteNumber || '')}</span>
        </div>

      </div>
    `;
  }

  function renderOverviewContent(vm, runtime) {
    const { state, company, groupLabels, utils } = getRuntime(runtime);
    const { esc, getText, biTitle, money, tableHead } = utils;
    const totalItems = vm.groups.reduce((sum, g) => sum + g.items.length, 0);
    const hasNotes = Boolean(vm.notes && vm.notes.trim());
    const notesCard = hasNotes ? `
      <article class="qp-narrative-card" style="margin-bottom:12px;">
        <div class="qp-card-title">
          <h3>${biTitle('项目说明', 'Project Description', 'Opis projekta')}</h3>
        </div>
        <p>${esc(vm.notes)}</p>
      </article>
    ` : '';

    const moduleRows = vm.groups.map((group) => {
      const labels = groupLabels[group.projectType] || groupLabels.travel;
      const titleObj = { zh: group.projectTitle || labels.zh, en: labels.en, sr: labels.sr };
      return `
        <tr>
          <td style="padding:20px 14px">${getText(titleObj)}</td>
          <td style="padding:20px 14px;text-align:center;color:var(--qp-ink-muted)">${group.items.length}</td>
          <td class="qp-money" style="padding:20px 14px">${money(group.groupSalesTotal, vm.currency)}</td>
        </tr>
      `;
    }).join('');

    const totalRow = `
      <tr style="border-top:2px solid var(--qp-line-strong)">
        <td style="font-weight:600;padding:20px 14px">${biTitle('合计', 'Total', 'Ukupno')}</td>
        <td style="text-align:center;font-weight:600;padding:20px 14px">${totalItems}</td>
        <td class="qp-money" style="font-weight:700;font-size:17px;padding:20px 14px">${money(vm.totalSales, vm.currency)}</td>
      </tr>
    `;

    const chapterNote = state.lang === 'zh-sr'
      ? 'Detalji po stavkama i jediničnim cenama nalaze se na sledećim stranicama.'
      : state.lang === 'zh-en'
      ? 'Full itemized details and unit pricing are provided on the following pages.'
      : '各服务模块的完整明细项目与单价信息详见后续页面。';

    return `
      <div style="flex-shrink:0;background:#1B2A4A;padding:14px 32px;display:flex;align-items:center;justify-content:space-between;margin-bottom:0;">
        <div style="display:flex;align-items:center;gap:8px;">
          <img src="/assets/logo.png" style="height:22px;width:auto;display:block;flex-shrink:0;">
          <div>
            <div style="font-size:12px;font-weight:700;color:#F5F2EC;">${esc(company.cn)}</div>
            <div style="font-size:7px;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin-top:2px;">${esc(company.en)}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:#7B8FAD;">${esc(vm.projectName)}${vm.clientName ? ' · ' + esc(vm.clientName) : ''}</div>
          <div style="font-size:9px;color:#C9A84C;letter-spacing:1px;margin-top:2px;text-transform:uppercase;">SERVICE OVERVIEW</div>
        </div>
      </div>

      <div class="qp-overview-layout">
        <div class="qp-section-stack">
          ${notesCard}
          <article class="qp-scope-card">
            <div class="qp-card-title">
              <h3>${biTitle('服务模块与报价摘要', 'Service Modules & Pricing', 'Moduli i cene')}</h3>
            </div>
            <table class="qp-table">
              <thead>
                <tr>
                  ${tableHead('服务模块', 'Service Module', 'Modul usluge')}
                  <th style="text-align:center">${tableHead('项目数', 'Items', 'Stavke').replace(/^<th[^>]*>/, '').replace(/<\/th>$/, '')}</th>
                  ${tableHead('金额', 'Amount', 'Iznos', 'qp-money')}
                </tr>
              </thead>
              <tbody>${moduleRows}${totalRow}</tbody>
            </table>
          </article>
        </div>

        <div class="qp-chapter-note">
          <p>${esc(chapterNote)}</p>
        </div>
      </div>
    `;
  }

  function renderDetailHeader(vm, runtime) {
    const { company, utils } = getRuntime(runtime);
    const { esc } = utils;
    return `
      <div style="flex-shrink:0;background:#1B2A4A;padding:14px 32px;display:flex;align-items:center;justify-content:space-between;margin-bottom:0;">
        <div style="display:flex;align-items:center;gap:8px;">
          <img src="/assets/logo.png" style="height:22px;width:auto;display:block;flex-shrink:0;">
          <div>
            <div style="font-size:12px;font-weight:700;color:#F5F2EC;">${esc(company.cn)}</div>
            <div style="font-size:7px;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin-top:2px;">${esc(company.en)}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:#7B8FAD;">${esc(vm.projectName)}${vm.clientName ? ' · ' + esc(vm.clientName) : ''}</div>
          <div style="font-size:9px;color:#C9A84C;letter-spacing:1px;margin-top:2px;text-transform:uppercase;">DETAILED QUOTATION</div>
        </div>
      </div>
    `;
  }

  function renderItemRows(items, runtime, currency) {
    const { utils } = getRuntime(runtime);
    const { esc, getText, money } = utils;
    if (!items || items.length === 0) {
      return '<tr><td colspan="6" style="text-align:center;color:var(--qp-ink-muted);padding:20px">本组暂无明细</td></tr>';
    }

    return items.map((item) => `
      <tr>
        <td><strong>${getText(item.itemName)}</strong></td>
        <td>${item.specification ? esc(item.specification) : ''}</td>
        <td>${esc(item.qtyDisplay)}</td>
        <td>${esc(item.unit)}</td>
        <td class="qp-money">${money(item.salesUnitPrice, currency)}</td>
        <td class="qp-money">${money(item.salesSubtotal, currency)}</td>
      </tr>
    `).join('');
  }

  function renderProfessionalGroupCard(vm, group, runtime) {
    const { utils } = getRuntime(runtime);
    const { getText, biTitle, money, tableHead } = utils;
    return `
      <article class="qp-detail-card">
        <div class="qp-group-head">
          <div>
            <h3>${getText({ zh: group.projectTitle, en: group.typeLabel.en, sr: group.typeLabel.sr })}</h3>
          </div>
        </div>
        <table class="qp-table">
          <colgroup><col style="width:35%"><col style="width:25%"><col style="width:7%"><col style="width:7%"><col style="width:13%"><col style="width:13%"></colgroup>
          <thead>
            <tr>
              ${tableHead('项目名称', 'Item Name', 'Naziv stavke')}
              ${tableHead('规格说明', 'Specification', 'Specifikacija')}
              ${tableHead('数量', 'Qty', 'Kol.')}
              ${tableHead('单位', 'Unit', 'Jedinica')}
              ${tableHead('销售单价', 'Unit Price', 'Jedinicna cena', 'qp-money')}
              ${tableHead('小计', 'Subtotal', 'Medjuzbir', 'qp-money')}
            </tr>
          </thead>
          <tbody>${renderItemRows(group.items, runtime, vm.currency)}</tbody>
        </table>
        <div class="qp-group-foot">
          <span>${biTitle('分组小计', 'Group Subtotal', 'Medjuzbir grupe')}</span>
          <strong>${money(group.groupSalesTotal, vm.currency)}</strong>
        </div>
      </article>
    `;
  }

  // Single <tr> HTML for one item row — used by renderGroupSegmentHtml.
  function renderItemRowHtml(item, runtime, currency) {
    const { utils } = getRuntime(runtime);
    const { esc, getText, money } = utils;
    return `
      <tr>
        <td><strong>${getText(item.itemName)}</strong></td>
        <td>${item.specification ? esc(item.specification) : ''}</td>
        <td>${esc(item.qtyDisplay)}</td>
        <td>${esc(item.unit)}</td>
        <td class="qp-money">${money(item.salesUnitPrice, currency)}</td>
        <td class="qp-money">${money(item.salesSubtotal, currency)}</td>
      </tr>
    `;
  }

  // Renders a complete <article> for a subset of rows from one group.
  // isFirst=true  → qp-group-head (full title, no badge)
  // isFirst=false → qp-group-head (same prominent head) + （续）badge inline in h3
  // Both always use qp-group-head so the title is guaranteed visible.
  // isLast=true   → includes qp-group-foot subtotal
  // thead always present (repeats on every segment)
  function renderGroupSegmentHtml(vm, group, rowsHtml, isFirst, isLast, runtime) {
    const { utils } = getRuntime(runtime);
    const { getText, biTitle, money, tableHead } = utils;

    const titleHtml = getText({ zh: group.projectTitle, en: (group.typeLabel || {}).en, sr: (group.typeLabel || {}).sr });
    const contBadge = isFirst ? '' : '<em class="qp-cont-badge">（续）</em>';

    // Always use qp-group-head so the title renders identically to the first segment.
    // Continuation segments are distinguished only by the （续）badge.
    const headHtml = `<div class="qp-group-head">
        <div>
          <h3>${titleHtml}${contBadge}</h3>
        </div>
      </div>`;

    const footHtml = isLast
      ? `<div class="qp-group-foot">
          <span>${biTitle('分组小计', 'Group Subtotal', 'Medjuzbir grupe')}</span>
          <strong>${money(group.groupSalesTotal, vm.currency)}</strong>
        </div>`
      : '';

    const bodyRows = rowsHtml.length === 0
      ? '<tr><td colspan="6" style="text-align:center;color:var(--qp-ink-muted);padding:20px">本组暂无明细</td></tr>'
      : rowsHtml.join('');

    const contClass = isFirst ? '' : ' qp-detail-card-cont';
    return `
      <article class="qp-detail-card${contClass}">
        ${headHtml}
        <table class="qp-table">
          <colgroup><col style="width:35%"><col style="width:25%"><col style="width:7%"><col style="width:7%"><col style="width:13%"><col style="width:13%"></colgroup>
          <thead>
            <tr>
              ${tableHead('项目名称', 'Item Name', 'Naziv stavke')}
              ${tableHead('规格说明', 'Specification', 'Specifikacija')}
              ${tableHead('数量', 'Qty', 'Kol.')}
              ${tableHead('单位', 'Unit', 'Jedinica')}
              ${tableHead('销售单价', 'Unit Price', 'Jedinicna cena', 'qp-money')}
              ${tableHead('小计', 'Subtotal', 'Medjuzbir', 'qp-money')}
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
        ${footHtml}
      </article>
    `;
  }

  function renderProfessionalFlatChunk(vm, items, runtime) {
    const { utils } = getRuntime(runtime);
    const { tableHead } = utils;
    return `
      <article class="qp-detail-card">
        <table class="qp-table">
          <colgroup><col style="width:35%"><col style="width:25%"><col style="width:7%"><col style="width:7%"><col style="width:13%"><col style="width:13%"></colgroup>
          <thead>
            <tr>
              ${tableHead('项目名称', 'Item Name', 'Naziv stavke')}
              ${tableHead('规格说明', 'Specification', 'Specifikacija')}
              ${tableHead('数量', 'Qty', 'Kol.')}
              ${tableHead('单位', 'Unit', 'Jedinica')}
              ${tableHead('销售单价', 'Unit Price', 'Jedinicna cena', 'qp-money')}
              ${tableHead('小计', 'Subtotal', 'Medjuzbir', 'qp-money')}
            </tr>
          </thead>
          <tbody>${renderItemRows(items, runtime, vm.currency)}</tbody>
        </table>
      </article>
    `;
  }

  function renderMixedGroupCard(vm, group, runtime) {
    const { utils } = getRuntime(runtime);
    const { esc, getText, biTitle, money } = utils;
    return `
      <article class="qp-detail-card">
        <div class="qp-group-head">
          <div>
            <h3>${getText({ zh: group.projectTitle, en: group.typeLabel.en, sr: group.typeLabel.sr })}</h3>
          </div>
        </div>
        <div style="padding:18px 20px;display:grid;gap:12px">
          ${group.items.length === 0
            ? '<p style="color:var(--qp-ink-muted);font-size:13px">暂无服务项目</p>'
            : group.items.map((item) => `
              <div class="qp-module-card">
                <strong>${getText(item.itemName)}</strong>
                ${item.specification ? `<p>${esc(item.specification)}</p>` : ''}
                <div style="display:flex;justify-content:space-between;gap:16px;align-items:baseline;margin-top:4px">
                  <span style="color:var(--qp-ink-muted);font-size:12px">${esc(item.qtyDisplay)} ${esc(item.unit)}</span>
                  <strong style="font-size:15px">${money(item.salesSubtotal, vm.currency)}</strong>
                </div>
              </div>
            `).join('')}
        </div>
        <div class="qp-group-foot">
          <span>${biTitle('模块小计', 'Module Subtotal', 'Medjuzbir modula')}</span>
          <strong>${money(group.groupSalesTotal, vm.currency)}</strong>
        </div>
      </article>
    `;
  }

  function renderMixedFlatChunk(vm, items, runtime) {
    const { utils } = getRuntime(runtime);
    const { esc, getText, money } = utils;
    const cards = items.map((item) => `
      <article class="qp-module-card">
        <strong>${getText(item.itemName)}</strong>
        ${item.specification ? `<p>${esc(item.specification)}</p>` : ''}
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:baseline;margin-top:6px">
          <span style="color:var(--qp-ink-muted);font-size:12px">${esc(item.qtyDisplay)} ${esc(item.unit)}</span>
          <strong style="font-size:15px">${money(item.salesSubtotal, vm.currency)}</strong>
        </div>
      </article>
    `).join('');

    return `
      <article class="qp-scope-card">
        <div class="qp-module-grid">${cards}</div>
      </article>
    `;
  }

  function renderTotalBlock(vm, runtime, note) {
    const { utils } = getRuntime(runtime);
    const { esc, biTitle, money } = utils;
    return `
      <div class="qp-total-card">
        <div class="qp-total-note">
          <span>Final Quotation</span>
          <strong>${biTitle('客户版总报价', 'Client Grand Total', 'Ukupna cena za klijenta')}</strong>
          <p>${esc(note)}</p>
        </div>
        <div class="qp-total-amount">
          <span>Grand Total</span>
          <em class="qp-total-currency">${esc(vm.currency)}</em>
          <strong class="qp-total-value">${money(vm.totalSales, vm.currency)}</strong>
        </div>
      </div>
    `;
  }

  function renderTermsHeader(runtime) {
    const { company, utils } = getRuntime(runtime);
    const { esc } = utils;
    return `
      <div style="flex-shrink:0;background:#1B2A4A;padding:14px 32px;display:flex;align-items:center;justify-content:space-between;margin-bottom:0;grid-column:1/-1;">
        <div style="display:flex;align-items:center;gap:8px;">
          <img src="/assets/logo.png" style="height:22px;width:auto;display:block;flex-shrink:0;">
          <div>
            <div style="font-size:12px;font-weight:700;color:#F5F2EC;">${esc(company.cn)}</div>
            <div style="font-size:7px;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin-top:2px;">${esc(company.en)}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:#7B8FAD;">以下条款请双方签署前仔细阅读</div>
          <div style="font-size:9px;color:#C9A84C;letter-spacing:1px;margin-top:2px;text-transform:uppercase;">COMMERCIAL TERMS</div>
        </div>
      </div>
    `;
  }

  function renderTermsCard(runtime, titleHtml, bodyHtml) {
    return `
      <article class="qp-terms-card">
        <div class="qp-card-title">
          <h3>${titleHtml}</h3>
        </div>
        ${bodyHtml}
      </article>
    `;
  }

  function renderSignatureBlock(runtime) {
    const { state, company, utils } = getRuntime(runtime);
    const { biTitle } = utils;
    if (!state.showSign) return '';
    return `
      <div class="qp-sign-row qp-terms-span-full">
        <div class="qp-sign-box">
          <strong>${biTitle('客户确认签字', 'Client Confirmation', 'Potvrda klijenta')}</strong>
          <p>请贵方授权代表签字并注明日期，以确认本报价方案。</p>
          <div class="qp-sign-lines">
            <div class="qp-sign-field"><span>签字 Signature</span><div class="qp-sign-line"></div></div>
            <div class="qp-sign-field"><span>日期 Date</span><div class="qp-sign-line"></div></div>
          </div>
        </div>
        <div class="qp-sign-box">
          <strong>${biTitle(company.cn, company.en, company.en)}</strong>
          <p>由公司授权代表签字确认，并加盖公章。</p>
          <div class="qp-sign-lines">
            <div class="qp-sign-field"><span>签字 Signature</span><div class="qp-sign-line"></div></div>
            <div class="qp-sign-field"><span>日期 / 盖章 Date / Stamp</span><div class="qp-sign-line"></div></div>
          </div>
        </div>
      </div>
    `;
  }

  function buildCoverBlock(vm, runtime) {
    return createBlock('cover', 'cover', {
      html: renderCoverContent(vm, runtime),
      className: 'qp-block-cover',
      wrapperStyle: 'display:flex;flex-direction:column;flex:1;min-height:0;',
      measureMode: 'fixed',
      minHeight: 0,
      meta: { pageClassName: 'qp-cover', bodyClassName: 'qp-cover-body' },
    });
  }

  function buildOverviewBlock(vm, runtime) {
    return createBlock('overview', 'overview', {
      html: renderOverviewContent(vm, runtime),
      className: 'qp-block-overview',
      measureMode: 'natural',
      minHeight: 0,
      meta: { pageClassName: 'qp-overview-page', bodyClassName: 'qp-standard-body' },
    });
  }

  function buildDetailHeaderBlock(vm, runtime) {
    return createBlock('detail-header', 'detail-header', {
      html: renderDetailHeader(vm, runtime),
      className: 'qp-block-detail-header',
      measureMode: 'natural',
      minHeight: 48,
      keepWithNext: true,
    });
  }

  function buildQuoteGroupBlocks(vm, runtime) {
    const { state } = getRuntime(runtime);
    const blocks = [];

    if (state.mode === 'professional' && state.grouping === 'grouped') {
      // Rowset blocks: composer does true row-level pagination.
      // Each block provides rowsHtml[] + renderSegment(rows, isFirst, isLast) closure.
      vm.groups.forEach(function (group, groupIdx) {
        const capturedGroup = group;
        const capturedVm = vm;
        const capturedRuntime = runtime;
        const rowsHtml = group.items.map(function (item) {
          return renderItemRowHtml(item, capturedRuntime, capturedVm.currency);
        });
        blocks.push({
          id: 'quote-group-' + (groupIdx + 1),
          type: 'quote-group-rowset',
          html: '',
          className: 'qp-block-quote-group',
          keepWithNext: false,
          measureMode: 'rowset',
          minHeight: 0,
          meta: {},
          rowsHtml: rowsHtml,
          renderSegment: function (rows, isFirst, isLast) {
            return renderGroupSegmentHtml(capturedVm, capturedGroup, rows, isFirst, isLast, capturedRuntime);
          },
        });
      });
    } else if (state.mode === 'professional' && state.grouping === 'flat') {
      const flatItems = vm.groups.flatMap((group) =>
        (group.items || []).map((item) => ({ ...item, groupTitle: group.projectTitle }))
      );
      const chunks = [];
      for (let index = 0; index < flatItems.length; index += 9) chunks.push(flatItems.slice(index, index + 9));
      chunks.forEach((items, index) => {
        blocks.push(createBlock(`quote-group-${index + 1}`, 'quote-group', {
          html: renderProfessionalFlatChunk(vm, items, runtime),
          className: 'qp-block-quote-group',
          measureMode: 'natural',
          minHeight: 180,
        }));
      });
    } else if (state.mode === 'mixed' && state.grouping === 'grouped') {
      vm.groups.forEach((group, index) => {
        blocks.push(createBlock(`quote-group-${index + 1}`, 'quote-group', {
          html: renderMixedGroupCard(vm, group, runtime),
          className: 'qp-block-quote-group',
          measureMode: 'natural',
          minHeight: 180,
        }));
      });
    } else {
      const flatItems = vm.groups.flatMap((group) =>
        (group.items || []).map((item) => ({ ...item, groupTitle: group.projectTitle }))
      );
      const chunks = [];
      for (let index = 0; index < flatItems.length; index += 8) chunks.push(flatItems.slice(index, index + 8));
      chunks.forEach((items, index) => {
        blocks.push(createBlock(`quote-group-${index + 1}`, 'quote-group', {
          html: renderMixedFlatChunk(vm, items, runtime),
          className: 'qp-block-quote-group',
          measureMode: 'natural',
          minHeight: 180,
        }));
      });
    }

    return blocks;
  }

  function buildFinalQuotationBlock(vm, runtime) {
    return createBlock('final-quotation', 'final-quotation', {
      html: renderTotalBlock(vm, runtime, '以上明细项目合计为本项目完整客户报价，金额以最终签署版本为准。'),
      className: 'qp-block-final-quotation qp-final-quotation-block',
      measureMode: 'natural',
      minHeight: 120,
    });
  }

  function buildTermsBlocks(vm, runtime) {
    void vm;
    const { staticTerms, utils } = getRuntime(runtime);
    const { getText, biTitle } = utils;
    const included = staticTerms.included.map((item) => `<li>${getText(item)}</li>`).join('');
    const excluded = staticTerms.excluded.map((item) => `<li>${getText(item)}</li>`).join('');
    const notes = staticTerms.notes.map((item) => `<li>${getText(item)}</li>`).join('');

    // Signature is rendered first so we know if it exists before wiring keepWithNext.
    const signatureHtml = renderSignatureBlock(runtime);

    const blocks = [
      // terms-header: never left alone at page bottom.
      createBlock('terms-header', 'terms-header', {
        html: renderTermsHeader(runtime),
        className: 'qp-terms-span-full qp-block-terms-header',
        keepWithNext: true,
        measureMode: 'natural',
        minHeight: 0,
      }),
      createBlock('terms-included', 'terms-card', {
        html: renderTermsCard(runtime, biTitle('费用包含', 'Included', 'Ukljuceno'), `<ul>${included}</ul>`),
        className: 'qp-block-terms-card',
        measureMode: 'natural',
        minHeight: 0,
      }),
      // terms-excluded stays with terms-notes (the next block).
      createBlock('terms-excluded', 'terms-card', {
        html: renderTermsCard(runtime, biTitle('费用不含', 'Excluded', 'Nije ukljuceno'), `<ul>${excluded}</ul>`),
        className: 'qp-block-terms-card',
        keepWithNext: true,
        measureMode: 'natural',
        minHeight: 0,
      }),
      // terms-notes stays with terms-payment.
      createBlock('terms-notes', 'terms-card', {
        html: renderTermsCard(runtime, biTitle('特别说明', 'Notes', 'Napomene'), `<ul>${notes}</ul>`),
        className: 'qp-block-terms-card',
        keepWithNext: true,
        measureMode: 'natural',
        minHeight: 0,
      }),
      // terms-payment: stays with signature if shown.
      createBlock('terms-payment', 'terms-card', {
        html: renderTermsCard(runtime, biTitle('付款方式与节点', 'Payment Terms', 'Uslovi placanja'), `<p>${getText(staticTerms.payment)}</p>`),
        className: 'qp-block-terms-card',
        keepWithNext: Boolean(signatureHtml),
        measureMode: 'natural',
        minHeight: 0,
      }),
    ];

    // Signature is its own span-full atomic block (~160px tall).
    // Small enough to always fit on any page — no overflow risk.
    if (signatureHtml) {
      blocks.push(createBlock('terms-signature', 'terms-signature', {
        html: signatureHtml,
        className: 'qp-terms-span-full qp-block-terms-signature',
        measureMode: 'natural',
        minHeight: 0,
      }));
    }

    return blocks;
  }

  function buildAllBlocks(vm, runtime) {
    const quoteGroups = buildQuoteGroupBlocks(vm, runtime);
    // Anchor final-quotation to the last group when it is a regular block.
    // Rowset blocks handle their own page flushing; keepWithNext doesn't apply.
    if (quoteGroups.length > 0) {
      const lastGroup = quoteGroups[quoteGroups.length - 1];
      if (lastGroup.type !== 'quote-group-rowset') {
        lastGroup.keepWithNext = true;
      }
    }
    return {
      cover: buildCoverBlock(vm, runtime),
      overview: buildOverviewBlock(vm, runtime),
      detailHeader: buildDetailHeaderBlock(vm, runtime),
      quoteGroups,
      finalQuotation: quoteGroups.length > 0 ? buildFinalQuotationBlock(vm, runtime) : null,
      terms: buildTermsBlocks(vm, runtime),
    };
  }

  window.ProjectQuotationBlocks = {
    createBlock,
    normalizeBlock,
    buildCoverBlock,
    buildOverviewBlock,
    buildDetailHeaderBlock,
    buildQuoteGroupBlocks,
    buildFinalQuotationBlock,
    buildTermsBlocks,
    buildAllBlocks,
  };
})();

