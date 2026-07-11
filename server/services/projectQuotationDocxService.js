"use strict";

const path = require("node:path");

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeFileName(value) {
  return String(value || "project-quotation").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120);
}

function money(value, currency) {
  const amount = Number(value || 0);
  return `${currency || "EUR"} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getText(value) {
  if (!value || typeof value !== "object") return String(value || "");
  return value.zh || value.en || value.sr || "";
}

function itemName(item) {
  return getText(item.itemName) || item.name || item.title || item.itemType || "服务项目";
}

function itemAmount(item) {
  return Number(item.salesSubtotal ?? item.totalSales ?? item.totalPrice ?? item.priceSubtotal ?? 0);
}

function itemUnitPrice(item) {
  return Number(item.salesUnitPrice ?? item.unitPrice ?? item.price ?? 0);
}

function groupAmount(group) {
  if (Number.isFinite(Number(group.projectSalesTotal))) return Number(group.projectSalesTotal);
  if (Number.isFinite(Number(group.groupSalesTotal))) return Number(group.groupSalesTotal);
  return (group.items || []).reduce((sum, item) => sum + itemAmount(item), 0);
}

function quoteGroups(quote) {
  if (Array.isArray(quote.projectGroups) && quote.projectGroups.length > 0) return quote.projectGroups;
  if (Array.isArray(quote.groups) && quote.groups.length > 0) return quote.groups;
  if (Array.isArray(quote.items) && quote.items.length > 0) {
    return [{ projectTitle: "报价明细", projectType: "mixed", items: quote.items }];
  }
  return [];
}

function quoteTotal(quote, groups) {
  const explicit = Number(quote.totalSales ?? quote.totalPrice ?? quote.grandTotal ?? 0);
  if (explicit > 0) return explicit;
  return groups.reduce((sum, group) => sum + groupAmount(group), 0);
}

function paragraph(text, style) {
  const pStyle = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${pStyle}<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function paragraphLines(lines, style) {
  const pStyle = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  const runs = lines.map((line, index) => (
    `<w:r>${index > 0 ? "<w:br/>" : ""}<w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`
  )).join("");
  return `<w:p>${pStyle}${runs}</w:p>`;
}

function tableCell(content, width, bold) {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcMar><w:top w:w="120" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${xmlEscape(content)}</w:t></w:r></w:p></w:tc>`;
}

function tableRow(cells, widths, bold) {
  return `<w:tr>${cells.map((cell, index) => tableCell(cell, widths[index] || widths[0], bold)).join("")}</w:tr>`;
}

function table(rows, widths) {
  const grid = widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9D2C3"/><w:left w:val="single" w:sz="4" w:color="D9D2C3"/><w:bottom w:val="single" w:sz="4" w:color="D9D2C3"/><w:right w:val="single" w:sz="4" w:color="D9D2C3"/><w:insideH w:val="single" w:sz="4" w:color="D9D2C3"/><w:insideV w:val="single" w:sz="4" w:color="D9D2C3"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows.join("")}</w:tbl>`;
}

