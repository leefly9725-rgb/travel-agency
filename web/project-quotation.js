const COMPANY = {
  logoText: 'LDS',
  cn: 'LDS International Travel',
  en: 'LDS International Travel',
  legal: 'LDS International Travel d.o.o Beograd',
  address: 'Second Floor, TRG PRIJATELJSTVA SRBIJE KINE 4, BEOGRAD',
  contact: 'shen.summer@yahoo.com',
  pib: '112696746',
};

const GROUP_TYPE_LABELS = {
  travel: { zh: '旅游接待', en: 'Travel & Reception', sr: 'Turizam i prijem' },
  event:  { zh: '活动服务', en: 'Event Services',     sr: 'Usluge dogadjaja' },
  mixed:  { zh: '综合项目', en: 'Mixed Program',      sr: 'Kombinovani program' },
};

// 供应商价格库分类 → 客户报价单显示标签
const CATALOG_CATEGORY_LABELS = {
  av_equipment:    'AV设备',
  stage_structure: '舞台搭建',
  print_display:   '印刷展示',
  decoration:      '装饰物料',
  furniture:       '家具桌椅',
  personnel:       '人员服务',
  logistics:       '物流运输',
  management:      '管理费用',
  hotel:           '酒店住宿',
  transport:       '交通用车',
  ticket:          '门票景点',
  misc:            '其他',
};

// itemType code → 供应商价格库分类 code（itemCategory 未设时的自动推断）
const ITEM_TYPE_TO_CATEGORY = {
  av_lighting:           'av_equipment',
  build_production:      'stage_structure',
  design_print:          'print_display',
  staffing_execution:    'personnel',
  logistics_transport:   'logistics',
  venue_service:         'management',
  material_purchase:     'decoration',
  hotel:                 'hotel',
  transport:             'transport',
  guide_translation:     'personnel',
  driver_guide:          'personnel',
  ticket:                'ticket',
  fuel:                  'logistics',
  toll_parking:          'logistics',
  catering_refreshments: 'management',
};


function normalizeSupplierCatalogItem(rawItem) {
  return {
    id: String(rawItem?.id || '').trim(),
    category: String(rawItem?.category || rawItem?.supplierCategory || rawItem?.supplier_category || '').trim(),
  };
}

async function loadSupplierCategoryMap(fetchFn) {
  try {
    const data = await fetchFn('/api/supplier-items');
    const items = Array.isArray(data) ? data : (data?.items || []);
    return items.reduce((map, rawItem) => {
      const item = normalizeSupplierCatalogItem(rawItem);
      if (item.id && item.category) {
        map.set(item.id, item.category);
      }
      return map;
    }, new Map());
  } catch (_) {
    return new Map();
  }
}

function resolveProjectItemCategory(item, supplierCategoryMap) {
  const supplierCategory = supplierCategoryMap?.get(String(item?.supplierCatalogItemId || '').trim()) || '';
  const explicitCategory = String(item?.itemCategory || '').trim();
  const mappedCategory = ITEM_TYPE_TO_CATEGORY[item?.itemType] || '';
  const categoryKey = supplierCategory || explicitCategory || mappedCategory || 'misc';
  return {
    categoryKey,
    categoryLabel: CATALOG_CATEGORY_LABELS[categoryKey] || '其他',
  };
}

// 分类在客户报价单中的显示排序
const CATEGORY_SORT_ORDER = [
  'hotel', 'transport', 'ticket',
  'av_equipment', 'stage_structure', 'furniture', 'decoration', 'print_display',
  'personnel', 'logistics', 'management',
];

// 项目类型的标准显示名称。
// 用途：当 itemName 用户未填写时，提供类型语义的专业 fallback，
// 确保三种语言版本下都有合理显示，而不是空白或程序占位符。
const ITEM_TYPE_DISPLAY = {
  hotel:             { zh: '酒店住宿',    en: 'Hotel Accommodation', sr: 'Hotelski smeštaj' },
  transport:         { zh: '交通服务',    en: 'Transportation',       sr: 'Transport'         },
  guide_translation: { zh: '导游 / 翻译', en: 'Guide / Interpreter',  sr: 'Vodič / Tumač'     },
  catalog_item:      { zh: '服务项目',    en: 'Service Item',         sr: 'Usluga'            },
  misc:              { zh: '杂项服务',    en: 'Miscellaneous',        sr: 'Ostale usluge'     },
};

