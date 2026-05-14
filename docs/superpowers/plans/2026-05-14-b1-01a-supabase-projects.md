# B1-01A: Supabase `public.projects` Persistence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 4 project API routes (convert, list, get, patch-status) read/write `public.projects` when Supabase is enabled, while leaving all local JSON paths untouched.

**Architecture:** New `server/services/projectStore.js` exports three pure helpers + four async store methods that accept a Supabase config object. `server/app.js` adds an `if (supabase.enabled)` branch before each existing local-JSON block — no existing local paths are modified.

**Tech Stack:** Node.js (built-ins only), Supabase REST API via `supabaseRequest`, `node:test` for tests.

**Design spec:** `docs/superpowers/specs/2026-05-14-b1-01a-supabase-projects-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| **Create** | `server/services/projectStore.js` | Pure helpers + Supabase CRUD for `public.projects` |
| **Create** | `tests/projectHelpers.test.js` | Unit tests for the three pure helpers |
| **Modify** | `server/app.js` (import + 4 route blocks) | Add `supabase.enabled` branches |

---

## Task 0: Create Feature Branch

- [ ] **Step 0.1: Create and switch to branch**

```bash
git checkout -b feat/b1-01a-supabase-projects
```

Expected output: `Switched to a new branch 'feat/b1-01a-supabase-projects'`

---

## Task 1: Write Failing Tests for Pure Helpers

**Files:**
- Create: `tests/projectHelpers.test.js`

- [ ] **Step 1.1: Create the test file**

Create `tests/projectHelpers.test.js` with this exact content:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeProjectRecordFromSupabase,
  buildSupabaseProjectPayload,
  deriveProjectFinancials,
} = require("../server/services/projectStore");

// ── deriveProjectFinancials ───────────────────────────────────────────────────

test("deriveProjectFinancials extracts financials from quoteSnapshot", () => {
  const project = {
    quoteSnapshot: { totalSales: 1000, totalCost: 700, grossProfit: 300, grossMargin: 30 },
  };
  const r = deriveProjectFinancials(project);
  assert.equal(r.totalSales, 1000);
  assert.equal(r.totalCost, 700);
  assert.equal(r.grossProfit, 300);
  assert.equal(r.grossMargin, 30);
});

test("deriveProjectFinancials returns zeros when quoteSnapshot is absent", () => {
  const r = deriveProjectFinancials({});
  assert.equal(r.totalSales, 0);
  assert.equal(r.totalCost, 0);
  assert.equal(r.grossProfit, 0);
  assert.equal(r.grossMargin, 0);
});

test("deriveProjectFinancials returns zeros when quoteSnapshot is null", () => {
  const r = deriveProjectFinancials({ quoteSnapshot: null });
  assert.equal(r.totalSales, 0);
  assert.equal(r.totalCost, 0);
  assert.equal(r.grossProfit, 0);
  assert.equal(r.grossMargin, 0);
});

test("deriveProjectFinancials handles partial snapshot without throwing", () => {
  const r = deriveProjectFinancials({ quoteSnapshot: { totalSales: 500 } });
  assert.equal(r.totalSales, 500);
  assert.equal(r.totalCost, 0);
  assert.equal(r.grossProfit, 0);
  assert.equal(r.grossMargin, 0);
});

// ── normalizeProjectRecordFromSupabase ────────────────────────────────────────

test("normalizeProjectRecordFromSupabase maps all snake_case fields to camelCase", () => {
  const row = {
    id: "PRJ-1",
    project_number: "PRJ-20260514-1234",
    source_quote_id: "Q-123",
    source_quote_number: "QT-20260514-9999",
    source_pricing_mode: "project_based",
    project_name: "Serbia Tour",
    client_name: "ACME Corp",
    contact_name: "Alice",
    contact_phone: "+381 11 000 0000",
    destination: "Belgrade",
    start_date: "2026-06-01",
    end_date: "2026-06-05",
    pax_count: 12,
    currency: "EUR",
    status: "confirmed",
    owner_name: "Bob",
    notes: "VIP group",
    quote_snapshot: { totalSales: 9600, totalCost: 7200, grossProfit: 2400, grossMargin: 25 },
    created_at: "2026-05-14T10:00:00.000Z",
    updated_at: "2026-05-14T12:00:00.000Z",
  };
  const r = normalizeProjectRecordFromSupabase(row);
  assert.equal(r.id, "PRJ-1");
  assert.equal(r.projectNumber, "PRJ-20260514-1234");
  assert.equal(r.sourceQuoteId, "Q-123");
  assert.equal(r.sourceQuoteNumber, "QT-20260514-9999");
  assert.equal(r.sourcePricingMode, "project_based");
  assert.equal(r.projectName, "Serbia Tour");
  assert.equal(r.clientName, "ACME Corp");
  assert.equal(r.contactName, "Alice");
  assert.equal(r.contactPhone, "+381 11 000 0000");
  assert.equal(r.destination, "Belgrade");
  assert.equal(r.startDate, "2026-06-01");
  assert.equal(r.endDate, "2026-06-05");
  assert.equal(r.paxCount, 12);
  assert.equal(r.currency, "EUR");
  assert.equal(r.status, "confirmed");
  assert.equal(r.ownerName, "Bob");
  assert.equal(r.notes, "VIP group");
  assert.equal(r.createdAt, "2026-05-14T10:00:00.000Z");
  assert.equal(r.updatedAt, "2026-05-14T12:00:00.000Z");
});

test("normalizeProjectRecordFromSupabase maps quote_snapshot to quoteSnapshot object", () => {
  const snap = { totalSales: 800, totalCost: 600, grossProfit: 200, grossMargin: 25 };
  const r = normalizeProjectRecordFromSupabase({ id: "PRJ-2", quote_snapshot: snap });
  assert.deepEqual(r.quoteSnapshot, snap);
});

test("normalizeProjectRecordFromSupabase derives financials from quote_snapshot", () => {
  const r = normalizeProjectRecordFromSupabase({
    id: "PRJ-3",
    quote_snapshot: { totalSales: 1000, totalCost: 750, grossProfit: 250, grossMargin: 25 },
  });
  assert.equal(r.totalSales, 1000);
  assert.equal(r.totalCost, 750);
  assert.equal(r.grossProfit, 250);
  assert.equal(r.grossMargin, 25);
});

test("normalizeProjectRecordFromSupabase uses safe defaults for all missing fields", () => {
  const r = normalizeProjectRecordFromSupabase({ id: "PRJ-4" });
  assert.equal(r.projectNumber, "");
  assert.equal(r.sourceQuoteId, "");
  assert.equal(r.clientName, "");
  assert.equal(r.status, "draft");
  assert.equal(r.currency, "EUR");
  assert.equal(r.paxCount, 0);
  assert.deepEqual(r.quoteSnapshot, {});
  assert.equal(r.totalSales, 0);
  assert.equal(r.createdAt, "");
  assert.equal(r.updatedAt, "");
});

// ── buildSupabaseProjectPayload ────────────────────────────────────────────────

test("buildSupabaseProjectPayload maps camelCase to snake_case", () => {
  const project = {
    id: "PRJ-100",
    projectNumber: "PRJ-20260514-1000",
    sourceQuoteId: "Q-ABC",
    sourceQuoteNumber: "QT-20260514-ABC",
    sourcePricingMode: "project_based",
    projectName: "Test Project",
    clientName: "TestCo",
    contactName: "Eve",
    contactPhone: "123",
    destination: "Paris",
    startDate: "2026-07-01",
    endDate: "2026-07-10",
    paxCount: 5,
    currency: "EUR",
    status: "draft",
    ownerName: "Admin",
    notes: "none",
    quoteSnapshot: { totalSales: 500 },
  };
  const r = buildSupabaseProjectPayload(project);
  assert.equal(r.id, "PRJ-100");
  assert.equal(r.project_number, "PRJ-20260514-1000");
  assert.equal(r.source_quote_id, "Q-ABC");
  assert.equal(r.source_quote_number, "QT-20260514-ABC");
  assert.equal(r.source_pricing_mode, "project_based");
  assert.equal(r.project_name, "Test Project");
  assert.equal(r.client_name, "TestCo");
  assert.equal(r.contact_name, "Eve");
  assert.equal(r.contact_phone, "123");
  assert.equal(r.destination, "Paris");
  assert.equal(r.start_date, "2026-07-01");
  assert.equal(r.end_date, "2026-07-10");
  assert.equal(r.pax_count, 5);
  assert.equal(r.currency, "EUR");
  assert.equal(r.status, "draft");
  assert.equal(r.owner_name, "Admin");
  assert.equal(r.notes, "none");
  assert.deepEqual(r.quote_snapshot, { totalSales: 500 });
});

test("buildSupabaseProjectPayload excludes undefined fields", () => {
  const r = buildSupabaseProjectPayload({ id: "PRJ-200", projectName: "Partial" });
  assert.equal(r.id, "PRJ-200");
  assert.equal(r.project_name, "Partial");
  assert.ok(!("contact_phone" in r), "contact_phone must not appear when undefined");
  assert.ok(!("owner_name" in r), "owner_name must not appear when undefined");
  assert.ok(!("notes" in r), "notes must not appear when undefined");
});

test("buildSupabaseProjectPayload coerces null quoteSnapshot to empty object", () => {
  const r = buildSupabaseProjectPayload({ id: "PRJ-300", quoteSnapshot: null });
  assert.deepEqual(r.quote_snapshot, {});
});

test("buildSupabaseProjectPayload preserves YYYY-MM-DD date strings unchanged", () => {
  const r = buildSupabaseProjectPayload({ id: "PRJ-400", startDate: "2026-08-15", endDate: "2026-08-20" });
  assert.equal(r.start_date, "2026-08-15");
  assert.equal(r.end_date, "2026-08-20");
});
```

