# Project Quotation Word/PDF Parity Design

## Goal

Make the editable DOCX export visibly belong to the same quotation template as the existing PDF while preserving the API, quote schema, filename rule, and PDF implementation.

## Design

The PDF is the design authority. The DOCX exporter maps its A4 geometry, navy/gold/ivory palette, Arial/Microsoft YaHei typography, cover hierarchy, overview, grouped detail tables, final total, commercial terms, signatures, footer, and bilingual stacking into deterministic OOXML.

The implementation remains dependency-free and is split by responsibility under `server/services/projectQuotationDocx/`: centralized theme tokens, a defensive language-aware view model, reusable OOXML primitives, and section builders. `projectQuotationDocxService.js` stays as the backward-compatible public entry point.

The cover is a first-page section with no header/footer and an explicit next-page section break. Body pages use native headers/footers and PAGE fields. Tables use exact widths, repeating headers, cell margins, and `cantSplit`; headings use `keepNext`/`keepLines`. Empty notes, groups, terms, and optional signatures are omitted without spacer paragraphs.

## Validation

Tests inspect the generated package and OOXML contract, then fixtures for Chinese, Chinese-English, Chinese-Serbian, short, and long content are rendered through LibreOffice. Representative pages are visually compared with the PDF design language and checked for blank pages, clipping, overflow, broken tables, and missing glyphs.

## Compatibility

No database or API changes. Legacy field aliases receive defensive fallbacks. PDF files and browser composer code remain unchanged.
