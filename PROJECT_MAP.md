# PROJECT_MAP.md

Project: 泷鼎晟国际旅行社运营系统 V1.0

Purpose of this file:
- Help Claude Code understand the repository quickly
- Reduce unnecessary repo scanning
- Identify the safest modification entry points
- Clarify core business logic and data flow

---

## 1. Project Overview

This is an internal operations system for a travel agency in Serbia.

Current architecture:
- Frontend: static pages in `web/`
- Backend: Node.js server in `server/`
- Deployment: Vercel
- Database mode:
  - current active persistence: JSON file
  - future / partial migration target: Supabase

Important constraint:
- The project is already in active development
- Changes must remain backward compatible
- Avoid breaking current quotation workflows

---

## 2. Top-Level Directory Map

### `server/`
Core backend logic.

Important files:
- `server/index.js` — local server entry point
- `server/app.js` — central HTTP handler and API router
- `server/dataStore.js` — current persistence layer using JSON
- `server/env.js` — custom environment parser
- `server/services/quoteService.js` — most critical business calculation logic
- `server/services/exchangeRateService.js` — exchange rates
- `server/services/documentPreviewService.js` — preview generation for output documents
- `server/services/templateService.js`
- `server/templateStore.js`

### `api/`
Vercel serverless entry.

Important file:
- `api/[[...route]].js` — delegates requests to `server/app.js`

### `web/`
Frontend pages and shared browser-side utilities.

Important files:
- `web/app.js` — shared API and DOM helpers
- `web/app-utils.js` — formatting and validation helpers
- `web/ui-labels.js` — central UI labels
- `web/styles.css` — shared styles

Page pattern:
- each page is usually an `html + js` pair
- prefer following existing page patterns rather than inventing new structure

### `tests/`
Native Node.js test files.

Important files:
- `tests/api.test.js`
- `tests/quoteService.test.js`
- `tests/dataStore.test.js`
- `tests/templateStore.test.js`

### `scripts/`
Schema and migration-related scripts.

Important file:
- `scripts/supabase-schema.sql`

### `data/`
Current JSON persistence.

Important file:
- `data/seed.json`

---

## 3. Current Runtime Modes

### Current active mode
The system currently reads and writes primarily through:
- `server/dataStore.js`
- `data/seed.json`

### Deployment mode
- Local runtime starts from `server/index.js`
- Vercel runtime enters from `api/[[...route]].js`
- Both paths eventually rely on `server/app.js`

### Supabase status
- Supabase is detected from `.env`
- Schema exists in `scripts/supabase-schema.sql`
- Supabase is not yet the primary active persistence path
- Check `/api/meta` for readiness

Important rule:
If making persistence-related changes, verify whether they affect:
- JSON persistence only
- Supabase compatibility only
- both paths

---

## 4. Core Business Modules

### 4.1 Quotation System
This is the most important module.

Main responsibility:
- manage quote data
- calculate totals
- calculate cost
- calculate sales price
- calculate gross profit and gross margin
- support multiple service item types

Primary core file:
- `server/services/quoteService.js`

This file is high risk.
Any modification here must preserve:
- old quote compatibility
- item total correctness
- quote total correctness
- profit and margin correctness

### 4.2 Document Preview System
Main file:
- `server/services/documentPreviewService.js`

Responsibility:
- generate preview data for business documents

Known document types:
- quote
- itinerary
- airport pickup
- vehicle service
- guide task sheet

### 4.3 Template System
Main files:
- `server/services/templateService.js`
- `server/templateStore.js`

Responsibility:
- built-in templates
- user-defined templates
- quote template CRUD

### 4.4 Exchange Rate Logic
Main file:
- `server/services/exchangeRateService.js`

Responsibility:
- fixed exchange rates
- currency conversion support

---

## 5. Quote Data Structure Map

Quotes contain quote items.

Known item types include:
- `hotel`
- `vehicle`
- `guide`
- `interpreter`
- `dining`
- `tickets`
- `meeting`
- `parking`
- `misc`

Important structure rule:
Each item type may contain its own detail rows.

Examples:
- hotel items may contain room-level rows
- vehicle items may contain service rows
- guide / interpreter items may contain service rows

The system calculates:
- row-level values
- item-level totals
- quote-level totals

Every quote must support:
- cost
- price
- gross profit
- gross margin

Important implementation rule:
When adding a new quote-related field or detail structure, update all affected layers:
1. frontend input
2. frontend payload
3. backend parser
4. normalization logic
5. calculation logic
6. persistence logic
7. preview/export logic if needed

---

## 6. High-Risk Files

These files require extra caution.

### Critical business logic
- `server/services/quoteService.js`

### Central API router
- `server/app.js`

### Persistence layer
- `server/dataStore.js`

### Frontend shared helpers
- `web/app.js`
- `web/app-utils.js`
- `web/ui-labels.js`

### Deployment bridge
- `api/[[...route]].js`

### Schema file
- `scripts/supabase-schema.sql`

Risk rule:
Do not casually rewrite these files.
Prefer small targeted modifications.

---

## 7. Safe Entry Points By Task Type

### If task is about quote calculation
Read first:
1. `server/services/quoteService.js`
2. related API handling in `server/app.js`
3. related frontend page `web/*.js`
4. relevant tests in `tests/quoteService.test.js`

### If task is about form fields / UI input
Read first:
1. target page `web/*.html`
2. target page `web/*.js`
3. `web/app.js`
4. `web/ui-labels.js`
5. matching API handler in `server/app.js`

### If task is about persistence
Read first:
1. `server/dataStore.js`
2. relevant route in `server/app.js`
3. `data/seed.json`
4. `scripts/supabase-schema.sql` if schema compatibility is involved

### If task is about document preview/export
Read first:
1. `server/services/documentPreviewService.js`
2. related API route in `server/app.js`
3. frontend preview page if applicable

### If task is about templates
Read first:
1. `server/services/templateService.js`
2. `server/templateStore.js`
3. related routes in `server/app.js`
4. related tests

---

## 8. Frontend Conventions

Frontend stack:
- plain HTML
- plain CSS
- plain JavaScript
- no framework
- no bundler
- no build step

Rules:
- do not introduce React / Vue / bundlers
- do not add npm dependencies casually
- prefer existing DOM utility style
- add labels to `web/ui-labels.js` instead of scattering strings
- prefer matching current page structure

---

## 9. Backend Conventions

Backend stack:
- Node.js built-ins only
- no external npm dependencies

Rules:
- do not add packages casually
- keep implementation simple
- match current route and service style
- normalize payloads defensively
- maintain backward compatibility

---

## 10. Test Strategy

Test framework:
- native Node.js test runner
- `node:test`
- `node:assert/strict`

Important note:
Tests require shared process state.

Use:
```bash
node --test --test-isolation=none