- [ ] **Step 1.2: Run tests to confirm they fail (module not found)**

```bash
node --test tests/projectHelpers.test.js
```

Expected: `Error: Cannot find module '../server/services/projectStore'`

---

## Task 2: Implement Pure Helpers in `projectStore.js`

**Files:**
- Create: `server/services/projectStore.js`

- [ ] **Step 2.1: Create `server/services/projectStore.js`** with pure helpers only (store methods come in Task 3):

```js
'use strict';

const { supabaseRequest } = require('../supabaseClient');
const { roundToTwo } = require('./quoteService');

// ── Pure helpers (no I/O, fully testable) ─────────────────────────────────────

function deriveProjectFinancials(project) {
  const snap =
    project && project.quoteSnapshot !== null && typeof project.quoteSnapshot === 'object'
      ? project.quoteSnapshot
      : {};
  return {
    totalSales: Number(snap.totalSales || 0),
    totalCost: Number(snap.totalCost || 0),
    grossProfit: Number(snap.grossProfit || 0),
    grossMargin: Number(snap.grossMargin || 0),
  };
}

function normalizeProjectRecordFromSupabase(row) {
  const snap =
    row.quote_snapshot !== null && typeof row.quote_snapshot === 'object'
      ? row.quote_snapshot
      : {};
  return {
    id: row.id || '',
    projectNumber: row.project_number || '',
    sourceQuoteId: row.source_quote_id || '',
    sourceQuoteNumber: row.source_quote_number || '',
    sourcePricingMode: row.source_pricing_mode || 'project_based',
    projectName: row.project_name || '',
    clientName: row.client_name || '',
    contactName: row.contact_name || '',
    contactPhone: row.contact_phone || '',
    destination: row.destination || '',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    paxCount: Number(row.pax_count || 0),
    currency: row.currency || 'EUR',
    status: row.status || 'draft',
    ownerName: row.owner_name || '',
    notes: row.notes || '',
    quoteSnapshot: snap,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    ...deriveProjectFinancials({ quoteSnapshot: snap }),
  };
}

function buildSupabaseProjectPayload(project) {
  const raw = {
    id: project.id,
    project_number: project.projectNumber,
    source_quote_id: project.sourceQuoteId,
    source_quote_number: project.sourceQuoteNumber,
    source_pricing_mode: project.sourcePricingMode,
    project_name: project.projectName,
    client_name: project.clientName,
    contact_name: project.contactName,
    contact_phone: project.contactPhone,
    destination: project.destination,
    start_date: project.startDate || null,
    end_date: project.endDate || null,
    pax_count: project.paxCount !== undefined ? Number(project.paxCount) : undefined,
    currency: project.currency,
    status: project.status,
    owner_name: project.ownerName,
    notes: project.notes,
    quote_snapshot:
      project.quoteSnapshot !== null && typeof project.quoteSnapshot === 'object'
        ? project.quoteSnapshot
        : {},
  };
  const payload = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) payload[k] = v;
  }
  return payload;
}

// ── ID generation (mirrors app.js — duplicated to avoid circular import) ───────

function createProjectId() {
  return `PRJ-${Date.now()}`;
}

function generateProjectNumber() {
  return `PRJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
}

