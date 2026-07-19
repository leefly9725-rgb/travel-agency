"use strict";

const T = require("./theme");
const X = require("./xml");

const label = (vm, zh, en, sr) => vm.text({ zh, en, sr });
function heading(text, level = 1) { return X.p(text, { size: level === 1 ? T.sizes.section : T.sizes.subsection, bold: true, color: T.colors.navy, before: level === 1 ? 180 : 130, after: 100, keepNext: true, keepLines: true, bottomBorder: level === 1 ? { color: T.colors.line, size: 6 } : null }); }

function logoDrawing() {
  return `<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1645920" cy="946631"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="LDS Travel Logo" descr="LDS Travel logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="lds-logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1645920" cy="946631"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function buildCover(vm) {
  const logoCell = vm.company.logoConfigured === false ? X.p("未配置 Logo / LOGO NOT CONFIGURED", { color: T.colors.soft, size: 13 }) : logoDrawing();
  const top = X.table([
    X.row([logoCell, vm.company.en, `${vm.company.address}\n${vm.company.contact}`], [2800, 3600, 4372], { noBorder: true, cells: [{ raw: true, padX: 0, padY: 0 }, { bold: true, color: T.colors.navy, size: 16 }, { align: "right", color: T.colors.soft, size: 14 }] }),
  ], [2800, 3600, 4372], { noBorder: true });
  const title = [
    X.p("客户报价单", { size: T.sizes.coverTitle, bold: true, color: T.colors.navy, before: 520, after: 80, keepLines: true }),
    X.p(vm.internal ? "内部核算版 / INTERNAL USE ONLY" : "CUSTOMER QUOTATION", { size: T.sizes.coverSubtitle, bold: true, color: T.colors.gold, after: 340 }),
    X.p(vm.projectName, { size: T.sizes.projectTitle, bold: true, color: T.colors.navy, after: 120, keepLines: true }),
    vm.location || vm.dateRange ? X.p([vm.location, vm.dateRange].filter(Boolean).join("  |  "), { color: T.colors.soft, size: 18, after: 280 }) : "",
  ].join("");
  const metaRows = [];
  if (vm.clientName) metaRows.push(X.row(["客户 / CLIENT", vm.clientName, "联系人 / CONTACT", vm.clientContact || "—"], [1700, 3686, 1700, 3686], { cells: [{ fill: T.colors.ivory, bold: true, color: T.colors.soft }, {}, { fill: T.colors.ivory, bold: true, color: T.colors.soft }, {}] }));
  metaRows.push(X.row(["报价编号 / QUOTE NO.", vm.quoteNumber || "—", "项目人数 / PAX", vm.pax || "—"], [1700, 3686, 1700, 3686], { cells: [{ fill: T.colors.ivory, bold: true, color: T.colors.soft }, {}, { fill: T.colors.ivory, bold: true, color: T.colors.soft }, {}] }));
  const meta = X.table(metaRows, [1700, 3686, 1700, 3686]);
  const belt = X.table([X.row(["报价日期", "有效期至", "币种", "服务模块"], [2693,2693,2693,2693], { fill: T.colors.navy, color: T.colors.gold, bold: true, align: "center", size: 15 }), X.row([vm.quoteDate || "—", vm.validUntil || "—", vm.currency, `${vm.groups.length} 个`], [2693,2693,2693,2693], { fill: T.colors.navy, color: T.colors.ivory, bold: true, align: "center", size: 19 })], [2693,2693,2693,2693], { borderColor: T.colors.navy });
  const total = X.table([X.row(["GRAND TOTAL · 客户报价总额", vm.totalText], [5600,5172], { fill: T.colors.gold, color: T.colors.navy, bold: true, size: T.sizes.amount, cells: [{ size: 18 }, { align: "right", size: T.sizes.amount }] })], [5600,5172], { borderColor: T.colors.gold });
  return `${top}${title}${meta}${X.p("", { after: 160 })}${belt}${total}<w:p><w:pPr>${X.pageSection({ cover: true })}</w:pPr></w:p>`;
}

function buildOverview(vm) {
  if (!vm.groups.length && !vm.notes) return "";
  const parts = [heading(label(vm, "服务方案概述", "Service Overview", "Pregled usluga"))];
  if (vm.notes) parts.push(heading(label(vm, "项目说明", "Project Description", "Opis projekta"), 2), X.p(vm.notes, { color: T.colors.soft, after: 160, keepLines: true }));
  if (vm.groups.length) {
    parts.push(heading(label(vm, "服务模块与报价摘要", "Service Modules & Pricing", "Moduli i cene"), 2));
    const widths = [6772,1400,2600];
    const rows = [X.row([label(vm,"服务模块","Service Module","Modul usluge"), label(vm,"项目数","Items","Stavke"), label(vm,"金额","Amount","Iznos")], widths, { header: true, fill: T.colors.header, bold: true, color: T.colors.soft, cells: [{}, { align:"center" }, { align:"right" }] })];
    vm.groups.forEach(g => rows.push(X.row([g.title, String(g.items.length), g.amountText], widths, { cells: [{}, { align:"center" }, { align:"right", bold:true }] })));
    rows.push(X.row([label(vm,"合计","Total","Ukupno"), String(vm.groups.reduce((s,g)=>s+g.items.length,0)), vm.totalText], widths, { fill: T.colors.ivory, bold:true, cells:[{}, {align:"center"},{align:"right"}] }));
    parts.push(X.table(rows, widths));
  }
  return parts.join("");
}

function buildDetails(vm) {
  if (!vm.groups.length) return "";
  const out = [heading(label(vm,"报价明细","Detailed Quotation","Detaljna ponuda"))];
  const widths = [2450,2450,720,780,1450,1550,1372];
  vm.groups.forEach((group, index) => {
    out.push(heading(`${index + 1}. ${group.title}`, 2));
    const rows = [X.row([label(vm,"项目名称","Item Name","Naziv stavke"), label(vm,"规格说明","Specification","Specifikacija"), label(vm,"数量","Qty","Kol."), label(vm,"单位","Unit","Jedinica"), label(vm,"销售单价","Unit Price","Jedinična cena"), label(vm,"小计","Subtotal","Međuzbir"), label(vm,"备注","Remarks","Napomena")], widths, { header:true, fill:T.colors.header, bold:true, color:T.colors.soft, align:"center", size:T.sizes.tableHeader })];
    group.items.forEach(item => rows.push(X.row([item.name,item.specification,item.quantity,item.unit,item.unitPrice,item.amount,item.remarks], widths, { cells:[{}, {}, {align:"center"},{align:"center"},{align:"right"},{align:"right",bold:true},{}] })));
    rows.push(X.row([label(vm,"分组小计","Group Subtotal","Međuzbir grupe"),"","","","",group.amountText,""], widths, { fill:T.colors.ivory, bold:true, cells:[{}, {}, {}, {}, {}, {align:"right"}, {}] }));
    out.push(X.table(rows,widths));
  });
  out.push(X.p("", { after:120 }), X.table([X.row(["GRAND TOTAL · 客户报价总额",vm.totalText],[6172,4600],{fill:T.colors.gold,color:T.colors.navy,bold:true,cells:[{size:20},{align:"right",size:T.sizes.amount}]})],[6172,4600],{borderColor:T.colors.gold}));
  return out.join("");
}

function bullets(vm, title, items) {
  if (!items.length) return "";
  return `${heading(title,2)}${items.map(item => X.p(`• ${vm.text(item)}`, { keepLines:true, after:70, left:240 })).join("")}`;
}
function buildTerms(vm) {
  const out = [heading(label(vm,"商务条款","Commercial Terms","Komercijalni uslovi"))];
  out.push(bullets(vm,label(vm,"费用包含","Included","Uključeno"),vm.terms.included));
  out.push(bullets(vm,label(vm,"费用不含","Excluded","Nije uključeno"),vm.terms.excluded));
  out.push(bullets(vm,label(vm,"特别说明","Notes","Napomene"),vm.terms.notes));
  out.push(heading(label(vm,"付款方式与节点","Payment Terms","Uslovi plaćanja"),2), X.p(vm.text(vm.terms.payment),{keepLines:true,after:180}));
  if (vm.showSign) {
    const widths=[5386,5386];
    out.push(heading(label(vm,"签字确认","Signature Confirmation","Potvrda potpisa"),2));
    out.push(X.table([
      X.row([label(vm,"客户确认签字","Client Confirmation","Potvrda klijenta"),vm.company.cn],widths,{fill:T.colors.ivory,bold:true,color:T.colors.navy}),
      X.row(["签字 Signature\n\n\n日期 Date", "签字 Signature\n\n\n日期 / 盖章 Date / Stamp"],widths,{cells:[{padY:180},{padY:180}]}),
    ],widths));
  }
  return out.join("");
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${T.fonts.latin}" w:hAnsi="${T.fonts.latin}" w:eastAsia="${T.fonts.eastAsia}"/><w:sz w:val="${T.sizes.body}"/><w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
}
function headerXml(vm){return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${X.p(`${vm.company.en}  |  ${vm.quoteNumber}`,{size:T.sizes.footer,color:T.colors.soft,bottomBorder:{color:T.colors.line,size:4}})}</w:hdr>`;}
function footerXml(vm){return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${X.run(`${vm.company.legal}  ·  `,{size:T.sizes.footer,color:T.colors.soft})}<w:fldSimple w:instr=" PAGE ">${X.run("1",{size:T.sizes.footer,color:T.colors.soft})}</w:fldSimple></w:p></w:ftr>`;}
function documentXml(vm) { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${buildCover(vm)}${buildOverview(vm)}${buildDetails(vm)}${buildTerms(vm)}${X.pageSection()}</w:body></w:document>`; }

module.exports={documentXml,stylesXml,headerXml,footerXml};
