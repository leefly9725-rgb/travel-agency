const test = require("node:test");
const assert = require("node:assert/strict");
const { createAdvertisingQuoteStore } = require("../server/services/advertisingQuoteStore");

test("Supabase mode loads catalogs remotely and never writes local JSON", async (t) => {
  const originalFetch = global.fetch; let savedLocally = false; const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push([String(url), options]);
    const path = String(url).split("/rest/v1/")[1];
    if (path.startsWith("advertising_materials")) return new Response(JSON.stringify([{ id: "m1", data: { nameZh: "远程材料", costPrice: 10 }, is_active: true }]), { status: 200 });
    return new Response("[]", { status: 200 });
  };
  t.after(() => { global.fetch = originalFetch; });
  const store = createAdvertisingQuoteStore({ data: {}, saveData: () => { savedLocally = true; }, supabaseConfig: { enabled: true, url: "https://example.supabase.co", serviceRoleKey: "server-secret" } });
  const catalog = await store.catalog();
  assert.equal(catalog.materials[0].nameZh, "远程材料");
  assert.equal(savedLocally, false);
  assert.ok(requests.some(([url]) => url.includes("advertising_materials")));
});

test("Supabase save uses transactional RPC", async (t) => {
  const originalFetch = global.fetch; let rpcBody;
  global.fetch = async (url, options = {}) => {
    if (String(url).includes("/rpc/save_advertising_quote")) { rpcBody = JSON.parse(options.body); return new Response(JSON.stringify({ id: "ADV-1", quote_number: "LDS-ADV-2026-0001" }), { status: 200 }); }
    return new Response("[]", { status: 200 });
  };
  t.after(() => { global.fetch = originalFetch; });
  const store = createAdvertisingQuoteStore({ data: {}, saveData: () => assert.fail("must not fallback"), supabaseConfig: { enabled: true, url: "https://example.supabase.co", serviceRoleKey: "server-secret" } });
  const saved = await store.saveQuote({ entityId: "lds", clientName: "Client", items: [], calculationSnapshot: { totalIncludingVat: 100 }, ownerId: "11111111-1111-1111-1111-111111111111" });
  assert.equal(saved.quoteNumber, "LDS-ADV-2026-0001");
  assert.equal(rpcBody.p_quote.clientName, "Client");
});

test("Supabase catalog price update and audit use one transactional RPC", async (t) => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push([String(url), options]);
    if (String(url).includes("advertising_materials?")) return new Response(JSON.stringify([{ id: "m1", data: { costPrice: 10, suggestedSalePrice: 15 }, is_active: true }]), { status: 200 });
    if (String(url).includes("/rpc/save_advertising_catalog_entry")) return new Response(JSON.stringify({ id: "m1", data: { costPrice: 10, suggestedSalePrice: 16, adjustmentReason: "market" }, is_active: true }), { status: 200 });
    return new Response("[]", { status: 200 });
  };
  t.after(() => { global.fetch = originalFetch; });
  const store = createAdvertisingQuoteStore({ data: {}, saveData: () => assert.fail("must not fallback"), supabaseConfig: { enabled: true, url: "https://example.supabase.co", serviceRoleKey: "server-secret" } });
  const result = await store.updateCatalog("materials", { suggestedSalePrice: 16, adjustmentReason: "market" }, "m1", "11111111-1111-1111-1111-111111111111");
  assert.equal(result.suggestedSalePrice, 16);
  const writes = requests.filter(([, options]) => options.method === "POST");
  assert.equal(writes.length, 1);
  assert.match(writes[0][0], /rpc\/save_advertising_catalog_entry/);
  const body = JSON.parse(writes[0][1].body);
  assert.deepEqual(body.p_logs, [{ fieldName: "suggestedSalePrice", oldValue: 15, newValue: 16, reason: "market" }]);
});

test("configured Supabase failure is surfaced and never falls back locally", async (t) => {
  const originalFetch = global.fetch; let savedLocally = false;
  global.fetch = async () => new Response(JSON.stringify({ message: "database unavailable" }), { status: 503 });
  t.after(() => { global.fetch = originalFetch; });
  const store = createAdvertisingQuoteStore({ data: {}, saveData: () => { savedLocally = true; }, supabaseConfig: { enabled: true, url: "https://example.supabase.co", serviceRoleKey: "server-secret" } });
  await assert.rejects(() => store.listQuotes(), /Supabase/);
  assert.equal(savedLocally, false);
});

test("Supabase delete requires returned-row confirmation", async (t) => {
  const originalFetch = global.fetch;
  const responses = [[], [{ id: "ADV-1" }]];
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push([String(url), options]);
    return new Response(JSON.stringify(responses.shift()), { status: 200 });
  };
  t.after(() => { global.fetch = originalFetch; });
  const store = createAdvertisingQuoteStore({
    data: {},
    saveData: () => assert.fail("must not fallback"),
    supabaseConfig: {
      enabled: true,
      url: "https://example.supabase.co",
      serviceRoleKey: "server-secret",
    },
  });

  assert.equal(await store.deleteQuote("ADV-1"), false);
  assert.equal(await store.deleteQuote("ADV-1"), true);
  assert.match(requests[0][0], /select=id/);
  assert.equal(requests[0][1].headers.Prefer, "return=representation");
});

