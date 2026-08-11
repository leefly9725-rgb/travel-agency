# Advertising Intelligent BOM V2 Design

**Date:** 2026-08-11
**Status:** Approved for implementation planning
**Baseline:** `da9ce7c86009ac741fb1cbdea5eaf8e948b9f9b3` (`codex/intelligent-bom-v2`)
**Scope:** One end-to-end `pvc_uv_board_v1` BOM quotation path, append-only price versions, quote-level EUR/RSD FX snapshots, V1 read/API compatibility, and reviewable test-only migration preparation.

---

## Problem

Advertising quotation V1 stores catalog prices in each catalog row's `data jsonb`, calculates from `items`, `processes`, and `additionalFees`, and saves the result in `calculation_snapshot`. The Supabase `save_advertising_quote` RPC deletes and rebuilds item and fee rows on every save. This works for V1 quotations, but it cannot prove which immutable catalog price version was used, and it does not persist quote-level EUR/RSD exchange-rate evidence.

V2 must establish one pricing truth without replacing the working V1 UI and API. `advertising_quote_items` remains the customer-understandable finished-product container. `advertising_quote_bom_lines` becomes the only pricing source for quotations explicitly marked `pricingEngine: "bom_v2"`. `calculationSnapshot` remains a derived, read-only compatibility projection; it is not independently editable.

## Current Contracts That Must Remain Stable

- `calculateAdvertisingQuotation(input, catalog, context)` remains the V1 calculator and remains the default when `pricingEngine` is absent.
- `createAdvertisingQuoteStore({ data, saveData, supabaseConfig })` continues to expose `catalog`, `listQuotes`, `getQuote`, `saveQuote`, `duplicate`, `deleteQuote`, `updateCatalog`, and `listAdjustmentLogs`.
- Existing routes remain available with their current methods and paths:
  - `GET /api/advertising/catalog`
  - `GET /api/advertising/{materials|processes|rules|services|entities}`
  - `GET /api/advertising/quotes`
  - `GET /api/advertising/quotes/:id`
  - `POST /api/advertising/quotes/calculate`
  - `POST /api/advertising/quotes`
  - `PUT /api/advertising/quotes/:id`
  - `POST /api/advertising/quotes/:id/calculate`
  - `POST /api/advertising/quotes/:id/duplicate`
  - `POST /api/advertising/quotes/:id/export/docx`
- Existing V1 quotations that have no `pricingEngine` or have no BOM rows are read and rendered exactly as V1 quotations.
- Existing response fields remain. V2 adds fields but does not rename or remove V1 fields.

## Goals

1. Price one typical PVC board with UV printing from immutable price versions through persisted BOM lines to customer and internal views.
2. Represent material, process, labor, installation, transport, design, discount, surcharge, and adjustment as BOM line types so later products do not need parallel pricing stores.
3. Make price changes append-only: an existing price-version row is never updated or deleted; a new version has a new version number, effective date, and reason.
4. Save `{ baseCurrency, quoteCurrency, rate, rateDate, source }` when a V2 quotation is first persisted and reuse it for every later recalculation of that quotation.
5. Keep costs, suppliers, price-floor data, internal notes, and internal BOM details out of ordinary employee responses.
6. Produce an additive, reviewable migration and an offline target guard. Do not connect to or mutate any Supabase project during this slice.

## Non-Goals

- AI extraction, image measurement, OCR, free-form product interpretation, or automatic dimension guessing.
- More product templates beyond `pvc_uv_board_v1`.
- Backfilling V1 quotations into BOM rows.
- Replacing V1 catalog tables, quote items, exports, or quotation numbering.
- Applying a migration, changing Vercel variables, deploying Preview/Production, or writing any database.
- Supporting currencies other than EUR and RSD in the V2 BOM engine.

## Safety Boundary

- The only permitted future migration target is LDS-OPS-TEST, project ref `uidfqpksuvebsrbnlyzl`.
- Production ref `ymbwmoxydgcmawkttbgi` is permanent zero-write scope.
- The implementation creates `scripts/supabase-migrate-v14-advertising-intelligent-bom-v2.sql` and offline verification only. It does not run `supabase db push`, `psql`, migration MCP calls, REST writes, or RPC calls against a real project.
- Before a later database operation, the operator must run the repository target guard and independently verify the displayed project name and ref are `LDS-OPS-TEST / uidfqpksuvebsrbnlyzl` in the same session.
- `SUPABASE_SERVICE_ROLE_KEY` remains server-only. No value or derivative of it may enter `web/`, browser storage, responses, or logs.

---

## Architecture Decision

