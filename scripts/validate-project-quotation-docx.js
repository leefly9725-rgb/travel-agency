#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { buildProjectQuotationDocx } = require("../server/services/projectQuotationDocxService");

const outDir = path.resolve(__dirname, "../artifacts/docx-validation");
fs.mkdirSync(outDir, { recursive: true });

const base = {
  id: "Q-DOCX-QA", quoteNumber: "QT-DOCX-QA", pricingMode: "project_based",
  projectName: "贝尔格莱德商务访问与活动服务", projectLocation: "Belgrade, Serbia",
  clientName: "验收客户 / QA Client", clientContact: "Ana Petrović",
  quoteDate: "2026-07-11", validUntil: "2026-07-21", startDate: "2026-08-01", endDate: "2026-08-05",
  paxCount: 18, currency: "EUR", notes: "本报价覆盖住宿、交通、现场执行与活动支持。",
  projectGroups: [
    { projectTitle: "旅游接待", projectType: "travel", items: [
      { itemName: { zh: "酒店住宿", en: "Hotel Accommodation", sr: "Hotelski smeštaj" }, specification: "四星酒店，含早餐 / 4-star hotel with breakfast", quantity: 18, unit: "人晚", salesUnitPrice: 128, salesSubtotal: 2304, remarks: "4 晚" },
      { itemName: { zh: "机场接送", en: "Airport Transfer", sr: "Aerodromski transfer" }, specification: "专车接送", quantity: 2, unit: "次", salesUnitPrice: 240, salesSubtotal: 480 },
    ], groupSalesTotal: 2784 },
    { projectTitle: "活动服务", projectType: "event", items: [
      { itemName: { zh: "会议现场执行", en: "On-site Event Support", sr: "Podrška događaju na licu mesta" }, specification: "项目经理及现场协调", quantity: 3, unit: "人天", salesUnitPrice: 380, salesSubtotal: 1140, remarks: "含基础设备" },
    ], groupSalesTotal: 1140 },
  ], totalSales: 3924,
};

const manyItems = Array.from({ length: 34 }, (_, index) => ({
  itemName: { zh: `长内容测试项目 ${index + 1}`, en: `Long content test item ${index + 1}`, sr: `Stavka za test dužeg sadržaja ${index + 1}` },
  specification: "用于验证表格跨页、重复表头、固定列宽和整行不拆分。",
  quantity: index + 1, unit: "项", salesUnitPrice: 99.5, salesSubtotal: (index + 1) * 99.5,
}));

const variants = [
  ["scenario-a-zh", "zh", base],
  ["scenario-b-zh-en", "zh-en", base],
  ["scenario-c-zh-sr", "zh-sr", base],
  ["scenario-d-short", "zh", { ...base, notes: "", projectGroups: [base.projectGroups[0]], totalSales: 2784 }],
  ["scenario-e-long", "zh-en", { ...base, projectGroups: [{ projectTitle: "综合服务", projectType: "mixed", items: manyItems }], totalSales: manyItems.reduce((sum, item) => sum + item.salesSubtotal, 0) }],
];

for (const [name, lang, quote] of variants) {
  const file = path.join(outDir, `${name}.docx`);
  fs.writeFileSync(file, buildProjectQuotationDocx(quote, { lang }));
  process.stdout.write(`${file}\n`);
}
