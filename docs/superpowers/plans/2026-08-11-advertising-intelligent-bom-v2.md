# Advertising Intelligent BOM V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one compatible `pvc_uv_board_v1` quotation path whose customer totals and internal costing are both derived from persisted, immutable-price-version BOM lines with a saved EUR/RSD FX snapshot.

**Architecture:** Quotes opt into V2 with `pricingEngine: "bom_v2"`; quotes without the discriminator continue through the unchanged V1 calculator and store contracts. The server resolves price versions and FX evidence, a pure calculator emits BOM rows and compatibility totals, and the store persists quote items, BOM lines, and the first FX snapshot atomically. Customer and internal outputs aggregate the same BOM rows, with server-side redaction hiding the complete BOM from users without cost permission.

**Tech Stack:** Node.js 20+ CommonJS, built-in `node:test`/`node:assert`, existing Supabase REST/RPC helpers, PostgreSQL migration SQL, vanilla HTML/CSS/JavaScript; no new packages or frontend framework.

**Design spec:** `docs/superpowers/specs/2026-08-11-advertising-intelligent-bom-v2-design.md`

## Global Constraints

- Baseline is `da9ce7c86009ac741fb1cbdea5eaf8e948b9f9b3`; do not fold unrelated branches or dirty-worktree changes into this feature.
- `advertising_quote_items` remains the finished-product container; V2 pricing truth exists only in `advertising_quote_bom_lines`.
- V2 supports only `bomTemplateCode: "pvc_uv_board_v1"` and only EUR/RSD.
- Missing `pricingEngine` means V1; no V1 quote is backfilled or reinterpreted.
- Existing API paths and V1 response fields cannot be renamed or removed.
- Price versions are append-only and carry currency, positive version number, effective date, and non-empty change reason.
- The first saved V2 FX snapshot is immutable and always means `1 EUR = rate RSD`.
- `service_role` is server-only; ordinary staff must not receive BOM rows, costs, suppliers, internal notes, price floors, markup, gross profit, or gross margin.
- Migration work is file generation plus offline/static validation only. Before any later database operation, independently prove `LDS-OPS-TEST / uidfqpksuvebsrbnlyzl` in the same session.
- Production ref `ymbwmoxydgcmawkttbgi` is permanent zero-write scope.
- Use TDD, keep each task independently reviewable, stage named files only, and make one commit per task.
- Do not run `git add .` or `git add -A`.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `server/services/advertisingBomCalculator.js` | Pure version selection, FX conversion, PVC/UV BOM generation, aggregation |
| Create | `server/services/advertisingFxSnapshot.js` | Resolve new quote rate or preserve existing snapshot |
| Create | `scripts/supabase-migrate-v14-advertising-intelligent-bom-v2.sql` | Additive price-version/BOM/FX schema and V2 RPCs |
| Create | `scripts/verify-advertising-bom-v2-target.js` | Offline Supabase URL/ref guard; no network access |
| Create | `scripts/verify-advertising-bom-v2.js` | Local automated V2 verification entry point |
| Create | `tests/advertisingBomCalculator.test.js` | Pure domain/calculation tests |
| Create | `tests/advertisingFxSnapshot.test.js` | First-snapshot and immutable-reuse tests |
| Create | `tests/advertisingBomMigration.test.js` | Static migration and target-guard tests |
| Create | `docs/runbooks/advertising-intelligent-bom-v2-test-release.md` | Test-only migration and release evidence checklist |
| Modify | `server/services/advertisingQuoteStore.js:33-82` | Local/remote version and BOM persistence with V1 compatibility |
| Modify | `server/services/advertisingSecurity.js:1-4` | Remove whole BOM collection and new sensitive fields from staff responses |
| Modify | `server/services/advertisingQuotationExportService.js:4-47` | Aggregate V2 customer/internal views from BOM lines |
| Modify | `server/services/authMiddleware.js:54-65` | Protect version-history route |
| Modify | `server/app.js:38-46,1489-1660` | Dispatch V1/V2 calculation, resolve FX, expose safe history route |
| Modify | `web/ui-labels.js:128-134` | Central V2 Chinese labels |
| Modify | `web/advertising-quote.html:34-98` | Single-product inputs, dynamic currency, read-only FX evidence |
| Modify | `web/advertising-quote.js:1-40` | V1/V2 editor branching and one-product payload |
| Modify | `web/advertising-price-library.html:15-48` | Version/effective-date controls and history region |
| Modify | `web/advertising-price-library.js:11-115` | Versioned price payload and protected history fetch |
| Modify | `web/advertising-ui.css` | Responsive V2 template, FX, and history layout |
| Modify | `tests/advertisingQuoteStore.test.js` | Local/remote V2 persistence and append-only version behavior |
| Modify | `tests/advertisingSecurity.test.js` | Staff BOM/cost/supplier redaction |
| Modify | `tests/advertisingQuotationExport.test.js` | Customer/internal same-BOM aggregation |
| Modify | `tests/api.test.js:4634-4778` | V1 regression plus V2 route, snapshot, permission, and page contracts |
| Modify | `package.json` | Add local `test:advertising-bom-v2` command only |

---

### Task 1: Pure BOM Domain Model and PVC/UV Calculation

**Files:**
- Create: `server/services/advertisingBomCalculator.js`
- Create: `tests/advertisingBomCalculator.test.js`
- Preserve unchanged: `server/services/advertisingQuotationCalculator.js`

**Interfaces:**
- Consumes: catalog objects with `materials`, `processes`, `services`, `rules`, and `priceVersions`; V2 input with one `pvc_uv_board_v1` item; explicit five-field FX snapshot.
- Produces: `selectEffectivePriceVersion(priceVersions, catalogType, catalogId, effectiveOn)`, `convertBomMoney(amount, fromCurrency, toCurrency, fxSnapshot)`, `buildPvcUvBoardBomLines({ item, catalog, quoteCurrency, effectiveOn, fxSnapshot })`, and `calculateAdvertisingBomQuotation(input, catalog, context)`.
- Error codes: `ADVERTISING_BOM_TEMPLATE_UNSUPPORTED`, `ADVERTISING_PRICE_VERSION_UNAVAILABLE`, and `ADVERTISING_FX_SNAPSHOT_INVALID`, each with `statusCode: 422`.

- [ ] **Step 1.1: Write the failing domain tests**

Create `tests/advertisingBomCalculator.test.js` with fixtures that make version/effective-date choices observable:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  selectEffectivePriceVersion,
  convertBomMoney,
  calculateAdvertisingBomQuotation,
} = require("../server/services/advertisingBomCalculator");

const fxSnapshot = {
  baseCurrency: "EUR",
  quoteCurrency: "RSD",
  rate: 117.2,
  rateDate: "2026-08-01",
  source: "LDS-OPS-TEST fixture",
};

