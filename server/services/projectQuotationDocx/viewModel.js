"use strict";

const COMPANY = Object.freeze({
  cn: "LDS International Travel",
  en: "LDS INTERNATIONAL TRAVEL",
  legal: "LDS International Travel d.o.o Beograd",
  address: "Second Floor, TRG PRIJATELJSTVA SRBIJE KINE 4, BEOGRAD",
  contact: "shen.summer@yahoo.com",
  logoConfigured: true,
});

const GROUP_LABELS = {
  travel: { zh: "旅游接待", en: "Travel & Reception", sr: "Turizam i prijem" },
  event: { zh: "活动服务", en: "Event Services", sr: "Usluge događaja" },
  mixed: { zh: "综合项目", en: "Mixed Program", sr: "Kombinovani program" },
};

const TERMS = {
  included: [
    { zh: "报价范围内的客户版服务执行费用", en: "Client-facing service execution fees within the quotation scope", sr: "Troškovi izvršenja usluga prema obimu ponude" },
    { zh: "报价所列全部服务项目", en: "All services listed in this quotation", sr: "Sve usluge navedene u ovoj ponudi" },
  ],
  excluded: [
    { zh: "国际机票、签证、个人消费及未列明第三方费用", en: "International flights, visas, personal expenses, and unlisted third-party charges", sr: "Međunarodne avionske karte, vize, lični troškovi i nenavedeni troškovi" },
  ],
  notes: [
    { zh: "本报价自出具之日起 10 个自然日内有效；服务范围调整时，报价金额将相应更新。", en: "This quotation remains valid for 10 calendar days. Scope changes may result in a revised quotation.", sr: "Ova ponuda važi 10 kalendarskih dana. Promene obima mogu dovesti do izmene ponude." },
  ],
  payment: { zh: "建议银行转账。确认后支付 50% 预付款，项目开始前支付余款。", en: "Bank transfer is recommended. A 50% advance is due upon confirmation, with the balance paid before commencement.", sr: "Preporučuje se bankarski transfer. Avans od 50% plaća se po potvrdi, a ostatak pre početka projekta." },
};

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function rawGroups(quote) {
  if (Array.isArray(quote.projectGroups)) return quote.projectGroups;
  if (Array.isArray(quote.groups)) return quote.groups;
  if (Array.isArray(quote.items) && quote.items.length) return [{ projectTitle: "报价明细", projectType: "mixed", items: quote.items }];
  return [];
}
function itemAmount(item) { return num(item.salesSubtotal ?? item.totalSales ?? item.totalPrice ?? item.priceSubtotal); }
function unitPrice(item) { return num(item.salesUnitPrice ?? item.unitPrice ?? item.price); }
function localized(value, lang) {
  if (!value || typeof value !== "object") return String(value || "");
  const zh = String(value.zh || value.en || value.sr || "");
  const foreign = lang === "zh-sr" ? String(value.sr || value.en || "") : lang === "zh-en" ? String(value.en || value.sr || "") : "";
  return foreign && foreign !== zh ? `${zh}\n${foreign}` : zh;
}
function money(value, currency) {
  return `${currency || "EUR"} ${num(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function buildViewModel(quote, options = {}) {
  const lang = ["zh", "zh-en", "zh-sr"].includes(options.lang) ? options.lang : "zh-en";
  const currency = quote.currency || "EUR";
  const groups = rawGroups(quote).map((group) => {
    const items = (Array.isArray(group.items) ? group.items : []).filter(Boolean).map((item) => ({
      name: localized(item.itemName || item.name || item.title || "服务项目", lang),
      specification: String(item.specification || item.description || ""),
      quantity: String(item.quantity ?? item.qty ?? ""), unit: String(item.unit || ""),
      unitPrice: money(unitPrice(item), currency), amount: money(itemAmount(item), currency), remarks: String(item.remarks || item.notes || ""),
    }));
    const label = GROUP_LABELS[group.projectType] || GROUP_LABELS.mixed;
    const amount = num(group.projectSalesTotal ?? group.groupSalesTotal) || items.reduce((sum, item) => sum + num(item.amount.replace(/[^0-9.-]/g, "")), 0);
    return { title: localized({ zh: group.projectTitle || group.title || label.zh, en: label.en, sr: label.sr }, lang), type: group.projectType || "mixed", items, amount, amountText: money(amount, currency) };
  }).filter((group) => group.items.length > 0);
  const total = num(quote.totalSales ?? quote.totalPrice ?? quote.grandTotal) || groups.reduce((sum, group) => sum + group.amount, 0);
  const internalBomLines = quote.internal && Array.isArray(quote.internalBomLines)
    ? quote.internalBomLines.map((line) => ({
      lineType: String(line.lineType || ""), description: String(line.descriptionSnapshot || line.nameSnapshot || ""),
      quantity: String(line.quantity ?? ""), sourceCurrency: String(line.sourceCurrency || ""),
      costUnitPriceSource: String(line.costUnitPriceSource ?? ""), saleUnitPriceSource: String(line.saleUnitPriceSource ?? ""),
      costAmount: String(line.costAmount ?? ""), saleAmount: String(line.saleAmount ?? ""),
      supplier: String(line.supplierSnapshot?.name || line.supplierSnapshot?.nameZh || line.supplierSnapshot?.id || ""),
      priceVersionId: String(line.priceVersionId || ""), internalNotes: String(line.internalNotes || ""),
    }))
    : [];
  return {
    lang, company: quote.company || COMPANY, currency, groups, total, totalText: money(total, currency), internal: Boolean(quote.internal), internalBomLines,
    quoteNumber: String(quote.quoteNumber || quote.id || ""), projectName: String(quote.projectName || quote.title || quote.quoteNumber || ""),
    location: String(quote.projectLocation || quote.location || ""), clientName: String(quote.clientName || ""), clientContact: String(quote.clientContact || quote.contactName || ""),
    quoteDate: String(quote.quoteDate || quote.createdAt || "").slice(0, 10), validUntil: String(quote.validUntil || "").slice(0, 10),
    dateRange: [quote.startDate, quote.endDate].filter(Boolean).join(" – "), pax: String(quote.paxCount || quote.pax || ""), notes: String(quote.notes || "").trim(),
    showSign: options.sign !== "0" && options.sign !== 0, terms: TERMS,
    text(value) { return localized(value, lang); },
  };
}

module.exports = { buildViewModel, money };
