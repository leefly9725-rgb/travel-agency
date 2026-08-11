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