const catalog = {
  materials: [{ id: "pvc-3", nameZh: "3mm PVC发泡板", unit: "sqm", isActive: true }],
  processes: [{ id: "uv", nameZh: "UV平板打印", unit: "sqm", supportsDoubleSide: true, isActive: true }],
  services: [
    { id: "production-labor", nameZh: "制作人工", category: "labor", unit: "hour", isActive: true },
    { id: "installation", nameZh: "安装费", category: "installation", unit: "fixed", isActive: true },
    { id: "delivery", nameZh: "配送费", category: "delivery", unit: "trip", isActive: true },
    { id: "design", nameZh: "设计费", category: "design", unit: "hour", isActive: true },
  ],
  rules: [{ materialId: "pvc-3", processId: "uv", isActive: true }],
  priceVersions: [
    { id: "PV-M-1", catalogType: "materials", catalogId: "pvc-3", versionNumber: 1, currency: "EUR", costUnitPrice: 9, saleUnitPrice: 14, minimumSaleUnitPrice: 9, minimumCharge: 0, effectiveFrom: "2026-01-01", changeReason: "initial" },
    { id: "PV-M-2", catalogType: "materials", catalogId: "pvc-3", versionNumber: 2, currency: "EUR", costUnitPrice: 10, saleUnitPrice: 16, minimumSaleUnitPrice: 10, minimumCharge: 0, effectiveFrom: "2026-08-01", changeReason: "supplier increase" },
    { id: "PV-P-1", catalogType: "processes", catalogId: "uv", versionNumber: 1, currency: "RSD", costUnitPrice: 1172, saleUnitPrice: 2344, minimumSaleUnitPrice: 0, minimumCharge: 4102, effectiveFrom: "2026-01-01", changeReason: "initial" },
    { id: "PV-L-1", catalogType: "services", catalogId: "production-labor", versionNumber: 1, currency: "EUR", costUnitPrice: 5, saleUnitPrice: 10, minimumSaleUnitPrice: 0, minimumCharge: 0, effectiveFrom: "2026-01-01", changeReason: "initial" },
    { id: "PV-I-1", catalogType: "services", catalogId: "installation", versionNumber: 1, currency: "EUR", costUnitPrice: 10, saleUnitPrice: 25, minimumSaleUnitPrice: 0, minimumCharge: 0, effectiveFrom: "2026-01-01", changeReason: "initial" },
    { id: "PV-T-1", catalogType: "services", catalogId: "delivery", versionNumber: 1, currency: "EUR", costUnitPrice: 20, saleUnitPrice: 50, minimumSaleUnitPrice: 0, minimumCharge: 0, effectiveFrom: "2026-01-01", changeReason: "initial" },
    { id: "PV-D-1", catalogType: "services", catalogId: "design", versionNumber: 1, currency: "EUR", costUnitPrice: 8, saleUnitPrice: 20, minimumSaleUnitPrice: 0, minimumCharge: 0, effectiveFrom: "2026-01-01", changeReason: "initial" },
  ],
};

function input(overrides = {}) {
  return {
    pricingEngine: "bom_v2",
    quoteDate: "2026-08-11",
    currency: "EUR",
    vatMode: "exclusive",
    vatRate: 20,
    discountPercent: 10,
    fixedDiscount: 5,
    items: [{
      id: "ADI-1",
      name: "门店 PVC UV 展板",
      bomTemplateCode: "pvc_uv_board_v1",
      width: 1000,
      height: 1000,
      sizeUnit: "mm",
      quantity: 2,
      sides: 2,
      laborHours: 1,
      installationQuantity: 1,
      transportTrips: 1,
      designHours: 1,
    }],
    ...overrides,
  };
}

test("selects the greatest effective date and version not after quote date", () => {
  assert.equal(selectEffectivePriceVersion(catalog.priceVersions, "materials", "pvc-3", "2026-07-31").id, "PV-M-1");
  assert.equal(selectEffectivePriceVersion(catalog.priceVersions, "materials", "pvc-3", "2026-08-11").id, "PV-M-2");
});

test("converts only EUR/RSD using 1 EUR = rate RSD", () => {
  assert.equal(convertBomMoney(10, "EUR", "RSD", fxSnapshot), 1172);
  assert.equal(convertBomMoney(1172, "RSD", "EUR", fxSnapshot), 10);
  assert.throws(() => convertBomMoney(10, "USD", "EUR", fxSnapshot), error => error.code === "ADVERTISING_FX_SNAPSHOT_INVALID");
});

test("builds material, process, labor, installation, transport, design, and discount BOM lines", () => {
  const result = calculateAdvertisingBomQuotation(input(), catalog, { userId: "user-1", fxSnapshot });
  assert.deepEqual(result.bomLines.map(line => line.lineType), ["material", "process", "labor", "installation", "transport", "design", "discount"]);
  assert.equal(result.bomLines[0].quantity, 2);
  assert.equal(result.bomLines[1].quantity, 4);
  assert.equal(result.bomLines[1].priceVersionId, "PV-P-1");
  assert.equal(result.fxSnapshot.rate, 117.2);
});

test("uses the UV minimum charge and never doubles material area for two sides", () => {
  const result = calculateAdvertisingBomQuotation(input({ discountPercent: 0, fixedDiscount: 0 }), catalog, { fxSnapshot });
  const material = result.bomLines.find(line => line.lineType === "material");
  const process = result.bomLines.find(line => line.lineType === "process");
  assert.equal(material.quantity, 2);
  assert.equal(process.quantity, 4);
  assert.equal(process.saleAmount, 80);
});

test("aggregates item totals from its BOM lines and VAT from the BOM subtotal", () => {
  const result = calculateAdvertisingBomQuotation(input(), catalog, { fxSnapshot });
  const positiveSale = result.bomLines.filter(line => line.lineType !== "discount").reduce((sum, line) => sum + line.saleAmount, 0);
  assert.equal(result.items[0].saleAmount, positiveSale);
  assert.equal(result.subtotalExcludingVat, result.bomLines.reduce((sum, line) => sum + line.saleAmount, 0));
  assert.equal(result.totalIncludingVat, Number((result.subtotalExcludingVat + result.vatAmount).toFixed(2)));
});

