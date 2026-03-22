---
name: lds-pdf-layout
description: 当任务涉及 scripts/export-project-quotation-pdf.js、web/quotation-preview.html、@media print CSS、A4 版心与页边距、分页控制（page-break）、cover page、条款页、签字区布局、screen 与 print 一致性时触发此 Skill
---

# lds-pdf-layout — PDF 导出布局规范

## 触发条件（任一满足即触发）

- 修改 `scripts/export-project-quotation-pdf.js`
- 修改 `web/quotation-preview.html` 或其对应的 `.js`
- 修改 `web/styles.css` 中 `@media print` 相关规则
- 处理 PDF cover page、条款页、签字区的布局
- 修复打印预览与 screen 不一致的问题
- 处理表格行在页面中间被截断的问题
- PDF 总页数超出目标范围（目标 4~5 页）

## 当前 PDF 相关文件

```
scripts/export-project-quotation-pdf.js  — PDF 导出逻辑
web/quotation-preview.html              — 报价单预览页（PDF 模板来源）
web/styles.css                           — 包含 @media print 规则
artifacts-project-quotation-*.pdf       — 历史输出截图，可参考对比
```

## 页面结构目标（4~5 页）

```
第 1 页：Cover（公司信息、报价编号、客户、日期）— 严格锁定 1 页
第 2~3 页：报价明细表（按 item_type 分组，hotel 显示 nights）
第 4~5 页：条款 + 签字区（优先同页）
```

## 操作流程

1. 先检查 screen 显示是否正确（`http://localhost:3000/quotation-preview.html?id=xxx`）
2. 打开打印预览（Ctrl+P）检查分页和总页数
3. 参考 `scripts/check-a4-layout.js` 检查关键 CSS 规则是否存在
4. 修改 CSS 时，同时看 screen 和 print 预览
5. 完成后用 `scripts/check-a4-layout.js` 再次验证

## 版心规范

```css
@page { size: A4; margin: 15mm 20mm; }
/* 内容区：170mm 宽 × 267mm 高 */
```

## 参考文件

- `references/css-print-patterns.md` — 常用 @media print 模式
- `templates/pdf-page-structure.md` — HTML 骨架模板
- `scripts/check-a4-layout.js` — **可直接运行**：检查 CSS 中关键 print 规则
- `gotchas.md` — 最容易踩的 PDF 坑