### Explicit V2 discriminator

The top-level quote field is:

```js
pricingEngine: "bom_v2"
```

The absence of this field means V1. The one supported V2 item carries:

```js
bomTemplateCode: "pvc_uv_board_v1"
```

This explicit discriminator prevents an old quotation from silently changing calculation semantics merely because new code is deployed.

### Calculation flow

```text
User dimensions and service quantities
  -> server validates pvc_uv_board_v1 input
  -> server resolves effective immutable price versions
  -> server resolves or reuses the quote FX snapshot
  -> pure BOM builder creates BOM lines
  -> pure aggregator calculates item/customer/internal totals
  -> server saves quote item container + BOM rows + FX snapshot atomically
  -> customer and internal views aggregate the same persisted BOM rows
```

The browser never chooses cost values, supplier values, price-version IDs, unit prices, or FX data. It submits dimensions, quantities, enabled services, discount inputs, quote currency, and template code. The server resolves all pricing evidence.

## V2 Domain Interfaces

Create `server/services/advertisingBomCalculator.js` with these exported interfaces:

```js
selectEffectivePriceVersion(priceVersions, catalogType, catalogId, effectiveOn)

convertBomMoney(amount, fromCurrency, toCurrency, fxSnapshot)

buildPvcUvBoardBomLines({
  item,
  catalog,
  quoteCurrency,
  effectiveOn,
  fxSnapshot,
})

calculateAdvertisingBomQuotation(input, catalog, context)
```

`context` is:

```js
{
  userId: string | null,
  fxSnapshot: {
    baseCurrency: "EUR",
    quoteCurrency: "RSD",
    rate: number,
    rateDate: "YYYY-MM-DD",
    source: string,
  },
}
```

`calculateAdvertisingBomQuotation` returns:

```js
{
  pricingEngine: "bom_v2",
  bomLines: AdvertisingBomLine[],
  items: Array<{
    id: string,
    groupId: string | null,
    materialNameSnapshot: string,
    costAmount: number,
    saleAmount: number,
  }>,
  groups: object[],
  groupTotals: object[],
  discountAmount: number,
  subtotalExcludingVat: number,
  vatRate: number,
  vatAmount: number,
  totalIncludingVat: number,
  totalCost: number,
  grossProfit: number,
  grossMargin: number,
  fxSnapshot: object,
  calculatedAt: string,
  calculatedBy: string | null,
}
```

### BOM line shape

```js
{
  id: string,
  quoteItemId: string | null,
  position: number,
  lineType:
    | "material"
    | "process"
    | "labor"
    | "installation"
    | "transport"
    | "design"
    | "discount"
    | "surcharge"
    | "adjustment",
  catalogType: "materials" | "processes" | "services" | null,
  catalogId: string | null,
  priceVersionId: string | null,
  descriptionSnapshot: string,
  unitSnapshot: string,
  quantity: number,
  sourceCurrency: "EUR" | "RSD",
  quoteCurrency: "EUR" | "RSD",
  costUnitPriceSource: number,
  saleUnitPriceSource: number,
  costAmount: number,
  saleAmount: number,
  customerVisible: boolean,
  supplierSnapshot: object,
  internalNotes: string,
}
```

`supplierSnapshot` and `internalNotes` are persisted evidence and are always sensitive. Discount lines have `catalogType`, `catalogId`, and `priceVersionId` set to `null`, `costAmount` equal to `0`, and a negative `saleAmount`. Every other generated price line references an immutable price version.

### Single product template

`pvc_uv_board_v1` accepts one quote item with:

```js
{
  id,
  name,
  nameEn,
  width,
  height,
  sizeUnit: "mm" | "cm" | "m",
  quantity,
  sides: 1 | 2,
  laborHours,
  installationQuantity,
  transportTrips,
  designHours,
  notes,
  groupId,
  bomTemplateCode: "pvc_uv_board_v1",
}
```

It resolves these catalog entries:

- material `pvc-3`
- process `uv`
- services `production-labor`, `installation`, `delivery`, and `design`

Zero service quantity omits that service line. UV quantity is area multiplied by sides; material quantity is area without the side multiplier. The UV line applies its versioned `minimumCharge` to its sale amount. The percentage and fixed discount are combined into one negative quote-level `discount` BOM line after all positive lines and before VAT.

### Currency rule

The FX snapshot always means `1 EUR = rate RSD`:

- EUR source to RSD quote: multiply by `rate`.
- RSD source to EUR quote: divide by `rate`.
- Same currency: no conversion.
- Any other pair or a missing/non-positive rate throws `ADVERTISING_FX_SNAPSHOT_INVALID` with HTTP 422.

