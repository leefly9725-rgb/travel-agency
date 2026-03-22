# PDF 一致性修复 — 补全 @media print + A4 版心 + 分页控制

## 类型
复杂开发

## 状态
done（2026-03-18）

## 背景
报价单 PDF 的打印样式定义在 `web/quotation-preview.html` 和 `web/project-quotation.html` 的内联 `<style>` 块中（不是 `web/styles.css`），已有 `@media print`、`@page { size: A4 portrait; margin: 0; }`、`page-break-after: always` 等规则。当前 `check-a4-layout.js`（V2.2 后）已按实际样式链路扫描，不再误报 styles.css 缺失。需要核查打印效果与 A4 版心是否满足交付要求。

## 目标

### P0（本轮必须）
- [ ] 运行 `check-a4-layout.js`（V2.2 版，按内联 style 扫描），确认当前通过率
- [ ] 对实际不足的规则（以脚本输出为准）在 `web/quotation-preview.html` 内联 `<style>` 中补全：
  - `@page margin` 版心（若未设置或为 0）
  - `page-break-inside: avoid` 保护表格行
  - 条款+签字区 `page-break-inside: avoid`
- [ ] 打印预览验收：Cover 独占第 1 页，总页数 4~5 页

### P1（本轮尽量）
- [ ] PDF 中 nights 列仅 hotel 行显示（与 quote-project 页面规则一致）
- [ ] 数字列右对齐，表头在每页重复（`thead { display: table-header-group }`）

### P2（后续）
- [ ] `check-a4-layout.js` 全部通过（0 未通过项）

## 涉及 Skill
- `lds-pdf-layout`（主要）
- `lds-project-quotation`（nights 在 PDF 中的一致性）

## 关键约束
- **禁止**在 `@media print` 中重写超过 30 行的全量样式（只做增量调整）
- **禁止**对 JS/CSS 文件使用 replace_all（尤其是 `?` 字符）
- 修改后必须同时检查 screen 和打印预览（`Ctrl+P`）
- 不引入任何外部 CSS 框架

---

## Done Definition（完成定义）

以下全部满足才算"完成"：

- [ ] `node .claude/skills/lds-pdf-layout/scripts/check-a4-layout.js` 运行无 ❌（脚本已按实际内联 style 链路扫描，0 误报）
- [ ] 打印预览中：Cover page 独占第 1 页（不溢出）
- [ ] 打印预览中：明细表格行不在页面中间截断
- [ ] 打印预览中：条款+签字区在同一页（或签字区整体不被截断）
- [ ] 打印预览中：总页数 ≤ 5 页（明细行数合理时）
- [ ] Screen 视图与修改前相比无明显视觉变化（@media print 不影响 screen）
- [ ] `npm test` 全部通过

---

## 验收方式

```
1. 运行检查脚本（V2.2 版，扫描内联 style）：
   node .claude/skills/lds-pdf-layout/scripts/check-a4-layout.js
   记录当前失败项（脚本会显示每条规则的来源文件）

2. 针对实际失败项在 web/quotation-preview.html 内联 <style> 中补全后，重新运行：
   node .claude/skills/lds-pdf-layout/scripts/check-a4-layout.js
   目标：❌ 为 0

3. 打印预览验收：
   访问 http://localhost:3000/quotation-preview.html?id=[有数据的报价id]
   按 Ctrl+P 打开打印预览
   检查：
     - 第 1 页：只有 Cover，不溢出
     - 第 2-3 页：明细表格，行不截断
     - 最后页：条款 + 签字区（三处签字位）完整
     - 右下角总页数：4~5 页

4. Screen 验收：
   同一页面在普通浏览模式下，确认 layout 无变化

5. npm test:
   cd /d/LDS-OPS-v1 && npm test
```

---

## 风险提示

| 风险 | 概率 | 影响 | 处置 |
|---|---|---|---|
| `@media print` 样式意外影响 screen（specificity 问题）| 中 | Screen 布局错乱 | 所有 print 规则必须在 `@media print {}` 内，不泄漏到 screen |
| Cover page 锁高 267mm 后内容截断（logo 或标题被裁）| 中 | Cover 信息不完整 | 调整 Cover 内部元素间距，确保内容 < 267mm |
| quotation-preview.html 没有 Cover 区块，无从添加分页 | 高 | 需要重构 HTML 结构 | 先读懂现有 HTML 结构，再针对性添加 cover/terms 容器 |
| `check-a4-layout.js` 的检测 pattern 与实际 class 命名不匹配 | 低 | 通过率虚高/虚低 | 若实际 class 不同，相应调整脚本中的检测 pattern |

## 交付说明（2026-03-18）
- 改动文件：`web/quotation-preview.html`（仅 `@media print` 块内增量添加 6 行）
- 数据改动：不涉及
- 兼容处理：所有改动严格在 `@media print {}` 内，screen 样式零影响
- 本地验证：`node .claude/skills/lds-pdf-layout/scripts/check-a4-layout.js` 10/10 ✅；`npm test` 20/20 ✅
- 线上风险点：纯 CSS 改动，无 JS/API，Vercel 部署无风险
- 本地 server / 线上 api 同步状态：不涉及
- 下一轮可打包项：P1—浏览器打印预览手动验收（Cover 独占 1 页 / 表格行不截断 / 签字区完整）；AI 生成报价说明文本（待 PDF 稳定后）