test("rejects a second item or unsupported template instead of guessing", () => {
  assert.throws(() => calculateAdvertisingBomQuotation(input({ items: [input().items[0], input().items[0]] }), catalog, { fxSnapshot }), error => error.code === "ADVERTISING_BOM_TEMPLATE_UNSUPPORTED");
  assert.throws(() => calculateAdvertisingBomQuotation(input({ items: [{ ...input().items[0], bomTemplateCode: "acrylic_letters" }] }), catalog, { fxSnapshot }), error => error.code === "ADVERTISING_BOM_TEMPLATE_UNSUPPORTED");
});
```

- [ ] **Step 1.2: Run the new test to verify RED**

Run:

```bash
node --test --test-isolation=none tests/advertisingBomCalculator.test.js
```

Expected: FAIL with `Cannot find module '../server/services/advertisingBomCalculator'`.

- [ ] **Step 1.3: Implement the pure module without I/O**

Create `server/services/advertisingBomCalculator.js`. Use deterministic helpers and return new objects; do not read environment variables, files, clocks other than `calculatedAt`, or Supabase. The core dispatch must be:

```js
function calculateAdvertisingBomQuotation(input = {}, catalog = {}, context = {}) {
  if (input.pricingEngine !== "bom_v2" || input.items?.length !== 1 || input.items[0]?.bomTemplateCode !== "pvc_uv_board_v1") {
    throw bomError("只支持单个 PVC UV 展板模板。", "ADVERTISING_BOM_TEMPLATE_UNSUPPORTED");
  }
  const fxSnapshot = validateFxSnapshot(context.fxSnapshot);
  const quoteCurrency = assertBomCurrency(input.currency || "EUR");
  const bomLines = buildPvcUvBoardBomLines({
    item: input.items[0],
    catalog,
    quoteCurrency,
    effectiveOn: input.quoteDate || new Date().toISOString().slice(0, 10),
    fxSnapshot,
  });
  const positiveSubtotal = round(bomLines.reduce((sum, line) => sum + line.saleAmount, 0));
  const discountAmount = round(Math.min(
    positiveSubtotal,
    positiveSubtotal * positive(input.discountPercent) / 100 + positive(input.fixedDiscount)
  ));
  if (discountAmount > 0) bomLines.push(buildDiscountLine(discountAmount, quoteCurrency, bomLines.length));
  return aggregateBomQuotation(input, bomLines, context, fxSnapshot);
}
```

Use `selectEffectivePriceVersion` for `pvc-3`, `uv`, `production-labor`, `installation`, `delivery`, and `design`. Generate optional service lines only when their quantity is greater than zero. For every catalog-backed line, copy `priceVersionId`, source currency/unit prices, supplier snapshot, description, and unit; compute quote-currency amounts with `convertBomMoney`.

- [ ] **Step 1.4: Run focused RED-to-GREEN verification**

Run:

```bash
node --test --test-isolation=none tests/advertisingBomCalculator.test.js tests/advertisingQuotationCalculator.test.js
node --check server/services/advertisingBomCalculator.js
```

Expected: all new tests PASS; all existing V1 calculator tests PASS; syntax check exits 0.

- [ ] **Step 1.5: Commit the pure domain slice**

```bash
git add -- server/services/advertisingBomCalculator.js tests/advertisingBomCalculator.test.js
git diff --cached --check
git commit -m "feat: add advertising BOM v2 calculator"
```

Review gate: reject the task if V1 calculator code changed, if any function performs I/O, if a catalog-backed line lacks `priceVersionId`, or if an unsupported template is accepted.

---

### Task 2: Additive Migration and Offline Target Guard

**Files:**
- Create: `scripts/supabase-migrate-v14-advertising-intelligent-bom-v2.sql`
- Create: `scripts/verify-advertising-bom-v2-target.js`
- Create: `tests/advertisingBomMigration.test.js`

**Interfaces:**
- Consumes: V13 advertising tables/RPCs and an optional `SUPABASE_URL` string for offline hostname parsing.
- Produces: `advertising_price_versions`, `advertising_quote_bom_lines`, additive quote columns, V2 save RPCs, append-only enforcement, service-role-only grants, and `assertAdvertisingBomTestTarget(url)`.
- Must not open sockets or execute SQL.

- [ ] **Step 2.1: Write static migration and target-guard tests**

Create `tests/advertisingBomMigration.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { assertAdvertisingBomTestTarget } = require("../scripts/verify-advertising-bom-v2-target");

const sqlPath = path.join(__dirname, "..", "scripts", "supabase-migrate-v14-advertising-intelligent-bom-v2.sql");

test("V14 is additive, append-only, and keeps both V1 RPCs", () => {
  const sql = fs.readFileSync(sqlPath, "utf8");
  assert.match(sql, /create table if not exists public\.advertising_price_versions/i);
  assert.match(sql, /create table if not exists public\.advertising_quote_bom_lines/i);
  assert.match(sql, /alter table public\.advertising_quotes add column if not exists pricing_engine/i);
  assert.match(sql, /alter table public\.advertising_quotes add column if not exists fx_snapshot/i);
  assert.match(sql, /prevent_advertising_price_version_mutation/i);
  assert.match(sql, /save_advertising_quote_v2/i);
  assert.match(sql, /save_advertising_catalog_entry_v2/i);
  assert.doesNotMatch(sql, /drop\s+(table|column)\b/i);
  assert.doesNotMatch(sql, /truncate\b/i);
});

test("new tables and RPCs are service-role only", () => {
  const sql = fs.readFileSync(sqlPath, "utf8");
  assert.match(sql, /revoke all on public\.advertising_price_versions from public, anon, authenticated/i);
  assert.match(sql, /revoke all on public\.advertising_quote_bom_lines from public, anon, authenticated/i);
  assert.match(sql, /grant .* on public\.advertising_price_versions.*service_role/is);
  assert.match(sql, /grant .* on public\.advertising_quote_bom_lines.*service_role/is);
  assert.match(sql, /revoke execute on function public\.save_advertising_quote_v2\(jsonb,jsonb,jsonb\) from public, anon, authenticated/i);
});

test("offline target guard accepts only LDS-OPS-TEST", () => {
  assert.equal(assertAdvertisingBomTestTarget("https://uidfqpksuvebsrbnlyzl.supabase.co"), "uidfqpksuvebsrbnlyzl");
  assert.throws(() => assertAdvertisingBomTestTarget("https://ymbwmoxydgcmawkttbgi.supabase.co"), /PRODUCTION_ZERO_WRITE/);
  assert.throws(() => assertAdvertisingBomTestTarget("https://example.supabase.co"), /TEST_PROJECT_REQUIRED/);
});
```

- [ ] **Step 2.2: Run the static tests to verify RED**

Run:

```bash
node --test --test-isolation=none tests/advertisingBomMigration.test.js
```

Expected: FAIL because both the migration and target-guard module are absent.

- [ ] **Step 2.3: Implement the offline target guard**

Create `scripts/verify-advertising-bom-v2-target.js` with no import of `supabaseClient` and no `fetch`:

```js
"use strict";

const TEST_REF = "uidfqpksuvebsrbnlyzl";
const PRODUCTION_REF = "ymbwmoxydgcmawkttbgi";

function assertAdvertisingBomTestTarget(value) {
  const hostname = new URL(String(value || "")).hostname;
  const ref = hostname.split(".")[0];
  if (ref === PRODUCTION_REF) throw new Error(`PRODUCTION_ZERO_WRITE: ${PRODUCTION_REF}`);
  if (ref !== TEST_REF) throw new Error(`TEST_PROJECT_REQUIRED: expected ${TEST_REF}, received ${ref || "empty"}`);
  return ref;
}

if (require.main === module) {
  const ref = assertAdvertisingBomTestTarget(process.env.SUPABASE_URL);
  process.stdout.write(`Verified LDS-OPS-TEST project ref: ${ref}\n`);
}

module.exports = { TEST_REF, PRODUCTION_REF, assertAdvertisingBomTestTarget };
```

- [ ] **Step 2.4: Write the additive V14 migration**

The migration header must state both refs and that the file is not self-authorizing. Implement the two tables and quote columns exactly as the design spec defines. Use checks, unique constraints, and indexes on `(catalog_type, catalog_id, effective_from desc, version_number desc)` and `(quote_id, position)`.

Add an append-only trigger:

```sql
create or replace function private.prevent_advertising_price_version_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'ADVERTISING_PRICE_VERSION_IMMUTABLE';
end
$$;