test("local quote numbering advances past the highest existing suffix", async () => {
  const data = {
    advertisingQuotes: [
      { id: "A1", quoteNumber: "LDS-ADV-2026-0001" },
      { id: "A3", quoteNumber: "LDS-ADV-2026-0003" },
    ],
  };
  const store = createAdvertisingQuoteStore({
    data,
    saveData: () => {},
    supabaseConfig: { enabled: false },
  });
  const saved = await store.saveQuote({
    entityId: "lds",
    clientName: "Client",
    projectName: "Project",
    items: [],
    calculationSnapshot: {},
  });
  assert.equal(saved.quoteNumber, "LDS-ADV-2026-0004");
});

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
  const first = await store.saveQuote({
    pricingEngine: "bom_v2",
    clientName: "Client",
    projectName: "PVC",
    entityId: "lds",
    items: [{ id: "I1" }],
    bomLines: [{ id: "B1", quoteItemId: "I1", lineType: "material", saleAmount: 16 }],
    fxSnapshot,
    calculationSnapshot: { totalIncludingVat: 16 },
  });
  const second = await store.saveQuote({ ...first, fxSnapshot: { ...fxSnapshot, rate: 120 }, bomLines: first.bomLines });

  assert.deepEqual(second.fxSnapshot, fxSnapshot);
  assert.deepEqual((await store.getQuote(first.id)).bomLines.map((line) => line.id), ["B1"]);
  assert.equal(data.advertisingQuoteBomLines[0].quoteId, first.id);
});

test("an empty local FX placeholder does not block the first real snapshot", async () => {
  const data = { advertisingQuotes: [{ id: "A1", pricingEngine: "bom_v2", entityId: "lds", fxSnapshot: {}, items: [] }] };
  const store = createAdvertisingQuoteStore({ data, saveData: () => {}, supabaseConfig: { enabled: false } });
  const fxSnapshot = { baseCurrency: "EUR", quoteCurrency: "RSD", rate: 117.2, rateDate: "2026-08-01", source: "test" };

  const saved = await store.saveQuote({ ...data.advertisingQuotes[0], fxSnapshot, bomLines: [] });

  assert.deepEqual(saved.fxSnapshot, fxSnapshot);
});

test("remote V2 save uses the V2 RPC and remote read fetches BOM rows", async (t) => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push([String(url), options]);
    if (String(url).includes("/rpc/save_advertising_quote_v2")) return new Response(JSON.stringify({ id: "A2", quote_number: "LDS-ADV-2026-0002", pricing_engine: "bom_v2", fx_snapshot: { rate: 117.2 }, data: { items: [{ id: "I1" }] } }), { status: 200 });
    if (String(url).includes("advertising_quotes?")) return new Response(JSON.stringify([{ id: "A2", quote_number: "LDS-ADV-2026-0002", pricing_engine: "bom_v2", fx_snapshot: { rate: 117.2 }, data: { items: [{ id: "I1" }] } }]), { status: 200 });
    if (String(url).includes("advertising_quote_bom_lines?")) return new Response(JSON.stringify([{ id: "B1", quote_id: "A2", quote_item_id: "I1", position: 0, line_type: "material", sale_amount: 16 }]), { status: 200 });
    return new Response("[]", { status: 200 });
  };
  t.after(() => { global.fetch = originalFetch; });
  const store = createAdvertisingQuoteStore({ data: {}, saveData: () => assert.fail("must not write local"), supabaseConfig: { enabled: true, url: "https://example.supabase.co", serviceRoleKey: "server-secret" } });
  const bomLines = [{ id: "B1" }];
  const fxSnapshot = { rate: 117.2 };
  await store.saveQuote({ pricingEngine: "bom_v2", bomLines, fxSnapshot });
  const quote = await store.getQuote("A2");

  assert.equal(quote.bomLines[0].lineType, "material");
  assert.deepEqual(quote.fxSnapshot, { rate: 117.2 });
  const rpcRequest = requests.find(([url]) => url.includes("/rpc/save_advertising_quote_v2"));
  assert.deepEqual(JSON.parse(rpcRequest[1].body), {
    p_quote: { pricingEngine: "bom_v2" },
    p_bom_lines: bomLines,
    p_fx_snapshot: fxSnapshot,
  });
  assert.ok(requests.some(([url]) => url.includes("advertising_quote_bom_lines?") && url.includes("quote_id=eq.A2") && url.includes("order=position")));
});

