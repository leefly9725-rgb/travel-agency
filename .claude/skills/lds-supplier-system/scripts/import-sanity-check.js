#!/usr/bin/env node
/**
 * import-sanity-check.js
 * 验证 data/seed.json 中供应商数据的基本质量。
 *
 * 用法：
 *   node .claude/skills/lds-supplier-system/scripts/import-sanity-check.js
 *     → 基线模式（默认）：supplier_catalog_items 为 0 视为"等待导入"，不报错
 *
 *   node .claude/skills/lds-supplier-system/scripts/import-sanity-check.js --mode=post-import
 *     → 导入后验收模式：supplier_catalog_items 为 0 视为 ERROR
 *
 *   node .claude/skills/lds-supplier-system/scripts/import-sanity-check.js [seed路径] [--mode=post-import]
 *     → 指定 seed 文件路径
 *
 * 检查项：
 *   1. suppliers 数组存在且有数据
 *   2. 每个 supplier 有 id、name（必填），isActive 有值
 *   3. supplier id 无重复
 *   4. supplier_catalog_items 存在（0 条时：基线模式=提示，导入后模式=ERROR）
 *   5. 每个 catalog_item 有 supplierId，且对应的 supplier 存在（无孤儿记录）
 *   6. price 字段为数字，非负
 *   7. supplierId+itemName 组合唯一（幂等性检查）
 *   8. 输出统计摘要
 */

const fs = require('node:fs');
const path = require('node:path');

// ── 解析参数（支持任意顺序：路径和 --mode 均可选）────────────────────────────
const args = process.argv.slice(2);
const modeArg = args.find(a => a.startsWith('--mode='));
const MODE = modeArg ? modeArg.replace('--mode=', '') : 'baseline'; // 'baseline' | 'post-import'
const seedArg = args.find(a => !a.startsWith('--'));
const SEED_PATH = seedArg || path.join(__dirname, '../../../../data/seed.json');

