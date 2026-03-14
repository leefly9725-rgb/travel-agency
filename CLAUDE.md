# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start the server (same as dev)
npm run dev        # Start the server
npm test           # Run all tests
```

Run a single test file:
```bash
node --test tests/quoteService.test.js
node --test tests/api.test.js
```

Server runs at `http://localhost:3000` by default. Port is configurable via `.env`.

## Architecture

**LongDingsheng Ops V1** — Internal operations system for a travel agency in Serbia. Full-stack app with zero external dependencies (Node.js built-ins only, no npm packages).

### Backend (`server/`)

- **`server/index.js`** — Entry point, port negotiation
- **`server/app.js`** — Single HTTP handler with all API routes (`/api/quotes`, `/api/receptions`, `/api/documents`, `/api/templates`, `/api/projects`). Also serves static files from `web/`.
- **`server/dataStore.js`** — JSON file persistence layer. All data lives in `data/seed.json`.
- **`server/services/quoteService.js`** — Core quote calculation engine: totals, profit, margin, currency conversion. This is the most critical business logic file.
- **`server/services/exchangeRateService.js`** — Fixed exchange rates for EUR, RSD, KM, ALL, CNY.
- **`server/services/documentPreviewService.js`** — Builds preview data for 5 document types (quote, itinerary, airport pickup, vehicle service, guide task sheet).
- **`server/services/templateService.js`** / **`templateStore.js`** — Built-in and user-defined quote templates.
- **`server/env.js`** — Custom `.env` parser (no dotenv package).

**Deployment:** `api/[[...route]].js` is the Vercel serverless entry point that delegates to `server/app.js`.

### Frontend (`web/`)

Vanilla HTML + CSS + JavaScript. No build step, no bundler, no framework.

Each page is an `*.html` + `*.js` pair. Shared utilities:
- **`web/ui-labels.js`** — Central map of all Chinese UI labels. Add new labels here rather than hardcoding strings in page files.
- **`web/app.js`** — Shared API call helpers and DOM utilities.
- **`web/app-utils.js`** — Formatting and validation helpers.
- **`web/styles.css`** — All shared styles.

### Data Model

Quotes contain **quote items** of types: `hotel`, `vehicle`, `guide`, `interpreter`, `dining`, `tickets`, `meeting`, `parking`, `misc`. Each item type has its own **detail rows** (e.g., hotel items have room-level rows with separate cost/price per room type per night). The quote calculation logic in `quoteService.js` aggregates these detail rows into item-level and quote-level totals.

All quotes must track: cost, price, gross profit, gross margin.

### Tests

Native Node.js test runner (`node:test` + `node:assert/strict`). Tests in `tests/`:
- `api.test.js` — HTTP integration tests (spins up a real server with a temp seed file)
- `quoteService.test.js` — Unit tests for calculation logic
- `dataStore.test.js` — Persistence tests
- `templateStore.test.js` — Template CRUD tests

Run with `--test-isolation=none` (required — tests share process state).

### Business Rules

- Primary UI language: Chinese. Output languages: Chinese, English, Serbian.
- Default currency: EUR. Optional: CNY, RSD. Date format: YYYY-MM-DD, 24-hour time.
- All reception tasks must have an assignee and status.

### Supabase (not yet active)

The app detects Supabase credentials from `.env`. Currently everything reads/writes `data/seed.json`. The schema is at `scripts/supabase-schema.sql`. Check `/api/meta` to verify Supabase readiness.
---

## Engineering Safety Rules

This project is already in active development and must remain stable.

Claude must follow these rules:

- Do NOT refactor large parts of the system unless explicitly required.
- Prefer minimal safe modifications.
- Maintain backward compatibility whenever possible.
- Do not introduce breaking API changes silently.
- Avoid creating unnecessary new files.

If a change may affect production behavior, explain the risk first.

---

## Repository Reading Strategy

To reduce token usage and improve efficiency:

- Do NOT scan the entire repository unless necessary.
- First read only files related to the task.
- Prefer modifying existing files instead of creating many new ones.
- Follow existing coding patterns and architecture.

---

## Supabase Safety Rules

Supabase integration exists but is not fully active.

Rules:

- `service_role_key` must never be exposed to frontend code.
- Privileged database operations must only run on the server.
- Database schema changes must be backward compatible.
- Avoid destructive migrations.

Preferred schema change style:

ADD COLUMN IF NOT EXISTS

---

## Development Workflow

Claude Code must follow this process:

1 Understand existing code
2 Identify minimal safe modification
3 Implement change
4 Verify compatibility
5 Provide structured summary

Never modify files blindly.

---

## Required Delivery Format

At the end of every task Claude must provide:

### Modified Files
List all files changed.

### Database Changes
Tables, fields, migration SQL.

### Compatibility Handling
Explain how old data continues working.

### Local Testing
Explain how to verify the change locally.

### Production Risk
Explain any possible production impact.

### Deployment Needed
Yes / No
