---
name: lds-frontend-ui
description: 当任务涉及 web/ 下任意页面的表单布局、卡片点击区域、列表排版、表格列宽、新建报价界面闪烁、web/styles.css 样式修复、label/input 对齐一致性时触发此 Skill
---

# lds-frontend-ui — 前端 UI 布局规范

## 触发条件（任一满足即触发）

- `web/quotes.html` 列表卡片点击无响应
- `web/quote-project.html` 输入区对齐、表格布局问题
- `web/styles.css` 中 spacing 规则打架
- `web/quote-new.html` 新建项目型报价时先闪现标准报价界面
- 任意页面 label/input 对齐不统一
- 表格列宽需要统一策略

## 项目前端约束

```
- 纯原生 HTML + CSS + JS，无框架，无打包
- 共享样式：web/styles.css
- 共享 JS 工具：web/app.js、web/app-utils.js、web/ui-labels.js
- 每个页面是独立的 .html + .js 文件对
- 修改样式只改 styles.css，不用内联 style（保持一致性）
- 新增 UI 文字必须加入 web/ui-labels.js，不硬编码字符串
```

## 卡片点击修复模式

```js
// 错误：只有标题可点
document.querySelectorAll('.quote-card h3').forEach(el => {
  el.addEventListener('click', () => goToDetail(id));
});

// 正确：整个卡片可点
document.querySelectorAll('.quote-card').forEach(card => {
  card.style.cursor = 'pointer';
  card.addEventListener('click', () => goToDetail(card.dataset.id));
});
```

```css
/* styles.css 中加 hover 反馈 */
.quote-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #6366f1; }
```

## 新建报价闪烁修复方向

```js
// quote-new.js — 错误模式：异步切换
setTimeout(() => { if (type === 'project') showProjectForm(); }, 0);

// 正确模式：URL 参数在首次渲染前同步读取
const params = new URLSearchParams(location.search);
const pricingMode = params.get('mode') || 'standard';
// 根据 pricingMode 直接渲染对应界面，无条件渲染标准界面
```

## 表格列宽统一策略

```css
/* web/styles.css — 报价行表格 */
.quote-items-table { width: 100%; table-layout: fixed; }
.col-type     { width: 90px; }
.col-name     { /* 弹性 */ }
.col-nights   { width: 65px; } /* 仅 hotel 类型显示 */
.col-qty      { width: 65px; }
.col-unit     { width: 60px; }
.col-price    { width: 90px; text-align: right; }
.col-actions  { width: 70px; text-align: center; }
```

## 参考文件

- `references/grid-system-reference.md` — 栅格与 spacing 参考
- `templates/card-click-pattern.md` — 卡片点击区域标准模式
- `scripts/ui-consistency-check.md` — UI 一致性检查步骤
- `gotchas.md` — 已知 UI 陷阱