drop trigger if exists advertising_price_versions_immutable on public.advertising_price_versions;
create trigger advertising_price_versions_immutable
before update or delete on public.advertising_price_versions
for each row execute function private.prevent_advertising_price_version_mutation();
```

Seed deterministic version-1 rows for the existing material/process/service records and add `production-labor` with `on conflict do nothing`. Use `2026-01-01` as initial `effective_from`, `V1 catalog baseline` as reason, and preserve each catalog row's existing currency/prices. The new V2 RPCs must validate item ownership, line/quote IDs, allowed line types/currencies, price-version references, and immutable FX behavior inside the transaction.

Apply minimum grants:

```sql
alter table public.advertising_price_versions enable row level security;
alter table public.advertising_quote_bom_lines enable row level security;
revoke all on public.advertising_price_versions from public, anon, authenticated;
revoke all on public.advertising_quote_bom_lines from public, anon, authenticated;
grant select, insert on public.advertising_price_versions to service_role;
grant select, insert, update, delete on public.advertising_quote_bom_lines to service_role;
revoke execute on function public.save_advertising_quote_v2(jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_advertising_quote_v2(jsonb,jsonb,jsonb) to service_role;
revoke execute on function public.save_advertising_catalog_entry_v2(text,jsonb,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.save_advertising_catalog_entry_v2(text,jsonb,jsonb,uuid) to service_role;
```

Do not execute the migration.

- [ ] **Step 2.5: Run static RED-to-GREEN verification**

Run:

```bash
node --test --test-isolation=none tests/advertisingBomMigration.test.js
node --check scripts/verify-advertising-bom-v2-target.js
SUPABASE_URL=https://uidfqpksuvebsrbnlyzl.supabase.co node scripts/verify-advertising-bom-v2-target.js
```

Expected: tests PASS, syntax check exits 0, and the guard prints only the verified test ref. Also run the production refusal locally:

```bash
SUPABASE_URL=https://ymbwmoxydgcmawkttbgi.supabase.co node scripts/verify-advertising-bom-v2-target.js
```

Expected: non-zero exit with `PRODUCTION_ZERO_WRITE`; no network request occurs.

- [ ] **Step 2.6: Commit migration artifacts only**

```bash
git add -- scripts/supabase-migrate-v14-advertising-intelligent-bom-v2.sql scripts/verify-advertising-bom-v2-target.js tests/advertisingBomMigration.test.js
git diff --cached --check
git commit -m "feat: add reviewable advertising BOM v2 migration"
```

Review gate: inspect the SQL manually and reject on destructive DDL, authenticated access to either new table/RPC, mutable price versions, missing V1 RPC preservation, or any evidence that a real database command ran.

---

### Task 3: Store Compatibility, BOM Persistence, and Price Version Creation

**Files:**
- Modify: `server/services/advertisingQuoteStore.js:33-82`
- Modify: `tests/advertisingQuoteStore.test.js`

**Interfaces:**
- Consumes: V1 quote/catalog data, V2 `bomLines` and `fxSnapshot`, Supabase V2 RPCs.
- Preserves: all eight existing store methods and their current call signatures.
- Adds: `listPriceVersions({ catalogType, catalogId })` and `saveCatalogPriceVersion(kind, payload, id, userId)`.
- `getQuote(id)` returns `pricingEngine`, `fxSnapshot`, and `bomLines` for V2; V1 return shape remains compatible.

- [ ] **Step 3.1: Add failing local and remote store tests**

Append tests that prove V1 absence is tolerated and V2 evidence is round-tripped:

```js
test("old local quotes remain legacy V1 without BOM fields", async () => {
  const data = { advertisingQuotes: [{ id: "A1", quoteNumber: "LDS-ADV-2026-0001", items: [] }] };
  const store = createAdvertisingQuoteStore({ data, saveData: () => {}, supabaseConfig: { enabled: false } });
  const quote = await store.getQuote("A1");
  assert.equal(quote.pricingEngine, undefined);
  assert.equal(quote.bomLines, undefined);
});

test("local V2 save persists BOM lines and the first FX snapshot", async () => {
  const data = {};
  const store = createAdvertisingQuoteStore({ data, saveData: () => {}, supabaseConfig: { enabled: false } });
  const fxSnapshot = { baseCurrency: "EUR", quoteCurrency: "RSD", rate: 117.2, rateDate: "2026-08-01", source: "test" };
  const first = await store.saveQuote({ pricingEngine: "bom_v2", clientName: "Client", projectName: "PVC", entityId: "lds", items: [{ id: "I1" }], bomLines: [{ id: "B1", quoteItemId: "I1", lineType: "material", saleAmount: 16 }], fxSnapshot, calculationSnapshot: { totalIncludingVat: 16 } });
  const second = await store.saveQuote({ ...first, fxSnapshot: { ...fxSnapshot, rate: 120 }, bomLines: first.bomLines });
  assert.deepEqual(second.fxSnapshot, fxSnapshot);
  assert.deepEqual((await store.getQuote(first.id)).bomLines.map(line => line.id), ["B1"]);
});

test("remote V2 save uses the V2 RPC and remote read fetches BOM rows", async (t) => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push([String(url), options]);
    if (String(url).includes("/rpc/save_advertising_quote_v2")) return new Response(JSON.stringify({ id: "A2", quote_number: "LDS-ADV-2026-0002", pricing_engine: "bom_v2", fx_snapshot: { rate: 117.2 }, data: { items: [{ id: "I1" }] } }), { status: 200 });
    if (String(url).includes("advertising_quotes?")) return new Response(JSON.stringify([{ id: "A2", quote_number: "LDS-ADV-2026-0002", pricing_engine: "bom_v2", fx_snapshot: { rate: 117.2 }, data: { items: [{ id: "I1" }] } }]), { status: 200 });
    if (String(url).includes("advertising_quote_bom_lines?")) return new Response(JSON.stringify([{ id: "B1", quote_id: "A2", quote_item_id: "I1", line_type: "material", sale_amount: 16 }]), { status: 200 });
    return new Response("[]", { status: 200 });
  };
  t.after(() => { global.fetch = originalFetch; });
  const store = createAdvertisingQuoteStore({ data: {}, saveData: () => assert.fail("must not write local"), supabaseConfig: { enabled: true, url: "https://example.supabase.co", serviceRoleKey: "server-secret" } });
  await store.saveQuote({ pricingEngine: "bom_v2", bomLines: [{ id: "B1" }], fxSnapshot: { rate: 117.2 } });
  const quote = await store.getQuote("A2");
  assert.equal(quote.bomLines[0].lineType, "material");
  assert.ok(requests.some(([url]) => url.includes("/rpc/save_advertising_quote_v2")));
});

