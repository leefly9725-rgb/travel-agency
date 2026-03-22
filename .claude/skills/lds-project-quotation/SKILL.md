---
name: lds-project-quotation
description: 当任务涉及 web/quote-project.html、报价行 item_type 字段逻辑、hotel_details.nights 显示规则、项目型报价与标准报价切换、报价行单位自动匹配、server/services/quoteService.js 计算逻辑时触发此 Skill
---

# lds-project-quotation — 项目型报价业务规范

## 触发条件（任一满足即触发）

- 修改 `web/quote-project.html` 或 `web/quote-project.js`
- 修改 `server/services/quoteService.js` 中与 project 模式相关的计算
- 涉及 `quote_items.type` 的字段显示规则（哪些类型显示哪些列）
- 涉及 `hotel_details.nights`（晚数）的显示/隐藏逻辑
- 讨论 item_type 与默认单位的映射规则
- 涉及 `pricing_mode: 'project'` 的报价结构

## 核心数据结构（server 实际结构）

```js
// quote_items 的 type 枚举（来自 server/app.js 和 seed.json）
const ITEM_TYPES = ['hotel', 'vehicle', 'guide', 'interpreter',
                    'dining', 'tickets', 'meeting', 'parking', 'misc'];

// hotel 类型有 hotel_details（晚数在这里）
// hotel_details.nights ← 唯一有"晚数"概念的地方
// 其他类型无 hotel_details，不存在 nights 字段

// 导游/翻译两个独立类型（guide / interpreter）
// 角色不在 item_type 里区分，type 本身就是区分依据
```

## 字段显示规则（前端控制）

| item_type | 显示晚数(nights) | 有 detail rows | 备注 |
|---|---|---|---|
| hotel | ✅ `hotel_details.nights` | ✅ room_type 明细 | 唯一有晚数的类型 |
| vehicle | ❌ | ✅ 用车明细 | 无服务日期列 |
| guide | ❌ | ✅ 导游明细 | 独立于 interpreter |
| interpreter | ❌ | ✅ 翻译明细 | 独立于 guide |
| dining | ❌ | ❌ | 简单条目 |
| tickets/meeting/parking/misc | ❌ | ❌ | 简单条目 |

## 默认单位映射（当前阶段，写死前端，后续动态化）

```js
const DEFAULT_UNIT_MAP = {
  hotel:       '晚',
  vehicle:     '辆',
  guide:       '天',
  interpreter: '天',
  dining:      '人次',
  tickets:     '张',
  meeting:     '次',
  parking:     '天',
  misc:        '项',
};
```

## 新建报价界面约束

- 进入 `web/quote-new.html` 选择 `pricing_mode: 'project'` 后，**直接渲染** project 界面
- 禁止先渲染标准报价表单再切换（已知闪烁 Bug）
- 根因在 `quote-new.js` 中类型判断使用了 `setTimeout` 或 `useEffect` 式异步逻辑

## quoteService.js 计算注意点

- `hotel` 的小计 = `hotel_details` 各行的 `(room_count × nights × rate)` 之和
- `project` 模式的总计由各 `quote_items` 聚合，不是 `standard` 模式的日×人计算
- 修改计算逻辑后必须运行 `node --test tests/quoteService.test.js`

## 参考文件

- `references/item-type-rules.md` — 各 item_type 字段规则完整版
- `references/quoteservice-calculation.md` — 计算逻辑说明
- `templates/quote-item-schema.md` — 报价条目数据结构
- `scripts/field-rule-validator.js` — 可运行：校验报价行字段合法性
- `gotchas.md` — 已知陷阱
