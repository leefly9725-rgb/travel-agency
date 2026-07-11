# LDS-OPS-v1 Agent Router

This file defines how Claude Code selects and sequences agents for every task type in this project.
It supplements `.claude/CLAUDE.md` and is loaded automatically during every session.

---

## Core Collaboration Rules

1. **One code-writer per task.** Only the primary agent may write or edit source files. Supporting and review agents read, analyze, and report — they never directly modify code.
2. **Sequential, not parallel.** Agents execute one at a time in the defined order: Plan → Implement → Review → Accept.
3. **Review before acceptance.** When a review agent is listed, its findings must be addressed before the task is considered complete.
4. **LDS rules override agent defaults.** Any agent's built-in style, defaults, or preferences are subordinate to the rules in `CLAUDE.md` and `.claude/CLAUDE.md`.
5. **Escalate on doubt.** If the task scope is unclear or the routing is ambiguous, stop and discuss before proceeding.

---

## Task Categories & Routing Table

### Category 1 — Backend API & Business Logic

**Triggers:** `server/app.js`, `server/dataStore.js`, `server/services/`, `api/`, route, endpoint, handler, API, HTTP, request, response, REST, middleware

| Role | Agent | Responsibility |
|---|---|---|
| Primary | `engineering-backend-architect` | Route design, API logic, dataStore reads/writes |
| Supporting | `engineering-minimal-change-engineer` | Scopes the diff — enforces minimal safe modification rule |
| Review | `engineering-code-reviewer` | Verifies correctness, API compatibility, backward compatibility |

**LDS-OPS-v1 Special Rules:**
- Existing API paths in `server/app.js` must never be renamed — only new paths may be added.
- `api/[[...route]].js` is a proxy only; no business logic may be added there.
- Any change to a public API response shape requires the review agent to explicitly confirm backward compatibility.
- The review agent must check that `npm test` passes before the task is accepted.

---

### Category 2 — Database & Supabase Migrations

**Triggers:** Supabase, schema, migration, SQL, `seed.json`, table, column, ALTER, CREATE TABLE, `scripts/supabase-migrate-*.sql`, data model, persistence layer

| Role | Agent | Responsibility |
|---|---|---|
| Primary | `engineering-database-optimizer` | Schema design, migration SQL, index strategy |
| Supporting | `engineering-backend-architect` | Ensures migration is consistent with `server/` and `dataStore.js` usage |
| Review | `engineering-security-engineer` | Validates `service_role_key` boundaries; confirms no privileged ops leak to client |
| Review | `engineering-code-reviewer` | Confirms migration is non-destructive; checks `seed.json` compatibility |

**LDS-OPS-v1 Special Rules — Supabase Safety:**
- `service_role_key` must never appear in any file under `web/` or `api/`. Violation blocks task acceptance.
- All schema changes must use `ADD COLUMN IF NOT EXISTS` or equivalent non-destructive DDL.
- Destructive operations (`DROP COLUMN`, `DROP TABLE`, `TRUNCATE`) require explicit user confirmation before the primary agent executes.
- Every migration must include a rollback strategy in the task delivery summary.
- After any schema change, the delivery summary must state whether `seed.json` compatibility was verified and whether Vercel + Supabase environment is in sync.
- Check `/api/meta` to confirm the active persistence layer before and after migration work.

---

### Category 3 — Frontend UI

**Triggers:** `web/*.html`, `web/*.js`, `web/styles.css`, `web/ui-labels.js`, form, layout, card, button, table, label, style, CSS, UI, page, input, modal, scroll, responsive

| Role | Agent | Responsibility |
|---|---|---|
| Primary | `engineering-frontend-developer` | HTML/JS/CSS implementation |
| Supporting | `engineering-minimal-change-engineer` | Keeps diffs targeted; prevents CSS sprawl |
| Review | `testing-evidence-collector` | Requires visual or behavioral proof before accepting UI changes |

**Lightweight exception:** CSS-only or label-only changes (`web/styles.css`, `web/ui-labels.js`, static text) may skip the review agent. All other UI changes require evidence collection.