// ── Snapshot builder (mirrors app.js buildProjectSnapshot — same reason) ──────

function buildProjectSnapshot(quote) {
  const totalCost = Number(quote.totalCost || 0);
  const totalSales = Number(quote.totalSales || quote.totalPrice || 0);
  const grossProfit = roundToTwo(totalSales - totalCost);
  const grossMargin = totalSales > 0 ? roundToTwo((grossProfit / totalSales) * 100) : 0;
  return {
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber || '',
    pricingMode: quote.pricingMode || 'project_based',
    projectGroups: Array.isArray(quote.projectGroups) ? quote.projectGroups : [],
    totalCost,
    totalSales,
    totalPrice: totalSales,
    grossProfit,
    grossMargin,
    currency: quote.currency || 'EUR',
    clientName: quote.clientName || '',
    projectName: quote.projectName || '',
    contactName: quote.contactName || '',
    contactPhone: quote.contactPhone || '',
    destination: quote.destination || '',
    startDate: quote.startDate || '',
    endDate: quote.endDate || '',
    paxCount: Number(quote.paxCount || 0),
    createdAt: quote.createdAt || '',
    convertedAt: new Date().toISOString(),
  };
}

// ── Supabase store methods (added in Task 3) ──────────────────────────────────

module.exports = {
  deriveProjectFinancials,
  normalizeProjectRecordFromSupabase,
  buildSupabaseProjectPayload,
};
```

- [ ] **Step 2.2: Run helper tests — expect all 13 to pass**

```bash
node --test tests/projectHelpers.test.js
```

Expected: `13 passing` (or equivalent pass summary), 0 failures.

- [ ] **Step 2.3: Syntax-check the new file**

```bash
node --check server/services/projectStore.js
```

Expected: no output (clean).

- [ ] **Step 2.4: Commit**

```bash
git add server/services/projectStore.js tests/projectHelpers.test.js
git commit -m "feat(B1-01A): pure helpers normalizeProjectRecordFromSupabase, buildSupabaseProjectPayload, deriveProjectFinancials + tests"
```

---

## Task 3: Add Supabase Store Methods to `projectStore.js`

**Files:**
- Modify: `server/services/projectStore.js` — replace the `module.exports` line and add 4 async functions above it.

- [ ] **Step 3.1: Replace the tail of `projectStore.js`**

Replace this block at the end of the file:

```js
// ── Supabase store methods (added in Task 3) ──────────────────────────────────

