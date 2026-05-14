# B1-01A Design: Supabase `public.projects` Persistence

**Date:** 2026-05-14  
**Status:** Approved  
**Scope:** Add Supabase read/write paths for the 4 project APIs. Local JSON paths unchanged.

---

## Problem

`public.projects` table exists in Supabase schema but the application never reads or writes it.
In production (Vercel + Supabase), all 4 project APIs silently fall through to local JSON,
which is ephemeral on Vercel. B1-01 is therefore not production-complete.

---

## Out of Scope

- B1-02 project tracking board, dispatch, cost accounting
- Refactoring local JSON paths or existing tests
- `standard-quotation.html` / customer quotation security interface
- `project-quotation` output chain
- `suppliers` page

---

## Architecture Decision

**Option B chosen:** New `server/services/projectStore.js`, mirroring `quoteStore.js`.

Rationale: project entity is a distinct domain (separate table, separate lifecycle).
`app.js` already delegates quote CRUD to `quoteStore.js`; the same pattern applies here.

---

## New File: `server/services/projectStore.js`

### Pure Helpers (exported, fully testable without HTTP)

#### `normalizeProjectRecordFromSupabase(row)`

Input: Supabase REST row (snake_case + timestamps).  
Output: unified camelCase project object consumed by `serializeProject()`.

| Supabase column | JS field |
|---|---|
| `id` | `id` |
| `project_number` | `projectNumber` |
| `source_quote_id` | `sourceQuoteId` |
| `source_quote_number` | `sourceQuoteNumber` |
| `source_pricing_mode` | `sourcePricingMode` |
| `project_name` | `projectName` |
| `client_name` | `clientName` |
| `contact_name` | `contactName` |
| `contact_phone` | `contactPhone` |
| `destination` | `destination` |
| `start_date` | `startDate` |
| `end_date` | `endDate` |
| `pax_count` | `paxCount` |
| `currency` | `currency` |
| `status` | `status` |
| `owner_name` | `ownerName` |
| `notes` | `notes` |
| `quote_snapshot` | `quoteSnapshot` (object) |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |

Plus computed via `deriveProjectFinancials`:
`totalSales`, `totalCost`, `grossProfit`, `grossMargin`

Missing/null fields must not throw — default to safe empty values.

---

#### `buildSupabaseProjectPayload(project)`

Input: camelCase project object (from local create or `convertQuoteToProjectLocal`).  
Output: snake_case object safe to POST/PATCH to Supabase REST API.

Rules:
- Omit `undefined` values (use `!== undefined` filter).
- `quote_snapshot` must be an object (never a string).
- Date fields keep `YYYY-MM-DD` string format — no conversion.
- Never include computed financials (`totalSales` etc.) as top-level columns — they live in `quote_snapshot`.
- Never include local-only fields like `id` in UPDATE payloads (caller decides).

---

#### `deriveProjectFinancials(project)`

Input: camelCase project object (local or normalized from Supabase).  
Output: `{ totalSales, totalCost, grossProfit, grossMargin }`.

Source: `project.quoteSnapshot.totalSales` etc.  
Fallback: `0` for any missing field — never throws.

---

### Store Methods (require Supabase config + `supabaseRequest`)

All methods take `(config)` as first arg (the result of `getSupabaseConfig()`).

#### `convertToProject(config, quoteStore, quoteId)`

1. Fetch quote via `quoteStore.getQuoteById(quoteId)` — uses Supabase if enabled.
2. If not found → throw with message "报价不存在。"
3. If `pricingMode !== 'project_based'` → throw `{status: 400, message: "只有项目型报价…"}`
4. Idempotency: `GET public.projects?source_quote_id=eq.<quoteId>` — if row exists, return normalized project.
5. Build payload via `buildSupabaseProjectPayload`.
6. `POST public.projects` with `Prefer: return=representation`.
7. Back-write: `PATCH public.quotes?id=eq.<quoteId>` → `{ project_id: project.id }`.
8. Return `{ project: normalizeProjectRecordFromSupabase(row), created: true }`.

#### `listProjects(config)`

`GET public.projects?select=*&order=updated_at.desc`  
Returns array of normalized projects. If Supabase errors, propagate — do not fake empty array.

