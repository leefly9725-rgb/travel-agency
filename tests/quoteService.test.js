const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateQuoteTotals, calculateInclusiveDays } = require("../server/services/quoteService");

test("calculateQuoteTotals returns totals, profit, and margin", () => {
  const result = calculateQuoteTotals([
    { name: "hotel", currency: "EUR", cost: 80, price: 120, quantity: 2 },
    { name: "guide", currency: "EUR", cost: 50, price: 90, quantity: 1 },
  ], "EUR");

  assert.equal(result.totalCost, 210);
  assert.equal(result.totalPrice, 330);
  assert.equal(result.grossProfit, 120);
  assert.equal(result.grossMargin, 36.36);
});

test("calculateQuoteTotals supports hotel detail rows with separate cost and sales", () => {
  const result = calculateQuoteTotals([
    {
      type: "hotel",
      name: "贝尔格莱德商务酒店",
      hotelDetails: [
        { roomType: "标准双床房", roomCount: 2, nights: 3, costNightlyRate: 70, priceNightlyRate: 80, currency: "EUR", notes: "" },
        { roomType: "大床房", roomCount: 1, nights: 3, costNightlyRate: 90, priceNightlyRate: 100, currency: "EUR", notes: "" },
      ],
    },
  ], "EUR");

  assert.equal(result.items[0].hotelDetails.length, 2);
  assert.equal(result.items[0].hotelDetails[0].costSubtotalOriginal, 420);
  assert.equal(result.items[0].hotelDetails[0].priceSubtotalOriginal, 480);
  assert.equal(result.items[0].totalCost, 690);
  assert.equal(result.items[0].totalPrice, 780);
  assert.equal(result.totalCost, 690);
  assert.equal(result.totalPrice, 780);
});

test("calculateQuoteTotals supports vehicle detail rows with separate cost and sales", () => {
  const result = calculateQuoteTotals([
    {
      type: "vehicle",
      name: "商务用车",
      vehicleDetails: [
        { detailType: "pickup", vehicleModel: "奔驰 V 级", vehicleCount: 2, pricingUnit: "trip", costUnitPrice: 60, priceUnitPrice: 90, currency: "EUR", notes: "" },
        { detailType: "full_day", vehicleModel: "别克 GL8", vehicleCount: 1, pricingUnit: "full_day", costUnitPrice: 150, priceUnitPrice: 220, currency: "EUR", notes: "" },
      ],
    },
  ], "EUR");

  assert.equal(result.items[0].vehicleDetails.length, 2);
  assert.equal(result.items[0].vehicleDetails[0].costSubtotalOriginal, 120);
  assert.equal(result.items[0].vehicleDetails[0].priceSubtotalOriginal, 180);
  assert.equal(result.items[0].totalCost, 270);
  assert.equal(result.items[0].totalPrice, 400);
  assert.equal(result.totalCost, 270);
  assert.equal(result.totalPrice, 400);
});

test("calculateQuoteTotals supports guide and interpreter service detail rows", () => {
  const result = calculateQuoteTotals([
    {
      type: "guide",
      name: "导游与翻译服务",
      serviceDetails: [
        { serviceRole: "guide", serviceLanguage: "zh", serviceDuration: "full_day", quantity: 1, costUnitPrice: 120, priceUnitPrice: 180, currency: "EUR", notes: "" },
        { serviceRole: "interpreter", serviceLanguage: "zh-en", serviceDuration: "hour", quantity: 4, costUnitPrice: 20, priceUnitPrice: 35, currency: "EUR", notes: "" },
      ],
    },
  ], "EUR");

  assert.equal(result.items[0].serviceDetails.length, 2);
  assert.equal(result.items[0].serviceDetails[0].costSubtotalOriginal, 120);
  assert.equal(result.items[0].serviceDetails[1].priceSubtotalOriginal, 140);
  assert.equal(result.items[0].totalCost, 200);
  assert.equal(result.items[0].totalPrice, 320);
});

test("calculateQuoteTotals converts mixed currencies into the base quote currency", () => {
  const result = calculateQuoteTotals([
    { name: "vehicle", currency: "RSD", cost: 117, price: 234, quantity: 1 },
    { name: "hotel", currency: "EUR", cost: 80, price: 100, quantity: 2 },
  ], "EUR");

  assert.equal(result.items[0].convertedCost, 1);
  assert.equal(result.items[0].convertedPrice, 2);
  assert.equal(result.totalCost, 161);
  assert.equal(result.totalPrice, 202);
});

test("calculateInclusiveDays counts start and end dates inclusively", () => {
  assert.equal(calculateInclusiveDays("2026-03-11", "2026-03-13"), 3);
});

test("calculateQuoteTotals protects against divide-by-zero margin", () => {
  const result = calculateQuoteTotals([
    { name: "free-service", currency: "EUR", cost: 10, price: 0, quantity: 1 },
  ], "EUR");

  assert.equal(result.totalCost, 10);
  assert.equal(result.totalPrice, 0);
  assert.equal(result.grossProfit, -10);
  assert.equal(result.grossMargin, 0);
});