Line source unit prices remain in the price version's currency. `costAmount` and `saleAmount` are rounded to two decimals in quote currency. This preserves source-price evidence while keeping quote totals deterministic.

---

## Supabase Data Model

Create an additive V14 migration.

### `public.advertising_price_versions`

| Column | Type | Rule |
|---|---|---|
| `id` | `text` | primary key |
| `catalog_type` | `text` | `materials`, `processes`, or `services` |
| `catalog_id` | `text` | existing catalog ID |
| `version_number` | `integer` | positive; unique with type and ID |
| `currency` | `text` | `EUR` or `RSD` |
| `cost_unit_price` | `numeric(14,4)` | non-negative |
| `sale_unit_price` | `numeric(14,4)` | non-negative |
| `minimum_sale_unit_price` | `numeric(14,4)` | nullable, non-negative |
| `minimum_charge` | `numeric(14,4)` | non-negative, default `0` |
| `effective_from` | `date` | required |
| `change_reason` | `text` | trimmed, non-empty |
| `supplier_snapshot` | `jsonb` | internal evidence, default `{}` |
| `created_by` | `uuid` | required |
| `created_at` | `timestamptz` | default `now()` |

Price versions are append-only. A trigger rejects every `UPDATE` and `DELETE` on this table. Effective selection is deterministic: greatest `effective_from` not after the quotation date, then greatest `version_number`. A future-dated version does not alter quotations calculated before its effective date.

### `public.advertising_quote_bom_lines`

| Column | Type | Rule |
|---|---|---|
| `id` | `text` | primary key |
| `quote_id` | `text` | FK to `advertising_quotes`, cascade delete |
| `quote_item_id` | `text` | nullable FK to `advertising_quote_items`, cascade delete |
| `position` | `integer` | stable display order |
| `line_type` | `text` | one of the nine V2 line types |
| `catalog_type` | `text` | nullable catalog family |
| `catalog_id` | `text` | nullable catalog ID |
| `price_version_id` | `text` | nullable FK to price versions, restrict delete |
| `description_snapshot` | `text` | required |
| `unit_snapshot` | `text` | required |
| `quantity` | `numeric(14,4)` | non-negative |
| `source_currency` | `text` | `EUR` or `RSD` |
| `quote_currency` | `text` | `EUR` or `RSD` |
| `cost_unit_price_source` | `numeric(14,4)` | non-negative |
| `sale_unit_price_source` | `numeric(14,4)` | non-negative |
| `cost_amount` | `numeric(14,2)` | non-negative quote-currency amount |
| `sale_amount` | `numeric(14,2)` | negative only for discount lines |
| `customer_visible` | `boolean` | default `true` |
| `supplier_snapshot` | `jsonb` | default `{}`; sensitive |
| `internal_notes` | `text` | default empty; sensitive |

### Additive quote columns

Add to `public.advertising_quotes`:

```sql
pricing_engine text not null default 'legacy_v1'
fx_snapshot jsonb not null default '{}'::jsonb
```

The migration adds checks for `legacy_v1` and `bom_v2` and validates the populated V2 FX object inside the V2 save RPC. Existing rows automatically remain `legacy_v1` with an empty FX snapshot.

### RPC boundaries

Keep `public.save_advertising_quote(jsonb)` and `public.save_advertising_catalog_entry(text,jsonb,jsonb,uuid)` unchanged for V1 callers.

Add:

```sql
public.save_advertising_quote_v2(
  p_quote jsonb,
  p_bom_lines jsonb,
  p_fx_snapshot jsonb
) returns public.advertising_quotes

public.save_advertising_catalog_entry_v2(
  p_kind text,
  p_item jsonb,
  p_price_version jsonb,
  p_user_id uuid
) returns jsonb
```

The V2 quote RPC allocates or preserves the quote number, writes the quote/item container, replaces that quotation's BOM rows inside one transaction, and persists the FX snapshot only if the quote has none. An update that supplies a different FX object is rejected with `ADVERTISING_FX_SNAPSHOT_IMMUTABLE`.

The V2 catalog RPC updates non-price catalog metadata and inserts a new price version. It derives `version_number` under an advisory transaction lock for the catalog key. It never updates an old version.

### RLS and grants

- Enable RLS on both new tables.
- Revoke all privileges from `anon` and `authenticated`.
- Grant table and RPC access only to `service_role`.
- Revoke V2 RPC execution from `public`, `anon`, and `authenticated`.
- Browser users access the data only through authenticated Node routes and server-side sanitization.

---

## Local JSON and Store Compatibility

