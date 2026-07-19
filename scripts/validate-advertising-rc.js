"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

function loadTestEnv() {
  const file = path.resolve(process.cwd(), ".env.test");
  assert.ok(fs.existsSync(file), ".env.test is required");
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  const required = ["URL", "ANON_KEY", "SERVICE_ROLE_KEY", "ADMIN_EMAIL", "ADMIN_PASSWORD", "ADMIN_USER_ID", "STAFF_A_EMAIL", "STAFF_A_PASSWORD", "STAFF_A_USER_ID", "STAFF_B_EMAIL", "STAFF_B_PASSWORD", "STAFF_B_USER_ID"];
  for (const suffix of required) assert.ok(env[`SUPABASE_TEST_${suffix}`], `SUPABASE_TEST_${suffix} is required`);
  const parsedUrl = new URL(env.SUPABASE_TEST_URL);
  const ref = parsedUrl.hostname.split(".")[0];
  assert.equal(ref, "uidfqpksuvebsrbnlyzl", "test URL must identify LDS-OPS-TEST");
  env.SUPABASE_TEST_URL = parsedUrl.origin;
  return env;
}

async function main() {
  const env = loadTestEnv();
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = env.SUPABASE_TEST_URL;
  process.env.SUPABASE_ANON_KEY = env.SUPABASE_TEST_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_TEST_SERVICE_ROLE_KEY;
  process.env.ALLOW_DEV_BYPASS = "false";

  const base = env.SUPABASE_TEST_URL;
  const anon = env.SUPABASE_TEST_ANON_KEY;
  const service = env.SUPABASE_TEST_SERVICE_ROLE_KEY;
  const rest = async (pathname, { key = anon, token = key, method = "GET", body, headers = {} } = {}) => {
    const response = await fetch(`${base}/rest/v1/${pathname}`, { method, headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: response.status, data, headers: response.headers };
  };
  const login = async (email, password) => {
    const response = await fetch(`${base}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await response.json(); assert.equal(response.status, 200, "test login failed"); assert.ok(data.access_token); return data.access_token;
  };
  const [adminToken, staffAToken, staffBToken] = await Promise.all([
    login(env.SUPABASE_TEST_ADMIN_EMAIL, env.SUPABASE_TEST_ADMIN_PASSWORD),
    login(env.SUPABASE_TEST_STAFF_A_EMAIL, env.SUPABASE_TEST_STAFF_A_PASSWORD),
    login(env.SUPABASE_TEST_STAFF_B_EMAIL, env.SUPABASE_TEST_STAFF_B_PASSWORD),
  ]);
  const rpcSave = async (quote) => {
    const result = await rest("rpc/save_advertising_quote", { key: service, method: "POST", body: { p_quote: quote } });
    if (result.status >= 400) throw Object.assign(new Error("RPC save failed"), { result });
    return Array.isArray(result.data) ? result.data[0] : result.data;
  };
  const quotePayload = (id, entityId, ownerId) => ({ id, entityId, ownerId, status: "draft", mode: "project", clientName: "RC Client", projectName: "RC Project", currency: "EUR", items: [{ id: `${id}-item`, groupId: "g1", name: "RC Board", materialId: "pvc-3", width: 1000, height: 800, sizeUnit: "mm", quantity: 2, sides: 2, position: 0, processes: [{ id: `${id}-process`, processId: "uv", position: 0 }] }], additionalFees: [{ id: `${id}-fee`, category: "delivery", customerVisible: true, position: 0, saleAmount: 10 }], calculationSnapshot: { totalIncludingVat: 123, totalCost: 45, grossProfit: 78 }, termsSnapshot: { validityDays: 15 } });

  const txId = `RC-TX-${Date.now()}`;
  const initial = await rpcSave(quotePayload(txId, "lds", env.SUPABASE_TEST_STAFF_A_USER_ID));
  assert.match(initial.quote_number, /^LDS-ADV-\d{4}-\d{4}$/);
  const updatedPayload = quotePayload(txId, "lds", env.SUPABASE_TEST_STAFF_A_USER_ID); updatedPayload.projectName = "RC Project Updated";
  const updated = await rpcSave(updatedPayload); assert.equal(updated.quote_number, initial.quote_number);
  const reopened = await rest(`advertising_quotes?id=eq.${encodeURIComponent(txId)}&select=*`, { key: service });
  assert.equal(reopened.data[0].project_name, "RC Project Updated");

  const before = JSON.stringify(reopened.data[0]);
  const failures = [
    { ...updatedPayload, projectName: "bad material", items: [{ ...updatedPayload.items[0], materialId: "missing-material" }] },
    { ...updatedPayload, projectName: "bad process", items: [{ ...updatedPayload.items[0], processes: [{ id: "bad-process-row", processId: "missing-process" }] }] },
    { ...updatedPayload, projectName: "bad log", adjustmentLogs: [{ quoteItemId: updatedPayload.items[0].id, fieldName: "manualAdjustment", oldValue: 0, newValue: 1, reason: "" }] },
  ];
  for (const payload of failures) { const result = await rest("rpc/save_advertising_quote", { key: service, method: "POST", body: { p_quote: payload } }); assert.ok(result.status >= 400); const after = await rest(`advertising_quotes?id=eq.${encodeURIComponent(txId)}&select=*`, { key: service }); assert.equal(JSON.stringify(after.data[0]), before); }

  const runConcurrent = async (entityId, ownerId) => {
    const stamp = `${entityId}-${Date.now()}`;
    const saved = await Promise.all(Array.from({ length: 20 }, (_, i) => rpcSave(quotePayload(`RC-${stamp}-${i}`, entityId, ownerId))));
    const numbers = saved.map(x => x.quote_number); assert.equal(new Set(numbers).size, 20); return numbers;
  };
  const ldsNumbers = await runConcurrent("lds", env.SUPABASE_TEST_STAFF_A_USER_ID);
  const emaNumbers = await runConcurrent("ema", env.SUPABASE_TEST_STAFF_B_USER_ID);

  const rls = {};
  for (const [name, token] of [["anon", null], ["admin", adminToken], ["staffA", staffAToken], ["staffB", staffBToken]]) {
    const opts = token ? { key: anon, token } : { key: anon, token: anon };
    const quotes = await rest("advertising_quotes?select=id,owner_id,data&limit=5", opts);
    const catalog = await rest("advertising_materials?select=id,data&limit=2", opts);
    const logs = await rest("advertising_quote_adjustment_logs?select=*&limit=2", opts);
    rls[name] = { quotes: quotes.status, quoteRows: Array.isArray(quotes.data) ? quotes.data.length : -1, catalog: catalog.status, catalogRows: Array.isArray(catalog.data) ? catalog.data.length : -1, logs: logs.status, logRows: Array.isArray(logs.data) ? logs.data.length : -1 };
  }
  assert.equal(rls.admin.quoteRows > 0, true, JSON.stringify(rls)); assert.equal(rls.staffA.quoteRows, 0, JSON.stringify(rls)); assert.equal(rls.staffB.quoteRows, 0, JSON.stringify(rls)); assert.equal(rls.anon.quotes, 401, JSON.stringify(rls));

  const { createServer } = require("../server/app");
  const server = createServer(); await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const apiBase = `http://127.0.0.1:${server.address().port}`;
  const api = async (pathname, { token, method = "GET", body } = {}) => { const response = await fetch(`${apiBase}${pathname}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); const type=response.headers.get("content-type")||""; const data=type.includes("json")?await response.json():Buffer.from(await response.arrayBuffer()); return { status:response.status,data,type }; };
  try {
    assert.equal((await api("/api/advertising/catalog")).status, 401);
    assert.equal((await api("/api/advertising/catalog", { token: adminToken })).status, 200);
    const aCreate = await api("/api/advertising/quotes", { token: staffAToken, method: "POST", body: quotePayload(undefined, "lds", undefined) }); assert.equal(aCreate.status, 201);
    const aId = aCreate.data.id; assert.ok(aId); assert.equal(JSON.stringify(aCreate.data).includes("costPrice"), false); assert.equal(JSON.stringify(aCreate.data).includes("totalCost"), false);
    assert.equal((await api(`/api/advertising/quotes/${aId}`, { token: staffAToken })).status, 200);
    assert.equal((await api(`/api/advertising/quotes/${aId}`, { token: staffBToken })).status, 403);
    const put = quotePayload(aId, "lds", undefined); put.projectName="Staff A Updated"; assert.equal((await api(`/api/advertising/quotes/${aId}`, { token: staffAToken, method:"PUT", body:put })).status, 200);
    assert.equal((await api("/api/advertising/materials/pvc-3", { token: staffAToken, method:"PUT", body:{ suggestedSalePrice: 20, adjustmentReason:"RC" } })).status, 403);
    assert.equal((await api("/api/advertising/adjustment-logs", { token: staffAToken })).status, 403);
    assert.equal((await api(`/api/advertising/quotes/${aId}`, { token: staffAToken, method:"DELETE" })).status, 403);
    const editorScript = fs.readFileSync(path.resolve(process.cwd(), "web/advertising-quote.js"), "utf8");
    assert.match(editorScript, /if\(format==='pdf'\)\{printQuote\(internal\);return\}/, "PDF must use browser-native print flow");
    assert.match(editorScript, /window\.print\(\)/, "PDF print flow must invoke window.print");
    const exports = {};
    for (const format of ["docx"]) for (const internal of [false, true]) {
      const key=`staff_${format}_${internal?"internal":"customer"}`; const result=await api(`/api/advertising/quotes/${aId}/export/${format}${internal?"?internal=1":""}`,{token:staffAToken,method:"POST"}); exports[key]={status:result.status,size:Buffer.isBuffer(result.data)?result.data.length:0,error:result.status>=400?result.data?.error:undefined};
    }
    assert.equal(exports.staff_docx_customer.status,200,JSON.stringify(exports)); assert.equal(exports.staff_docx_internal.status,403,JSON.stringify(exports));
    const adminDocx=await api(`/api/advertising/quotes/${aId}/export/docx?internal=1`,{token:adminToken,method:"POST"}); assert.equal(adminDocx.status,200,`admin docx ${adminDocx.status}`);
    console.log(JSON.stringify({ ok:true, transaction:{created:true,updated:true,reopened:true,rollbacks:3}, concurrency:{lds:ldsNumbers.length,ema:emaNumbers.length,ldsUnique:new Set(ldsNumbers).size,emaUnique:new Set(emaNumbers).size}, rls, nodeApi:{anonymousDenied:true,staffOwnCrud:true,crossUserDenied:true,costSanitized:true,catalogDenied:true,auditDenied:true}, exports:{...exports,pdf_browser_print:true,admin_docx_internal:{status:adminDocx.status,size:adminDocx.data.length}} }));
  } finally { await new Promise(resolve => server.close(resolve)); }
}

main().catch(error => { console.error(JSON.stringify({ ok:false, message:error.message, status:error.result?.status, location:String(error.stack||"").split("\n")[1]?.trim() })); process.exitCode=1; });