test("catalog price change appends a version with reason instead of overwriting price JSON", async () => {
  const data = {};
  const store = createAdvertisingQuoteStore({ data, saveData: () => {}, supabaseConfig: { enabled: false } });
  const before = await store.listPriceVersions({ catalogType: "materials", catalogId: "pvc-3" });
  const result = await store.updateCatalog("materials", { suggestedSalePrice: 17, currency: "EUR", effectiveFrom: "2026-09-01", adjustmentReason: "supplier increase" }, "pvc-3", "11111111-1111-1111-1111-111111111111");
  const after = await store.listPriceVersions({ catalogType: "materials", catalogId: "pvc-3" });
  assert.equal(after.length, before.length + 1);
  assert.equal(after[0].versionNumber, before[0].versionNumber + 1);
  assert.equal(after[0].changeReason, "supplier increase");
  assert.equal(result.activePriceVersion.id, after[0].id);
});
```

- [ ] **Step 3.2: Run store tests to verify RED**

Run:

```bash
node --test --test-isolation=none tests/advertisingQuoteStore.test.js
```

Expected: FAIL because `listPriceVersions`, V2 RPC dispatch, BOM normalization, and first-snapshot preservation do not exist.

- [ ] **Step 3.3: Add local version/BOM defaults and normalizers**

In `ensureAdvertisingData`, initialize missing arrays without rewriting old quote objects. Generate deterministic version-1 local seeds only when `advertisingPriceVersions` is absent:

```js
function buildInitialPriceVersions(data) {
  return [
    ...data.advertisingMaterials.map(item => priceVersionFromCatalog("materials", item)),
    ...data.advertisingProcesses.map(item => priceVersionFromCatalog("processes", item)),
    ...data.advertisingServiceCatalog.map(item => priceVersionFromCatalog("services", item)),
  ];
}

if (!Array.isArray(data.advertisingPriceVersions)) data.advertisingPriceVersions = buildInitialPriceVersions(data);
if (!Array.isArray(data.advertisingQuoteBomLines)) data.advertisingQuoteBomLines = [];
```

Add snake/camel normalizers for price versions and BOM rows. Extend `remoteQuoteRow(row, bomLines = undefined)` with:

```js
pricingEngine: row.pricing_engine || row.data?.pricingEngine,
fxSnapshot: row.fx_snapshot || row.data?.fxSnapshot,
...(bomLines === undefined ? {} : { bomLines }),
```

- [ ] **Step 3.4: Add V2 save/read and append-only catalog behavior**

Dispatch `saveQuote` by discriminator:

```js
if (remote && payload.pricingEngine === "bom_v2") {
  const { bomLines = [], fxSnapshot = {}, ...quotePayload } = payload;
  const result = await supabaseRequest(supabaseConfig, "rpc/save_advertising_quote_v2", {
    method: "POST",
    body: JSON.stringify({ p_quote: quotePayload, p_bom_lines: bomLines, p_fx_snapshot: fxSnapshot }),
  });
  return remoteQuoteRow(Array.isArray(result) ? result[0] : result, bomLines);
}
```

For local updates, preserve `existing.fxSnapshot` when present and replace only that quote's rows in `data.advertisingQuoteBomLines`. For remote `getQuote`, fetch the quote first and fetch `advertising_quote_bom_lines?select=*&quote_id=eq.<id>&order=position` only when `pricing_engine` is `bom_v2`.

Implement version methods:

```js
async listPriceVersions({ catalogType, catalogId } = {})
async saveCatalogPriceVersion(kind, payload, id, userId)
```

Local creation computes `versionNumber = max + 1`, requires `adjustmentReason`, and pushes a new row; it never mutates an existing version. Remote creation calls `rpc/save_advertising_catalog_entry_v2`. `catalog()` overlays the effective version onto existing flattened fields as `costPrice`, `suggestedSalePrice`, `minimumSalePrice`, `defaultMinimumFee`, `currency`, `effectiveFrom`, and `activePriceVersion` so current consumers continue working.

- [ ] **Step 3.5: Run store RED-to-GREEN and regression verification**

Run:

```bash
node --test --test-isolation=none tests/advertisingQuoteStore.test.js tests/advertisingQuotationCalculator.test.js
node --check server/services/advertisingQuoteStore.js
```

Expected: all store and V1 calculator tests PASS; syntax check exits 0; the existing test `configured Supabase failure is surfaced and never falls back locally` remains green.

- [ ] **Step 3.6: Commit the store slice**

```bash
git add -- server/services/advertisingQuoteStore.js tests/advertisingQuoteStore.test.js
git diff --cached --check
git commit -m "feat: persist advertising BOM and price versions"
```

Review gate: reject if `listQuotes()` starts fetching BOM details, if a Supabase failure falls back to JSON, if an old quote is rewritten, if the second save replaces FX evidence, or if a protected catalog price mutates an old version.

---

### Task 4: FX Resolution, API Dispatch, Permissions, Redaction, and Exports

**Files:**
- Create: `server/services/advertisingFxSnapshot.js`
- Create: `tests/advertisingFxSnapshot.test.js`
- Modify: `server/app.js:38-46,1489-1660`
- Modify: `server/services/authMiddleware.js:54-65`
- Modify: `server/services/advertisingSecurity.js:1-4`
- Modify: `server/services/advertisingQuotationExportService.js:4-47`
- Modify: `tests/advertisingSecurity.test.js`
- Modify: `tests/advertisingQuotationExport.test.js`
- Modify: `tests/api.test.js:4653-4778`

**Interfaces:**
- Consumes: `exchangeRateStore.getLatestExchangeRate`, existing auth context/permissions, V1/V2 calculators, store methods.
- Produces: `resolveAdvertisingFxSnapshot({ pricingEngine, existingQuote, supabaseConfig, effectiveOn })`; V2 dispatch on existing routes; protected `GET /api/advertising/price-versions`; V2 customer/internal projections.
- Preserves: V1 API calculations, ownership checks, current route paths, and existing error sanitizer.

- [ ] **Step 4.1: Write failing FX unit tests**

Create `tests/advertisingFxSnapshot.test.js` and inject the rate lookup to keep it pure at the boundary:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveAdvertisingFxSnapshot } = require("../server/services/advertisingFxSnapshot");

test("V1 does not request an exchange rate", async () => {
  let called = false;
  const result = await resolveAdvertisingFxSnapshot({ pricingEngine: "legacy_v1", getLatestRate: async () => { called = true; } });
  assert.equal(result, null);
  assert.equal(called, false);
});

test("existing V2 quote reuses its saved snapshot", async () => {
  const saved = { baseCurrency: "EUR", quoteCurrency: "RSD", rate: 117.2, rateDate: "2026-08-01", source: "saved" };
  const result = await resolveAdvertisingFxSnapshot({ pricingEngine: "bom_v2", existingQuote: { fxSnapshot: saved }, getLatestRate: async () => assert.fail("must not read global rate") });
  assert.deepEqual(result, saved);
  assert.notEqual(result, saved);
});

test("new V2 quote normalizes the latest EUR/RSD rate", async () => {
  const result = await resolveAdvertisingFxSnapshot({ pricingEngine: "bom_v2", effectiveOn: "2026-08-11", getLatestRate: async (base, quote, date) => ({ baseCurrency: base, quoteCurrency: quote, rate: 117.3, rateDate: date, source: "manual" }) });
  assert.deepEqual(result, { baseCurrency: "EUR", quoteCurrency: "RSD", rate: 117.3, rateDate: "2026-08-11", source: "manual" });
});

test("missing rate fails with 422", async () => {
  await assert.rejects(() => resolveAdvertisingFxSnapshot({ pricingEngine: "bom_v2", getLatestRate: async () => null }), error => error.statusCode === 422 && error.code === "NO_EXCHANGE_RATE");
});
```

