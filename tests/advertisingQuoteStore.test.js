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
