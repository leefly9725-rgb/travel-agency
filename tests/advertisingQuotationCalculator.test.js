const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateAdvertisingQuotation, convertAreaToSquareMeters } = require("../server/services/advertisingQuotationCalculator");

const catalog = {
  materials: [{ id: "pvc", nameZh: "PVC发泡板", costPrice: 9.5, suggestedSalePrice: 14, minimumSalePrice: 9.5, unit: "sqm", isActive: true }],
  processes: [{ id: "uv", nameZh: "UV打印", costPrice: 15.5, suggestedSalePrice: 20, unit: "sqm", supportsDoubleSide: true, isActive: true }],
  rules: [{ materialId: "pvc", processId: "uv", isActive: true }],
};

test("converts 1200x800 mm to 0.96 square metres", () => {
  assert.equal(convertAreaToSquareMeters(1200, 800, "mm"), 0.96);
});

test("double-sided printing doubles process area but not material area", () => {
  const result = calculateAdvertisingQuotation({ items: [{ name: "板", materialId: "pvc", width: 1000, height: 1000, sizeUnit: "mm", quantity: 1, sides: 2, processes: [{ processId: "uv" }] }], minimumProcessingFee: 0, minimumOrderAmount: 0, vatMode: "not_applicable" }, catalog);
  assert.equal(result.items[0].materialArea, 1);
  assert.equal(result.items[0].processes[0].billingQuantity, 2);
});

test("minimum processing fee is applied once per product", () => {
  const result = calculateAdvertisingQuotation({ items: [{ name: "板", materialId: "pvc", width: 1000, height: 1000, sizeUnit: "mm", quantity: 1, processes: [{ processId: "uv", actualSalePrice: 22 }] }], minimumProcessingFee: 35, minimumOrderAmount: 0, vatMode: "not_applicable" }, catalog);
  assert.equal(result.items[0].processingSaleBeforeMinimum, 22);
  assert.equal(result.items[0].minimumProcessingSurcharge, 13);
});

test("minimum order excludes delivery and VAT", () => {
  const result = calculateAdvertisingQuotation({ items: [], additionalFees: [{ category: "production", name: "制作", quantity: 1, saleUnitPrice: 52 }], minimumOrderAmount: 75, delivery: { enabled: true, quantity: 1, saleUnitPrice: 150 }, vatMode: "exclusive", vatRate: 20 }, catalog);
  assert.equal(result.minimumOrderBasis, 52);
  assert.equal(result.minimumOrderSurcharge, 23);
  assert.equal(result.subtotalExcludingVat, 225);
  assert.equal(result.vatAmount, 45);
  assert.equal(result.totalIncludingVat, 270);
});

test("calculates delivery and construction quantities", () => {
  const result = calculateAdvertisingQuotation({ items: [], minimumOrderAmount: 0, delivery: { enabled: true, quantity: 2, saleUnitPrice: 150 }, additionalFees: [{ category: "construction", name: "升降机", quantity: 5, saleUnitPrice: 100 }], vatMode: "not_applicable" }, catalog);
  assert.equal(result.deliverySale, 300);
  assert.equal(result.additionalFees[0].saleAmount, 500);
});

test("protects gross margin when sales are zero", () => {
  const result = calculateAdvertisingQuotation({ items: [], minimumOrderAmount: 0, vatMode: "not_applicable" }, catalog);
  assert.equal(result.grossMargin, 0);
});

test("project groups preserve item grouping and totals",()=>{const result=calculateAdvertisingQuotation({mode:'project',groups:[{id:'g1',nameZh:'户外广告'}],items:[{id:'i1',groupId:'g1',name:'板',materialId:'pvc',width:1000,height:1000,sizeUnit:'mm',quantity:1,processes:[]}],minimumOrderAmount:0,vatMode:'not_applicable'},catalog);assert.equal(result.items[0].groupId,'g1');assert.equal(result.groupTotals[0].saleAmount,14)});
test("applies percentage and fixed discounts before VAT",()=>{const result=calculateAdvertisingQuotation({items:[],additionalFees:[{category:'production',name:'制作',quantity:1,saleUnitPrice:100}],minimumOrderAmount:0,discountPercent:10,fixedDiscount:5,vatMode:'exclusive',vatRate:20},catalog);assert.equal(result.discountAmount,15);assert.equal(result.subtotalExcludingVat,85);assert.equal(result.vatAmount,17)});

test("rejects an explicit material sale price below the catalog minimum", () => {
  const strictCatalog = {
    ...catalog,
    materials: [{ ...catalog.materials[0], minimumSalePrice: 15 }],
  };
  assert.throws(
    () => calculateAdvertisingQuotation({
      items: [{
        materialId: "pvc",
        width: 1000,
        height: 1000,
        sizeUnit: "mm",
        quantity: 1,
        materialSaleUnitPrice: 1,
        processes: [],
      }],
      minimumOrderAmount: 0,
      vatMode: "not_applicable",
    }, strictCatalog),
    (error) => error.code === "BELOW_MINIMUM_MATERIAL_PRICE"
  );
});

test("material-process rule minimum overrides quote-level processing minimum", () => {
  const strictCatalog = {
    ...catalog,
    rules: [{
      ...catalog.rules[0],
      defaultMinimumFeeOverride: 90,
    }],
  };
  const result = calculateAdvertisingQuotation({
    items: [{
      materialId: "pvc",
      width: 1000,
      height: 1000,
      sizeUnit: "mm",
      quantity: 1,
      processes: [{ processId: "uv" }],
    }],
    minimumProcessingFee: 35,
    minimumOrderAmount: 0,
    vatMode: "not_applicable",
  }, strictCatalog);
  assert.equal(result.items[0].minimumProcessingFeeApplied, 90);
  assert.equal(result.items[0].minimumProcessingSurcharge, 70);
});

test("inclusive VAT splits a tax-inclusive total into net and VAT", () => {
  const result = calculateAdvertisingQuotation({
    items: [],
    additionalFees: [{
      category: "production",
      quantity: 1,
      saleUnitPrice: 120,
    }],
    minimumOrderAmount: 0,
    vatMode: "inclusive",
    vatRate: 20,
  }, catalog);
  assert.equal(result.subtotalExcludingVat, 100);
  assert.equal(result.vatAmount, 20);
  assert.equal(result.totalIncludingVat, 120);
});

test("delivery additional fees are excluded from the minimum basis but included in total", () => {
  const result = calculateAdvertisingQuotation({
    items: [],
    additionalFees: [{
      category: "delivery",
      quantity: 1,
      saleUnitPrice: 150,
    }],
    minimumOrderAmount: 75,
    vatMode: "not_applicable",
  }, catalog);
  assert.equal(result.minimumOrderBasis, 0);
  assert.equal(result.minimumOrderSurcharge, 75);
  assert.equal(result.deliverySale, 150);
  assert.equal(result.totalIncludingVat, 225);
});
