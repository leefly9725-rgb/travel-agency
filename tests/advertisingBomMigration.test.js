const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  TEST_REF,
  PRODUCTION_REF,
  assertAdvertisingBomTestTarget,
} = require("../scripts/verify-advertising-bom-v2-target");

const root = path.join(__dirname, "..");
const sqlPath = path.join(root, "scripts", "supabase-migrate-v14-advertising-intelligent-bom-v2.sql");
const v13SqlPath = path.join(root, "scripts", "supabase-migrate-v13-advertising-quotations.sql");
const guardPath = path.join(root, "scripts", "verify-advertising-bom-v2-target.js");

function normalizedSql() {
  return fs.readFileSync(sqlPath, "utf8").replace(/\s+/g, " ").trim();
}

function functionBody(sql, functionName, schema = "public") {
  const marker = `create or replace function ${schema}.${functionName}`;
  const start = sql.toLowerCase().indexOf(marker);
  assert.notEqual(start, -1, `missing ${functionName}`);
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1, `unterminated ${functionName}`);
  return sql.slice(start, end + 3).replace(/\s+/g, " ");
}

test("offline target guard accepts only the exact LDS-OPS-TEST host", () => {
  assert.equal(TEST_REF, "uidfqpksuvebsrbnlyzl");
  assert.equal(PRODUCTION_REF, "ymbwmoxydgcmawkttbgi");
  assert.equal(
    assertAdvertisingBomTestTarget(`https://${TEST_REF}.supabase.co`),
    TEST_REF
  );
  assert.throws(
    () => assertAdvertisingBomTestTarget(`https://${PRODUCTION_REF}.supabase.co`),
    /PRODUCTION_ZERO_WRITE/
  );
  for (const value of [
    "https://example.supabase.co",
    `https://${TEST_REF}.supabase.co.evil.example`,
    `https://${TEST_REF}.example.com`,
  ]) {
    assert.throws(
      () => assertAdvertisingBomTestTarget(value),
      /TEST_PROJECT_REQUIRED/
    );
  }
});