**LDS-OPS-v1 Special Rules:**
- All new UI strings must be added to `web/ui-labels.js` — no hardcoded strings in page files.
- The primary UI language is Chinese. English and Serbian are output-only languages.
- Do not introduce JavaScript frameworks or bundlers. Vanilla JS only.
- No npm packages may be imported client-side.

---

### Category 4 — PDF / Word / Export Workflows

**Triggers:** PDF, export, print, `@media print`, `scripts/export-*.js`, `web/quotation-preview.html`, cover page, A4, page-break, Word, DOCX, download, composer, headless, Playwright, layout, margin, pagination

| Role | Agent | Responsibility |
|---|---|---|
| Primary | `engineering-frontend-developer` | Print layout, CSS `@media print`, HTML structure for PDF rendering |
| Supporting | `specialized-document-generator` | Document structure conventions, multi-page layout, cover/terms/signature zones |
| Review | `testing-evidence-collector` | Visual proof of rendered PDF before acceptance — screenshot or printed PDF required |
| Review | `engineering-code-reviewer` | Confirms screen and print render paths are consistent; no broken page breaks |

**LDS-OPS-v1 Special Rules — Export Workflows:**
- `scripts/export-project-quotation-pdf.js` is the authoritative export entry point. Do not create parallel export scripts without explicit user instruction.
- A4 page dimensions (210mm × 297mm) and defined margin values in `@media print` must not be changed without visual confirmation.
- Cover page, body, terms page, and signature zone are all required sections in the final PDF. Changes to any section require the evidence collector to re-verify the full document.
- The review agent must confirm that `window.matchMedia('print')` and headless print paths produce identical output.
- Word/DOCX export (if added) must not replace the PDF path — both must remain independently functional.

---

### Category 5 — Security & RBAC / Permissions

**Triggers:** auth, authentication, login, session, token, permission, role, RBAC, `service_role_key`, `authMiddleware.js`, `auth-guard.js`, `admin-permissions.html`, access control, JWT, cookie, user role, privilege

| Role | Agent | Responsibility |
|---|---|---|
| Primary | `engineering-security-engineer` | Auth architecture, permission model, token handling |
| Supporting | `engineering-backend-architect` | Ensures auth middleware integrates correctly with route handlers |
| Review | `engineering-code-reviewer` | Checks for privilege escalation, missing guards, insecure defaults |
| Review | `testing-api-tester` | Verifies that protected routes reject unauthorized requests |

**LDS-OPS-v1 Special Rules — Security:**
- `service_role_key` is server-only. Any code that passes it through a response, logs it, or exposes it to `web/` is a blocker. The review agent must explicitly sign off on this.
- Role changes must be backward compatible. If a role is renamed or removed, existing sessions must not break silently.
- New permission checks must be added server-side first. Client-side guards are UI conveniences only, not security controls.
- `admin-permissions.html` changes require both the security engineer and code reviewer to sign off.
- The API tester review must confirm that at least one unauthorized-access test case passes before changes are accepted.

---

### Category 6 — Quote & Pricing Logic

**Triggers:** `server/services/quoteService.js`, quote calculation, totals, profit, margin, currency, EUR, CNY, RSD, exchange rate, pricing, cost, price, `exchangeRateService.js`, quote item, hotel_details, quote total

| Role | Agent | Responsibility |
|---|---|---|
| Primary | `engineering-backend-architect` | Calculation logic, aggregation, currency handling |
| Supporting | `engineering-minimal-change-engineer` | Prevents accidental scope expansion in the most critical business logic file |
| Review | `engineering-code-reviewer` | Mathematical correctness, rounding, edge cases (zero cost, multi-currency) |
| Review | `testing-api-tester` | Confirms `quoteService.test.js` passes; new logic must have a corresponding test |