#### `getProjectById(config, id)`

`GET public.projects?select=*&id=eq.<id>`  
If found: return normalized project.  
If not found: return `null` (caller in `app.js` then runs archive fallback).

#### `updateProjectStatus(config, id, status)`

1. Validate `status` in `VALID_PROJECT_STATUSES` — caller does this, store trusts it.
2. `GET public.projects?select=id&id=eq.<id>` to confirm existence → null means 404.
3. `PATCH public.projects?id=eq.<id>` → `{ status, updated_at: now }` with `Prefer: return=representation`.
4. Return normalized project.

---

## Changes to `server/app.js`

Four route handlers gain a `supabase.enabled` branch. Local JSON path is untouched.

### POST `/api/quotes/:id/convert-to-project`

```
const supabase = getSupabaseConfig();
if (supabase.enabled) {
  // projectStore.convertToProject(supabase, quoteStore, quoteId)
  // maps errors to 400/404
  // returns serializeProject(project) with 201 or 200
} else {
  // existing local JSON path (unchanged)
}
```

### GET `/api/projects`

```
const supabase = getSupabaseConfig();
if (supabase.enabled) {
  // projectStore.listProjects(supabase)
} else {
  // existing local JSON path (unchanged)
}
```

### GET `/api/projects/:id`

```
const supabase = getSupabaseConfig();
if (supabase.enabled) {
  const project = await projectStore.getProjectById(supabase, id);
  if (project) { return serializeProject(project); }
  // fallback: existing archive view (unchanged)
} else {
  // existing local JSON path + archive fallback (unchanged)
}
```

### PATCH `/api/projects/:id/status`

```
const supabase = getSupabaseConfig();
if (supabase.enabled) {
  // projectStore.updateProjectStatus(supabase, id, newStatus)
} else {
  // existing local JSON path (unchanged)
}
```

---

## Tests: `tests/projectHelpers.test.js`

Pure unit tests — no HTTP, no Supabase mock.

| Test | What it verifies |
|---|---|
| `normalizeProjectRecordFromSupabase` — snake→camel | All field mappings correct |
| `normalizeProjectRecordFromSupabase` — missing fields | No throw, safe defaults |
| `normalizeProjectRecordFromSupabase` — timestamps | `created_at`/`updated_at` → `createdAt`/`updatedAt` |
| `buildSupabaseProjectPayload` — camel→snake | All field mappings correct |
| `buildSupabaseProjectPayload` — no undefined fields | `undefined` values excluded |
| `buildSupabaseProjectPayload` — snapshot is object | Never stringified |
| `deriveProjectFinancials` — from snapshot | Correct extraction |
| `deriveProjectFinancials` — missing snapshot | Returns `{0,0,0,0}` without throw |
| `deriveProjectFinancials` — partial snapshot | Partial fields default to 0 |

Existing `api.test.js` B1-01 block (lines 1487–1678) continues unchanged.

---

## Schema

`supabase-schema.sql` already complete. No new DDL needed in code.

**Manual production step required:**
Run the full `supabase-schema.sql` against production Supabase instance
(or confirm `public.projects` already exists via Supabase dashboard).
Specifically verify the `source_quote_id` UNIQUE constraint and `quote_snapshot jsonb` column.

---

## Compatibility

| Concern | Handling |
|---|---|
| Old `data.projects` local JSON data | Untouched — local path unchanged |
| Old `/api/projects/:id` archive fallback | Untouched — Supabase path returns `null` to trigger it |
| `quoteSnapshot` missing on old projects | `deriveProjectFinancials` defaults to 0 |
| `project-detail.js` render branch | `quoteSnapshot` present → `renderRealProject`; absent → `renderArchiveProject` |
| `standard-quotation.html` | Not touched |
| Customer quotation security interface | Not touched |

---

## Delivery Checklist (post-implementation)

- [ ] `node --check server/services/projectStore.js`
- [ ] `node --check server/app.js`
- [ ] `node --check tests/projectHelpers.test.js`
- [ ] `npm test` — all 66+ pass
- [ ] Local JSON: convert → projects.html → project-detail → status patch
- [ ] Production: `public.projects` table confirmed; convert → Supabase record; `quotes.project_id` back-written
