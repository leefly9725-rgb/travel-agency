const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { createQuoteStore } = require("../server/services/quoteStore");
const { supabaseRequest } = require("../server/supabaseClient");
const { createServer } = require("../server/app");

const remoteConfig = {
  enabled: true,
  url: "https://example.supabase.co",
  serviceRoleKey: "server-test-secret",
};

const quoteFixture = {
  id: "Q-HOTFIX-1",
  quoteNumber: "QT-20260716-0001",
  clientName: "Freeze test",
  projectName: "Freeze test",
  contactName: "Tester",
  currency: "EUR",
  startDate: "2026-07-16",
  endDate: "2026-07-16",
  items: [{ type: "misc", name: "Test item", unit: "item", quantity: 1, cost: 1, price: 2, currency: "EUR" }],
};

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("supabaseRequest preserves HTTP status and structured PostgREST error fields", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => jsonResponse(500, {
    code: "55000",
    message: "报价维护中，暂时禁止新建、编辑或删除，请稍后再试。",
    details: null,
    hint: null,
  });
  try {
    await assert.rejects(
      () => supabaseRequest(remoteConfig, "quotes", { method: "POST", body: "{}" }),
      (error) => {
        assert.equal(error.status, 500);
        assert.equal(error.code, "55000");
        assert.equal(error.details, null);
        assert.equal(error.hint, null);
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});

async function assertRemoteSaveRejected(remoteError, expectedCode, expectedStatus) {
  let localSaveCalls = 0;
  const store = createQuoteStore({
    data: { quotes: [] },
    saveData: () => { localSaveCalls += 1; },
    supabaseConfig: remoteConfig,
  });

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).endsWith("/rest/v1/")) {
      return jsonResponse(200, {
        definitions: { quotes: { properties: {} } },
        paths: {},
      });
    }
    return jsonResponse(remoteError.status, remoteError.body);
  };
  try {
    await assert.rejects(
      () => store.saveQuote({ ...quoteFixture }),
      (error) => {
        assert.equal(error.code, expectedCode);
        assert.equal(error.statusCode, expectedStatus);
        return true;
      },
    );
    assert.equal(localSaveCalls, 0, "remote rejection must never write local JSON");
  } finally {
    global.fetch = originalFetch;
  }
}

test("frozen quote writes return QUOTE_WRITES_FROZEN and never fall back locally", async () => {
  await assertRemoteSaveRejected({
    status: 500,
    body: { code: "55000", message: "报价维护中，暂时禁止新建、编辑或删除，请稍后再试。" },
  }, "QUOTE_WRITES_FROZEN", 423);
});

test("RLS rejection never falls back locally", async () => {
  await assertRemoteSaveRejected({
    status: 403,
    body: { code: "42501", message: "new row violates row-level security policy" },
  }, "QUOTE_WRITE_FORBIDDEN", 403);
});

test("unique constraint conflict never falls back locally", async () => {
  await assertRemoteSaveRejected({
    status: 409,
    body: { code: "23505", message: "duplicate key value violates unique constraint" },
  }, "QUOTE_NUMBER_CONFLICT", 409);
});

test("database validation rejection never falls back locally", async () => {
  await assertRemoteSaveRejected({
    status: 400,
    body: { code: "23502", message: "null value violates not-null constraint" },
  }, "QUOTE_DATA_INVALID", 422);
});