**LDS-OPS-v1 Special Rules:**
- `quoteService.js` is the highest-risk file in the project. Every change, no matter how small, triggers the full review chain above.
- New test cases in `quoteService.test.js` are mandatory for any change to calculation logic — not optional.
- Currency conversion rates live in `exchangeRateService.js`. Rate values must not be hardcoded in `quoteService.js`.
- Quote totals must always track: cost, price, gross profit, gross margin. No change may break any of these four fields.

---

### Category 7 — Supplier System

**Triggers:** `web/suppliers.html`, `scripts/import-supplier-catalog.js`, `scripts/seed-suppliers.js`, supplier, catalog, price library, from-catalog, Excel, XLSX, CSV, import, supplier_catalog_items

| Role | Agent | Responsibility |
|---|---|---|
| Primary | `engineering-backend-architect` | Supplier CRUD routes, catalog import logic, data normalization |
| Supporting | `engineering-data-engineer` | Excel/CSV parsing pipeline, data validation, deduplication |
| Review | `engineering-code-reviewer` | Import idempotency, data integrity, no silent overwrites |

**LDS-OPS-v1 Special Rules:**
- Import scripts must be idempotent — running the same import twice must not create duplicate records.
- No npm package may be introduced for Excel parsing without explicit user authorization.
- Import errors must be surfaced per-row, not silently swallowed.

---

### Category 8 — Debugging & Incident Response

**Triggers:** bug, error, broken, white screen, loading spinner, 404, 500, console error, crash, regression, not working, failed, unexpected, Vercel error, production issue, npm test failure, JS syntax error, API mismatch, local vs online difference

| Role | Agent | Responsibility |
|---|---|---|
| Primary | `engineering-incident-response-commander` | Incident triage, root cause identification, fix coordination |
| Supporting | `engineering-minimal-change-engineer` | Ensures the fix is surgical — no opportunistic cleanup during incident response |
| Review | `testing-reality-checker` | Gates production readiness — must produce explicit pass/fail before fix is accepted |
| Review | `testing-evidence-collector` | Documents proof of resolution (screenshot, log, test output) |

**LDS-OPS-v1 Special Rules:**
- During debugging, do not refactor or "clean up" adjacent code. Fix only the identified root cause.
- If the bug manifests only on Vercel (not locally), explicitly state the local/Vercel divergence in the delivery summary.
- `npm test` must pass after any bug fix. Test failures block acceptance.
- Production data must never be modified as part of debugging unless the user explicitly authorizes it.

---

### Category 9 — Architecture & Documentation

**Triggers:** CLAUDE.md, AGENT_ROUTER.md, architecture, design document, spec, plan, system design, ADR, onboarding, README, PROJECT_MAP.md, documentation, technical spec, `docs/superpowers/`

| Role | Agent | Responsibility |
|---|---|---|
| Primary | `engineering-technical-writer` | Drafts documentation, specs, and architectural guides |
| Supporting | `engineering-software-architect` | Validates architectural accuracy and forward compatibility |
| Review | None required | Documentation-only changes do not require a review agent |

**LDS-OPS-v1 Special Rules:**
- Design documents under `docs/superpowers/specs/` or `docs/superpowers/plans/` are only created for: new schema design, new API contracts, security model changes, or multi-file architectural decisions.
- Do not create design documents for trivial UI tweaks, single-field additions, text changes, or CSS fixes.
- Changes to `CLAUDE.md` or `.claude/CLAUDE.md` require the user to review and approve the diff before committing.

---

### Category 10 — Testing & QA

**Triggers:** `tests/*.test.js`, test, unit test, integration test, assertion, test case, test coverage, `npm test`, test runner, `node:test`

| Role | Agent | Responsibility |
|---|---|---|
| Primary | `testing-api-tester` | Writes and validates API integration tests |
| Supporting | `engineering-backend-architect` | Ensures tests exercise real server behavior (not mocks) |
| Review | `testing-reality-checker` | Confirms tests are meaningful — passes cannot be trivially achieved by mocking |

**LDS-OPS-v1 Special Rules:**
- Tests run with `--test-isolation=none` (process state is shared). New tests must not depend on isolated state.
- Do not mock the database in integration tests. Tests spin up a real server with a temp seed file — maintain this pattern.
- All new backend logic must have a corresponding test case before the task is accepted.