module.exports = {
  deriveProjectFinancials,
  normalizeProjectRecordFromSupabase,
  buildSupabaseProjectPayload,
};
```

With:

```js
// ── Supabase store methods ─────────────────────────────────────────────────────

// convertToProject — idempotent; quoteStore is passed in (already created in handleApi)
async function convertToProject(config, quoteStore, quoteId) {
  // 1. Fetch quote (quoteStore handles Supabase vs local internally)
  let quote;
  try {
    const result = await quoteStore.getQuoteById(quoteId);
    quote = result.quote;
  } catch {
    const err = new Error('报价不存在。');
    err.status = 404;
    throw err;
  }

  // 2. Validate pricing mode
  if (quote.pricingMode !== 'project_based') {
    const err = new Error('只有项目型报价（project_based）可以转换为项目。');
    err.status = 400;
    throw err;
  }

  // 3. Idempotency: return existing project if already converted
  const existing = await supabaseRequest(
    config,
    `projects?source_quote_id=eq.${encodeURIComponent(quoteId)}&select=*`,
  );
  if (Array.isArray(existing) && existing.length > 0) {
    return { project: normalizeProjectRecordFromSupabase(existing[0]), created: false };
  }

  // 4. Build project object
  const now = new Date().toISOString();
  const project = {
    id: createProjectId(),
    projectNumber: generateProjectNumber(),
    sourceQuoteId: quoteId,
    sourceQuoteNumber: quote.quoteNumber || '',
    sourcePricingMode: quote.pricingMode || 'project_based',
    projectName: quote.projectName || '',
    clientName: quote.clientName || '',
    contactName: quote.contactName || '',
    contactPhone: quote.contactPhone || '',
    destination: quote.destination || '',
    startDate: quote.startDate || '',
    endDate: quote.endDate || '',
    paxCount: Number(quote.paxCount || 0),
    currency: quote.currency || 'EUR',
    status: 'draft',
    ownerName: '',
    notes: '',
    quoteSnapshot: buildProjectSnapshot(quote),
    createdAt: now,
    updatedAt: now,
  };

  // 5. Insert into public.projects
  const payload = buildSupabaseProjectPayload(project);
  const rows = await supabaseRequest(config, 'projects', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });

  // 6. Back-write project_id to public.quotes
  await supabaseRequest(
    config,
    `quotes?id=eq.${encodeURIComponent(quoteId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ project_id: project.id }),
    },
  );

  const inserted = Array.isArray(rows) ? rows[0] : rows;
  return { project: normalizeProjectRecordFromSupabase(inserted || payload), created: true };
}

async function listProjects(config) {
  const rows = await supabaseRequest(config, 'projects?select=*&order=updated_at.desc');
  if (!Array.isArray(rows)) throw new Error('Supabase public.projects 查询失败。');
  return rows.map(normalizeProjectRecordFromSupabase);
}

async function getProjectById(config, id) {
  const rows = await supabaseRequest(
    config,
    `projects?select=*&id=eq.${encodeURIComponent(id)}`,
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return normalizeProjectRecordFromSupabase(rows[0]);
}

async function updateProjectStatus(config, id, status) {
  // Check existence first so we can return 404 vs 500
  const existing = await supabaseRequest(
    config,
    `projects?select=id&id=eq.${encodeURIComponent(id)}`,
  );
  if (!Array.isArray(existing) || existing.length === 0) {
    const err = new Error('项目不存在。');
    err.status = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const rows = await supabaseRequest(
    config,
    `projects?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status, updated_at: now }),
    },
  );

  const updated = Array.isArray(rows) ? rows[0] : rows;
  if (!updated) throw new Error('更新失败，Supabase 未返回记录。');
  return normalizeProjectRecordFromSupabase(updated);
}

