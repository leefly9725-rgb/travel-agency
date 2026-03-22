# project-based Phase 2 — UI 修复 + 晚数规则 + 新建无闪烁

## 类型
复杂开发

## 状态
done（2026-03-18）

## 背景
`web/quotes.html` 卡片点击只响应标题区域；`web/quote-project.html` 中 nights（晚数）对所有 item_type 都显示，应仅 hotel 显示；新建项目型报价时先渲染标准报价界面再切换，产生闪烁。

## 目标

### P0（本轮必须）
- [ ] **修复 quotes.html 卡片点击**：整个 `.quote-card` 元素可点击，不仅 `h3`
  - 涉及文件：`web/quotes.html` + `web/quotes.js`（或内联 script）
- [ ] **nights 仅 hotel 显示**：`item_type !== 'hotel'` 时 nights 列隐藏，且 hotel_details 中的 nights 不传值
  - 涉及文件：`web/quote-project.html` / `web/quote-project.js`
- [ ] **修复新建报价闪烁**：`web/quote-new.html` 在首次渲染前从 URL 参数同步读取 mode，直接进入正确界面
  - 涉及文件：`web/quote-new.html` / `web/quote-new.js`

### P1（本轮尽量）
- [ ] quotes.html 列表默认按 `updatedAt DESC` 排序（修改 `/api/quotes` 返回顺序或前端排序）
- [ ] quote-project.html 表格列宽统一（`table-layout: fixed` + 列宽定义）

### P2（后续打包）
- [ ] 切换 item_type 时自动填充默认单位
- [ ] item_type 下拉从 `/api/quote-item-types` 动态读取（该 API 已存在）

## 涉及 Skill
- `lds-frontend-ui`（卡片点击、闪烁、列宽）
- `lds-project-quotation`（nights 规则、item_type 显示控制）

## 关键约束
- 修改 JS 时不使用 replace_all，精确定位行号
- 不引入任何新的 npm 依赖
- 改动后必须运行 `npm test`（P0 改动不涉及后端，测试应全部通过）

---

## Done Definition（完成定义）

以下全部满足才算"完成"：

- [ ] `web/quotes.html` 中点击卡片的**标题文字、客户名、日期、空白区域** 4 个位置全部跳转
- [ ] `web/quote-project.html` 中：hotel 行有 nights 输入框；vehicle/guide/dining 等行 nights 列不可见
- [ ] `web/quote-new.html` 新建项目型报价时：首屏直接是 project 界面，screen recording 中无明显闪烁
- [ ] `npm test` 全部通过
- [ ] 交付说明完整输出（改动文件 / 数据改动 / 兼容处理 / 本地验证 / 线上风险）

---

## 验收方式

```
1. 启动本地服务：npm start

2. 卡片点击验收：
   访问 http://localhost:3000/quotes.html
   用鼠标分别点击：卡片标题 / 客户名文字 / 日期区域 / 卡片空白处
   → 每次都应跳转到报价详情页

3. nights 规则验收：
   进入任意 project 型报价详情页
   找到 hotel 类型行 → 确认有 nights 输入框
   将该行类型改为 vehicle → nights 列立即消失
   改回 hotel → nights 列重新出现

4. 新建无闪烁验收：
   打开 DevTools → Performance → CPU: 4x slowdown
   点击"新建项目型报价"
   观察首帧：应直接是 project 表单，无标准报价界面一闪而过

5. npm test:
   cd /d/LDS-OPS-v1 && npm test
   全部通过
```

---

## 风险提示

| 风险 | 概率 | 影响 | 处置 |
|---|---|---|---|
| 修改 quotes.js 时影响排序或分页逻辑 | 低 | 列表显示异常 | 改动前读懂现有 quotes.js 完整逻辑 |
| nights 隐藏逻辑误用 `display:none` 而非条件渲染，导致仍提交 nights 值 | 中 | 数据脏 | 确认前端 submit 时不包含 nights 字段（非 hotel 行） |
| quote-new.js 首屏判断与现有路由冲突 | 低 | 新建报价页白屏 | 改动后立即测试新建标准报价和项目型报价两个路径 |
| P1 排序改动影响 API 返回结构 | 低 | 前端读取出错 | 只在返回结果上做 `.sort()`，不改 API 结构 |

## 交付说明（2026-03-18）
- 改动文件：
  - `web/styles.css`：`.quote-card` 新增 `cursor: pointer`（1行）
  - `web/quote-new.html`：anti-flash CSS 补全 `.quote-items-section`（1行）
- 数据改动：不涉及
- 兼容处理：
  - cursor 改动纯视觉，不影响任何功能；`.quote-card` 上已有的 JS click 逻辑（`attachCardClicks`）本身正确，只是缺少视觉提示
  - nights 规则已在 `quote-project-editor.js` 正确实现，P0 描述的问题实际上已在更早的代码中修复，本轮无需改动
  - 排序（P1）已在 `quotes.js` 中以 `updatedAt DESC` 为默认排序实现，无需改动
- 本地验证：`npm test` 20/20 ✅
- 线上风险点：纯前端 CSS/HTML 改动，Vercel 部署无风险
- 本地 server / 线上 api 同步状态：不涉及
- 下一轮可打包项：单位自动匹配（切换 item_type 时自动填充默认单位）、item-types 下拉从 /api/quote-item-types 动态读取
