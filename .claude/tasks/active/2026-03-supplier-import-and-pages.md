# 供应商导入 + 管理页面完善

## 类型
复杂开发 + 数据导入

## 状态
active（2026-03-18）

## 背景
导入前 seed.json 中 `supplier_catalog_items` 为 0 条（正常基线状态，等待导入）。`web/suppliers.html` 已存在但状态未知。`web/quotes.html` 的"从库选"功能可能没有真实数据可选。需要：①完善供应商管理页；②导入价格库数据；③确认从库选接入真实 API。

## 目标

### P0（本轮必须）
- [ ] **确认 `web/suppliers.html` 现状**：读取页面和对应 JS，评估是否可用
- [ ] **导入供应商价格库**：将 `supplier_quotation_summary_v2.xlsx` 中的数据导入 seed.json（注意零外部依赖约束，需确认 xlsx 解析方案）
- [ ] **运行 import-sanity-check.js 通过（--mode=post-import）**：supplier_catalog_items > 0 条，无孤儿记录，无重复

### P1（本轮尽量）
- [ ] **完善 suppliers.html**：确认供应商列表展示、新增、编辑基本可用
- [ ] **从库选接入真实 API**：报价行的"从库选"弹窗调用 `/api/supplier-items`（该 API 已存在），而不是硬编码数据

### P2（后续）
- [ ] 从库选支持按 item_type 过滤
- [ ] 供应商管理页支持删除和禁用（isActive 切换）

## xlsx 导入方案确认（P0 第一步）

由于项目零外部依赖，xlsx 解析有以下选项：
1. **引入 xlsx npm 包**（需用户明确授权，打破零依赖约束）
2. **用户提供 CSV 格式**（内置 `readline` 模块可解析，无需外部依赖）
3. **手动整理为 JSON**，直接写入 seed.json

**在开始前必须和用户确认使用哪种方案**。

## 字段映射（以实际 xlsx/csv 表头为准，下面是预期）

| 源字段 | 目标位置 | 目标字段 | 转换 |
|---|---|---|---|
| 供应商名称 | suppliers | name | — |
| 联系人 | suppliers | contact | — |
| 联系电话 | suppliers | phone | — |
| 服务项目 | supplier_catalog_items | itemName | — |
| 服务类型 | supplier_catalog_items | itemType | 映射到枚举值 |
| 单位 | supplier_catalog_items | unit | — |
| 单价(EUR) | supplier_catalog_items | price | parseFloat |

**注意**：字段命名用 camelCase（与现有 seed.json 一致），不用 snake_case。

## 涉及 Skill
- `lds-supplier-system`（主要）
- `lds-safe-backend`（seed.json 结构变更、/api/supplier-items 路由）

---

## Done Definition（完成定义）

以下全部满足才算"完成"：

- [ ] `node .claude/skills/lds-supplier-system/scripts/import-sanity-check.js --mode=post-import` 通过，无 ERROR 级别问题
- [ ] seed.json 中 `supplier_catalog_items` 条数 > 0，且与源文件行数匹配
- [ ] 抽查 3 条 catalog_item：itemName、price、itemType 与源数据一致
- [ ] 重复运行导入脚本，条数不变（幂等性）
- [ ] `web/suppliers.html` 页面可以正常打开，供应商列表有数据
- [ ] 报价页面"从库选"弹窗可以展示供应商数据（不是空列表）
- [ ] `npm test` 全部通过
- [ ] 交付说明完整

---

## 验收方式

```
1. 导入验收：
   # 运行导入脚本（具体命令视选用方案而定）
   node scripts/import-supplier-catalog.js  # 或新编写的导入脚本

   # 数据质量验证（导入后用 --mode=post-import，catalog_items=0 视为 ERROR）
   node .claude/skills/lds-supplier-system/scripts/import-sanity-check.js --mode=post-import
   → 应输出"✅ 数据质量检查通过"

   # 重复运行验证幂等性
   node scripts/import-supplier-catalog.js
   node .claude/skills/lds-supplier-system/scripts/import-sanity-check.js --mode=post-import
   → 条数不变

2. 页面验收：
   访问 http://localhost:3000/suppliers.html
   → 供应商列表有数据，字段显示正确

3. 从库选验收：
   进入任意报价详情页，点击"从库选"按钮
   → 弹窗打开后展示真实供应商价格数据（不是空列表）
   → 选中一条后填入报价行

4. API 验收：
   curl http://localhost:3000/api/supplier-items | head -200
   → 返回有数据的 JSON 数组

5. npm test:
   cd /d/LDS-OPS-v1 && npm test
```

---

## 风险提示

| 风险 | 概率 | 影响 | 处置 |
|---|---|---|---|
| xlsx 解析需要外部依赖，与零依赖约束冲突 | 高 | 方案需要变更 | **P0 第一步**：与用户确认 xlsx/csv/JSON 选哪种导入方式 |
| camelCase vs snake_case 字段命名不一致导致数据读取失败 | 中 | 前端显示空值 | 导入前读取现有 seed.json 确认命名风格 |
| 现有 `web/suppliers.html` 有 bug 或功能不完整 | 中 | 需要额外修复工作 | P0 先读取页面现状再制定修复计划 |
| `/api/supplier-items` 路由已存在但行为未知 | 低 | 从库选逻辑需调整 | 先 `curl /api/supplier-items` 确认返回格式 |
| 导入数据破坏已有 suppliers（重名 supplier 被覆盖）| 低 | 丢失旧供应商信息 | 导入前备份 seed.json，导入逻辑用 upsert（按 id 或 name） |

## 交付说明（完成后填写）
- 改动文件：
- 数据改动：seed.json suppliers / supplier_catalog_items（条数、新增字段）
- 兼容处理：
- 本地验证：
- 线上风险点：
- 本地 server / 线上 api 同步状态：
- 下一轮可打包项：从库选按 item_type 过滤、供应商禁用功能