test("Supabase infrastructure failure never masquerades as a production save", async () => {
  let localSaveCalls = 0;
  const store = createQuoteStore({
    data: { quotes: [] },
    saveData: () => { localSaveCalls += 1; },
    supabaseConfig: remoteConfig,
  });
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new TypeError("fetch failed"); };
  try {
    await assert.rejects(
      () => store.saveQuote({ ...quoteFixture }),
      (error) => error.code === "QUOTE_REMOTE_UNAVAILABLE" && error.statusCode === 503,
    );
    assert.equal(localSaveCalls, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test("local JSON save remains available only when Supabase is explicitly disabled", async () => {
  let localSaveCalls = 0;
  const store = createQuoteStore({
    data: { quotes: [] },
    saveData: () => { localSaveCalls += 1; },
    supabaseConfig: { enabled: false },
  });
  const result = await store.saveQuote({ ...quoteFixture });
  assert.equal(result.source, "local_json");
  assert.equal(localSaveCalls, 1);
});

test("successful Supabase save path remains unchanged", async () => {
  let localSaveCalls = 0;
  const store = createQuoteStore({
    data: { quotes: [] },
    saveData: () => { localSaveCalls += 1; },
    supabaseConfig: remoteConfig,
  });
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).endsWith("/rest/v1/")) {
      return jsonResponse(200, { definitions: { quotes: { properties: {} } }, paths: {} });
    }
    return new Response(null, { status: 204 });
  };
  try {
    const result = await store.saveQuote({ ...quoteFixture });
    assert.equal(result.source, "supabase");
    assert.equal(localSaveCalls, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test("frontend fetch helper rejects frozen writes with machine code and maintenance copy", async () => {
  const source = fs.readFileSync(path.join(process.cwd(), "web", "app-utils.js"), "utf8");
  const context = {
    fetch: async () => jsonResponse(423, {
      ok: false,
      code: "QUOTE_WRITES_FROZEN",
      message: "报价功能正在进行维护，当前无法保存。你的输入内容尚未写入生产数据库，请稍后重试。",
    }),
    localStorage: { removeItem() {} },
    sessionStorage: { setItem() {}, getItem() { return null; }, removeItem() {} },
    document: { getElementById() { return null; } },
    window: {
      location: { hostname: "production.example", href: "" },
      AuthStore: { getToken() { return "token"; }, clearSession() {} },
    },
    URL,
  };
  context.window.window = context.window;
  vm.runInNewContext(source, context);

  await assert.rejects(
    () => context.window.AppUtils.fetchJson("/api/quotes", { method: "POST" }, "fallback"),
    (error) => {
      assert.equal(error.code, "QUOTE_WRITES_FROZEN");
      assert.match(error.message, /尚未写入生产数据库/);
      return true;
    },
  );
});

test("quote API returns 423 with QUOTE_WRITES_FROZEN while GET remains available", async () => {
  const tempDataFile = path.join(process.cwd(), "tests", "temp-quote-freeze-seed.json");
  const originalFetch = global.fetch;
  const previousEnv = {
    DATA_FILE: process.env.DATA_FILE,
    ALLOW_DEV_BYPASS: process.env.ALLOW_DEV_BYPASS,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  fs.writeFileSync(tempDataFile, JSON.stringify({ quotes: [], receptions: [], documents: [], templates: [] }));
  process.env.DATA_FILE = tempDataFile;
  process.env.ALLOW_DEV_BYPASS = "true";
  process.env.SUPABASE_URL = remoteConfig.url;
  process.env.SUPABASE_ANON_KEY = "anon-test-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = remoteConfig.serviceRoleKey;

  const remoteQuoteRow = {
    id: "Q-HOTFIX-REMOTE",
    quote_number: "QT-20260716-0001",
    client_name: "Freeze test",
    project_name: "Freeze test",
    contact_name: "Tester",
    currency: "EUR",
    start_date: "2026-07-16",
    end_date: "2026-07-16",
    quote_items: [],
  };

  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.startsWith(remoteConfig.url)) {
      if (target.endsWith("/rest/v1/")) {
        return jsonResponse(200, { definitions: { quotes: { properties: {} } }, paths: {} });
      }
      if (target.includes("templates?")) {
        return jsonResponse(200, [{ id: "TPL-TEST", name: "Test", template_items: [] }]);
      }
      if (target.includes("quote_item_types?") || target.includes("project_group_types?")) {
        return jsonResponse(200, []);
      }
      if (target.includes("quotes?select=")) {
        return jsonResponse(200, [remoteQuoteRow]);
      }
      if (target.includes("/rest/v1/quotes") && ["POST", "DELETE"].includes(options.method)) {
        return jsonResponse(500, {
          code: "55000",
          message: "报价维护中，暂时禁止新建、编辑或删除，请稍后再试。",
          details: null,
          hint: null,
        });
      }
      throw new Error(`Unexpected Supabase test request: ${options.method || "GET"} ${target}`);
    }
    return originalFetch(url, options);
  };

  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const authHeaders = { Authorization: "Bearer dev-bypass-token" };
  try {
    const getResponse = await originalFetch(`${baseUrl}/api/quotes`, { headers: authHeaders });
    assert.equal(getResponse.status, 200);
    const detailResponse = await originalFetch(`${baseUrl}/api/quotes/Q-HOTFIX-REMOTE`, { headers: authHeaders });
    assert.equal(detailResponse.status, 200);

    const postResponse = await originalFetch(`${baseUrl}/api/quotes`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(quoteFixture),
    });
    const postPayload = await postResponse.json();
    assert.equal(postResponse.status, 423, JSON.stringify(postPayload));
    assert.deepEqual(postPayload, {
      ok: false,
      error: "报价功能正在进行维护，当前无法保存。你的输入内容尚未写入生产数据库，请稍后重试。",
      code: "QUOTE_WRITES_FROZEN",
      message: "报价功能正在进行维护，当前无法保存。你的输入内容尚未写入生产数据库，请稍后重试。",
    });

    const putResponse = await originalFetch(`${baseUrl}/api/quotes/Q-HOTFIX-REMOTE`, {
      method: "PUT",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(quoteFixture),
    });
    assert.equal(putResponse.status, 423);
    assert.equal((await putResponse.json()).code, "QUOTE_WRITES_FROZEN");

    const deleteResponse = await originalFetch(`${baseUrl}/api/quotes/Q-HOTFIX-REMOTE`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.equal(deleteResponse.status, 423);
    assert.equal((await deleteResponse.json()).code, "QUOTE_WRITES_FROZEN");

    const persisted = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    assert.deepEqual(persisted.quotes, [], "frozen API writes must not create local JSON records");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (fs.existsSync(tempDataFile)) fs.unlinkSync(tempDataFile);
  }
});