const STATIC_TERMS = {
  included: [
    {
      zh: '报价范围内的客户版服务执行费用',
      en: 'Client-facing service execution fees within the quotation scope',
      sr: 'Troskovi izvrsenja usluga prema obimu ponude',
    },
    {
      zh: '报价所列全部服务项目',
      en: 'All services listed in this quotation',
      sr: 'Sve usluge navedene u ovoj ponudi',
    },
    {
      zh: '项目执行期间的基础现场协调',
      en: 'Basic on-site operational coordination during service delivery',
      sr: 'Osnovna koordinacija na terenu tokom realizacije',
    },
  ],
  excluded: [
    {
      zh: '国际机票、签证、个人消费及未列明第三方费用',
      en: 'International flights, visas, personal expenses, and unlisted third-party charges',
      sr: 'Medjunarodne avionske karte, vize, licni troskovi i nenavedeni troskovi',
    },
    {
      zh: '超时、临时新增服务或客户临时变更造成的追加成本',
      en: 'Additional costs due to overtime, ad-hoc services, or last-minute client changes',
      sr: 'Dodatni troskovi zbog prekovremenog rada ili izmena na zahtev klijenta',
    },
  ],
  notes: [
    {
      zh: '本报价自出具之日起 10 个自然日内有效，如服务范围调整，报价金额将随之更新。',
      en: 'This quotation remains valid for 10 calendar days from the issue date. Any scope adjustment may result in a revised quotation.',
      sr: 'Ova ponuda vazi 10 kalendarskih dana od datuma izdavanja. Svaka promena obima moze dovesti do revidirane ponude.',
    },
  ],
  payment: {
    zh: '建议采用银行转账付款。签约确认后支付 50% 预付款，项目开始前支付剩余尾款。',
    en: 'Bank transfer is recommended. A 50% advance payment is due upon confirmation, with the remaining balance settled before project commencement.',
    sr: 'Preporucuje se placanje bankarskim transferom. Nakon potvrde uplacuje se 50% avansa, a ostatak pre pocetka projekta.',
  },
};

const params = new URLSearchParams(location.search);
const quoteId = params.get('id') || '';
let termsSnapshot = null;  // loaded in bootstrap(), injected into Composer runtime
const editTermsBtn = document.getElementById('btn-edit-terms');
if (editTermsBtn && quoteId) {
  const returnPath = `${window.location.pathname}${window.location.search}`;
  editTermsBtn.href = `/terms-editor.html?quote_id=${encodeURIComponent(quoteId)}&return=${encodeURIComponent(returnPath)}`;
}

const state = {
  lang: params.get('lang') || 'zh-en',
  mode: params.get('mode') || 'professional',
  grouping: params.get('grouping') || 'grouped',
  showOverview: params.get('overview') !== '0',
  showSign: params.get('sign') !== '0',
  taxMode: params.get('taxMode') || params.get('tax') || params.get('vat') || 'included',
};

const FEATURE_FLAGS = {
  composerPagination: params.get('composer') !== '0',
};

const previewRoot = document.getElementById('quotation-preview');
const loadingEl = document.getElementById('qp-loading');
const errorEl = document.getElementById('qp-error');
const toolbarSubEl = document.getElementById('toolbar-subtitle');
const langSelect = document.getElementById('preview-language');
const modeSelect = document.getElementById('preview-mode');
const groupingSelect = document.getElementById('preview-grouping');
const overviewCheck = document.getElementById('preview-overview');
const signCheck = document.getElementById('preview-sign');
const taxSelect = document.getElementById('preview-tax-mode');
window.__QP_READY__ = false;
window.__QP_TOTAL_PAGES__ = 0;
window.__QP_PAGES_STABLE__ = false;

