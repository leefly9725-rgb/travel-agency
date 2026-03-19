const mockQuotation = {
  company: {
    logoText: 'LDS',
    cn: '泷鼎晟国际旅行社运营系统 V1.0',
    en: 'LDS International Travel',
    address: 'Belgrade, Serbia | 商务接待与高端定制服务',
    contact: 'WhatsApp / Tel: +381 60 123 4567 | sales@lds-travel.com',
  },
  quotation: {
    title: {
      zh: '塞尔维亚商务接待项目报价单',
      en: 'Quotation for Serbia Business Reception Project',
      sr: 'Ponuda za projekat poslovnog prijema u Srbiji'
    },
    clientName: '某国际制造企业代表团',
    projectName: '2026 塞尔维亚商务接待与工厂参访项目',
    quoteNumber: 'QT-20260315-8801',
    quoteDate: '2026-03-15',
    validUntil: '2026-03-25',
    currency: 'EUR',
    contactName: 'Amy Li',
    contactLine: 'amy.li@lds-travel.com / +381 60 123 4567',
    projectSummary: {
      zh: '本报价单用于展示 6 天 5 晚塞尔维亚商务接待项目的客户版外发样式，涵盖接送机、酒店住宿、商务翻译、会议支持与商务宴请等核心服务。',
      en: 'This quotation preview demonstrates the client-facing format for a six-day Serbia business reception program, covering airport transfers, hotel accommodation, interpretation, meeting support, and hosted dining services.',
      sr: 'Ovaj pregled ponude prikazuje klijentski format za sestodnevni poslovni prijem u Srbiji, ukljucujuci transfere, hotelski smestaj, prevodjenje, podrsku sastancima i poslovne obroke.'
    },
    scopeSummary: {
      zh: '覆盖贝尔格莱德与诺维萨德双城商务行程，适用于邮件附件、微信转发与 PDF 导出场景的客户版报价模板。',
      en: 'Covers a dual-city business itinerary in Belgrade and Novi Sad, suitable for email attachments, WeChat forwarding, and future PDF export scenarios.',
      sr: 'Obuhvata poslovni itinerar u Beogradu i Novom Sadu i prilagodjen je za slanje mejlom, WeChat-om i buduci PDF izvoz.'
    }
  },
  overview: {
    project: {
      zh: '本项目面向首次来访塞尔维亚的商务代表团，重点是商务接待效率、行程衔接稳定性与客户观感的一致性。报价方案强调正式、清晰、可审阅，适合对外商务沟通。',
      en: 'This program is designed for a first-time business delegation visiting Serbia, with emphasis on operational reliability, stable itinerary handoff, and a polished client impression. The quotation format is formal, clear, and easy to review externally.',
      sr: 'Program je namenjen poslovnoj delegaciji koja prvi put dolazi u Srbiju, sa fokusom na operativnu stabilnost, efikasan tok itinerara i profesionalan utisak kod klijenta.'
    },
    serviceNarrative: {
      zh: '本方案采用“商务接待主线 + 会务支持模块 + 商务宴请模块”的客户表达方式，适合企业采购、外部审批和对外商务确认。报价内容不含内部采购口径，仅展示客户可见服务与销售金额。',
      en: 'This prototype presents the program through a client-facing structure built around the main reception flow, support modules, and hospitality modules. It is intended for procurement review, external approval, and formal client confirmation.',
      sr: 'Ovaj prototip predstavlja program kroz klijentsku strukturu zasnovanu na glavnom toku prijema, modulu podrske i modulu gostoprimstva, pogodnu za internu nabavku i formalnu potvrdu klijenta.'
    },
    itinerary: [
      { zh: 'D1 贝尔格莱德接机与酒店入住，晚间欢迎晚宴', en: 'D1 Airport arrival in Belgrade, hotel check-in, and welcome dinner', sr: 'D1 Dolazak u Beograd, prijava u hotel i vecera dobrodoslice' },
      { zh: 'D2 贝尔格莱德商务会谈与城市商务考察', en: 'D2 Business meetings and city-side commercial inspection in Belgrade', sr: 'D2 Poslovni sastanci i komercijalni obilazak Beograda' },
      { zh: 'D3 诺维萨德工厂参访与往返交通支持', en: 'D3 Novi Sad factory visit with round-trip transport support', sr: 'D3 Poseta fabrici u Novom Sadu sa organizovanim prevozom' },
      { zh: 'D4 行业交流活动与双语会务支持', en: 'D4 Industry exchange session with bilingual event support', sr: 'D4 Strucni poslovni dogadjaj uz dvojezicnu podrsku' },
      { zh: 'D5 自由商务活动与答谢晚宴', en: 'D5 Flexible business activities and hosted appreciation dinner', sr: 'D5 Fleksibilne poslovne aktivnosti i svecana vecera' },
      { zh: 'D6 送机离境', en: 'D6 Airport departure transfer', sr: 'D6 Transfer do aerodroma i odlazak' },
    ],
    scope: [
      { zh: '接送机、城市与城际商务交通安排', en: 'Airport transfers plus city and intercity business transportation', sr: 'Transferi od/do aerodroma, gradski i medjugradski poslovni prevoz' },
      { zh: '酒店住宿与房型统筹', en: 'Hotel accommodation and room-type coordination', sr: 'Hotelski smestaj i koordinacija tipova soba' },
      { zh: '商务翻译、陪同与会议执行支持', en: 'Business interpretation, escorting, and meeting execution support', sr: 'Poslovno prevodjenje, pratnja i podrska sastancima' },
      { zh: '商务宴请与接待标准化执行', en: 'Hosted dining and standardized reception delivery', sr: 'Poslovni obroci i standardizovana organizacija prijema' },
    ],
    modules: [
      {
        name: { zh: '接待交通模块', en: 'Transportation Module', sr: 'Modul prevoza' },
        description: {
          zh: '覆盖接送机、城市点对点调度与诺维萨德往返商务交通，强调准点与现场调度可控。',
          en: 'Covers airport transfers, intra-city dispatch, and round-trip business transport to Novi Sad with emphasis on punctuality and on-site coordination.',
          sr: 'Obuhvata transfere, gradski prevoz i povratno poslovno putovanje do Novog Sada uz fokus na tacnost i koordinaciju na terenu.'
        }
      },
      {
        name: { zh: '住宿与会务模块', en: 'Accommodation & Meeting Module', sr: 'Modul smestaja i sastanaka' },
        description: {
          zh: '统一安排市区商务酒店、会场支持与多语沟通，保证客户外部体验专业一致。',
          en: 'Coordinates city business hotels, venue support, and multilingual communication for a professional external client experience.',
          sr: 'Obezbedjuje poslovni smestaj, podrsku sastancima i visejezicnu komunikaciju za profesionalan utisak kod klijenta.'
        }
      },
      {
        name: { zh: '商务接待模块', en: 'Business Hospitality Module', sr: 'Modul poslovnog gostoprimstva' },
        description: {
          zh: '包含商务午晚餐、欢迎宴请与答谢晚宴等客户可感知服务模块。',
          en: 'Includes hosted lunches, dinners, welcome dining, and appreciation banquets as visible hospitality deliverables.',
          sr: 'Ukljucuje poslovne ruckove, vecere, veceru dobrodoslice i zahvalnu veceru kao vidljive usluge gostoprimstva.'
        }
      }
    ]
  },
  groups: [
    {
      type: 'travel',
      typeLabel: { zh: 'Travel', en: 'Travel', sr: 'Travel' },
      title: { zh: '交通与住宿安排', en: 'Transport and Accommodation', sr: 'Prevoz i smestaj' },
      description: {
        zh: '适用于本次商务接待主行程的交通与酒店安排，强调准点、整洁和商务接待感。',
        en: 'Covers transportation and hotel arrangements for the core reception itinerary, with emphasis on punctuality, order, and business-grade experience.',
        sr: 'Obuhvata prevoz i hotelski smestaj za glavni itinerar poslovnog prijema, uz fokus na tacnost i poslovni standard.'
      },
      items: [
        {
          name: { zh: '商务轿车接送机服务', en: 'Executive Airport Transfer Service', sr: 'Aerodromski transfer poslovnom limuzinom' },
          spec: { zh: '贝尔格莱德机场接机 1 次 + 送机 1 次，含中文协调', en: 'One airport pickup and one airport drop-off in Belgrade with Chinese coordination', sr: 'Jedan docek i jedan odlazak na aerodrom u Beogradu uz kinesku koordinaciju' },
          quantity: 2,
          unit: { zh: '趟', en: 'trip', sr: 'voznja' },
          price: 180,
          subtotal: 360,
          remark: { zh: '按代表团统一班次执行', en: 'Scheduled against unified delegation arrival pattern', sr: 'Organizovano prema zajednickom dolasku delegacije' }
        },
        {
          name: { zh: '市区商务酒店住宿', en: 'City Business Hotel Accommodation', sr: 'Smestaj u poslovnom hotelu u centru' },
          spec: { zh: '4 间标准房 + 1 间大床房，5 晚', en: '4 standard rooms plus 1 king room for 5 nights', sr: '4 standardne sobe i 1 king soba za 5 noci' },
          quantity: 25,
          unit: { zh: '间夜', en: 'room night', sr: 'nocenje sobe' },
          price: 138,
          subtotal: 3450,
          remark: { zh: '含早餐与基础税费', en: 'Breakfast and base taxes included', sr: 'Dorucak i osnovne takse ukljucene' }
        },
        {
          name: { zh: '诺维萨德往返商务用车', en: 'Round-trip Business Vehicle to Novi Sad', sr: 'Povratni poslovni prevoz do Novog Sada' },
          spec: { zh: '商务中巴 1 台，全天往返', en: 'One executive minibus for full-day round trip', sr: 'Jedan poslovni minibus za celodnevno povratno putovanje' },
          quantity: 1,
          unit: { zh: '天', en: 'day', sr: 'dan' },
          price: 420,
          subtotal: 420,
          remark: { zh: '含高速与司机服务', en: 'Includes tolls and driver service', sr: 'Ukljucuje putarine i uslugu vozaca' }
        }
      ],
      subtotal: 4230
    },
    {
      type: 'event',
      typeLabel: { zh: 'Event', en: 'Event', sr: 'Event' },
      title: { zh: '商务接待与会务支持', en: 'Hospitality and Event Support', sr: 'Gostoprimstvo i podrska dogadjajima' },
      description: {
        zh: '面向会议、翻译、宴请与现场协同的客户可感知服务模块。',
        en: 'Covers meetings, interpretation, hosted dining, and on-site coordination as visible client-facing modules.',
        sr: 'Obuhvata sastanke, prevodjenje, poslovne obroke i koordinaciju na terenu kao vidljive module usluge.'
      },
      items: [
        {
          name: { zh: '中英商务翻译服务', en: 'Chinese-English Business Interpretation', sr: 'Kinesko-englesko poslovno prevodjenje' },
          spec: { zh: '全程会议陪同 2 天', en: 'Two days of full business meeting accompaniment', sr: 'Dva dana pune poslovne pratnje i prevodjenja' },
          quantity: 2,
          unit: { zh: '天', en: 'day', sr: 'dan' },
          price: 260,
          subtotal: 520,
          remark: { zh: '含资料预读与会议纪要整理', en: 'Includes material review and summary notes', sr: 'Ukljucuje pripremu materijala i beleske sa sastanka' }
        },
        {
          name: { zh: '欢迎晚宴与答谢晚宴', en: 'Welcome Dinner and Appreciation Banquet', sr: 'Vecera dobrodoslice i zahvalna vecera' },
          spec: { zh: '10 人标准，2 场商务宴请', en: 'Standard hosted dining for 10 guests across 2 business dinners', sr: 'Poslovna vecera za 10 gostiju kroz 2 prijema' },
          quantity: 20,
          unit: { zh: '人次', en: 'guest meal', sr: 'obrok po osobi' },
          price: 48,
          subtotal: 960,
          remark: { zh: '含标准软饮，不含烈酒', en: 'Includes standard soft beverages, excludes spirits', sr: 'Ukljucuje standardna bezalkoholna pica, bez zestokih pica' }
        },
        {
          name: { zh: '会议执行与现场协调', en: 'Meeting Execution and On-site Coordination', sr: 'Izvrsenje sastanka i koordinacija na licu mesta' },
          spec: { zh: '会议资料、签到与场地协调 1 项', en: 'One package covering materials, registration, and venue coordination', sr: 'Jedan paket koji pokriva materijale, registraciju i koordinaciju prostora' },
          quantity: 1,
          unit: { zh: '项', en: 'package', sr: 'paket' },
          price: 680,
          subtotal: 680,
          remark: { zh: '适用于正式商务交流场景', en: 'Suitable for formal business exchange sessions', sr: 'Pogodno za formalne poslovne susrete' }
        }
      ],
      subtotal: 2160
    }
  ],
  terms: {
    included: [
      { zh: '报价范围内的客户版服务执行费用', en: 'Client-facing service execution fees within the quotation scope', sr: 'Troskovi izvrsenja usluga prema obimu ponude' },
      { zh: '报价所列商务交通、住宿、翻译、会务与宴请服务', en: 'Quoted transportation, accommodation, interpretation, meeting, and hosted dining services', sr: 'Navedene usluge prevoza, smestaja, prevodjenja, sastanaka i poslovnih obroka' },
      { zh: '项目执行期间的基础现场协调', en: 'Basic on-site operational coordination during service delivery', sr: 'Osnovna koordinacija na licu mesta tokom realizacije' }
    ],
    excluded: [
      { zh: '国际机票、签证、个人消费及未列明第三方费用', en: 'International flights, visas, personal expenses, and unlisted third-party charges', sr: 'Medjunarodne avionske karte, vize, licni troskovi i nenavedeni troskovi trecih strana' },
      { zh: '超时、临时新增服务或客户临时变更造成的追加成本', en: 'Additional costs caused by overtime, ad-hoc services, or last-minute client changes', sr: 'Dodatni troskovi zbog prekovremenog rada, hitnih usluga ili izmena po zahtevu klijenta' }
    ],
    notes: [
      { zh: '本报价为客户版样式原型，正式版本将根据最终行程与服务范围确认。', en: 'This page is a client-facing style prototype. Final commercial issuance will be aligned to the confirmed itinerary and scope.', sr: 'Ova stranica je prototip klijentskog formata. Konacna komercijalna verzija bice uskladjena sa potvrdjenim itinerarom i obimom usluge.' },
      { zh: '如服务范围调整，报价金额将随之更新。', en: 'Any adjustment to service scope may result in a quotation update.', sr: 'Svaka promena obima usluge moze dovesti do izmene ponude.' }
    ],
    payment: {
      zh: '建议采用银行转账付款。签约确认后支付 50% 预付款，项目开始前支付剩余尾款。',
      en: 'Bank transfer is recommended. A 50% advance payment is due upon confirmation, with the balance settled before project commencement.',
      sr: 'Preporucuje se placanje bankarskim transferom. Nakon potvrde placa se 50% avansa, a ostatak pre pocetka projekta.'
    },
    validity: {
      zh: '本报价自出具之日起 10 个自然日内有效。',
      en: 'This quotation remains valid for 10 calendar days from the issue date.',
      sr: 'Ponuda vazi 10 kalendarskih dana od datuma izdavanja.'
    }
  }
};

