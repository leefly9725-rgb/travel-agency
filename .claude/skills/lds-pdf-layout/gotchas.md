# lds-pdf-layout — Gotchas

> check-a4-layout.js 检查结果显示（2026-03-18）：当前 web/styles.css **完全缺少** @media print 规则，web/quotation-preview.html 也没有分页控制元素。这是已知的高优先级缺口。

## 1. 禁止对 JS/CSS 文件做无上下文的 replace_all

在 PDF 相关 CSS 中，`?` 可能出现在：
- `@supports selector(:has(...))` 中
- CSS 变量 fallback `var(--color, #333)`
- JS 中的可选链 `el?.classList`

全局替换 `?` 会一次性破坏多处，且 CSS 没有 try/catch，页面样式静默失效。

---

## 2. screen 和 print 禁止两套完全独立的布局

```css
/* 错误：@media print 里全量重写 */
@media print {
  .quote-table { display: block; font-size: 7px; margin: 0; padding: 0;
                  width: 100%; border-collapse: collapse; ... }
  /* 50+ 行覆盖 screen 样式 */
}

/* 正确：@media print 只做增量调整 */
@media print {
  .action-bar { display: none; }          /* 隐藏操作栏 */
  .quote-table { font-size: 9pt; }        /* 字号微调 */
  .page-break  { page-break-before: always; }
}
```

---

## 3. Cover page 内容超出会流入第 2 页

```css
/* 正确：锁定高度 + overflow hidden */
@media print {
  .cover-page {
    height: 267mm;          /* A4 内容区高度（297 - 15×2） */
    overflow: hidden;       /* 超出裁剪，不流出 */
    page-break-after: always;
  }
}
```

---

## 4. 表格行截断问题（最常见的 PDF Bug）

```css
/* 防止单行被页面截断 */
.quote-items-table tr {
  page-break-inside: avoid;
}

/* 防止 item 组（一组 hotel 明细）被截断 */
.item-group {
  page-break-inside: avoid;
}
```

---

## 5. 修改 CSS 后必须同时验证 screen 和打印预览

仅测 screen 不够，因为：
- `@media print` 块中的样式只在打印预览生效
- Chrome 打印预览和实际打印有时有差异

测试流程：
1. 浏览器刷新 screen 页面 → 确认正常
2. `Ctrl+P` 打开打印预览 → 检查分页、cover、总页数
3. 两者都通过才算完成

---

## 6. 当前 PDF 工作流的实际入口

```
web/quotation-preview.html   ← 直接在浏览器打印预览
scripts/export-project-quotation-pdf.js  ← 可能是 Puppeteer/headless 脚本
```

改 CSS 之前先确认实际使用的是哪个路径，避免改了不生效的文件。