---

### Category 11 — Project Execution Workflow (Multi-File Features)

**Triggers:** new feature, new module, new page, new API + UI, multi-file, cross-boundary, backend + frontend, new workflow, full-stack, sprint item, B1-\*, feat/

| Role | Agent | Responsibility |
|---|---|---|
| Primary | `engineering-software-architect` | Plans the feature, identifies all affected files, defines sequence of changes |
| Implementing | `engineering-backend-architect` or `engineering-frontend-developer` | Executes implementation per architect's plan (backend-first, then frontend) |
| Review | `engineering-code-reviewer` | Reviews the complete diff across all files |
| Review | `testing-reality-checker` | Final production-readiness gate — signs off before merge |

**Execution Sequence (mandatory):**
```
1. Architect scopes the feature → lists all files to change, defines API contract
2. Backend changes first → routes, dataStore, services (backend agent implements)
3. Frontend changes after backend is stable → web/*.html, web/*.js (frontend agent implements)
4. Code reviewer reviews full diff
5. Reality checker gates acceptance
6. User reviews delivery summary before merge
```

**LDS-OPS-v1 Special Rules:**
- No frontend change may precede its backend counterpart in multi-file features.
- The architect must identify whether the change requires a `docs/superpowers/` spec before implementation begins.
- Multi-file features always require `npm test` to pass at completion.
- If the feature touches Supabase schema, Category 2 (Database & Supabase) rules apply in addition to this category.

---

## When NOT to Use Multiple Agents

Use a single agent (no routing chain) for:

| Scenario | Single Agent |
|---|---|
| CSS-only style tweak in `web/styles.css` (single rule change) | `engineering-frontend-developer` |
| UI label / static text change in `web/ui-labels.js` | `engineering-frontend-developer` |
| Single-line behavior change with no API, data-model, or calculation impact | `engineering-minimal-change-engineer` |
| Documentation-only change (README, CLAUDE.md, markdown files) | `engineering-technical-writer` |
| Git operations (branch, commit, tag) | `engineering-git-workflow-master` |
| Reading/explaining code only (no changes) | No agent required — Claude Code handles inline |

**Rule:** If the task fits one of the above AND you are certain it cannot expand in scope, use the listed single agent. If any doubt exists, escalate to the full routing chain for the relevant category.

---

## Required Output Format (Every Task)

All tasks must conclude with a structured delivery summary in this format:

```
## Delivery Summary

### Routing Used
- Task category: [Category name]
- Primary agent: [agent name]
- Supporting agents: [list or "none"]
- Review agents: [list or "none"]
- Review findings: [summary of review agent output, or "review not required"]

### Modified Files
[List all files changed, with one-line description of change]

### Database Changes
[Tables, fields, migration SQL — or "none"]

### Compatibility Handling
[How old data / old API callers continue working — or "not applicable"]

### Local Testing
[npm test result / manual verification steps]

### Production Risk
[Any possible production impact — or "low / documentation only"]

### Local server / Vercel sync status
[In sync / Pending sync / Not applicable]

### Deployment Needed
[Yes / No]
```

---

## LDS-OPS-v1 Production Safety Checklist

Run this checklist mentally before accepting any task that touches `server/`, `api/`, `data/`, or `scripts/`:

- [ ] No npm packages introduced without user authorization
- [ ] `service_role_key` remains server-only (not in `web/` or API responses)
- [ ] `api/[[...route]].js` is untouched or proxy-only
- [ ] Existing API route paths are unchanged (only additions allowed)
- [ ] `data/seed.json` structure remains compatible (new fields have defaults)
- [ ] Supabase schema changes are non-destructive (`ADD COLUMN IF NOT EXISTS`)
- [ ] `npm test` passes
- [ ] Delivery summary includes local/Vercel sync status
- [ ] No production data modified without explicit user authorization
- [ ] Review agent findings addressed before task closed
