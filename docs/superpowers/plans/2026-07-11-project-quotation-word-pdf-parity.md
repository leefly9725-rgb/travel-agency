# Project Quotation Word/PDF Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild project quotation DOCX output around the existing PDF template's content and visual system.

**Architecture:** Keep the existing service API as a facade. Add focused dependency-free modules for theme tokens, view-model normalization, OOXML primitives, and document sections, with tests against the uncompressed OOXML package.

**Tech Stack:** Node.js built-ins, WordprocessingML/OOXML, `node:test`, LibreOffice render QA.

## Global Constraints

- PDF is the only visual authority and its implementation must not change.
- A4 portrait, PDF-aligned 10 mm body margins and native Word pagination.
- Preserve API, filename, quote schema, old-data compatibility, and zero external dependencies.
- No database changes.

---

### Task 1: Contract tests

**Files:**
- Create: `tests/projectQuotationDocxService.test.js`

**Interfaces:**
- Consumes: `buildProjectQuotationDocx(quote, options)`
- Produces: executable OOXML acceptance contract

- [ ] Write tests for A4 sections, cover break, styles, header/footer PAGE field, tables, bilingual filtering, empty-module hiding, terms, signatures, and Serbian glyphs.
- [ ] Run `node --test --test-isolation=none tests/projectQuotationDocxService.test.js` and confirm the new assertions fail against the legacy exporter.

### Task 2: Modular OOXML exporter

**Files:**
- Create: `server/services/projectQuotationDocx/theme.js`
- Create: `server/services/projectQuotationDocx/viewModel.js`
- Create: `server/services/projectQuotationDocx/xml.js`
- Create: `server/services/projectQuotationDocx/builders.js`
- Modify: `server/services/projectQuotationDocxService.js`

**Interfaces:**
- Produces: `buildDocumentPackage(quote, options)` returning ZIP entries
- Preserves: exported service functions and content type

- [ ] Implement centralized PDF-derived sizes, colors, fonts, borders, and widths.
- [ ] Implement defensive localized view model and empty-module filtering.
- [ ] Implement reusable paragraphs, cells, tables, sections, fields, and package relationships.
- [ ] Implement cover, overview, grouped details, final total, terms, signature, header, and footer builders.
- [ ] Run the focused test until green, then run `npm test`.

### Task 3: Rendered fixture validation

**Files:**
- Create: `scripts/validate-project-quotation-docx.js`
- Create only generated QA artifacts under `artifacts/docx-validation/`

**Interfaces:**
- Consumes: exporter and fixture quote variants
- Produces: five DOCX fixtures for visual QA

- [ ] Generate zh, zh-en, zh-sr, short, and long DOCX fixtures.
- [ ] Render each fixture with the Documents skill renderer and inspect every PNG.
- [ ] Correct layout defects, rerun focused/full tests, and regenerate final fixtures.
