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
    return normalizeBlock({
      id,
      type,
      html: `<div class="qp-compose-block${className}" data-block-id="${id}"${blockType}>${config.html || ''}</div>`,
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
    const { state, company, utils } = getRuntime(runtime);
    const { esc, money } = utils;
    const titleLineParts = [
      vm.destination ? esc(vm.destination) : '',
      vm.startDate && vm.endDate ? `${esc(vm.startDate)} ~ ${esc(vm.endDate)}` : vm.startDate ? esc(vm.startDate) : '',
    ].filter(Boolean);

    const summaryText = vm.notes && vm.notes.trim()
      ? esc(vm.notes.trim())
      : (state.lang === 'zh-sr'
          ? 'Ova ponuda obuhvata kompletan opseg usluga i finalnu cenu za ovaj projekat.'
          : state.lang === 'zh-en'
          ? 'This quotation covers the full scope of services and final pricing for this project.'
          : '本报价单涵盖本次项目全部服务内容，各项服务明细及金额以最终签署版本为准。');

    const peopleText = vm.paxCount !== '' ? `${esc(String(vm.paxCount))}人` : '—';

    return `
      <div class="qp-cover">
        <div class="qp-cover-top">
          <div class="qp-logo-block">
            <div class="qp-logo-mark">${esc(company.logoText)}</div>
            <div>
              <p class="qp-company-cn">${esc(company.cn)}</p>
              <p class="qp-company-en">${esc(company.en)}</p>
            </div>
          </div>
          <div class="qp-company-meta">
            <div>${esc(company.address)}</div>
            <div>${esc(company.contact)}</div>
          </div>
        </div>

        <div class="qp-cover-title-block">
          <div class="qp-cover-title-main">
            <p class="qp-cover-doc-title">客户报价书</p>
            <p class="qp-cover-doc-sub">CLIENT QUOTATION</p>
            <h1 class="qp-cover-project-name">${esc(vm.projectName)}</h1>
            ${titleLineParts.length > 0 ? `<p class="qp-cover-project-line">${titleLineParts.map((part) => `<span>${part}</span>`).join('')}</p>` : ''}
          </div>
          <div class="qp-cover-quote-box">
            <span>报价编号 / Quote No.</span>
            <strong>${esc(vm.quoteNumber || '—')}</strong>
          </div>
        </div>

        <section class="qp-cover-core">
          <div class="qp-cover-core-head">核心报价信息</div>
          <div class="qp-cover-core-panel">
            <div class="qp-cover-core-customer">
              <span>客户名称</span>
              <strong>${esc(vm.clientName || '—')}</strong>
            </div>
            <div class="qp-cover-core-pair-grid">
              <div class="qp-cover-core-cell">
                <span>联系人</span>
                <strong>${esc(vm.contactName || '—')}</strong>
              </div>
              <div class="qp-cover-core-cell">
                <span>联系方式</span>
                <strong>${esc(vm.contactPhone || '—')}</strong>
              </div>
            </div>
            <div class="qp-cover-core-meta-grid">
              <div class="qp-cover-core-cell">
                <span>报价日期</span>
                <strong>${esc(vm.quoteDate || '—')}</strong>
              </div>
              <div class="qp-cover-core-cell">
                <span>有效期至</span>
                <strong>${esc(vm.validUntil || '—')}</strong>
              </div>
              <div class="qp-cover-core-cell">
                <span>报价币种</span>
                <strong>${esc(vm.currency || 'EUR')}</strong>
              </div>
              <div class="qp-cover-core-cell">
                <span>参加人数</span>
                <strong>${peopleText}</strong>
              </div>
            </div>
          </div>
        </section>

        <section class="qp-cover-summary-strip">
          <div class="qp-cover-summary-head">项目摘要</div>
          <p>${summaryText}</p>
        </section>

        <section class="qp-cover-modules-strip">
          <span>服务模块：${vm.groups.length}</span>
        </section>

        <section class="qp-cover-total-strip">
          <div class="qp-cover-total-copy">
            <span>客户报价总额</span>
            <small>${state.lang === 'zh-sr' ? 'Klijentska ukupna cena' : 'Client Grand Total'}</small>
          </div>
          <div class="qp-cover-total-amount">
            <em>${esc(vm.currency || 'EUR')}</em>
            <strong>${money(vm.totalSales, vm.currency)}</strong>
          </div>
        </section>
      </div>
    `;
  }

  function renderOverviewContent(vm, runtime) {
    const { state, groupLabels, utils } = getRuntime(runtime);
    const { esc, getText, biTitle, money, tableHead } = utils;
    const totalItems = vm.groups.reduce((sum, g) => sum + g.items.length, 0);
    const hasNotes = Boolean(vm.notes && vm.notes.trim());
    const notesCard = hasNotes ? `
      <article class="qp-narrative-card">
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
          <td style="padding:16px 14px">${getText(titleObj)}</td>
          <td style="padding:16px 14px;text-align:center;color:var(--qp-ink-muted)">${group.items.length}</td>
          <td class="qp-money" style="padding:16px 14px">${money(group.groupSalesTotal, vm.currency)}</td>
        </tr>
      `;
    }).join('');

    const totalRow = `
      <tr style="border-top:2px solid var(--qp-line-strong)">
        <td style="font-weight:600;padding:14px 14px 16px">${biTitle('合计', 'Total', 'Ukupno')}</td>
        <td style="text-align:center;font-weight:600;padding:14px 14px 16px">${totalItems}</td>
        <td class="qp-money" style="font-weight:700;font-size:16px;padding:14px 14px 16px">${money(vm.totalSales, vm.currency)}</td>
      </tr>
    `;

    const chapterNote = state.lang === 'zh-sr'
      ? 'Detalji po stavkama i jediničnim cenama nalaze se na sledećim stranicama.'
      : state.lang === 'zh-en'
      ? 'Full itemized details and unit pricing are provided on the following pages.'
      : '各服务模块的完整明细项目与单价信息详见后续页面。';

    return `
      <div class="qp-page-head">
        <div>
          <h2>${biTitle('服务方案概述', 'Service Overview', 'Pregled usluga')}</h2>
          <p>${esc(vm.projectName)}${vm.clientName ? ' · ' + esc(vm.clientName) : ''}</p>
        </div>
        <div class="qp-page-mark">Service Overview</div>
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
    const { utils } = getRuntime(runtime);
    const { esc, biTitle } = utils;
    return `
      <div class="qp-page-head">
        <div>
          <h2>${biTitle('报价明细', 'Detailed Quotation', 'Detaljna ponuda')}</h2>
          <p>${esc(vm.projectName)}${vm.clientName ? ' · ' + esc(vm.clientName) : ''}</p>
        </div>
        <div class="qp-page-mark">Detailed Quotation</div>
      </div>
    `;
  }

  function renderItemRows(items, runtime, currency) {
    const { utils } = getRuntime(runtime);
    const { esc, getText, money } = utils;
    if (!items || items.length === 0) {
      return '<tr><td colspan="7" style="text-align:center;color:var(--qp-ink-muted);padding:20px">本组暂无明细</td></tr>';
    }

    return items.map((item) => `
      <tr>
        <td><strong>${getText(item.itemName)}</strong></td>
        <td>${item.specification ? esc(item.specification) : ''}</td>
        <td>${esc(item.qtyDisplay)}</td>
        <td>${esc(item.unit)}</td>
        <td class="qp-money">${money(item.salesUnitPrice, currency)}</td>
        <td class="qp-money">${money(item.salesSubtotal, currency)}</td>
        <td>${item.remarks ? esc(item.remarks) : ''}</td>
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
          <thead>
            <tr>
              ${tableHead('项目名称', 'Item Name', 'Naziv stavke')}
              ${tableHead('规格说明', 'Specification', 'Specifikacija')}
              ${tableHead('数量', 'Qty', 'Kol.')}
              ${tableHead('单位', 'Unit', 'Jedinica')}
              ${tableHead('销售单价', 'Unit Price', 'Jedinicna cena', 'qp-money')}
              ${tableHead('小计', 'Subtotal', 'Medjuzbir', 'qp-money')}
              ${tableHead('备注', 'Remarks', 'Napomena')}
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
        <td>${item.remarks ? esc(item.remarks) : ''}</td>
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
      ? '<tr><td colspan="7" style="text-align:center;color:var(--qp-ink-muted);padding:20px">本组暂无明细</td></tr>'
      : rowsHtml.join('');

    const contClass = isFirst ? '' : ' qp-detail-card-cont';
    return `
      <article class="qp-detail-card${contClass}">
        ${headHtml}
        <table class="qp-table">
          <thead>
            <tr>
              ${tableHead('项目名称', 'Item Name', 'Naziv stavke')}
              ${tableHead('规格说明', 'Specification', 'Specifikacija')}
              ${tableHead('数量', 'Qty', 'Kol.')}
              ${tableHead('单位', 'Unit', 'Jedinica')}
              ${tableHead('销售单价', 'Unit Price', 'Jedinicna cena', 'qp-money')}
              ${tableHead('小计', 'Subtotal', 'Medjuzbir', 'qp-money')}
              ${tableHead('备注', 'Remarks', 'Napomena')}
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
          <thead>
            <tr>
              ${tableHead('项目名称', 'Item Name', 'Naziv stavke')}
              ${tableHead('规格说明', 'Specification', 'Specifikacija')}
              ${tableHead('数量', 'Qty', 'Kol.')}
              ${tableHead('单位', 'Unit', 'Jedinica')}
              ${tableHead('销售单价', 'Unit Price', 'Jedinicna cena', 'qp-money')}
              ${tableHead('小计', 'Subtotal', 'Medjuzbir', 'qp-money')}
              ${tableHead('备注', 'Remarks', 'Napomena')}
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
    const { utils } = getRuntime(runtime);
    const { biTitle } = utils;
    return `
      <div class="qp-page-head qp-terms-span-full">
        <div>
          <h2>${biTitle('商务条款', 'Commercial Terms', 'Komercijalni uslovi')}</h2>
          <p>以下条款明确本次服务的费用范围、付款安排与确认要求，请双方签署前仔细阅读。</p>
        </div>
        <div class="qp-page-mark">Commercial Terms</div>
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