module.exports = {
  deriveProjectFinancials,
  normalizeProjectRecordFromSupabase,
  buildSupabaseProjectPayload,
  convertToProject,
  listProjects,
  getProjectById,
  updateProjectStatus,
};
```

- [ ] **Step 3.2: Syntax-check**

```bash
node --check server/services/projectStore.js
```

Expected: no output.

- [ ] **Step 3.3: Re-run helper tests — still 13 passing**

```bash
node --test tests/projectHelpers.test.js
```

Expected: 13 pass, 0 fail.

- [ ] **Step 3.4: Commit**

```bash
git add server/services/projectStore.js
git commit -m "feat(B1-01A): Supabase store methods convertToProject, listProjects, getProjectById, updateProjectStatus"
```

---

## Task 4: Add Supabase Branches to `server/app.js`

**Files:**
- Modify: `server/app.js` — add one import line, then update 4 route blocks.

**No existing lines are removed.** Each block adds an `if (supabase.enabled)` guard before the existing local-JSON code.

- [ ] **Step 4.1: Add `projectStore` import**

In `server/app.js`, find the existing imports block (around line 26-31):

```js
const { createQuoteStore } = require("./services/quoteStore");
const { createReceptionStore } = require("./services/receptionStore");
```

Add one line immediately after `createQuoteStore`:

```js
const { createQuoteStore } = require("./services/quoteStore");
const projectStore = require("./services/projectStore");
const { createReceptionStore } = require("./services/receptionStore");
```

- [ ] **Step 4.2: Update `GET /api/projects`**

Find this block (around line 2057):

```js
  if (request.method === "GET" && url.pathname === "/api/projects") {
    const data = loadSeedData();
    ensureProjectData(data);
    const realProjects = [...data.projects].sort(
      (a, b) => (b.updatedAt || "0").localeCompare(a.updatedAt || "0")
    );
    sendJson(response, 200, realProjects.map(serializeProject));
    return true;
  }