function main() {
  // ── 加载数据 ──────────────────────────────────────────────────────────
  if (!fs.existsSync(SEED_PATH)) {
    console.error(`[ERROR] 找不到 seed 文件: ${SEED_PATH}`);
    process.exit(1);
  }

  let seed;
  try {
    seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  } catch (e) {
    console.error(`[ERROR] seed.json 解析失败: ${e.message}`);
    process.exit(1);
  }

  const suppliers = seed.suppliers || [];
  const catalogItems = seed.supplier_catalog_items || seed.supplierCatalogItems || [];
  const issues = [];
  const warnings = [];

  // ── 检查 1：suppliers 存在 ────────────────────────────────────────────
  if (suppliers.length === 0) {
    issues.push('[EMPTY] suppliers 数组为空，导入可能未执行');
  }

  // ── 检查 2：必填字段 ──────────────────────────────────────────────────
  suppliers.forEach((s, i) => {
    if (!s.id)   issues.push(`[MISSING id]   suppliers[${i}] 缺少 id 字段（name: ${s.name || '未知'}）`);
    if (!s.name) issues.push(`[MISSING name] suppliers[${i}] 缺少 name 字段（id: ${s.id || '未知'}）`);
    if (s.isActive === undefined) {
      warnings.push(`[NO isActive] suppliers[${i}] (${s.name}) 缺少 isActive 字段，默认视为 true`);
    }
  });

  // ── 检查 3：supplier id 重复 ──────────────────────────────────────────
  const supplierIds = suppliers.map(s => s.id).filter(Boolean);
  const dupSupplierIds = supplierIds.filter((id, i) => supplierIds.indexOf(id) !== i);
  if (dupSupplierIds.length > 0) {
    issues.push(`[DUPLICATE id] 发现重复 supplier id: ${[...new Set(dupSupplierIds)].join(', ')}`);
  }

  const supplierIdSet = new Set(supplierIds);

  // ── 检查 4：catalog_items 存在 ───────────────────────────────────────
  if (catalogItems.length === 0) {
    if (MODE === 'post-import') {
      issues.push('[EMPTY] supplier_catalog_items 为空 — 导入后验收失败，价格库应有数据');
    } else {
      // 基线模式：导入前为空是正常状态，仅提示
      console.log('ℹ️  supplier_catalog_items 当前为空（基线状态，等待导入）');
      console.log('   导入完成后用 --mode=post-import 重新验收。\n');
    }
  }

  // ── 检查 5：孤儿记录（supplierId 对应的 supplier 不存在）──────────────
  const orphans = catalogItems.filter(item => {
    const sid = item.supplierId || item.supplier_id;
    return sid && !supplierIdSet.has(sid);
  });
  if (orphans.length > 0) {
    issues.push(`[ORPHAN] ${orphans.length} 条 catalog_item 的 supplierId 找不到对应 supplier:`);
    orphans.slice(0, 5).forEach(o => {
      issues.push(`  supplierId=${o.supplierId || o.supplier_id}, itemName=${o.itemName || o.item_name}`);
    });
    if (orphans.length > 5) issues.push(`  ...以及另外 ${orphans.length - 5} 条`);
  }

  // ── 检查 6：price 字段合法性 ─────────────────────────────────────────
  catalogItems.forEach((item, i) => {
    const price = item.price;
    if (price !== undefined && price !== null) {
      if (typeof price !== 'number') {
        issues.push(`[BAD price] catalog_items[${i}] (${item.itemName || item.item_name}) price 不是数字: ${JSON.stringify(price)}`);
      } else if (price < 0) {
        warnings.push(`[NEG price] catalog_items[${i}] (${item.itemName || item.item_name}) price 为负数: ${price}`);
      }
    }
  });

  // ── 检查 7：supplierId + itemName 组合唯一性（幂等性） ────────────────
  const catalogKeys = catalogItems.map(item => {
    const sid = item.supplierId || item.supplier_id || '';
    const name = item.itemName || item.item_name || '';
    return `${sid}::${name}`;
  });
  const dupCatalogKeys = catalogKeys.filter((k, i) => catalogKeys.indexOf(k) !== i);
  if (dupCatalogKeys.length > 0) {
    issues.push(`[DUPLICATE] ${dupCatalogKeys.length} 条 catalog_item (supplierId+itemName) 重复，导入未去重:`);
    [...new Set(dupCatalogKeys)].slice(0, 3).forEach(k => issues.push(`  ${k}`));
  }

  // ── 输出结果 ──────────────────────────────────────────────────────────
  console.log('\n=== 供应商数据质量检查报告 ===\n');
  console.log(`数据源：${SEED_PATH}`);
  console.log(`检查模式：${MODE === 'post-import' ? '导入后验收（--mode=post-import）' : '基线（默认）'}`);
  console.log(`\n【统计】`);
  console.log(`  suppliers:             ${suppliers.length} 条`);
  console.log(`  supplier_catalog_items:${catalogItems.length} 条`);

  // 按 supplier 分组统计
  const countBySup = {};
  catalogItems.forEach(item => {
    const sid = item.supplierId || item.supplier_id;
    countBySup[sid] = (countBySup[sid] || 0) + 1;
  });
  const supNames = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
  console.log('\n【各供应商价格条目数】');
  Object.entries(countBySup).forEach(([sid, cnt]) => {
    console.log(`  ${supNames[sid] || sid}: ${cnt} 条`);
  });

  if (warnings.length > 0) {
    console.log('\n⚠️  警告（不阻断，但需关注）：');
    warnings.forEach(w => console.log(`  ${w}`));
  }

  if (issues.length > 0) {
    console.log('\n❌ 发现问题：');
    issues.forEach(i => console.log(`  ${i}`));
    console.log('');
    process.exit(1);
  } else {
    console.log('\n✅ 数据质量检查通过\n');
  }
}

main();