- [ ] **Step 4.2: Add failing API, redaction, and export tests**

Append these assertions to the relevant existing test files:

```js
test("staff response removes the complete V2 BOM collection", () => {
  const input = { bomLines: [{ saleAmount: 20, costAmount: 10, supplierSnapshot: { name: "EMA" }, internalNotes: "secret" }], calculationSnapshot: { items: [{ saleAmount: 20 }] } };
  assert.deepEqual(sanitizeAdvertisingPayload(input, false), { calculationSnapshot: { items: [{ saleAmount: 20 }] } });
});
```

```js
test("V2 customer and internal views aggregate the same BOM", () => {
  const v2 = {
    ...quote,
    pricingEngine: "bom_v2",
    bomLines: [
      { id: "B1", quoteItemId: "i1", lineType: "material", saleAmount: 30, costAmount: 10, priceVersionId: "PV1", supplierSnapshot: { name: "EMA" } },
      { id: "B2", quoteItemId: "i1", lineType: "process", saleAmount: 20, costAmount: 8, priceVersionId: "PV2" },
      { id: "B3", quoteItemId: null, lineType: "discount", saleAmount: -5, costAmount: 0 },
    ],
    calculationSnapshot: { subtotalExcludingVat: 45, totalIncludingVat: 45 },
  };
  const customer = buildAdvertisingCustomerView(v2);
  const internal = buildAdvertisingCustomerView(v2, { internal: true });
  assert.equal(customer.projectGroups[0].items[0].salesSubtotal, 50);
  assert.equal(customer.totalSales, 45);
  assert.doesNotMatch(JSON.stringify(customer), /PV1|supplierSnapshot|costAmount/);
  assert.equal(internal.internalBomLines.length, 3);
  assert.equal(internal.totalSales, customer.totalSales);
});
```

In `tests/api.test.js`, extend the existing advertising API block with a V2 payload, assert `pricingEngine`, `fxSnapshot.rate/date/source`, persisted BOM aggregation, and a second update after changing the seed global exchange rate. The second response must retain the first snapshot. Add unauthenticated and insufficient-permission checks for `/api/advertising/price-versions` and assert that a staff response lacks the JSON key `bomLines`.

- [ ] **Step 4.3: Run the new tests to verify RED**

Run:

```bash
node --test --test-isolation=none tests/advertisingFxSnapshot.test.js tests/advertisingSecurity.test.js tests/advertisingQuotationExport.test.js tests/api.test.js
```

Expected: FAIL because FX resolver, V2 route dispatch, full-BOM redaction, and V2 export aggregation are absent.

- [ ] **Step 4.4: Implement FX resolution with dependency injection**

Create `server/services/advertisingFxSnapshot.js`:

```js
"use strict";
const exchangeRateStore = require("./exchangeRateStore");

async function resolveAdvertisingFxSnapshot({ pricingEngine, existingQuote = null, supabaseConfig = {}, effectiveOn, getLatestRate } = {}) {
  if (pricingEngine !== "bom_v2") return null;
  if (existingQuote?.fxSnapshot?.rate) return structuredClone(existingQuote.fxSnapshot);
  const lookup = getLatestRate || ((base, quote, date) => exchangeRateStore.getLatestExchangeRate(supabaseConfig, base, quote, date));
  const rate = await lookup("EUR", "RSD", effectiveOn);
  if (!rate || !(Number(rate.rate) > 0)) throw Object.assign(new Error("未找到 EUR/RSD 汇率。"), { statusCode: 422, code: "NO_EXCHANGE_RATE" });
  return { baseCurrency: "EUR", quoteCurrency: "RSD", rate: Number(rate.rate), rateDate: rate.rateDate, source: rate.source };
}

module.exports = { resolveAdvertisingFxSnapshot };
```

- [ ] **Step 4.5: Add safe server V2 dispatch**

Import the V2 calculator and FX resolver in `server/app.js`. Create one helper inside `handleApi` that strips server-owned fields and dispatches:

```js
const calculateAdvertisingByEngine = async (body, catalog, existingQuote = null) => {
  if (body?.pricingEngine !== "bom_v2") {
    return { calculationSnapshot: calculateAdvertisingQuotation(body, catalog, { userId: authCtx.userId }), fxSnapshot: null, bomLines: null };
  }
  const { bomLines, calculationSnapshot, fxSnapshot, supplierSnapshot, internalNotes, ...allowedBody } = body;
  const resolvedFx = await resolveAdvertisingFxSnapshot({
    pricingEngine: "bom_v2",
    existingQuote,
    supabaseConfig: getSupabaseConfig(),
    effectiveOn: allowedBody.quoteDate || new Date().toISOString().slice(0, 10),
  });
  const calculated = calculateAdvertisingBomQuotation(allowedBody, catalog, { userId: authCtx.userId, fxSnapshot: resolvedFx });
  return { calculationSnapshot: calculated, fxSnapshot: resolvedFx, bomLines: calculated.bomLines };
};
```

Use this helper in POST calculate, POST create, PUT update, POST `:id/calculate`, and duplicate. For update, load and ownership-check the existing quote before calculation. For duplicate, delete the source `fxSnapshot`, `bomLines`, `id`, and `quoteNumber` before resolving the new snapshot.

Add the version-history handler and require management permission both in `ROUTE_PERMISSION_MAP` and handler:

```js
if (request.method === "GET" && url.pathname === "/api/advertising/price-versions") {
  requirePermission(authCtx, "advertising_catalog.manage");
  const catalogType = url.searchParams.get("catalogType");
  const catalogId = url.searchParams.get("catalogId");
  if (!new Set(["materials", "processes", "services"]).has(catalogType) || !catalogId) {
    throw Object.assign(new Error("catalogType 和 catalogId 无效。"), { statusCode: 400, code: "ADVERTISING_PRICE_VERSION_QUERY_INVALID" });
  }
  sendJson(response, 200, sanitizeAdvertising(await advertisingStore.listPriceVersions({ catalogType, catalogId })));
  return true;
}
```

- [ ] **Step 4.6: Harden redaction and derive both views from BOM**

In `advertisingSecurity.js`, make `bomLines` sensitive as a complete collection for non-cost users while retaining the recursive field filter:

```js
return normalized === "bomlines" || normalized.includes("cost") || normalized.includes("supplier") || normalized.startsWith("internal") || /* existing rules */ false;
```

In `buildAdvertisingCustomerView`, preserve the exact V1 branch. For V2, group sale lines by `quoteItemId`; customer output gets only finished-product sums and customer-visible quote-level adjustments. When `internal` is true, add `internalBomLines: quote.bomLines.map(...)` without changing `totalSales`.

- [ ] **Step 4.7: Run focused RED-to-GREEN verification**

Run:

```bash
node --test --test-isolation=none tests/advertisingFxSnapshot.test.js tests/advertisingSecurity.test.js tests/advertisingQuotationExport.test.js tests/advertisingQuoteStore.test.js tests/api.test.js
node --check server/services/advertisingFxSnapshot.js
node --check server/services/advertisingSecurity.js
node --check server/services/advertisingQuotationExportService.js
node --check server/services/authMiddleware.js
node --check server/app.js
```

