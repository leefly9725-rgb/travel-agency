"use strict";

const round = (value, digits = 2) => Number((Number(value || 0)).toFixed(digits));
const positive = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

function convertAreaToSquareMeters(width, height, unit = "mm") {
  const factors = { mm: 0.001, cm: 0.01, m: 1 };
  if (!factors[unit]) throw Object.assign(new Error("不支持的尺寸单位。"), { code: "INVALID_SIZE_UNIT" });
  const w = positive(width);
  const h = positive(height);
  if (!w || !h) throw Object.assign(new Error("宽度和高度必须大于0。"), { code: "INVALID_DIMENSIONS" });
  return round(w * factors[unit] * h * factors[unit], 4);
}

function findActive(rows, id, label) {
  const row = (rows || []).find((entry) => String(entry.id) === String(id) && entry.isActive !== false);
  if (!row) throw Object.assign(new Error(`${label}不存在或已停用。`), { code: "CATALOG_ITEM_UNAVAILABLE" });
  return row;
}

function calculateAdvertisingQuotation(input = {}, catalog = {}, context = {}) {
  const minimumProcessingFee = positive(input.minimumProcessingFee, 35);
  const items = (input.items || []).map((source, index) => {
    const material = findActive(catalog.materials, source.materialId, "材料");
    const singleArea = convertAreaToSquareMeters(source.width, source.height, source.sizeUnit || "mm");
    const quantity = positive(source.quantity, 1) || 1;
    const materialArea = round(singleArea * quantity, 4);
    const materialCostUnitPrice = positive(material.costPrice);
    const materialSaleUnitPrice = positive(source.materialSaleUnitPrice, positive(material.suggestedSalePrice));
    const minimumMaterialSalePrice = positive(material.minimumSalePrice);
    if (
      source.materialSaleUnitPrice !== undefined &&
      source.materialSaleUnitPrice !== null &&
      source.materialSaleUnitPrice !== "" &&
      materialSaleUnitPrice < minimumMaterialSalePrice
    ) {
      throw Object.assign(new Error(`材料售价不得低于最低售价：${minimumMaterialSalePrice}。`), {
        code: "BELOW_MINIMUM_MATERIAL_PRICE",
      });
    }
    const materialCostAmount = round(materialArea * materialCostUnitPrice);
    const materialSaleAmount = round(materialArea * materialSaleUnitPrice);
    let processingCost = 0;
    let processingSaleBeforeMinimum = 0;
    const processes = (source.processes || []).map((selected) => {
      const process = findActive(catalog.processes, selected.processId, "工艺");
      const rule = (catalog.rules || []).find((entry) => String(entry.materialId) === String(material.id) && String(entry.processId) === String(process.id) && entry.isActive !== false);
      if (!rule) throw Object.assign(new Error(`材料不支持工艺：${process.nameZh || process.id}`), { code: "PROCESS_NOT_ALLOWED" });
      const sideMultiplier = Number(source.sides) === 2 && process.supportsDoubleSide ? 2 : 1;
      const billingQuantity = process.unit === "fixed" ? 1 : round(materialArea * sideMultiplier, 4);
      const costUnitPrice = positive(rule.costPriceOverride, positive(process.costPrice));
      const suggestedSalePrice = positive(rule.suggestedSalePriceOverride, positive(process.suggestedSalePrice));
      if (process.requiresManualQuote && selected.actualSalePrice === undefined) throw Object.assign(new Error(`工艺需要手动报价：${process.nameZh}`), { code: "MANUAL_PRICE_REQUIRED" });
      const saleUnitPrice = positive(selected.actualSalePrice, suggestedSalePrice);
      const costAmount = round(billingQuantity * costUnitPrice);
      const saleAmount = round(billingQuantity * saleUnitPrice);
      const minimumFeeSnapshot = positive(
        rule.defaultMinimumFeeOverride,
        positive(process.defaultMinimumFee)
      );
      processingCost += costAmount;
      processingSaleBeforeMinimum += saleAmount;
      return { processId: process.id, processNameSnapshot: process.nameZh, billingQuantity, costUnitPriceSnapshot: costUnitPrice, saleUnitPriceSnapshot: saleUnitPrice, minimumFeeSnapshot, costAmount, saleAmount };
    });
    processingCost = round(processingCost);
    processingSaleBeforeMinimum = round(processingSaleBeforeMinimum);
    const applicableMinimum = processes.length
      ? Math.max(
          positive(source.minimumProcessingFee, minimumProcessingFee),
          ...processes.map((process) => positive(process.minimumFeeSnapshot))
        )
      : 0;
    const minimumProcessingSurcharge = round(Math.max(0, applicableMinimum - processingSaleBeforeMinimum));
    const manualAdjustment = round(Number(source.manualAdjustment || 0));
    const costAmount = round(materialCostAmount + processingCost);
    const saleAmount = round(materialSaleAmount + processingSaleBeforeMinimum + minimumProcessingSurcharge + manualAdjustment);
    return { ...source, id: source.id || `advertising-item-${index + 1}`, singleArea, materialArea, materialNameSnapshot: material.nameZh, specificationSnapshot: material.specification || "", materialCostUnitPriceSnapshot: materialCostUnitPrice, materialSaleUnitPriceSnapshot: materialSaleUnitPrice, materialCostAmount, materialSaleAmount, processes, processingCost, processingSaleBeforeMinimum, minimumProcessingFeeApplied: applicableMinimum, minimumProcessingSurcharge, costAmount, saleAmount };
  });

  const additionalFees = (input.additionalFees || []).map((fee) => ({ ...fee, quantity: positive(fee.quantity, 1), costAmount: round(positive(fee.quantity, 1) * positive(fee.costUnitPrice)), saleAmount: round(positive(fee.quantity, 1) * positive(fee.saleUnitPrice)) }));
  const itemSale = round(items.reduce((sum, item) => sum + item.saleAmount, 0));
  const itemCost = round(items.reduce((sum, item) => sum + item.costAmount, 0));
  const applicableFees = additionalFees.filter((fee) => fee.category !== "delivery");
  const additionalSale = round(additionalFees.reduce((sum, fee) => sum + fee.saleAmount, 0));
  const additionalCost = round(additionalFees.reduce((sum, fee) => sum + fee.costAmount, 0));
  const minimumOrderBasis = round(itemSale + applicableFees.reduce((sum, fee) => sum + fee.saleAmount, 0));
  const minimumOrderAmount = positive(input.minimumOrderAmount, 75);
  const minimumOrderSurcharge = round(Math.max(0, minimumOrderAmount - minimumOrderBasis));
  const catalogDeliverySale = round(
    additionalFees
      .filter((fee) => fee.category === "delivery")
      .reduce((sum, fee) => sum + fee.saleAmount, 0)
  );
  const deliverySale = round(
    catalogDeliverySale +
    (input.delivery?.enabled ? positive(input.delivery.quantity, 1) * positive(input.delivery.saleUnitPrice, 150) : 0)
  );
  const deliveryCost = input.delivery?.enabled ? round(positive(input.delivery.quantity, 1) * positive(input.delivery.costUnitPrice)) : 0;
  const urgentBase = round(minimumOrderBasis + minimumOrderSurcharge + deliverySale);
  const urgentSale = input.urgent?.enabled ? round(input.urgent.type === "percentage" ? urgentBase * positive(input.urgent.value) / 100 : positive(input.urgent.value)) : 0;
  const adjustment = round(Number(input.adjustment || 0));
  const beforeDiscount = round(minimumOrderBasis + minimumOrderSurcharge + deliverySale + urgentSale);
  const discountAmount = round(Math.min(beforeDiscount, beforeDiscount * positive(input.discountPercent) / 100 + positive(input.fixedDiscount)));
  const adjustedSubtotal = round(beforeDiscount - discountAmount + adjustment);
  const vatRate = input.vatMode === "not_applicable" ? 0 : positive(input.vatRate, 20);
  const subtotalExcludingVat =
    input.vatMode === "inclusive" && vatRate
      ? round(adjustedSubtotal / (1 + vatRate / 100))
      : adjustedSubtotal;
  const vatAmount =
    input.vatMode === "exclusive"
      ? round(subtotalExcludingVat * vatRate / 100)
      : input.vatMode === "inclusive"
        ? round(adjustedSubtotal - subtotalExcludingVat)
        : 0;
  const totalIncludingVat =
    input.vatMode === "inclusive"
      ? adjustedSubtotal
      : round(subtotalExcludingVat + vatAmount);
  const totalCost = round(itemCost + additionalCost + deliveryCost);
  const grossProfit = round(subtotalExcludingVat - totalCost);
  const grossMargin = subtotalExcludingVat ? round(grossProfit / subtotalExcludingVat * 100) : 0;
  const groupTotals = (input.groups || []).map((group) => ({ ...group, saleAmount: round(items.filter((item) => item.groupId === group.id).reduce((sum,item) => sum + item.saleAmount,0)), costAmount: round(items.filter((item) => item.groupId === group.id).reduce((sum,item) => sum + item.costAmount,0)) }));
  return { items, groups: input.groups || [], groupTotals, additionalFees, itemSale, additionalSale, minimumOrderBasis, minimumOrderAmount, minimumOrderSurcharge, deliverySale, deliveryCost, urgentSale, discountPercent: positive(input.discountPercent), fixedDiscount: positive(input.fixedDiscount), discountAmount, adjustment, subtotalExcludingVat, vatRate, vatAmount, totalIncludingVat, totalCost, grossProfit, grossMargin, calculatedAt: new Date().toISOString(), calculatedBy: context.userId || null };
}

module.exports = { calculateAdvertisingQuotation, convertAreaToSquareMeters };