function money(value, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function addDays(dateStr, days) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getSecondary(value) {
  if (!value || typeof value !== 'object') return '';
  if (state.lang === 'zh-en') return value.en || '';
  if (state.lang === 'zh-sr') return value.sr || value.en || '';
  return '';
}

function getText(value) {
  if (!value || typeof value !== 'object') {
    return `<span>${esc(value == null ? '' : value)}</span>`;
  }

  const zh = value.zh || '';
  const secondary = getSecondary(value);
  if (state.lang === 'zh') {
    return `<span>${esc(zh)}</span>`;
  }
  return `<span>${esc(zh)}</span>${secondary ? `<span class="qp-sub-lang">${esc(secondary)}</span>` : ''}`;
}

function biTitle(main, subEn, subSr) {
  const secondary = state.lang === 'zh-sr' ? (subSr || subEn || '') : (subEn || '');
  if (state.lang === 'zh' || !secondary) {
    return `<span class="qp-bi-title-main">${esc(main)}</span>`;
  }
  return `<span class="qp-bi-title-main">${esc(main)}</span><span class="qp-bi-title-sub">${esc(secondary)}</span>`;
}

function metaLabel(zh, en, sr) {
  const secondary = state.lang === 'zh' ? '' : (state.lang === 'zh-sr' ? (sr || en || '') : (en || ''));
  if (!secondary) return esc(zh);
  return `${esc(zh)}<small style="display:block;font-size:10px;color:var(--qp-ink-muted);font-weight:400;letter-spacing:0.04em;line-height:1.45;margin-top:2px">${esc(secondary)}</small>`;
}

function tableHead(zh, en, sr, extraClass) {
  const cls = extraClass ? ` class=\"${esc(extraClass)}\"` : '';
  if (state.lang === 'zh') return `<th${cls}>${esc(zh)}</th>`;
  const secondary = state.lang === 'zh-sr' ? (sr || en || '') : (en || '');
  return `<th${cls}>${esc(zh)}${secondary ? `<br><small style=\"font-size:10px;font-weight:400;color:var(--qp-ink-muted);letter-spacing:0.02em\">${esc(secondary)}</small>` : ''}</th>`;
}


function renderBrandTitle(company, size, spacing) {
  const brandName = (company && (company.en || company.cn)) || '';
  return `<div style="font-size:${size};font-weight:700;color:#F5F2EC;letter-spacing:${spacing};">${esc(brandName)}</div>`;
}

function hasMeaningfulText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function buildClientItem(item, supplierCategoryMap, groupType) {
  const extraJson = item.extraJson || {};
  // Hotel-specific display (nights × rooms, 间夜 unit) only applies to genuine
  // travel-group hotel items.  Event groups may carry stale itemType='hotel'
  // from copy/paste or type-switching; suppress hotel formatting there.
  const isHotel = item.itemType === 'hotel' && groupType !== 'event';
  const nights = isHotel ? Math.max(Number(extraJson.nights || 1), 1) : null;
  const quantity = Math.max(Number(item.quantity || 1), 1);
  const qtyDisplay = isHotel && nights ? `${quantity} × ${nights} 晚` : `${quantity}`;
  const typeFallback = ITEM_TYPE_DISPLAY[item.itemType] || ITEM_TYPE_DISPLAY.misc;

  const { categoryKey, categoryLabel } = resolveProjectItemCategory(item, supplierCategoryMap);

  return {
    itemName: {
      zh: item.itemName || typeFallback.zh,
      en: item.nameEn || '',
      sr: item.nameSr || '',
    },
    specification: item.specification || '',
    unit: isHotel ? '间夜' : (item.unit || '项'),
    quantity,
    qtyDisplay,
    salesUnitPrice: Number(item.salesUnitPrice || 0),
    salesSubtotal: Number(item.salesSubtotal || 0),
    remarks: item.remarks || '',
    categoryKey,
    categoryLabel,
  };
}

function isEffectiveClientItem(item) {
  const subtotal = Number(item.salesSubtotal || 0);
  const unitPrice = Number(item.salesUnitPrice || 0);
  const quantity = Number(item.quantity || 0);
  const hasCommercialValue = subtotal > 0 || unitPrice > 0;
  const hasDescriptor = hasMeaningfulText(item.itemName && item.itemName.zh)
    || hasMeaningfulText(item.specification)
    || hasMeaningfulText(item.remarks);
  return hasCommercialValue && (hasDescriptor || quantity > 0);
}

function buildClientViewModel(quote, supplierCategoryMap) {
  const quoteDate = quote.startDate || (quote.createdAt || '').slice(0, 10) || '';

  const groups = (quote.projectGroups || []).map((group) => {
    const typeLabels = GROUP_TYPE_LABELS[group.projectType] || GROUP_TYPE_LABELS.travel;
    const items = (group.items || [])
      .map((item) => buildClientItem(item, supplierCategoryMap, group.projectType))
      .filter(isEffectiveClientItem);

    // 按分类排序，使同类明细聚集
    items.sort((a, b) => {
      const ai = CATEGORY_SORT_ORDER.indexOf(a.categoryKey);
      const bi = CATEGORY_SORT_ORDER.indexOf(b.categoryKey);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const groupSalesTotal = items.reduce((sum, item) => sum + Number(item.salesSubtotal || 0), 0);
    if (items.length === 0 || groupSalesTotal <= 0) {
      return null;
    }

    // event 组始终显示分类标题；其他组仅当存在多个不同分类时显示
    const distinctCategories = new Set(items.map((i) => i.categoryKey));
    const showCategoryHeaders = group.projectType === 'event'
      ? items.length > 0
      : distinctCategories.size > 1;

    return {
      projectType: group.projectType || 'travel',
      projectTitle: group.projectTitle || typeLabels.zh,
      typeLabel: typeLabels,
      description: group.description || '',
      items,
      groupSalesTotal,
      showCategoryHeaders,
    };
  }).filter(Boolean);

  const totalSales = groups.reduce((sum, group) => sum + group.groupSalesTotal, 0);

  const subtotal = totalSales;
  const vatRate = 0.2;
  const vatAmount = subtotal * vatRate;
  const grandTotal = subtotal + vatAmount;

  const serviceSummary = groups.map((group) => group.projectTitle).filter(Boolean);

  return {
    projectName: quote.projectName || '未命名项目',
    clientName: quote.clientName || '',
    contactName: quote.contactName || '',
    contactPhone: quote.contactPhone || '',
    quoteNumber: quote.quoteNumber || '',
    quoteDate,
    validUntil: addDays(quoteDate, 10),
    currency: quote.currency || 'EUR',
    paxCount: quote.paxCount != null ? quote.paxCount : '',
    destination: quote.destination || '',
    startDate: quote.startDate || '',
    endDate: quote.endDate || '',
    notes: quote.notes || '',
    groups,
    totalSales,
    subtotal,
    vatRate,
    vatAmount,
    grandTotal,
    serviceSummary,
  };
}

function renderTotalBlock(vm, note) {
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

function renderItemRows(items, currency, showCategoryHeaders) {
  if (!items || items.length === 0) {
    return '<tr><td colspan="7" style="text-align:center;color:var(--qp-ink-muted);padding:20px">本组暂无明细</td></tr>';
  }

  const rows = [];
  let lastCategory = null;
  items.forEach((item) => {
    if (showCategoryHeaders && item.categoryKey !== lastCategory) {
      rows.push(`<tr class="qp-category-header-row"><td colspan="7"><span class="qp-category-header-label">${esc(item.categoryLabel)}</span></td></tr>`);
      lastCategory = item.categoryKey;
    }
    rows.push(`
      <tr>
        <td><strong>${getText(item.itemName)}</strong></td>
        <td>${item.specification ? esc(item.specification) : ''}</td>
        <td>${esc(item.qtyDisplay)}</td>
        <td>${esc(item.unit)}</td>
        <td class="qp-money">${money(item.salesUnitPrice, currency)}</td>
        <td class="qp-money">${money(item.salesSubtotal, currency)}</td>
        <td>${item.remarks ? esc(item.remarks) : ''}</td>
      </tr>`);
  });
  return rows.join('');
}

function formatPageNo(value) {
  return String(value).padStart(2, '0');
}

function chunkItems(items, size) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function createBlock(id, html, options) {
  const config = options || {};
  const className = config.className ? ` ${config.className}` : '';
  const blockType = config.type ? ` data-block-type="${esc(config.type)}"` : '';
  return {
    id,
    keepWithNext: Boolean(config.keepWithNext),
    html: `<div class="qp-compose-block${className}" data-block-id="${esc(id)}"${blockType}>${html}</div>`,
  };
}

function renderCoverContent(vm) {
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
    <div style="display:flex;flex-direction:column;flex:1;min-height:0;background:#F5F2EC;font-family:Arial,sans-serif;overflow:hidden;position:relative;">

      <!-- 右上角几何装饰 -->
      <svg style="position:absolute;top:0;right:0;width:260px;height:260px;pointer-events:none;z-index:1;" viewBox="0 0 260 260">
        <polygon points="260,0 260,260 0,0" fill="#1B2A4A" opacity="0.06"/>
        <polygon points="260,0 260,170 90,0" fill="#C9A84C" opacity="0.11"/>
        <polygon points="260,0 260,70 190,0" fill="#1B2A4A" opacity="0.09"/>
      </svg>
      <!-- 左下角几何装饰 -->
      <svg style="position:absolute;bottom:55px;left:0;width:180px;height:180px;pointer-events:none;z-index:1;" viewBox="0 0 180 180">
        <polygon points="0,180 180,180 0,0" fill="#1B2A4A" opacity="0.05"/>
        <polygon points="0,180 110,180 0,70" fill="#C9A84C" opacity="0.08"/>
      </svg>

      <!-- Header -->
      <div style="flex-shrink:0;background:#1B2A4A;padding:18px 32px;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:2;">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="/assets/logo.png" style="height:32px;width:auto;display:block;flex-shrink:0;">
          <div>${renderBrandTitle(COMPANY, '15px', '1px')}</div>
        </div>
        <div style="text-align:right;font-size:9px;color:#7B8FAD;line-height:1.9;">
          <div>Belgrade, Serbia</div>
          <div>${esc(COMPANY.contact)}</div>
          <div>PIB: ${esc(COMPANY.pib)}</div>
        </div>
      </div>

      <!-- Hero 区 -->
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
        <div><div style="font-size:7px;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin-bottom:4px;">报价日期</div><div style="font-size:12px;color:#F5F2EC;font-weight:500;">${esc(vm.quoteDate || '—')}</div></div>
        <div><div style="font-size:7px;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin-bottom:4px;">有效期至</div><div style="font-size:12px;color:#F5F2EC;font-weight:500;">${esc(vm.validUntil || '—')}</div></div>
        <div><div style="font-size:7px;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin-bottom:4px;">币种</div><div style="font-size:12px;color:#F5F2EC;font-weight:500;">${esc(vm.currency || 'EUR')}</div></div>
        <div><div style="font-size:7px;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin-bottom:4px;">服务模块</div><div style="font-size:12px;color:#F5F2EC;font-weight:500;">${vm.groups.length} 个</div></div>
      </div>

      <!-- 金色总价栏 -->
      <div style="flex-shrink:0;background:#C9A84C;padding:20px 32px;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:2;">
        <div style="font-size:9px;letter-spacing:2px;color:#1B2A4A;text-transform:uppercase;font-weight:700;">GRAND TOTAL · 客户报价总额</div>
        <div style="display:flex;align-items:baseline;gap:8px;">
          <span style="font-size:12px;color:#1B2A4A;opacity:0.6;">${esc(vm.currency || 'EUR')}</span>
          <span style="font-size:30px;font-weight:700;color:#1B2A4A;">${money(vm.totalSales, vm.currency)}</span>
        </div>
      </div>

      <!-- 页脚 -->
      <div style="flex-shrink:0;background:#F5F2EC;padding:12px 32px;display:flex;justify-content:space-between;border-top:1px solid #D4CCBE;position:relative;z-index:2;">
        <span style="font-size:9px;color:#7B8FAD;letter-spacing:1px;">${esc(COMPANY.legal)}</span>
        <span style="font-size:9px;color:#7B8FAD;letter-spacing:1px;">${esc(vm.quoteNumber || '')}</span>
      </div>

    </div>
  `;
}

function renderOverviewHeader(vm) {
  return `
    <div class="qp-page-head">
      <div>
        <h2>${biTitle('服务方案概述', 'Service Overview', 'Pregled usluga')}</h2>
        <p>${esc(vm.projectName)}${vm.clientName ? ' · ' + esc(vm.clientName) : ''}</p>
      </div>
      <div class="qp-page-mark">Service Overview</div>
    </div>
  `;
}

function renderOverviewBody(vm) {
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
    const labels = GROUP_TYPE_LABELS[group.projectType] || GROUP_TYPE_LABELS.travel;
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

function renderDetailHeader(vm) {
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

function renderProfessionalGroupCard(vm, group) {
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
        <tbody>${renderItemRows(group.items, vm.currency, group.showCategoryHeaders)}</tbody>
      </table>
      <div class="qp-group-foot">
        <span>${biTitle('分组小计', 'Group Subtotal', 'Medjuzbir grupe')}</span>
        <strong>${money(group.groupSalesTotal, vm.currency)}</strong>
      </div>
    </article>
  `;
}

function renderProfessionalFlatChunk(vm, items) {
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
        <tbody>${renderItemRows(items, vm.currency)}</tbody>
      </table>
    </article>
  `;
}

function renderMixedGroupCard(vm, group) {
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

function renderMixedFlatChunk(vm, items) {
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

function buildDetailBlocks(vm) {
  const blocks = [];

  if (state.mode === 'professional' && state.grouping === 'grouped') {
    vm.groups.forEach((group, index) => {
      blocks.push(createBlock(`quote-group-${index + 1}`, renderProfessionalGroupCard(vm, group), { type: 'quote-group' }));
    });
  } else if (state.mode === 'professional' && state.grouping === 'flat') {
    const flatItems = vm.groups.flatMap((group) =>
      (group.items || []).map((item) => ({ ...item, groupTitle: group.projectTitle }))
    );
    chunkItems(flatItems, 9).forEach((items, index) => {
      blocks.push(createBlock(`quote-group-${index + 1}`, renderProfessionalFlatChunk(vm, items), { type: 'quote-group' }));
    });
  } else if (state.mode === 'mixed' && state.grouping === 'grouped') {
    vm.groups.forEach((group, index) => {
      blocks.push(createBlock(`quote-group-${index + 1}`, renderMixedGroupCard(vm, group), { type: 'quote-group' }));
    });
  } else {
    const flatItems = vm.groups.flatMap((group) =>
      (group.items || []).map((item) => ({ ...item, groupTitle: group.projectTitle }))
    );
    chunkItems(flatItems, 8).forEach((items, index) => {
      blocks.push(createBlock(`quote-group-${index + 1}`, renderMixedFlatChunk(vm, items), { type: 'quote-group' }));
    });
  }

  if (blocks.length > 0) {
    blocks.push(createBlock('final-quotation', renderTotalBlock(vm, '以上明细项目合计为本项目完整客户报价，金额以最终签署版本为准。'), {
      type: 'final-quotation',
      className: 'qp-final-quotation-block',
    }));
  }

  return blocks;
}

function renderTermsHeader() {
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

function renderTermsCard(titleHtml, bodyHtml) {
  return `
    <article class="qp-terms-card">
      <div class="qp-card-title">
        <h3>${titleHtml}</h3>
      </div>
      ${bodyHtml}
    </article>
  `;
}

function renderSignatureBlock() {
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
        <strong>${biTitle(COMPANY.cn, COMPANY.en, COMPANY.en)}</strong>
        <p>由公司授权代表签字确认，并加盖公章。</p>
        <div class="qp-sign-lines">
          <div class="qp-sign-field"><span>签字 Signature</span><div class="qp-sign-line"></div></div>
          <div class="qp-sign-field"><span>日期 / 盖章 Date / Stamp</span><div class="qp-sign-line"></div></div>
        </div>
      </div>
    </div>
  `;
}

function buildTermsBlocks() {
  const included = STATIC_TERMS.included.map((item) => `<li>${getText(item)}</li>`).join('');
  const excluded = STATIC_TERMS.excluded.map((item) => `<li>${getText(item)}</li>`).join('');
  const notes = STATIC_TERMS.notes.map((item) => `<li>${getText(item)}</li>`).join('');
  const blocks = [
    createBlock('terms-header', renderTermsHeader(), { type: 'terms-header', className: 'qp-terms-span-full', keepWithNext: true }),
    createBlock('terms-included', renderTermsCard(biTitle('费用包含', 'Included', 'Ukljuceno'), `<ul>${included}</ul>`), { type: 'terms-card' }),
    createBlock('terms-excluded', renderTermsCard(biTitle('费用不含', 'Excluded', 'Nije ukljuceno'), `<ul>${excluded}</ul>`), { type: 'terms-card' }),
    createBlock('terms-notes', renderTermsCard(biTitle('特别说明', 'Notes', 'Napomene'), `<ul>${notes}</ul>`), { type: 'terms-card' }),
    createBlock('terms-payment', renderTermsCard(biTitle('付款方式与节点', 'Payment Terms', 'Uslovi placanja'), `<p>${getText(STATIC_TERMS.payment)}</p>`), { type: 'terms-card' }),
  ];

  const signatureHtml = renderSignatureBlock();
  if (signatureHtml) {
    blocks.push(createBlock('signature-block', signatureHtml, { type: 'signature-block', className: 'qp-terms-span-full' }));
  }

  return blocks;
}

function buildComposerRuntime() {
  return {
    state,
    company: COMPANY,
    staticTerms: STATIC_TERMS,
    termsSnapshot,
    groupLabels: GROUP_TYPE_LABELS,
    utils: {
      esc,
      getText,
      biTitle,
      money,
      tableHead,
    },
  };
}

function buildComposerPlan(vm) {
  const blocksApi = window.ProjectQuotationBlocks;
  if (!blocksApi) {
    throw new Error('quotation blocks module is not loaded');
  }

  const runtime = buildComposerRuntime();
  const footer = { left: esc(COMPANY.en), right: '' };
  const built = blocksApi.buildAllBlocks(vm, runtime);
  const sections = [
    {
      id: 'cover',
      mode: 'fixed',
      pageClassName: 'qp-cover',
      bodyClassName: 'qp-cover-body',
      blocks: [built.cover],
      footer,
    },
  ];

  if (state.showOverview) {
    sections.push({
      id: 'overview',
      mode: 'fixed',
      pageClassName: 'qp-overview-page',
      bodyClassName: 'qp-standard-body',
      blocks: [built.overview],
      footer,
    });
  }

  const detailBlocks = built.quoteGroups.slice();
  if (built.finalQuotation) detailBlocks.push(built.finalQuotation);
  if (detailBlocks.length > 0) {
    sections.push({
      id: 'detail',
      mode: 'flow',
      pageClassName: 'qp-detail-page',
      bodyClassName: 'qp-standard-body',
      leadBlocks: [built.detailHeader],
      blocks: detailBlocks,
      footer,
    });
  }

  sections.push({
    id: 'terms',
    mode: 'flow',
    pageClassName: 'qp-terms-page',
    bodyClassName: 'qp-terms-body',
    blocks: built.terms,
    footer,
  });

  return { sections };
}

async function ensureFontsReady() {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (error) {
      // ignore font readiness errors and continue
    }
  }
}

async function renderComposer(vm) {
  const composerApi = window.ProjectQuotationComposer;
  if (!composerApi) {
    throw new Error('quotation composer module is not loaded');
  }

  window.__QP_READY__ = false;
  window.__QP_PAGES_STABLE__ = false;
  window.__QP_TOTAL_PAGES__ = 0;

  // Wait for fonts before measuring so block heights are accurate.
  await ensureFontsReady();

  const result = composerApi.composePreviewPages(buildComposerPlan(vm));
  const rendered = composerApi.renderPages(result);
  previewRoot.innerHTML = rendered.html;

  // Wait for fonts again now that actual page content is rendered.
  await ensureFontsReady();

  window.__QP_TOTAL_PAGES__ = rendered.totalPages;

  // Double rAF: let the browser complete layout before signalling ready.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__QP_READY__ = true;

  // One more rAF: stability confirmation for export to wait on.
  requestAnimationFrame(() => {
    window.__QP_PAGES_STABLE__ = true;
  });
}

async function render(vm) {
  return renderComposer(vm);
}

function bindControls(vm) {
  if (langSelect) langSelect.value = state.lang;
  if (modeSelect) modeSelect.value = state.mode;
  if (groupingSelect) groupingSelect.value = state.grouping;
  if (overviewCheck) overviewCheck.checked = state.showOverview;
  if (signCheck) signCheck.checked = state.showSign;
  if (taxSelect) taxSelect.value = state.taxMode;

  if (langSelect) {
    langSelect.addEventListener('change', () => {
      state.lang = langSelect.value;
      render(vm);
    });
  }

  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      state.mode = modeSelect.value;
      render(vm);
    });
  }

  if (groupingSelect) {
    groupingSelect.addEventListener('change', () => {
      state.grouping = groupingSelect.value;
      render(vm);
    });
  }

  if (overviewCheck) {
    overviewCheck.addEventListener('change', () => {
      state.showOverview = overviewCheck.checked;
      render(vm);
    });
  }

  if (signCheck) {
    signCheck.addEventListener('change', () => {
      state.showSign = signCheck.checked;
      render(vm);
    });
  }

  if (taxSelect) {
    taxSelect.addEventListener('change', () => {
      state.taxMode = taxSelect.value;
      render(vm);
    });
  }
}

