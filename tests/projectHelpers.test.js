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