Expected: all listed tests PASS and all syntax checks exit 0. Specifically confirm the original V1 API test `advertising quotation API calculates, saves, reopens and lists quotes` still passes unchanged.

- [ ] **Step 4.8: Commit server/API/security slice**

```bash
git add -- server/services/advertisingFxSnapshot.js server/app.js server/services/authMiddleware.js server/services/advertisingSecurity.js server/services/advertisingQuotationExportService.js tests/advertisingFxSnapshot.test.js tests/advertisingSecurity.test.js tests/advertisingQuotationExport.test.js tests/api.test.js
git diff --cached --check
git commit -m "feat: expose secure advertising BOM v2 API"
```

Review gate: reject if a client-supplied FX/cost/price-version value reaches calculation, if a non-cost user receives `bomLines`, if the new GET route uses `advertising_quote.view`, if a duplicate reuses its source FX snapshot, or if V1 requests call the new rate resolver.

---

### Task 5: One-Product Quote UI and Versioned Price Library

**Files:**
- Modify: `web/ui-labels.js:128-134`
- Modify: `web/advertising-quote.html:34-98`
- Modify: `web/advertising-quote.js:1-40`
- Modify: `web/advertising-price-library.html:15-48`
- Modify: `web/advertising-price-library.js:11-115`
- Modify: `web/advertising-ui.css`
- Modify: `tests/api.test.js:4634-4650`

**Interfaces:**
- Consumes: current catalog route with flattened active prices, V2 calculate/save routes, version-history route, `window.AppUi.advertising` labels.
- Produces: one `pvc_uv_board_v1` item payload, EUR/RSD selection, service quantities, read-only saved FX evidence, active-version fields, and protected version history.
- Preserves: V1 quote edit behavior for quotes lacking `pricingEngine` and current HTML route names.

- [ ] **Step 5.1: Extend the page contract test first**

In `tests/api.test.js`, extend `advertising quotation pages and navigation entry are served`:

```js
const editorHtml = await (await publicFetch(port, "/advertising-quote.html")).text();
assert.match(editorHtml, /adv-pricing-engine/);
assert.match(editorHtml, /adv-fx-snapshot/);
assert.match(editorHtml, /laborHours/);
assert.match(editorHtml, /transportTrips/);
assert.match(editorHtml, /designHours/);
assert.match(editorHtml, /name="currency"/);

const libraryHtml = await (await publicFetch(port, "/advertising-price-library.html")).text();
assert.match(libraryHtml, /adv-version-history/);
const libraryJs = await (await publicFetch(port, "/advertising-price-library.js")).text();
assert.match(libraryJs, /\/api\/advertising\/price-versions/);
assert.match(libraryJs, /effectiveFrom/);
assert.match(libraryJs, /adjustmentReason/);
```

- [ ] **Step 5.2: Run the page test to verify RED**

Run:

```bash
node --test --test-isolation=none --test-name-pattern="advertising quotation pages" tests/api.test.js
```

Expected: FAIL on the first missing V2 marker.

- [ ] **Step 5.3: Add central labels and semantic HTML**

Extend `window.AppUi.advertising` with exact keys:

```js
bomV2: "智能 BOM V2",
pvcUvBoard: "PVC UV 展板",
laborHours: "制作人工（小时）",
installationQuantity: "安装数量",
transportTrips: "运输趟数",
designHours: "设计工时",
fxSnapshot: "汇率快照",
priceVersion: "价格版本",
effectiveFrom: "生效日期",
versionHistory: "版本历史",
```

In `advertising-quote.html`, add hidden `#adv-pricing-engine`, a currency select with EUR/RSD, one template panel with inputs named `laborHours`, `installationQuantity`, `transportTrips`, and `designHours`, and a read-only `#adv-fx-snapshot`. Keep the current V1 product list markup available under a separate `#adv-v1-editor` container; add `#adv-v2-editor` for the one-product form.

In the price-library dialog, add currency and `effectiveFrom` fields to material/process/service definitions and add `<section id="adv-version-history">` outside the editable fields.

- [ ] **Step 5.4: Implement V1/V2 editor branching**

After the quote/catalog load resolves:

```js
const isV2 = quote.id ? quote.pricingEngine === "bom_v2" : true;
document.querySelector("#adv-pricing-engine").value = isV2 ? "bom_v2" : "legacy_v1";
document.querySelector("#adv-v2-editor").classList.toggle("hidden", !isV2);
document.querySelector("#adv-v1-editor").classList.toggle("hidden", isV2);
```

Build the V2 payload from allowed user inputs only:

```js
function v2Payload() {
  return {
    ...basePayload(),
    pricingEngine: "bom_v2",
    currency: form.elements.currency.value,
    items: [{
      id: quote.items?.[0]?.id || uid("ADI"),
      name: form.elements.productName.value,
      nameEn: form.elements.productNameEn.value,
      bomTemplateCode: "pvc_uv_board_v1",
      width: Number(form.elements.width.value),
      height: Number(form.elements.height.value),
      sizeUnit: form.elements.sizeUnit.value,
      quantity: Number(form.elements.quantity.value),
      sides: Number(form.elements.sides.value),
      laborHours: Number(form.elements.laborHours.value),
      installationQuantity: Number(form.elements.installationQuantity.value),
      transportTrips: Number(form.elements.transportTrips.value),
      designHours: Number(form.elements.designHours.value),
      notes: form.elements.notes.value,
    }],
  };
}
```

Do not put `bomLines`, prices, cost, suppliers, price-version IDs, or `fxSnapshot` into the browser payload. Render snapshot evidence only from the saved response. Replace every fixed `EUR` summary suffix with `result.quoteCurrency || form.elements.currency.value`.

- [ ] **Step 5.5: Implement version creation and history display**

For materials/processes/services, include `currency`, `effectiveFrom`, and protected price fields in the existing PUT payload. Keep `adjustmentReason` mandatory. When opening an existing record, fetch:

```js
const params = new URLSearchParams({ catalogType: tab, catalogId: row.id });
const response = await fetch(`/api/advertising/price-versions?${params}`, { headers: headers() });
```

Render version number, currency, effective date, reason, and only the price fields present in the sanitized response. Do not infer hidden costs or show a blank cost column to users whose response omits it.

- [ ] **Step 5.6: Add responsive and keyboard-safe styles**

Add focused rules under existing `.adv-` namespaces for the template grid, snapshot card, and history table. At widths at or below 768px use one-column inputs; at 390px ensure dialogs and tables stay within the viewport. Keep native labels, buttons, fieldsets, dialog focus, and tab keyboard behavior; do not replace them with click-only elements.

- [ ] **Step 5.7: Run page and syntax GREEN checks**

Run:

```bash
node --test --test-isolation=none --test-name-pattern="advertising quotation pages|advertising quotation API" tests/api.test.js
node --check web/advertising-quote.js
node --check web/advertising-price-library.js
```

Expected: both advertising page/API tests PASS and both scripts pass syntax checks.

- [ ] **Step 5.8: Perform browser acceptance before commit**

Start the local server with local JSON persistence, then verify:

1. New PVC/UV V2 quote at 1440×900, 768×1024, and 390×844.
2. EUR and RSD summaries use the selected currency.
3. Saved FX evidence shows rate, date, and source; changing the global seed rate and reopening does not change it.
4. A V1 quote without `pricingEngine` still shows the V1 material/process editor and saves through the V1 path.
5. Price change requires reason and creates a visible higher version; a future effective date does not become active early.
6. Tab/Shift+Tab reaches all fields, calculate/save, price tabs, history, and export; arrow keys still operate price-library tabs.
7. No horizontal page overflow at 390 px.

Record screenshots and console/network observations outside the repository; do not stage browser artifacts.

- [ ] **Step 5.9: Commit the UI slice**

```bash
git add -- web/ui-labels.js web/advertising-quote.html web/advertising-quote.js web/advertising-price-library.html web/advertising-price-library.js web/advertising-ui.css tests/api.test.js
git diff --cached --check
git commit -m "feat: add advertising BOM v2 quote workflow"
```

Review gate: reject if a new string bypasses `ui-labels.js`, if a V1 quote is forced into V2, if any server-owned pricing evidence is submitted by the browser, if fixed EUR labels remain in V2 totals, or if the 390 px view overflows.

---

### Task 6: Full Verification and Test-Only Release Preparation

**Files:**
- Create: `scripts/verify-advertising-bom-v2.js`
- Create: `docs/runbooks/advertising-intelligent-bom-v2-test-release.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: completed V2 implementation and existing Node test runner.
- Produces: `npm run test:advertising-bom-v2` and a runbook that cannot be mistaken for production authorization.
- Does not connect to Supabase, deploy, push, or mutate environment variables.

- [ ] **Step 6.1: Verify the release command is RED before adding it**

Run:

```bash
npm run test:advertising-bom-v2
```

Expected: FAIL with `Missing script: "test:advertising-bom-v2"`.

- [ ] **Step 6.2: Create the local verifier**

Create `scripts/verify-advertising-bom-v2.js` using `node:child_process.spawnSync`. It must run these files in one shared-process test command and exit with that command's status:

```js
"use strict";
const { spawnSync } = require("node:child_process");

const files = [
  "tests/advertisingBomCalculator.test.js",
  "tests/advertisingBomMigration.test.js",
  "tests/advertisingFxSnapshot.test.js",
  "tests/advertisingQuotationCalculator.test.js",
  "tests/advertisingQuoteStore.test.js",
  "tests/advertisingSecurity.test.js",
  "tests/advertisingQuotationExport.test.js",
  "tests/api.test.js",
];
const result = spawnSync(process.execPath, ["--test", "--test-isolation=none", ...files], { stdio: "inherit" });
process.exit(result.status == null ? 1 : result.status);
```

Add to `package.json` scripts:

```json
"test:advertising-bom-v2": "node scripts/verify-advertising-bom-v2.js"
```

- [ ] **Step 6.3: Write the test-release runbook**

Create `docs/runbooks/advertising-intelligent-bom-v2-test-release.md` with these mandatory sections and exact decisions:

1. Baseline/commit evidence and clean-worktree check.
2. `npm run test:advertising-bom-v2`, `npm test`, `git diff --check`, and sensitive-value scan commands.
3. Browser matrix: 1440×900, 768×1024, 390×844, keyboard, overflow, EUR/RSD, V1 reopen, customer/internal export.
4. Static migration review: additive DDL, append-only trigger, V1 RPCs preserved, RLS/grants, rollback requires backup and reverse-order removal only in LDS-OPS-TEST.
5. Hard gate: run `scripts/verify-advertising-bom-v2-target.js`, then independently verify project name/ref in the same session.
6. Authorized test target: `LDS-OPS-TEST / uidfqpksuvebsrbnlyzl`.
7. Permanent zero-write target: production `ymbwmoxydgcmawkttbgi`.
8. State explicitly that completing the runbook does not authorize migration, Preview environment changes, deployment, promotion, or production writes.

- [ ] **Step 6.4: Run focused GREEN and full regression suite**

Run:

```bash
npm run test:advertising-bom-v2
npm test
git diff --check
rg -n "SUPABASE_SERVICE_ROLE_KEY|serviceRoleKey|ymbwmoxydgcmawkttbgi" web api
```

Expected:

- Focused V2 suite PASS.
- Full suite PASS with zero failures, skips, cancellations, or unfinished tests.
- `git diff --check` produces no output.
- Sensitive scan finds no service-role secret reference in `web/`; any existing server-side `serviceRoleKey` reference in `api/` must remain proxy/config behavior and must not contain a literal key. The production ref must not appear in executable browser/API code.

- [ ] **Step 6.5: Re-run browser and export acceptance against the final tree**

Repeat Task 5's matrix after the full suite. Additionally compare one V2 customer's detail-row sum plus discount/VAT to `totalIncludingVat`, and compare the internal BOM sale sum to the same subtotal. Any mismatch blocks release preparation.

- [ ] **Step 6.6: Review commit boundaries and prepare the test-only handoff**

Run:

```bash
git log --oneline --decorate -6
git status --short
git diff --stat da9ce7c..HEAD
```

Expected: one focused commit per completed task, no screenshots/temp files/secrets, and only planned files in the diff. Do not push.

- [ ] **Step 6.7: Commit verification tooling and runbook**

```bash
git add -- scripts/verify-advertising-bom-v2.js docs/runbooks/advertising-intelligent-bom-v2-test-release.md package.json
git diff --cached --check
git commit -m "docs: add advertising BOM v2 test release gate"
```

Review gate: reject if the verifier can write a database, if the runbook implies production authorization, if full tests or browser checks are incomplete, or if the target-ref gate can accept any ref other than `uidfqpksuvebsrbnlyzl`.

---

## Final Implementation Review Checklist

- [ ] `pricingEngine` absent still selects V1 in calculate, create, update, duplicate, read, list, and export paths.
- [ ] `pvc_uv_board_v1` is the only accepted V2 template and accepts exactly one item.
- [ ] Customer finished-product totals, internal BOM totals, and compatibility snapshot totals reconcile from the same BOM lines.
- [ ] Every catalog-backed BOM line references an immutable price version; discount is the only first-slice line without one.
- [ ] Price changes append a new version with currency, effective date, version number, reason, and actor.
- [ ] Existing price-version rows cannot be updated or deleted.
- [ ] Saved FX `{rate, rateDate, source}` survives global-rate changes and quote recalculation.
- [ ] Duplicate V2 quotations resolve a new snapshot.
- [ ] Ordinary staff receive no `bomLines` key and no sensitive nested variants.
- [ ] Cost-authorized internal export is clearly marked and uses persisted BOM evidence.
- [ ] Migration is additive, repeatable, statically tested, and not executed.
- [ ] Only LDS-OPS-TEST ref `uidfqpksuvebsrbnlyzl` can pass the offline guard; production `ymbwmoxydgcmawkttbgi` fails closed.
- [ ] Focused suite, full `npm test`, syntax checks, browser matrix, overflow, keyboard, and export reconciliation all pass.
- [ ] No database, environment, deployment, promotion, push, or production write occurred during implementation.