function markReady(totalPages) {
  window.__QP_READY__ = false;
  window.__QP_PAGES_STABLE__ = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__QP_TOTAL_PAGES__ = Number(totalPages || 0);
      window.__QP_READY__ = true;
      requestAnimationFrame(() => {
        window.__QP_PAGES_STABLE__ = true;
      });
    });
  });
}

function showError(message) {
  window.__QP_READY__ = false;
  window.__QP_TOTAL_PAGES__ = 0;
  if (loadingEl) loadingEl.style.display = 'none';
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

async function bootstrap() {
  if (!quoteId) {
    showError('缺少报价 ID。请从项目型报价编辑页点击“客户报价单”进入，或检查 URL 中的 id 参数。');
    return;
  }

  try {
    const fetchFn = window.AppUtils && window.AppUtils.fetchJson
      ? (url) => window.AppUtils.fetchJson(url, null, '报价数据加载失败，请稍后重试。')
      : async (url) => {
          const res = await fetch(url);
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`请求失败 (${res.status}): ${text.slice(0, 160)}`);
          }
          return res.json();
        };

    const _snapToken = window.AuthStore?.getToken() || localStorage.getItem('app_token');
    const [quote, snapshotRaw, supplierCategoryMap] = await Promise.all([
      fetchFn(`/api/quotes/${encodeURIComponent(quoteId)}`),
      fetch(`/api/terms/snapshot?quote_id=${encodeURIComponent(quoteId)}`, {
        headers: _snapToken ? { Authorization: `Bearer ${_snapToken}` } : {},
      })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      loadSupplierCategoryMap(fetchFn),
    ]);
    termsSnapshot = snapshotRaw || null;

    if (!quote || quote.pricingMode !== 'project_based') {
      showError('该报价不是项目型报价，无法生成客户报价单。请确认报价 ID 正确。');
      return;
    }

    const vm = buildClientViewModel(quote, supplierCategoryMap);
    if (toolbarSubEl) {
      toolbarSubEl.textContent = `${vm.projectName}${vm.clientName ? ' · ' + vm.clientName : ''}`;
    }

    if (loadingEl) loadingEl.style.display = 'none';
    if (previewRoot) previewRoot.style.display = '';

    bindControls(vm);
    render(vm);
    document.title = `客户报价单 — ${vm.projectName}`;
  } catch (error) {
    showError(`报价数据加载失败：${error.message || '未知错误'}`);
  }
}

bootstrap();


