const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveAdvertisingFxSnapshot } = require("../server/services/advertisingFxSnapshot");

test("V1 does not request an exchange rate", async () => {
  let called = false;
  const result = await resolveAdvertisingFxSnapshot({
    pricingEngine: "legacy_v1",
    getLatestRate: async () => { called = true; },
  });
  assert.equal(result, null);
  assert.equal(called, false);
});

test("existing V2 quote reuses a clone of its saved snapshot", async () => {
  const saved = { baseCurrency: "EUR", quoteCurrency: "RSD", rate: 117.2, rateDate: "2026-08-01", source: "saved" };
  const result = await resolveAdvertisingFxSnapshot({
    pricingEngine: "bom_v2",
    existingQuote: { fxSnapshot: saved },
    getLatestRate: async () => assert.fail("must not read the global rate"),
  });
  assert.deepEqual(result, saved);
  assert.notEqual(result, saved);
});

test("new V2 quote normalizes the latest EUR/RSD rate", async () => {
  const result = await resolveAdvertisingFxSnapshot({
    pricingEngine: "bom_v2",
    effectiveOn: "2026-08-11",
    getLatestRate: async (base, quote, date) => ({
      baseCurrency: base,
      quoteCurrency: quote,
      rate: "117.3",
      rateDate: date,
      source: "manual",
    }),
  });
  assert.deepEqual(result, {
    baseCurrency: "EUR",
    quoteCurrency: "RSD",
    rate: 117.3,
    rateDate: "2026-08-11",
    source: "manual",
  });
});

test("missing or non-positive V2 rate fails with NO_EXCHANGE_RATE", async () => {
  for (const rate of [null, { rate: 0 }, { rate: -1 }]) {
    await assert.rejects(
      () => resolveAdvertisingFxSnapshot({ pricingEngine: "bom_v2", getLatestRate: async () => rate }),
      error => error.statusCode === 422 && error.code === "NO_EXCHANGE_RATE"
    );
  }
});