`ensureAdvertisingData(data)` adds these arrays only when absent:

```js
data.advertisingPriceVersions = [];
data.advertisingQuoteBomLines = [];
```

On first local initialization, deterministic version-1 records are derived from the existing material/process/service seeds. Existing user data is not rewritten. Old local quotes remain valid without `pricingEngine`, `fxSnapshot`, or BOM lines.

`remoteQuoteRow(row, bomLines = [])` adds `pricingEngine`, `fxSnapshot`, and `bomLines` while retaining every current field. `getQuote(id)` fetches BOM rows only for `bom_v2` records. `listQuotes()` does not fetch line details and preserves the existing list shape.

The store adds:

```js
listPriceVersions({ catalogType, catalogId })

saveCatalogPriceVersion(kind, payload, id, userId)
```

`updateCatalog(kind, payload, id, userId)` remains the public compatibility method. If no protected price field changes, it performs the V1 metadata update. If `costPrice`, `suggestedSalePrice`, `minimumSalePrice`, `defaultMinimumFee`, `currency`, or `effectiveFrom` changes, it requires `adjustmentReason` and delegates to `saveCatalogPriceVersion`.

## FX Snapshot Resolution

Create `server/services/advertisingFxSnapshot.js`:

```js
async function resolveAdvertisingFxSnapshot({
  pricingEngine,
  existingQuote,
  supabaseConfig,
  effectiveOn,
})
```

- V1 returns `null` and does not call the rate store.
- Existing V2 quotes return a clone of `existingQuote.fxSnapshot`; global rate changes are ignored.
- New V2 quotes call `exchangeRateStore.getLatestExchangeRate(supabaseConfig, "EUR", "RSD", effectiveOn)` and return the normalized five-field snapshot.
- Missing/non-positive rate throws `{ statusCode: 422, code: "NO_EXCHANGE_RATE" }`.
- Duplicating a V2 quote clears the source FX snapshot so the new quote receives a new snapshot on save.

The preview endpoint may resolve the current rate for display, but only quote creation persists it. Quote creation recalculates server-side with the snapshot it saves.

---

## API and Security

### Existing calculate/save endpoints

For all existing calculate and save routes:

```js
if (body.pricingEngine === "bom_v2") {
  // resolve/reuse server FX snapshot
  // calculateAdvertisingBomQuotation
} else {
  // calculateAdvertisingQuotation, unchanged
}
```

The server discards client-supplied `bomLines`, `calculationSnapshot`, `fxSnapshot`, price-version IDs, cost values, suppliers, and internal notes before V2 calculation. On update it loads the existing quote before resolving FX. Ownership and current permission checks remain in force.

### New version-history route

```http
GET /api/advertising/price-versions?catalogType=materials&catalogId=pvc-3
```

- Requires `advertising_catalog.manage` in `ROUTE_PERMISSION_MAP` and at the handler.
- Both query parameters are required and restricted to `materials`, `processes`, or `services`.
- Results are newest first.
- The response still passes through `sanitizeAdvertisingPayload`; a manager without `advertising_quote.cost_view` cannot receive cost or supplier fields.

No new write route is needed. Existing catalog `POST`/`PUT` paths accept `currency`, `effectiveFrom`, and `adjustmentReason`; protected changes create a new version.

### Sensitive-data rules

Extend sensitive key recognition to cover these fields even if naming changes:

- `costUnitPriceSource`, `costAmount`, and any key containing `cost`
- `supplierSnapshot` and any key containing `supplier`
- `internalNotes` and any key starting with `internal`
- `minimumSaleUnitPrice`, `minimumSalePrice`, markup, gross profit, and gross margin
- the complete `bomLines` collection for users without `advertising_quote.cost_view`

Ordinary staff receive the aggregated `calculationSnapshot.items[].saleAmount` and quote totals, never raw BOM rows. Cost-authorized users receive the internal view and BOM line detail.

## Customer and Internal Views

`buildAdvertisingCustomerView(quote, { internal })` branches only on persisted data shape:

- V1: existing logic remains unchanged.
- V2 customer view: group visible `advertising_quote_items`, sum sale amounts from that item's persisted BOM lines, and show one understandable finished-product row. Quote-level customer-visible discount lines appear in the adjustments group. No BOM details are exposed.
- V2 internal view: use the same item totals and include an `internalBomLines` breakdown with line type, description, quantity, source currency/unit price, quote-currency cost/sale amounts, supplier snapshot, price-version ID, and internal notes.

The V2 calculation snapshot is generated from the same BOM lines and exists only to preserve existing list, print, and DOCX consumers.

