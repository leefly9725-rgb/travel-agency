"use strict";

const T = require("./theme");
function esc(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function run(text, o = {}) {
  const props = [o.bold ? "<w:b/>" : "", o.color ? `<w:color w:val="${o.color}"/>` : "", o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : "", `<w:rFonts w:ascii="${T.fonts.latin}" w:hAnsi="${T.fonts.latin}" w:eastAsia="${T.fonts.eastAsia}" w:cs="${T.fonts.latin}"/>`].join("");
  const chunks = String(text ?? "").split("\n");
  return `<w:r><w:rPr>${props}</w:rPr>${chunks.map((part, i) => `${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(part)}</w:t>`).join("")}</w:r>`;
}
function p(text, o = {}) {
  const align = o.align ? `<w:jc w:val="${o.align}"/>` : "";
  const spacing = `<w:spacing w:before="${o.before || 0}" w:after="${o.after ?? 80}" w:line="${o.line || 276}" w:lineRule="auto"/>`;
  const keep = `${o.keepNext ? "<w:keepNext/>" : ""}${o.keepLines ? "<w:keepLines/>" : ""}<w:widowControl/>`;
  const border = o.bottomBorder ? `<w:pBdr><w:bottom w:val="single" w:sz="${o.bottomBorder.size || 6}" w:color="${o.bottomBorder.color || T.colors.line}" w:space="6"/></w:pBdr>` : "";
  return `<w:p><w:pPr>${align}${spacing}${keep}${border}</w:pPr>${run(text, o)}</w:p>`;
}
function cell(text, width, o = {}) {
  const shade = o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : "";
  const borders = o.noBorder ? `<w:tcBorders>${["top","left","bottom","right","insideH","insideV"].map(x => `<w:${x} w:val="nil"/>`).join("")}</w:tcBorders>` : "";
  const content = o.raw ? String(text || "") : p(text, { size: o.size || T.sizes.table, bold: o.bold, color: o.color, align: o.align, after: 0, line: 240 });
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shade}${borders}<w:vAlign w:val="center"/><w:tcMar><w:top w:w="${o.padY || 100}" w:type="dxa"/><w:left w:w="${o.padX || 110}" w:type="dxa"/><w:bottom w:w="${o.padY || 100}" w:type="dxa"/><w:right w:w="${o.padX || 110}" w:type="dxa"/></w:tcMar></w:tcPr>${content}</w:tc>`;
}
function row(cells, widths, o = {}) { return `<w:tr><w:trPr>${o.header ? "<w:tblHeader/>" : ""}<w:cantSplit/></w:trPr>${cells.map((value, i) => cell(value, widths[i], { ...o, ...(o.cells?.[i] || {}) })).join("")}</w:tr>`; }
function table(rows, widths, o = {}) {
  const borders = o.noBorder ? "" : `<w:tblBorders>${["top","left","bottom","right","insideH","insideV"].map(x => `<w:${x} w:val="single" w:sz="${o.borderSize || 4}" w:color="${o.borderColor || T.colors.line}"/>`).join("")}</w:tblBorders>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a,b)=>a+b,0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${borders}<w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.join("")}</w:tbl>`;
}
function pageSection({ cover = false } = {}) {
  const refs = cover ? "" : `<w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/>`;
  return `<w:sectPr>${refs}${cover ? "<w:type w:val=\"nextPage\"/><w:titlePg/>" : ""}<w:pgSz w:w="${T.page.width}" w:h="${T.page.height}"/><w:pgMar w:top="${T.page.margin}" w:right="${T.page.margin}" w:bottom="${T.page.margin}" w:left="${T.page.margin}" w:header="${T.page.header}" w:footer="${T.page.footer}" w:gutter="0"/></w:sectPr>`;
}
module.exports = { esc, run, p, cell, row, table, pageSection };