test("target guard CLI succeeds for test and refuses production without a network client", () => {
  const accepted = spawnSync(process.execPath, [guardPath], {
    cwd: root,
    env: { ...process.env, SUPABASE_URL: `https://${TEST_REF}.supabase.co` },
    encoding: "utf8",
  });
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(accepted.stdout, `Verified LDS-OPS-TEST project ref: ${TEST_REF}\n`);
  assert.equal(accepted.stderr, "");

  const refused = spawnSync(process.execPath, [guardPath], {
    cwd: root,
    env: { ...process.env, SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co` },
    encoding: "utf8",
  });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /PRODUCTION_ZERO_WRITE/);

  const source = fs.readFileSync(guardPath, "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|supabaseClient|node:(?:http|https|net)|require\(["'](?:http|https|net)["']\)/);
});

test("V14 is additive, idempotent, and leaves both V1 RPC definitions untouched", () => {
  const sql = normalizedSql();
  const v13Sql = fs.readFileSync(v13SqlPath, "utf8");

  assert.match(sql, /create table if not exists public\.advertising_price_versions/i);
  assert.match(sql, /create table if not exists public\.advertising_quote_bom_lines/i);
  assert.match(sql, /alter table public\.advertising_quotes add column if not exists pricing_engine/i);
  assert.match(sql, /alter table public\.advertising_quotes add column if not exists fx_snapshot/i);
  assert.match(sql, /create index if not exists[^;]+\(catalog_type, catalog_id, effective_from desc, version_number desc\)/i);
  assert.match(sql, /create index if not exists[^;]+\(quote_id, position\)/i);
  assert.doesNotMatch(sql, /drop\s+(?:table|column)\b|truncate\b/i);

  assert.match(v13Sql, /function public\.save_advertising_quote\(p_quote jsonb\)/i);
  assert.match(v13Sql, /function public\.save_advertising_catalog_entry\(/i);
  assert.doesNotMatch(sql, /(?:drop|create or replace) function public\.save_advertising_quote\s*\(\s*(?:\w+\s+)?jsonb\s*\)/i);
  assert.doesNotMatch(sql, /(?:drop|create or replace) function public\.save_advertising_catalog_entry\s*\([^)]*\)/i);
});

test("price versions are constrained, seeded once, and physically append-only", () => {
  const sql = normalizedSql();

  assert.match(sql, /catalog_type[^;]+check\s*\(catalog_type in \('materials','processes','services'\)\)/i);
  assert.match(sql, /version_number[^;]+check\s*\(version_number > 0\)/i);
  assert.match(sql, /currency[^;]+check\s*\(currency in \('EUR','RSD'\)\)/i);
  assert.match(sql, /unique\s*\(catalog_type,catalog_id,version_number\)/i);
  assert.match(sql, /prevent_advertising_price_version_mutation/i);
  assert.match(sql, /before update or delete on public\.advertising_price_versions/i);
  assert.match(sql, /ADVERTISING_PRICE_VERSION_IMMUTABLE/i);
  assert.doesNotMatch(sql, /update public\.advertising_price_versions|delete from public\.advertising_price_versions/i);
  assert.match(sql, /'production-labor'/i);
  assert.match(sql, /'2026-01-01'/i);
  assert.match(sql, /'V1 catalog baseline'/i);
  assert.match(sql, /on conflict\s+do nothing/i);
});

test("new tables and V2 RPCs are RLS protected and service-role only", () => {
  const sql = normalizedSql();

  for (const table of ["advertising_price_versions", "advertising_quote_bom_lines"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`, "i"));
  }
  assert.match(sql, /grant select, insert on public\.advertising_price_versions to service_role/i);
  assert.match(sql, /grant select, insert, update, delete on public\.advertising_quote_bom_lines to service_role/i);
  assert.match(sql, /revoke execute on function public\.save_advertising_quote_v2\(jsonb,jsonb,jsonb\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.save_advertising_quote_v2\(jsonb,jsonb,jsonb\) to service_role/i);
  assert.match(sql, /revoke execute on function public\.save_advertising_catalog_entry_v2\(text,jsonb,jsonb,uuid\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.save_advertising_catalog_entry_v2\(text,jsonb,jsonb,uuid\) to service_role/i);
  assert.doesNotMatch(sql, /create policy[^;]+to (?:anon|authenticated)/i);
  assert.doesNotMatch(sql, /grant execute on function private\.prevent_advertising_price_version_mutation\(\) to service_role/i);
});

test("V2 quote RPC validates ownership, line evidence, and immutable FX before replacement", () => {
  const body = functionBody(normalizedSql(), "save_advertising_quote_v2");

  assert.match(body, /ADVERTISING_FX_SNAPSHOT_INVALID/i);
  assert.match(body, /ADVERTISING_FX_SNAPSHOT_IMMUTABLE/i);
  assert.match(body, /\(select count\(\*\) from jsonb_object_keys\(p_fx_snapshot\)\) <> 5/i);
  assert.match(body, /owner_id[^;]+v_owner|v_owner[^;]+owner_id/i);
  assert.match(body, /quoteId/i);
  assert.match(body, /quoteItemId/i);
  assert.match(body, /lineType/i);
  assert.match(body, /priceVersionId/i);
  assert.match(body, /sourceCurrency/i);
  assert.match(body, /quoteCurrency/i);
  assert.match(body, /from public\.advertising_quote_items[^;]+quote_id <> v_id/i);
  assert.match(body, /from public\.advertising_quote_bom_lines[^;]+quote_id <> v_id/i);
  assert.match(body, /delete from public\.advertising_quote_bom_lines where quote_id=v_id/i);
  assert.match(body, /insert into public\.advertising_quote_bom_lines/i);
});

test("V2 quote RPC serializes a quote ID before reading ownership or saved FX", () => {
  const body = functionBody(normalizedSql(), "save_advertising_quote_v2");
  const lock = body.indexOf("perform pg_advisory_xact_lock(hashtextextended('advertising_quote:' || v_id,0))");
  const firstQuoteRead = body.indexOf("from public.advertising_quotes");

  assert.notEqual(lock, -1, "missing quote-scoped transaction advisory lock");
  assert.notEqual(firstQuoteRead, -1, "missing quote ownership/FX read");
  assert.ok(lock < firstQuoteRead, "quote lock must precede the first quote read");
});

test("V2 quote RPC checks immutable unit prices and effective version selection", () => {
  const body = functionBody(normalizedSql(), "save_advertising_quote_v2");

  assert.match(body, /\(v_line->>'costUnitPriceSource'\)::numeric <> v_version\.cost_unit_price/i);
  assert.match(body, /\(v_line->>'saleUnitPriceSource'\)::numeric <> v_version\.sale_unit_price/i);
  assert.match(body, /v_version\.effective_from > v_quote_date/i);
  assert.match(body, /newer\.effective_from <= v_quote_date/i);
  assert.match(body, /\(newer\.effective_from,newer\.version_number\) > \(v_version\.effective_from,v_version\.version_number\)/i);
});

test("table trigger allows only the first valid FX snapshot and rejects later changes", () => {
  const sql = normalizedSql();
  const body = functionBody(sql, "prevent_advertising_quote_fx_snapshot_mutation", "private");

  assert.match(sql, /create trigger advertising_quotes_fx_snapshot_immutable before update of fx_snapshot on public\.advertising_quotes/i);
  assert.match(sql, /execute function private\.prevent_advertising_quote_fx_snapshot_mutation\(\)/i);
  assert.match(body, /new\.fx_snapshot is not distinct from old\.fx_snapshot/i);
  assert.match(body, /coalesce\(old\.fx_snapshot,'\{\}'::jsonb\) <> '\{\}'::jsonb/i);
  assert.match(body, /ADVERTISING_FX_SNAPSHOT_IMMUTABLE/i);
  assert.match(body, /\(select count\(\*\) from jsonb_object_keys\(new\.fx_snapshot\)\) <> 5/i);
  assert.match(body, /new\.fx_snapshot->>'baseCurrency'[^;]+EUR/i);
  assert.match(body, /new\.fx_snapshot->>'quoteCurrency'[^;]+new\.currency/i);
  assert.match(body, /new\.fx_snapshot->>'rate'[^;]+numeric <= 0/i);
  assert.match(body, /new\.fx_snapshot->>'rateDate'[^;]+date/i);
  assert.match(body, /trim\(new\.fx_snapshot->>'source'\)/i);
  assert.doesNotMatch(sql, /disable trigger/i);
});

test("PostgreSQL 17 exact-five-key checks use jsonb_object_keys after type validation", () => {
  const sql = normalizedSql();
  const rpc = functionBody(sql, "save_advertising_quote_v2");
  const trigger = functionBody(sql, "prevent_advertising_quote_fx_snapshot_mutation", "private");

  assert.doesNotMatch(sql, /jsonb_object_length/i);
  for (const [body, value] of [[rpc, "p_fx_snapshot"], [trigger, "new.fx_snapshot"]]) {
    const typeCheck = body.indexOf(`jsonb_typeof(${value})`);
    const keyCount = body.indexOf(`select count(*) from jsonb_object_keys(${value})`);
    assert.notEqual(typeCheck, -1, `missing object type check for ${value}`);
    assert.notEqual(keyCount, -1, `missing PostgreSQL 17 key count for ${value}`);
    assert.ok(typeCheck < keyCount, `object type check must precede key expansion for ${value}`);
  }
});

test("V2 catalog RPC locks version allocation and only inserts price history", () => {
  const body = functionBody(normalizedSql(), "save_advertising_catalog_entry_v2");

  assert.match(body, /p_kind is null or p_kind not in \('materials','processes','services'\)/i);
  assert.match(body, /pg_advisory_xact_lock/i);
  assert.match(body, /ADJUSTMENT_REASON_REQUIRED/i);
  assert.ok(
    body.indexOf("ADJUSTMENT_REASON_REQUIRED") < body.indexOf("ADVERTISING_PRICE_VERSION_INVALID"),
    "missing reason must be rejected before generic price-version validation"
  );
  assert.match(body, /max\(version_number\)/i);
  assert.match(body, /insert into public\.advertising_price_versions/i);
  assert.doesNotMatch(body, /update public\.advertising_price_versions|delete from public\.advertising_price_versions/i);
});

test("migration header fixes the only future target and is not self-authorizing", () => {
  const header = fs.readFileSync(sqlPath, "utf8").split("\n").slice(0, 14).join("\n");
  assert.match(header, /uidfqpksuvebsrbnlyzl/);
  assert.match(header, /ymbwmoxydgcmawkttbgi/);
  assert.match(header, /not self-authorizing/i);
  assert.match(header, /do not execute/i);
});