test("catalog price change appends a version with reason instead of overwriting price JSON", async () => {
  const data = {};
  const store = createAdvertisingQuoteStore({ data, saveData: () => {}, supabaseConfig: { enabled: false } });
  const originalStoredPrice = data.advertisingMaterials.find((item) => item.id === "pvc-3").suggestedSalePrice;
  const before = await store.listPriceVersions({ catalogType: "materials", catalogId: "pvc-3" });
  const result = await store.updateCatalog("materials", { suggestedSalePrice: 17, currency: "EUR", effectiveFrom: "2026-09-01", adjustmentReason: "supplier increase" }, "pvc-3", "11111111-1111-1111-1111-111111111111");
  const after = await store.listPriceVersions({ catalogType: "materials", catalogId: "pvc-3" });

  assert.equal(after.length, before.length + 1);
  assert.equal(after[0].versionNumber, before[0].versionNumber + 1);
  assert.equal(after[0].changeReason, "supplier increase");
  assert.equal(result.activePriceVersion.id, after[0].id);
  assert.equal(result.suggestedSalePrice, 17);
  assert.equal(data.advertisingMaterials.find((item) => item.id === "pvc-3").suggestedSalePrice, originalStoredPrice);
  assert.equal(data.advertisingMaterials.find((item) => item.id === "pvc-3").activePriceVersion, undefined);
  assert.deepEqual(after.at(-1), before.at(-1));
});

test("V2 price versions require reason, effective date, and supported currency", async () => {
  const store = createAdvertisingQuoteStore({ data: {}, saveData: () => {}, supabaseConfig: { enabled: false } });
  const base = { costPrice: 9.5, suggestedSalePrice: 17, currency: "EUR", effectiveFrom: "2026-09-01", adjustmentReason: "supplier increase" };

  await assert.rejects(() => store.saveCatalogPriceVersion("materials", { ...base, adjustmentReason: " " }, "pvc-3"), (error) => error.code === "ADJUSTMENT_REASON_REQUIRED");
  await assert.rejects(() => store.saveCatalogPriceVersion("materials", { ...base, effectiveFrom: "2026-02-30" }, "pvc-3"), (error) => error.code === "ADVERTISING_PRICE_VERSION_INVALID");
  await assert.rejects(() => store.saveCatalogPriceVersion("materials", { ...base, currency: "USD" }, "pvc-3"), (error) => error.code === "ADVERTISING_PRICE_VERSION_INVALID");
});

test("remote price version creation uses the V2 RPC contract", async (t) => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push([String(url), options]);
    if (String(url).includes("/rpc/save_advertising_catalog_entry_v2")) {
      return new Response(JSON.stringify({
        item: { id: "pvc-3", data: { nameZh: "3mm PVC发泡板" }, is_active: true },
        priceVersion: { id: "APV-2", catalogType: "materials", catalogId: "pvc-3", versionNumber: 2, currency: "EUR", costUnitPrice: 9.5, saleUnitPrice: 17, minimumSaleUnitPrice: 9.5, minimumCharge: 0, effectiveFrom: "2026-09-01", changeReason: "supplier increase" },
      }), { status: 200 });
    }
    return new Response("[]", { status: 200 });
  };
  t.after(() => { global.fetch = originalFetch; });
  const store = createAdvertisingQuoteStore({ data: {}, saveData: () => assert.fail("must not write local"), supabaseConfig: { enabled: true, url: "https://example.supabase.co", serviceRoleKey: "server-secret" } });
  const result = await store.saveCatalogPriceVersion("materials", { nameZh: "3mm PVC发泡板", costPrice: 9.5, suggestedSalePrice: 17, minimumSalePrice: 9.5, defaultMinimumFee: 0, currency: "EUR", effectiveFrom: "2026-09-01", adjustmentReason: "supplier increase", activePriceVersion: { id: "APV-1" } }, "pvc-3", "11111111-1111-1111-1111-111111111111");

  assert.equal(result.activePriceVersion.id, "APV-2");
  assert.equal(result.suggestedSalePrice, 17);
  const request = requests.find(([url]) => url.includes("/rpc/save_advertising_catalog_entry_v2"));
  assert.deepEqual(JSON.parse(request[1].body), {
    p_kind: "materials",
    p_item: { nameZh: "3mm PVC发泡板", costPrice: 9.5, suggestedSalePrice: 17, minimumSalePrice: 9.5, defaultMinimumFee: 0, currency: "EUR", effectiveFrom: "2026-09-01", adjustmentReason: "supplier increase", id: "pvc-3" },
    p_price_version: { currency: "EUR", costUnitPrice: 9.5, saleUnitPrice: 17, minimumSaleUnitPrice: 9.5, minimumCharge: 0, effectiveFrom: "2026-09-01", changeReason: "supplier increase", supplierSnapshot: {} },
    p_user_id: "11111111-1111-1111-1111-111111111111",
  });
});