```

Replace it with:

```js
  if (request.method === "GET" && url.pathname === "/api/projects") {
    const supabase = getSupabaseConfig();
    if (supabase.enabled) {
      try {
        const projects = await projectStore.listProjects(supabase);
        sendJson(response, 200, projects.map(serializeProject));
      } catch (err) {
        sendJson(response, 500, { error: err.message });
      }
      return true;
    }
    const data = loadSeedData();
    ensureProjectData(data);
    const realProjects = [...data.projects].sort(
      (a, b) => (b.updatedAt || "0").localeCompare(a.updatedAt || "0")
    );
    sendJson(response, 200, realProjects.map(serializeProject));
    return true;
  }
```

- [ ] **Step 4.3: Update `POST /api/quotes/:id/convert-to-project`**

Find this block (around line 2067):

```js
  // POST /api/quotes/:id/convert-to-project
  if (request.method === "POST") {
    const convertMatch = url.pathname.match(/^\/api\/quotes\/([^/]+)\/convert-to-project$/);
    if (convertMatch) {
      const quoteId = decodeURIComponent(convertMatch[1]);
      const data = loadSeedData();
      const rawQuote = (data.quotes || []).find((q) => q.id === quoteId);
      if (!rawQuote) {
        sendJson(response, 404, { error: "报价不存在。" });
        return true;
      }
      if (rawQuote.pricingMode !== "project_based") {
        sendJson(response, 400, { error: "只有项目型报价（project_based）可以转换为项目。" });
        return true;
      }
      const { project, created } = convertQuoteToProjectLocal(data, rawQuote);
      if (created) {
        // Write back projectId into the quote for UI button state
        const qi = data.quotes.findIndex((q) => q.id === quoteId);
        if (qi >= 0) {
          data.quotes[qi] = { ...data.quotes[qi], projectId: project.id, updatedAt: new Date().toISOString() };
        }
        saveSeedData(data);
      }
      sendJson(response, created ? 201 : 200, serializeProject(project));
      return true;
    }
  }
```

Replace it with:

```js
  // POST /api/quotes/:id/convert-to-project
  if (request.method === "POST") {
    const convertMatch = url.pathname.match(/^\/api\/quotes\/([^/]+)\/convert-to-project$/);
    if (convertMatch) {
      const quoteId = decodeURIComponent(convertMatch[1]);
      const supabase = getSupabaseConfig();
      if (supabase.enabled) {
        try {
          const { project, created } = await projectStore.convertToProject(supabase, quoteStore, quoteId);
          sendJson(response, created ? 201 : 200, serializeProject(project));
        } catch (err) {
          sendJson(response, err.status || 500, { error: err.message });
        }
        return true;
      }
      const data = loadSeedData();
      const rawQuote = (data.quotes || []).find((q) => q.id === quoteId);
      if (!rawQuote) {
        sendJson(response, 404, { error: "报价不存在。" });
        return true;
      }
      if (rawQuote.pricingMode !== "project_based") {
        sendJson(response, 400, { error: "只有项目型报价（project_based）可以转换为项目。" });
        return true;
      }
      const { project, created } = convertQuoteToProjectLocal(data, rawQuote);
      if (created) {
        // Write back projectId into the quote for UI button state
        const qi = data.quotes.findIndex((q) => q.id === quoteId);
        if (qi >= 0) {
          data.quotes[qi] = { ...data.quotes[qi], projectId: project.id, updatedAt: new Date().toISOString() };
        }
        saveSeedData(data);
      }
      sendJson(response, created ? 201 : 200, serializeProject(project));
      return true;
    }
  }
