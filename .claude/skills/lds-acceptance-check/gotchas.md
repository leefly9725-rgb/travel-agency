# lds-acceptance-check — Gotchas

## 1. `npm test` 通过不代表 UI 验收通过

测试套件覆盖后端逻辑（quoteService、dataStore、API）。前端页面交互（卡片点击、nights 显示/隐藏、PDF 分页）只能通过手动验收确认。

---

## 2. 卡片点击验收必须测 3 个点击位置

只测标题点击不够：
- 点击标题文字 → 跳转
- 点击卡片日期/客户名区域 → 也要跳转
- 点击卡片空白处 → 也要跳转

3 个位置全部通过才算验收通过。

---

## 3. seed.json 条数验证不能只看"导入成功"提示

```js
// 验收时直接检查 seed.json：
const seed = JSON.parse(fs.readFileSync('data/seed.json', 'utf8'));
console.log('suppliers:', seed.suppliers.length);
console.log('catalog_items:', (seed.supplier_catalog_items || []).length);
// 或运行：node .claude/skills/lds-supplier-system/scripts/import-sanity-check.js
```

---

## 4. PDF 验收必须用打印预览，不能只看 screen

PDF 相关 CSS 在 `@media print` 中，screen 完全正常也不代表 print 正常。必须用 `Ctrl+P` 打开打印预览验收：
- Cover page 是否独占第 1 页
- 表格行是否在页中截断
- 总页数是否在 4~5 页

---

## 5. 当前 PDF print CSS 完全缺失（2026-03-18 已知问题）

`check-a4-layout.js` 检查结果显示 `web/styles.css` 中没有任何 `@media print` 规则。这意味着打印预览与 screen 完全相同，未做任何打印优化。**PDF 相关验收在此问题修复前无法通过**。

---

## 6. 验收完成后任务文件必须移到 tasks/done/

别忘了归档：将 `.claude/tasks/active/xxx.md` 移动到 `.claude/tasks/done/xxx.md`，并在文件末尾追加：

```
## 验收记录
- 验收日期：YYYY-MM-DD
- 验收结果：通过
- 遗留问题：[如有]
```