const state = {
  languageMode: 'zh',
  pricingMode: 'professional',
  groupMode: 'grouped',
};

const previewRoot = document.getElementById('quotation-preview');
const languageSelect = document.getElementById('preview-language');
const modeSelect = document.getElementById('preview-mode');
const groupingSelect = document.getElementById('preview-grouping');

function money(value, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getText(value) {
  if (!value || typeof value !== 'object') {
    return escapeHtml(value ?? '');
  }

  const zh = value.zh || '';
  const en = value.en || '';
  const sr = value.sr || '';

  if (state.languageMode === 'zh') {
    return `<span>${escapeHtml(zh)}</span>`;
  }

  if (state.languageMode === 'zh-en') {
    return `<span>${escapeHtml(zh)}</span><span class="qp-sub-lang">${escapeHtml(en)}</span>`;
  }

  return `<span>${escapeHtml(zh)}</span><span class="qp-sub-lang">${escapeHtml(sr)}</span>`;
}

function getTotal() {
  return mockQuotation.groups.reduce((sum, group) => sum + group.subtotal, 0);
}

function getLineItems() {
  return mockQuotation.groups.flatMap((group) => group.items.map((item) => ({ ...item, group })));
}

function renderTotalBlock(description) {
  const currency = mockQuotation.quotation.currency;
  return `
    <div class="qp-total-card">
      <div class="qp-total-note">
        <span>Final Quotation</span>
        <strong>客户版总报价</strong>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="qp-total-amount">
        <span>Grand Total</span>
        <em class="qp-total-currency">${escapeHtml(currency)}</em>
        <strong class="qp-total-value">${money(getTotal(), currency)}</strong>
      </div>
    </div>
  `;
}

function renderCoverPage() {
  const q = mockQuotation.quotation;

  return `
    <section class="qp-page qp-cover">
      <div class="qp-cover-top">
        <div class="qp-logo-block">
          <div class="qp-logo-mark">${escapeHtml(mockQuotation.company.logoText)}</div>
          <div>
            <p class="qp-company-cn">${escapeHtml(mockQuotation.company.cn)}</p>
            <p class="qp-company-en">${escapeHtml(mockQuotation.company.en)}</p>
          </div>
        </div>
        <div class="qp-company-meta">
          <div>${escapeHtml(mockQuotation.company.address)}</div>
          <div>${escapeHtml(mockQuotation.company.contact)}</div>
        </div>
      </div>

      <div class="qp-cover-hero">
        <div class="qp-hero-card">
          <div class="qp-hero-eyebrow">Client Quotation Preview</div>
          <h1>${getText(q.title)}</h1>
          <p class="qp-hero-sub">面向客户外发的项目型报价单静态原型，用于确认双语排版、A4 页面节奏与专业版 / 混合版的展示效果。</p>
        </div>
        <div class="qp-side-card">
          <div class="qp-meta-row"><span>客户名称</span><strong>${escapeHtml(q.clientName)}</strong></div>
          <div class="qp-meta-row"><span>项目名称</span><strong>${escapeHtml(q.projectName)}</strong></div>
          <div class="qp-meta-row"><span>报价编号</span><strong>${escapeHtml(q.quoteNumber)}</strong></div>
          <div class="qp-meta-row"><span>报价日期</span><strong>${escapeHtml(q.quoteDate)}</strong></div>
          <div class="qp-meta-row"><span>有效期</span><strong>${escapeHtml(q.validUntil)}</strong></div>
          <div class="qp-meta-row"><span>币种</span><strong>${escapeHtml(q.currency)}</strong></div>
        </div>
      </div>

      <div class="qp-cover-grid">
        <article class="qp-section">
          <div class="qp-section-title">
            <h2>项目概述</h2>
            <span>Overview</span>
          </div>
          <p>${getText(q.projectSummary)}</p>
        </article>
        <article class="qp-section">
          <div class="qp-section-title">
            <h2>服务范围摘要</h2>
            <span>Scope</span>
          </div>
          <p>${getText(q.scopeSummary)}</p>
        </article>
      </div>

      <div class="qp-summary-board">
        <article class="qp-summary-card">
          <span>联系人</span>
          <strong>${escapeHtml(q.contactName)}</strong>
          <p>${escapeHtml(q.contactLine)}</p>
        </article>
        <article class="qp-summary-card">
          <span>服务模块</span>
          <strong>${mockQuotation.overview.modules.length} 个模块</strong>
          <p>商务交通、住宿、会务与接待支持</p>
        </article>
        <article class="qp-summary-card">
          <span>客户版总报价</span>
          <strong>${money(getTotal(), q.currency)}</strong>
          <p>仅展示销售口径，不含内部成本信息</p>
        </article>
      </div>

      <div class="qp-page-no">
        <span>LDS International Travel</span>
        <span>01</span>
      </div>
    </section>
  `;
}

function renderOverviewPage() {
  const overview = mockQuotation.overview;
  const moduleCards = overview.modules.map((module) => `
    <article class="qp-module-card">
      <strong>${getText(module.name)}</strong>
      <p>${getText(module.description)}</p>
    </article>
  `).join('');

  const itinerary = overview.itinerary.map((item) => `<li>${getText(item)}</li>`).join('');
  const scope = overview.scope.map((item) => `<li>${getText(item)}</li>`).join('');

  return `
    <section class="qp-page">
      <div class="qp-page-head">
        <div>
          <h2>项目概述与服务摘要</h2>
          <p>以客户视角整理本次项目的服务逻辑、行程结构与执行范围，适合商务确认、审批流转与正式外发场景。</p>
        </div>
        <div class="qp-page-mark">Project Summary</div>
      </div>

      <div class="qp-overview-stack">
        <article class="qp-intro-panel">
          <div class="qp-section-title">
            <h3>项目说明</h3>
            <span>Executive Summary</span>
          </div>
          <p>${getText(overview.project)}</p>
          <p style="margin-top: 12px;">${getText(overview.serviceNarrative)}</p>
        </article>

        <div class="qp-summary-columns">
          <article class="qp-summary-panel">
            <div class="qp-section-title"><h3>行程 / 服务摘要</h3><span>Schedule</span></div>
            <ul>${itinerary}</ul>
          </article>
          <article class="qp-summary-panel">
            <div class="qp-section-title"><h3>服务范围</h3><span>Scope</span></div>
            <ul>${scope}</ul>
          </article>
        </div>

        <article class="qp-summary-panel">
          <div class="qp-section-title"><h3>服务模块说明</h3><span>Modules</span></div>
          <div class="qp-module-grid">${moduleCards}</div>
        </article>
      </div>

      <div class="qp-page-no">
        <span>LDS International Travel</span>
        <span>02</span>
      </div>
    </section>
  `;
}

function renderProfessionalGrouped() {
  const detailCards = mockQuotation.groups.map((group) => {
    const rows = group.items.map((item) => `
      <tr>
        <td><strong>${getText(item.name)}</strong></td>
        <td>${getText(item.spec)}</td>
        <td>${escapeHtml(item.quantity)}</td>
        <td>${getText(item.unit)}</td>
        <td class="qp-money">${money(item.price, mockQuotation.quotation.currency)}</td>
        <td class="qp-money">${money(item.subtotal, mockQuotation.quotation.currency)}</td>
        <td>${getText(item.remark)}</td>
      </tr>
    `).join('');

    return `
      <article class="qp-detail-card">
        <div class="qp-group-head">
          <div>
            <h3>${getText(group.title)}</h3>
            <p>${getText(group.description)}</p>
          </div>
          <span class="qp-badge">${getText(group.typeLabel)}</span>
        </div>
        <table class="qp-table">
          <thead>
            <tr>
              <th>项目名称</th>
              <th>规格说明</th>
              <th>数量</th>
              <th>单位</th>
              <th class="qp-money">销售单价</th>
              <th class="qp-money">小计</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="qp-group-foot">
          <span>分组小计</span>
          <strong>${money(group.subtotal, mockQuotation.quotation.currency)}</strong>
        </div>
      </article>
    `;
  }).join('');

  return `
    <section class="qp-page">
      <div class="qp-page-head">
        <div>
          <h2>报价明细</h2>
          <p>专业版按客户可见服务逐项展示，适用于正式审批、邮件附件与 PDF 外发版本。</p>
        </div>
        <div class="qp-page-mark">Detailed Quotation</div>
      </div>
      ${detailCards}
      ${renderTotalBlock('分组小计已按客户可见服务模块归并，总价区用于快速确认本次项目整体报价。')}
      <div class="qp-page-no">
        <span>LDS International Travel</span>
        <span>03</span>
      </div>
    </section>
  `;
}

function renderProfessionalFlat() {
  const rows = getLineItems().map((item) => `
    <tr>
      <td>
        <strong>${getText(item.name)}</strong>
        <span class="qp-sub-lang">${getText(item.group.title)}</span>
      </td>
      <td>${getText(item.spec)}</td>
      <td>${escapeHtml(item.quantity)}</td>
      <td>${getText(item.unit)}</td>
      <td class="qp-money">${money(item.price, mockQuotation.quotation.currency)}</td>
      <td class="qp-money">${money(item.subtotal, mockQuotation.quotation.currency)}</td>
      <td>${getText(item.remark)}</td>
    </tr>
  `).join('');

  return `
    <section class="qp-page">
      <div class="qp-page-head">
        <div>
          <h2>报价明细</h2>
          <p>专业版不按组展示，适合希望直接扫描全表金额的客户版沟通场景。</p>
        </div>
        <div class="qp-page-mark">Detailed Quotation</div>
      </div>
      <article class="qp-detail-card">
        <table class="qp-table">
          <thead>
            <tr>
              <th>项目名称</th>
              <th>规格说明</th>
              <th>数量</th>
              <th>单位</th>
              <th class="qp-money">销售单价</th>
              <th class="qp-money">小计</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </article>
      ${renderTotalBlock('此视图更适合直接查看客户版总额与逐项销售明细，不展开分组逻辑。')}
      <div class="qp-page-no">
        <span>LDS International Travel</span>
        <span>03</span>
      </div>
    </section>
  `;
}

function renderMixedGrouped() {
  const cards = mockQuotation.groups.map((group) => `
    <article class="qp-detail-card">
      <div class="qp-group-head">
        <div>
          <h3>${getText(group.title)}</h3>
          <p>${getText(group.description)}</p>
        </div>
        <span class="qp-badge">${getText(group.typeLabel)}</span>
      </div>
      <div style="padding: 18px 20px; display: grid; gap: 12px;">
        ${group.items.map((item) => `
          <div class="qp-module-card">
            <strong>${getText(item.name)}</strong>
            <p>${getText(item.spec)}</p>
          </div>
        `).join('')}
      </div>
      <div class="qp-group-foot">
        <span>模块小计</span>
        <strong>${money(group.subtotal, mockQuotation.quotation.currency)}</strong>
      </div>
    </article>
  `).join('');

  return `
    <section class="qp-page">
      <div class="qp-page-head">
        <div>
          <h2>模块报价</h2>
          <p>混合版聚焦服务模块和分组小计，更适合客户先确认预算区间与服务结构。</p>
        </div>
        <div class="qp-page-mark">Package Summary</div>
      </div>
      ${cards}
      ${renderTotalBlock('混合版以服务模块为主要视角，适合先确认预算框架，再进入正式明细讨论。')}
      <div class="qp-page-no">
        <span>LDS International Travel</span>
        <span>03</span>
      </div>
    </section>
  `;
}

function renderMixedFlat() {
  const cards = getLineItems().map((item) => `
    <article class="qp-module-card">
      <strong>${getText(item.name)}</strong>
      <p>${getText(item.spec)}</p>
      <p>${getText(item.remark)}</p>
      <div style="display:flex; justify-content:space-between; gap:16px; align-items:baseline; margin-top:4px;">
        <span>${getText(item.group.title)}</span>
        <strong>${money(item.subtotal, mockQuotation.quotation.currency)}</strong>
      </div>
    </article>
  `).join('');

  return `
    <section class="qp-page">
      <div class="qp-page-head">
        <div>
          <h2>模块报价</h2>
          <p>混合版不按组展示，适合快速浏览主要服务包及对应金额区间。</p>
        </div>
        <div class="qp-page-mark">Package Summary</div>
      </div>
      <article class="qp-section">
        <div class="qp-module-grid">${cards}</div>
      </article>
      ${renderTotalBlock('本页采用更轻量的服务包表达方式，便于客户在手机或邮件附件中快速浏览。')}
      <div class="qp-page-no">
        <span>LDS International Travel</span>
        <span>03</span>
      </div>
    </section>
  `;
}

function renderTermsPage() {
  const included = mockQuotation.terms.included.map((item) => `<li>${getText(item)}</li>`).join('');
  const excluded = mockQuotation.terms.excluded.map((item) => `<li>${getText(item)}</li>`).join('');
  const notes = mockQuotation.terms.notes.map((item) => `<li>${getText(item)}</li>`).join('');

  return `
    <section class="qp-page">
      <div class="qp-page-head">
        <div>
          <h2>商务条款</h2>
          <p>客户版条款页用于明确费用边界、付款安排与商务确认口径，适合配合正式报价单外发。</p>
        </div>
        <div class="qp-page-mark">Commercial Terms</div>
      </div>

      <div class="qp-terms-grid">
        <article class="qp-terms-card">
          <div class="qp-section-title"><h3>费用包含</h3><span>Included</span></div>
          <ul>${included}</ul>
        </article>
        <article class="qp-terms-card">
          <div class="qp-section-title"><h3>费用不含</h3><span>Excluded</span></div>
          <ul>${excluded}</ul>
        </article>
      </div>

      <div class="qp-terms-grid" style="margin-top: 16px;">
        <article class="qp-terms-card">
          <div class="qp-section-title"><h3>特别说明</h3><span>Notes</span></div>
          <ul>${notes}</ul>
        </article>
        <article class="qp-terms-card">
          <div class="qp-section-title"><h3>付款方式与节点</h3><span>Payment</span></div>
          <p>${getText(mockQuotation.terms.payment)}</p>
          <p style="margin-top: 10px;">${getText(mockQuotation.terms.validity)}</p>
        </article>
      </div>

      <div class="qp-sign-row">
        <div class="qp-sign-box">
          <strong>客户确认签字</strong>
          <p>请由客户授权代表签字确认，并填写日期。</p>
          <div class="qp-sign-lines">
            <div class="qp-sign-field"><span>签字 Signature</span><div class="qp-sign-line"></div></div>
            <div class="qp-sign-field"><span>日期 Date</span><div class="qp-sign-line"></div></div>
          </div>
        </div>
        <div class="qp-sign-box">
          <strong>泷鼎晟国际旅行社</strong>
          <p>由销售负责人签字确认，并预留公司盖章位置。</p>
          <div class="qp-sign-lines">
            <div class="qp-sign-field"><span>签字 Signature</span><div class="qp-sign-line"></div></div>
            <div class="qp-sign-field"><span>日期 / 盖章 Date / Stamp</span><div class="qp-sign-line"></div></div>
          </div>
        </div>
      </div>

      <div class="qp-page-no">
        <span>LDS International Travel</span>
        <span>04</span>
      </div>
    </section>
  `;
}

function renderDetailPage() {
  if (state.pricingMode === 'professional' && state.groupMode === 'grouped') return renderProfessionalGrouped();
  if (state.pricingMode === 'professional' && state.groupMode === 'flat') return renderProfessionalFlat();
  if (state.pricingMode === 'mixed' && state.groupMode === 'grouped') return renderMixedGrouped();
  return renderMixedFlat();
}

function render() {
  previewRoot.innerHTML = [
    renderCoverPage(),
    renderOverviewPage(),
    renderDetailPage(),
    renderTermsPage(),
  ].join('');
}

function bindControls() {
  languageSelect.addEventListener('change', (event) => {
    state.languageMode = event.target.value;
    render();
  });

  modeSelect.addEventListener('change', (event) => {
    state.pricingMode = event.target.value;
    render();
  });

  groupingSelect.addEventListener('change', (event) => {
    state.groupMode = event.target.value;
    render();
  });
}

bindControls();
render();