```

- [ ] **Step 4.4: Update `PATCH /api/projects/:id/status`**

Find this block (around line 2096):

```js
  // PATCH /api/projects/:id/status
  if (request.method === "PATCH") {
    const statusMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/status$/);
    if (statusMatch) {
      const projectId = decodeURIComponent(statusMatch[1]);
      const body = parseJsonBody(await readRequestBody(request));
      const newStatus = body.status;
      if (!VALID_PROJECT_STATUSES.includes(newStatus)) {
        sendJson(response, 400, { error: `status 不合法，允许值：${VALID_PROJECT_STATUSES.join(", ")}` });
        return true;
      }
      const data = loadSeedData();
      ensureProjectData(data);
      const idx = data.projects.findIndex((p) => p.id === projectId);
      if (idx < 0) {
        sendJson(response, 404, { error: "项目不存在。" });
        return true;
      }
      data.projects[idx] = { ...data.projects[idx], status: newStatus, updatedAt: new Date().toISOString() };
      saveSeedData(data);
      sendJson(response, 200, serializeProject(data.projects[idx]));
      return true;
    }
  }
```

Replace it with:

```js
  // PATCH /api/projects/:id/status
  if (request.method === "PATCH") {
    const statusMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/status$/);
    if (statusMatch) {
      const projectId = decodeURIComponent(statusMatch[1]);
      const body = parseJsonBody(await readRequestBody(request));
      const newStatus = body.status;
      if (!VALID_PROJECT_STATUSES.includes(newStatus)) {
        sendJson(response, 400, { error: `status 不合法，允许值：${VALID_PROJECT_STATUSES.join(", ")}` });
        return true;
      }
      const supabase = getSupabaseConfig();
      if (supabase.enabled) {
        try {
          const project = await projectStore.updateProjectStatus(supabase, projectId, newStatus);
          sendJson(response, 200, serializeProject(project));
        } catch (err) {
          sendJson(response, err.status || 500, { error: err.message });
        }
        return true;
      }
      const data = loadSeedData();
      ensureProjectData(data);
      const idx = data.projects.findIndex((p) => p.id === projectId);
      if (idx < 0) {
        sendJson(response, 404, { error: "项目不存在。" });
        return true;
      }
      data.projects[idx] = { ...data.projects[idx], status: newStatus, updatedAt: new Date().toISOString() };
      saveSeedData(data);
      sendJson(response, 200, serializeProject(data.projects[idx]));
      return true;
    }
  }
```

- [ ] **Step 4.5: Update `GET /api/projects/:id`**

Find this block (around line 2121):

```js
  if (request.method === "GET") {
    const projectId = matchIdRoute(url.pathname, "projects");
    if (projectId) {
      // Try real project entity first
      const data = loadSeedData();
      ensureProjectData(data);
      const realProject = data.projects.find((p) => p.id === projectId);
      if (realProject) {
        sendJson(response, 200, serializeProject(realProject));
        return true;
      }
      // Fallback: old archive view (preserves existing test for P-1)
      try {
        const [qr, rr] = await Promise.all([quoteStore.listQuotes(), receptionStore.listReceptions()]);
        sendJson(response, 200, getProjectDetail({ quotes: qr.quotes, receptions: rr.receptions }, projectId));
      } catch (error) {
        sendJson(response, 404, { error: error.message });
      }
      return true;
    }
  }
```

Replace it with:

```js
  if (request.method === "GET") {
    const projectId = matchIdRoute(url.pathname, "projects");
    if (projectId) {
      const supabase = getSupabaseConfig();
      if (supabase.enabled) {
        let project = null;
        try {
          project = await projectStore.getProjectById(supabase, projectId);
        } catch (err) {
          sendJson(response, 500, { error: err.message });
          return true;
        }
        if (project) {
          sendJson(response, 200, serializeProject(project));
          return true;
        }
        // not found in Supabase → fall through to archive fallback below
      } else {
        // Local JSON path: try real project entity first
        const data = loadSeedData();
        ensureProjectData(data);
        const realProject = data.projects.find((p) => p.id === projectId);
        if (realProject) {
          sendJson(response, 200, serializeProject(realProject));
          return true;
        }
        // fall through to archive fallback below
      }
      // Fallback: old archive view (preserves existing test for P-1)
      try {
        const [qr, rr] = await Promise.all([quoteStore.listQuotes(), receptionStore.listReceptions()]);
        sendJson(response, 200, getProjectDetail({ quotes: qr.quotes, receptions: rr.receptions }, projectId));
      } catch (error) {
        sendJson(response, 404, { error: error.message });
      }
      return true;
    }
  }
