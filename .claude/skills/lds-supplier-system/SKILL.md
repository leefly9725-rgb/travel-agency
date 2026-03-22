---
name: lds-supplier-system
description: 当任务涉及 web/suppliers.html、scripts/import-supplier-catalog.js、scripts/seed-suppliers.js、供应商数据的 CRUD、价格库管理、从供应商库选价格、从 xlsx/csv 导入供应商数据时触发此 Skill
---

# lds-supplier-system — 供应商与价格库规范

## 触发条件（任一满足即触发）

- 修改 `web/suppliers.html` 或对应 JS
- 修改 `scripts/import-supplier-catalog.js` 或 `scripts/seed-suppliers.js`
- 在 `server/app.js` 中新增/修改 `/api/suppliers` 相关路由
- 报价行中"从库选"功能接入真实供应商数据
- 导入 `supplier_quotation_summary_v2.xlsx`
- 修改 `data/seed.json` 中 suppliers 或 supplier_catalog_items 的结构

## 数据存储（本地 seed.json / 线上 Supabase）

```js
// 本地：data/seed.json；线上：Supabase suppliers 表
// 结构参考 scripts/import-supplier-catalog.js 和 scripts/supabase-schema.sql
{
  "suppliers": [
    {
      "id": "SUP-1001",
      "name": "Congress Rental l.t.d.",
      "contact": "Miloš Jovanović",
      "phone": "+381 11 3456789",
      "email": "info@congressrental.rs",
      "notes": "...",
      "isActive": true
    }
  ],
  "supplier_catalog_items": [
    {
      "id": "CAT-1001",
      "supplierId": "SUP-1001",    // ← 注意是 supplierId（camelCase），不是 supplier_id
      "itemName": "...",
      "itemType": "vehicle",
      "unit": "辆",
      "price": 320,
      "currency": "EUR",
      "notes": ""
    }
  ]
}
```

## 导入流程（xlsx → 本地 seed.json 或线上 Supabase）

```
1. 读取 xlsx（需要 xlsx 包或等价解析，当前项目无外部依赖，需与用户确认）
2. 字段映射验证（按列标题，不按列序号）
3. 去重：supplier 按 name，catalog_item 按 (supplierId, itemName)
4. 写入目标层：本地 → data/seed.json；线上 → Supabase suppliers + supplier_catalog_items
5. 验证：node .claude/skills/lds-supplier-system/scripts/import-sanity-check.js --mode=post-import
```

**当前实际脚本**：`scripts/import-supplier-catalog.js`（硬编码数据，非 xlsx 解析）

## 操作流程

1. 确认 supplier 数据结构（camelCase vs snake_case，以 seed.json 实际为准）
2. 若涉及 API，修改 `server/app.js` 的 `/api/suppliers` 路由
3. 运行 `node scripts/import-supplier-catalog.js` 验证导入
4. 运行 `node scripts/import-sanity-check.js` 验证数据质量
5. 运行 `npm test` 确认测试通过

## 参考文件

- `references/supplier-data-schema.md` — 当前 seed.json supplier 结构详解
- `templates/import-script-template.md` — 导入脚本模板
- `scripts/import-sanity-check.js` — **可直接运行**：验证导入数据质量
- `gotchas.md` — 已知陷阱
