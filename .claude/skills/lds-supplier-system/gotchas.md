# lds-supplier-system — Gotchas

> import-sanity-check.js 检查结果显示（2026-03-18）：当前 seed.json 中 suppliers 有 3 条，supplier_catalog_items 为 **0 条**。价格库尚未填充。

## 1. 字段命名是 camelCase，不是 snake_case

seed.json 中供应商数据用 camelCase：
```js
{ supplierId: "SUP-1001", itemName: "...", itemType: "vehicle" }
// 不是 supplier_id / item_name / item_type
```

写导入脚本时必须与现有 seed.json 格式保持一致，不要引入 snake_case 字段（会导致旧代码读取不到）。

---

## 2. xlsx 解析需要外部依赖，本项目零外部依赖

当前 `scripts/import-supplier-catalog.js` 是硬编码数据，不是真正的 xlsx 解析。

引入 xlsx 解析前必须和用户确认：
- 是否接受引入 `xlsx` npm 包（会打破"零外部依赖"约束）
- 或者改用其他方案（csv 格式 + 内置 readline 解析）

---

## 3. 导入脚本必须幂等

重复运行不能产生重复记录。当前 `import-supplier-catalog.js` 使用 id 去重：

```js
// 正确：先检查 id 是否存在
const existing = seed.suppliers.find(s => s.id === newSupplier.id);
if (!existing) seed.suppliers.push(newSupplier);
else Object.assign(existing, newSupplier);  // 更新
```

---

## 4. 从库选的前端必须调用真实 API，不能硬编码

```js
// 错误：硬编码供应商列表
const suppliers = ['供应商A', '供应商B'];

// 正确：从 /api/suppliers 获取
const res = await fetch('/api/suppliers');
const { suppliers } = await res.json();
```

---

## 5. 新增 catalog_items 字段必须不破坏旧 quote_items 引用

`quote_items` 中存了 `supplier`（供应商名称字符串）或 `supplierId`。修改 suppliers 数据结构时不能改变这些引用字段，否则旧报价单里的供应商信息会丢失。

---

## 6. supplier_catalog_items 目前为空（2026-03-18）

当前 seed.json 中价格库为空，`从库选` 功能无数据可用。这是一个已知缺口，需要先执行供应商导入任务。