```

- [ ] **Step 4.6: Syntax-check `app.js`**

```bash
node --check server/app.js
```

Expected: no output.

- [ ] **Step 4.7: Syntax-check all other modified/related files**

```bash
node --check server/services/projectStore.js && node --check tests/projectHelpers.test.js && node --check web/project-quotes.js && node --check web/projects.js && node --check web/project-detail.js
```

Expected: no output from any file.

- [ ] **Step 4.8: Commit**

```bash
git add server/app.js
git commit -m "feat(B1-01A): add supabase.enabled branches to 4 project API routes in app.js"
```

---

## Task 5: Run Full Test Suite

- [ ] **Step 5.1: Run all tests**

```bash
npm test
```

Expected: all existing tests pass (66+ from main suite) + 13 new helper tests. 0 failures.

If any test fails, investigate before proceeding — do not skip.

- [ ] **Step 5.2: Run helper tests in isolation to confirm clean import**

```bash
node --test tests/projectHelpers.test.js
```

Expected: 13 pass.

- [ ] **Step 5.3: Commit test confirmation**

```bash
git add -A
git commit -m "test(B1-01A): confirm all 66+ existing + 13 new helper tests pass"
```

---

## Task 6: Schema Verification (No Code Change)

This task is manual — no files modified.

- [ ] **Step 6.1: Confirm `public.projects` table in Supabase dashboard**

Log into Supabase → Table Editor → confirm `public.projects` exists with columns:
`id, project_number, source_quote_id (UNIQUE), quote_snapshot (jsonb), status (with check constraint), updated_at`

If the table does NOT exist, run this SQL in Supabase SQL Editor (already in `scripts/supabase-schema.sql`):

```sql
create table if not exists public.projects (
  id text primary key,
  project_number text not null,
  source_quote_id text unique,
  source_quote_number text not null default '',
  source_pricing_mode text not null default 'project_based',
  project_name text not null,
  client_name text not null,
  contact_name text not null default '',
  contact_phone text not null default '',
  destination text not null default '',
  start_date date,
  end_date date,
  pax_count integer not null default 0,
  currency text not null default 'EUR',
  status text not null default 'draft'
    constraint projects_status_check check (status in ('draft','confirmed','running','completed','cancelled')),
  owner_name text not null default '',
  notes text not null default '',
  quote_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_projects_updated_at on public.projects (updated_at desc);
create index if not exists idx_projects_status on public.projects (status);

alter table if exists public.projects add column if not exists owner_name text not null default '';
alter table if exists public.projects add column if not exists notes text not null default '';
```

Also ensure `public.quotes` has a `project_id` column:

```sql
alter table if exists public.quotes add column if not exists project_id text not null default '';
```

---

## Task 7: Final Commit and Branch Summary

- [ ] **Step 7.1: Final status check**

```bash
git status
git log --oneline feat/b1-01a-supabase-projects ^main
```

Expected: clean working tree; 4-5 commits on branch ahead of main.

- [ ] **Step 7.2: Summary of what was answered**

After implementation, confirm each question from the task brief:

| Question | Answer |
|---|---|
| POST convert-to-project writes `public.projects`? | ✅ via `projectStore.convertToProject` when `supabase.enabled` |
| GET /api/projects reads `public.projects`? | ✅ via `projectStore.listProjects` when `supabase.enabled` |
| GET /api/projects/:id queries `public.projects` first, then archive fallback? | ✅ `getProjectById` returns null → archive fallback runs |
| PATCH /api/projects/:id/status updates `public.projects.status`? | ✅ via `projectStore.updateProjectStatus` |
| `quotes.project_id` back-written? | ✅ step 6 of `convertToProject` PATCHes `public.quotes` |