function buildDocumentXml(quote, options = {}) {
  const groups = quoteGroups(quote);
  const currency = quote.currency || "EUR";
  const total = quoteTotal(quote, groups);
  const body = [];

  body.push(paragraph("客户报价单 / Customer Quotation", "Title"));
  body.push(paragraph(quote.projectName || quote.quoteNumber || "", "Subtitle"));
  body.push(table([
    tableRow(["报价编号", quote.quoteNumber || quote.id || "", "客户", quote.clientName || ""], [1800, 2880, 1800, 2880], true),
    tableRow(["报价日期", quote.quoteDate || quote.createdAt || "", "币种", currency], [1800, 2880, 1800, 2880], false),
    tableRow(["项目日期", [quote.startDate, quote.endDate].filter(Boolean).join(" - "), "人数", quote.paxCount || ""], [1800, 2880, 1800, 2880], false),
  ], [1800, 2880, 1800, 2880]));

  if (quote.notes) {
    body.push(paragraph("项目说明", "Heading1"));
    body.push(paragraph(quote.notes));
  }

  body.push(paragraph("服务模块与报价摘要 / Service Modules & Pricing", "Heading1"));
  body.push(table([
    tableRow(["服务模块 / Service Module", "项目数 / Items", "金额 / Amount"], [5600, 1600, 2160], true),
    ...groups.map((group) => tableRow([
      group.projectTitle || group.title || group.projectType || "服务模块",
      String((group.items || []).length),
      money(groupAmount(group), currency),
    ], [5600, 1600, 2160], false)),
    tableRow(["合计 / Total", String(groups.reduce((sum, group) => sum + (group.items || []).length, 0)), money(total, currency)], [5600, 1600, 2160], true),
  ], [5600, 1600, 2160]));

  body.push(paragraph("报价明细 / Detailed Quotation", "Heading1"));
  groups.forEach((group, groupIndex) => {
    body.push(paragraph(`${groupIndex + 1}. ${group.projectTitle || group.title || "服务模块"}`, "Heading2"));
    const itemRows = [
      tableRow(["服务名称", "规格说明", "数量", "单位", "单价", "金额"], [2600, 2400, 800, 800, 1380, 1380], true),
    ];
    (group.items || []).forEach((item) => {
      itemRows.push(tableRow([
        itemName(item),
        item.specification || item.description || "",
        String(item.quantity ?? item.qty ?? ""),
        item.unit || "",
        money(itemUnitPrice(item), currency),
        money(itemAmount(item), currency),
      ], [2600, 2400, 800, 800, 1380, 1380], false));
    });
    body.push(table(itemRows, [2600, 2400, 800, 800, 1380, 1380]));
  });

  body.push(paragraphLines([
    `客户报价总额 / Grand Total: ${money(total, currency)}`,
    "本 Word 文件为可编辑版本，正式发送客户前请以系统 PDF 版本为准核对格式和金额。",
  ], "Heading1"));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body.join("\n")}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Microsoft YaHei"/><w:sz w:val="20"/></w:rPr><w:pPr><w:spacing w:after="120"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="1B2A4A"/><w:sz w:val="34"/></w:rPr><w:pPr><w:spacing w:before="120" w:after="160"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="52627A"/><w:sz w:val="22"/></w:rPr><w:pPr><w:spacing w:after="200"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="1B2A4A"/><w:sz w:val="26"/></w:rPr><w:pPr><w:spacing w:before="260" w:after="120"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="1B2A4A"/><w:sz w:val="22"/></w:rPr><w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr></w:style>
</w:styles>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function wordRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xFF];
  }
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = Math.max(1980, date.getFullYear()) - 1980;
  return { time, date: (year << 9) | (month << 5) | day };
}

function createZip(entries) {
  const now = dosDateTime();
  const fileParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((entry) => {
    const name = Buffer.from(entry.name);
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(now.time, 10);
    local.writeUInt16LE(now.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    fileParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(now.time, 12);
    central.writeUInt16LE(now.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, ...centralParts, end]);
}

function buildProjectQuotationDocx(quote, options = {}) {
  if (!quote || typeof quote !== "object") throw new Error("Quote is required.");
  const entries = [
    { name: "[Content_Types].xml", data: contentTypesXml() },
    { name: "_rels/.rels", data: rootRelsXml() },
    { name: "word/_rels/document.xml.rels", data: wordRelsXml() },
    { name: "word/styles.xml", data: stylesXml() },
    { name: "word/document.xml", data: buildDocumentXml(quote, options) },
  ];
  return createZip(entries);
}

function projectQuotationDocxFileName(quote) {
  const base = quote && (quote.quoteNumber || quote.id) ? `project-quotation-${quote.quoteNumber || quote.id}` : "project-quotation";
  return sanitizeFileName(path.basename(base)) + ".docx";
}

module.exports = {
  DOCX_CONTENT_TYPE,
  buildProjectQuotationDocx,
  projectQuotationDocxFileName,
};
