# lds-project-quotation — Gotchas

## 1. 晚数在 hotel_details.nights，不在 quote_items 上

```
quote_items (type='hotel')
  └─ hotel_details
       ├─ room_type
       ├─ room_count
       ├─ nights    ← 晚数在这里
       ├─ cost_nightly_rate
       └─ price_nightly_rate
```

前端显示"晚数"输入框的条件：`item.type === 'hotel'`，且操作的是 `hotel_details` 子数组，不是 `quote_items` 本身。

---

## 2. guide 和 interpreter 是两个独立类型，不能合并

```js
// 错误：合并为一个类型
if (item.type === 'guide' || item.type === 'interpreter') { ... }
// 可以用于"共同逻辑"，但不能用于 UI 标签、数据存储

// 正确：保持独立，各自有独立的 detail 模板
```

---

## 3. quoteService.js 是最关键的计算引擎，改动前必须运行测试

```bash
node --test tests/quoteService.test.js
```

`hotel` 小计的计算：`room_count × nights × nightly_rate`，不是 `quantity × price`。改变计算方式前必须理解现有公式。

---

## 4. pricing_mode 切换时旧数据结构必须兼容

`standard` 和 `project` 两种模式共用同一个 `quotes` 表（或 seed.json 中同一个数组）。切换模式时：
- 已有的 `quote_items` 数据结构不变
- 只是 `pricing_mode` 字段从 'standard' 改为 'project'
- 前端渲染逻辑根据 `pricing_mode` 选择不同的展示组件

---

## 5. 新建报价闪烁根因：类型判断在异步 callback 中

```js
// 危险：先渲染默认界面，再异步判断
document.addEventListener('DOMContentLoaded', () => {
  renderStandardForm(); // ← 先渲染标准
  fetch('/api/quotes/' + id).then(q => {
    if (q.pricingMode === 'project') renderProjectForm(); // 闪烁！
  });
});

// 正确：从 URL 参数同步读取，首次渲染即正确
const mode = new URLSearchParams(location.search).get('mode') || 'standard';
// 根据 mode 渲染对应界面，不渲染默认界面
```

---

## 6. item_type 列表勿随意扩展

当前系统 `hotel_details`、`vehicle_details`、`guide_details` 等是与 `type` 一一对应的子表/子数组。新增类型需要同时：
- 前端新增对应的输入组件
- 后端新增对应的 detail 解析逻辑
- `quoteService.js` 新增对应的计算逻辑
- seed.json schema 可能需要更新