## UI Scope

### Quote editor

For a new quote, `web/advertising-quote.js` sets `pricingEngine: "bom_v2"` and renders exactly one `pvc_uv_board_v1` product. The form exposes dimensions, unit, quantity, sides, labor hours, installation quantity, transport trips, design hours, EUR/RSD quote currency, VAT mode/rate, and discount. Material and UV process are displayed as fixed template components rather than user-selectable alternatives.

When opening a V1 quote, the existing editor behavior remains available and sends no V2 discriminator. When opening a V2 quote, the single-product editor restores its input fields and displays the persisted FX snapshot as read-only evidence.

All summary currency labels are dynamic. New Chinese labels live under `window.AppUi.advertising`; JavaScript reads them instead of adding new hardcoded strings.

### Price library

For material, process, and service tabs, the table shows active version, currency, and effective date. The edit dialog includes currency, effective date, prices, and mandatory reason. Saving a protected price change creates a new version; it never edits the displayed old version. A version-history section reads the protected history endpoint and shows version number, currency, effective date, reason, and permitted price fields.

## Error Handling

| Code | HTTP | Meaning |
|---|---:|---|
| `ADVERTISING_BOM_TEMPLATE_UNSUPPORTED` | 422 | template is not `pvc_uv_board_v1` |
| `ADVERTISING_PRICE_VERSION_UNAVAILABLE` | 422 | no effective version for a required catalog item |
| `ADVERTISING_FX_SNAPSHOT_INVALID` | 422 | unsupported currency pair or invalid snapshot |
| `NO_EXCHANGE_RATE` | 422 | no EUR/RSD rate exists for first V2 calculation |
| `ADVERTISING_FX_SNAPSHOT_IMMUTABLE` | 409 | update attempts to replace saved FX evidence |
| `ADVERTISING_PRICE_VERSION_IMMUTABLE` | 409 | update/delete attempts to mutate a version |
| `ADJUSTMENT_REASON_REQUIRED` | 400 | protected catalog price change has no reason |

Database/PGRST and 5xx failures continue through `sendAdvertisingError` and do not fall back to local JSON when Supabase is configured.

---

## Verification Strategy

### Automated

- Pure unit tests for effective-version selection, dimensions, double-sided UV quantity, every supported BOM category, discount, VAT, mixed EUR/RSD conversion, invalid FX, and customer/internal aggregation.
- Store tests for local V1 compatibility, local V2 BOM persistence, remote V2 RPC payload, two-query V2 detail read, append-only price creation, and no local fallback on Supabase failure.
- Static SQL tests for additive DDL, append-only trigger, FK/restrict behavior, RLS, service-role-only grants, V1 RPC preservation, and the production zero-write warning.
- API tests for V1 unchanged behavior, V2 calculate/save/reopen, immutable saved FX after a global rate change, price version creation, permission denial, staff redaction, cost-authorized access, and export aggregation.
- Full `npm test` with shared process state.

### Browser acceptance

- New V2 PVC/UV quote in EUR and RSD at 1440, 768, and 390 CSS pixels.
- V1 quote reopen and save without a discriminator.
- Price history and future effective date behavior.
- Keyboard traversal through template inputs, currency, services, discount, save, and export.
- No horizontal overflow at 390 px; readable sticky totals at desktop/tablet/mobile.
- Customer export contains finished-product totals only; internal export contains BOM detail and an unmistakable internal marker.

## Rollout Order

1. Implement and review pure domain calculation.
2. Generate and statically verify the additive migration and target guard without a database connection.
3. Add local/remote store compatibility and append-only price APIs.
4. Integrate server routing, security, and export aggregation.
5. Complete the one-product UI and price-version UI.
6. Run the full automated/browser matrix and prepare a review packet.
7. In a later separately authorized task, prove `uidfqpksuvebsrbnlyzl / LDS-OPS-TEST` and apply only to that test project.

## Acceptance Criteria

- A V2 PVC/UV quotation can be calculated, saved, reopened, recalculated, shown to a customer, and inspected internally from one persisted BOM truth.
- Every non-discount price line references an immutable version with currency, version number, effective date, and change reason.
- A saved quote's FX rate/date/source does not change after the global exchange-rate record changes.
- V1 quote reads, saves, list responses, calculate behavior, exports, and current route paths remain compatible.
- Ordinary staff payloads contain no BOM line collection, cost, supplier, internal note, markup, price floor, gross profit, or gross margin.
- The migration is reviewable and statically tested, but no Supabase project has been written.
- Production ref `ymbwmoxydgcmawkttbgi` remains untouched.
