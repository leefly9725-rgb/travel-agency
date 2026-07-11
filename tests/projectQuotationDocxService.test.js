"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildProjectQuotationDocx } = require("../server/services/projectQuotationDocxService");

function fixture() {
  return {
    id: "Q-DOCX",
    quoteNumber: "QT-2026-0711",
    pricingMode: "project_based",
    projectName: "贝尔格莱德商务考察",
    projectLocation: "Belgrade, Serbia",
    clientName: "示例客户",
    clientContact: "Ana Petrović",
    quoteDate: "2026-07-11",
    validUntil: "2026-07-21",
    startDate: "2026-08-01",
    endDate: "2026-08-05",
    paxCount: 12,
    currency: "EUR",
    notes: "包含接待、交通与会议支持。",
    totalSales: 4321.5,
    projectGroups: [
      {
        projectTitle: "接待服务",
        projectType: "travel",
        groupSalesTotal: 4321.5,
        items: [{
          itemName: { zh: "酒店住宿", en: "Hotel accommodation", sr: "Hotelski smeštaj" },
          specification: "4 nights / 4 晚",
          quantity: 12,
          unit: "人",
          salesUnitPrice: 360.125,
          salesSubtotal: 4321.5,
          remarks: "含早餐",
        }],
      },
      { projectTitle: "空模块", projectType: "event", items: [] },
    ],
  };
}

function packageText(lang = "zh-en", extra = {}) {
  return buildProjectQuotationDocx({ ...fixture(), ...extra }, { lang }).toString("utf8");
}

test("DOCX maps the PDF A4 cover/body structure and native pagination", () => {
  const text = packageText();
  assert.match(text, /w:w="11906" w:h="16838"/);
  assert.match(text, /w:type w:val="nextPage"/);
  assert.match(text, /w:titlePg/);
  assert.match(text, /w:headerReference/);
  assert.match(text, /w:footerReference/);
  assert.match(text, /PAGE/);
  assert.match(text, /w:pgMar w:top="567" w:right="567" w:bottom="567" w:left="567"/);
});

test("DOCX contains the PDF-aligned branded sections and table controls", () => {
  const text = packageText();
  for (const expected of ["客户报价单", "CUSTOMER QUOTATION", "服务方案概述", "报价明细", "客户报价总额", "商务条款", "客户确认签字"]) {
    assert.ok(text.includes(expected), `missing ${expected}`);
  }
  assert.match(text, /1B2A4A/);
  assert.match(text, /C9A84C/);
  assert.match(text, /F5F2EC/);
  assert.match(text, /w:tblHeader/);
  assert.match(text, /w:cantSplit/);
  assert.match(text, /w:keepNext/);
  assert.ok(!text.includes("空模块"));
});

test("DOCX language mode filters alternate language and preserves Serbian glyphs", () => {
  const zh = packageText("zh");
  assert.ok(zh.includes("酒店住宿"));
  assert.ok(!zh.includes("Hotel accommodation"));
  const en = packageText("zh-en");
  assert.ok(en.includes("酒店住宿"));
  assert.ok(en.includes("Hotel accommodation"));
  const sr = packageText("zh-sr");
  assert.ok(sr.includes("酒店住宿"));
  assert.ok(sr.includes("Hotelski smeštaj"));
  assert.ok(sr.includes("Ana Petrović"));
});

test("DOCX safely hides optional empty modules", () => {
  const text = packageText("zh", { notes: "", clientName: "", projectLocation: "", projectGroups: [] });
  assert.ok(!text.includes("项目说明"));
  assert.ok(!text.includes("报价明细"));
  assert.ok(!text.includes("undefined"));
  assert.ok(!text.includes("null"));
});

test("DOCX embeds the supplied LDS logo and keeps one uppercase company name", () => {
  const text = packageText("zh-en");
  assert.ok(text.includes("word/media/lds-logo.png"));
  assert.match(text, /relationships\/image/);
  assert.match(text, /<w:drawing>/);
  assert.match(text, /LDS INTERNATIONAL TRAVEL/);
  assert.ok(!text.includes("LDS International Travel\nLDS INTERNATIONAL TRAVEL"));
});
