# 泷鼎晟国际旅行社运营系统 V1.0 — 项目协作总约束 V2.1

> 本文件是 Claude Code 协作的最高优先级约束文档。补充项目根目录 CLAUDE.md 中的通用规则。

---

## 技术栈速查（高频参考）

| 层 | 实际技术 | 说明 |
|---|---|---|
| 后端 | Node.js（零外部依赖） | 仅用 node: 内置模块 |
| 持久化 | `data/seed.json`（本地）/ Supabase PostgreSQL（线上） | 由环境变量 `SUPABASE_URL` 驱动切换，检查 `/api/meta` 确认当前层 |
| 前端 | 原生 HTML + CSS + JS | 无框架，无打包步骤 |
| 部署 | Vercel + GitHub + Supabase | 入口：`api/[[...route]].js` → `server/app.js` |
| 测试 | node:test（内置） | `npm test` 或 `node --test tests/*.test.js` |

> **重要**：项目已部署到 Vercel + Supabase 线上环境。本地开发默认用 `data/seed.json`，线上用 Supabase。改动涉及数据结构时，必须同时考虑 seed.json 兼容性和 Supabase schema 兼容性。改动前先确认当前持久化层：访问 `/api/meta`。

---

## 数据模型速查

```
quotes                — 报价主表（pricing_mode: 'standard' | 'project'）
  └─ quote_items      — 报价条目（type: hotel/vehicle/guide/interpreter/dining/tickets/meeting/parking/misc）
       ├─ hotel_details    — 酒店明细（room_type, room_count, nights, cost_nightly_rate, price_nightly_rate）
       ├─ vehicle_details  — 用车明细
       ├─ guide_details    — 导游/翻译明细
       └─ ...

suppliers             — 供应商（本地: seed.json; 线上: Supabase）
  └─ supplier_catalog_items — 价格库条目

project_types         — 项目类型主数据（schema 已有，前端动态读取待接入）
```

**晚数字段位置**：`hotel_details.nights`（不是 quote_items 上的列）

---

## 生产安全约束

1. **零依赖原则**：不得引入任何 npm 包，除非用户明确授权（目前唯一例外可能是 xlsx 解析）
2. **JSON 持久化兼容**：seed.json 中的旧数据字段结构不得破坏；新增字段须给默认值
3. **API 路由兼容**：`server/app.js` 中现有 API 路径不得改名；只可新增
4. **Supabase service_role_key**：仅在服务端使用，不得进入前端 JS
5. **Vercel 入口不动**：`api/[[...route]].js` 仅做代理，不加业务逻辑
6. **测试不得破坏**：改动后必须能通过 `npm test`
7. **本地 server vs 线上 api 同步**：改动涉及两端时必须明确说明是否已同步

---

## 交付格式（每轮必须输出）

```
## 本轮交付说明
- 改动文件：[列出文件路径]
- 数据改动：[seed.json 结构变化 / Supabase migration SQL / 两端是否同步]
- 兼容处理：[旧数据/旧 API 如何处理]
- 本地验证：[npm test 结果 / 手动操作步骤]
- 线上风险点：[部署后需关注的点]
- 本地 server / 线上 api 同步状态：[已同步 / 待同步 / 不涉及]
- 下一轮可打包项：[建议打包的后续任务]
```

---

## 协作分工建议

| 任务类型 | 推荐 |
|---|---|
| server/app.js 路由、dataStore.js、quoteService.js | Claude Code |
| Supabase schema / migration SQL | Claude Code |
| PDF 导出逻辑（scripts/export-project-quotation-pdf.js）| Claude Code |
| Excel/CSV 导入逻辑（scripts/import-supplier-catalog.js）| Claude Code |
| 页面小范围样式微调（styles.css 单处修改）| Codex 可 |
| web/*.html 新增输入字段（不涉及 API 改动）| Codex 可 |
| 任何涉及 server/、api/、data/ 的改动 | **不应仅交给 Codex** |

---

## 当前业务开发重点（2026-03）

- [ ] 修复 `web/quotes.html` 列表页卡片点击无响应
- [ ] 优化 `web/quote-project.html` 页面 UI 与表格布局
- [ ] 将报价行"晚数"从固定列改为仅 hotel 类型显示（`hotel_details.nights`）
- [ ] 新增项目类型管理页（`web/item-types.html` 已存在，确认状态）
- [ ] 新增/完善供应商管理与价格库管理页面（`web/suppliers.html` 已存在）
- [ ] 导入 `supplier_quotation_summary_v2.xlsx` 到 suppliers/supplier_catalog_items

---

## 已确认历史问题与提醒项

- **[闪烁]** `web/quote-new.html` 新建项目型报价时可能先渲染标准界面再切换，根因在类型判断时机
- **[单位]** 报价行默认单位应随 item_type 自动匹配，hotel→晚，vehicle→辆，guide→天
- **[排序]** `/quotes` 列表默认排序建议 `updatedAt DESC`
- **[AI]** PDF 导出稳定后，提醒引入 AI 生成报价说明文本
- **[拆分]** 标准报价与项目型报价混合越来越乱时，提醒讨论独立视图
- **[词典]** 客户表达词典不单独维护，并入 project_types 主数据

---

## Skill 触发索引

| Skill | 触发场景 |
|---|---|
| `lds-safe-backend` | server/app.js、dataStore.js、Supabase schema、API 兼容性、service_role_key |
| `lds-project-quotation` | quote-project 页面、报价行字段、item_type 规则、hotel_details.nights |
| `lds-pdf-layout` | PDF 导出、@media print、A4 版心、分页、cover/条款/签字区 |
| `lds-supplier-system` | suppliers 表、supplier_catalog_items、从库选、Excel 导入 |
| `lds-frontend-ui` | 卡片点击、表单对齐、列宽、新建报价闪烁 |
| `lds-debug-runbook` | 白屏、报错、加载不消失、本地/线上差异、批量替换后连锁错误 |
| `lds-acceptance-check` | 本轮验收、截图核对、PDF 核对、字段规则核对 |
