# AI 智能生成报价单说明文本

## 类型
复杂开发（Claude API 集成）

## 状态
backlog — 等待 PDF 导出功能稳定后启动（`2026-03-pdf-consistency-fix` 验收通过后）

## 背景
报价单中的说明文字目前手动编写。引入 Claude API 自动生成面向客户的说明段落，可提升效率。

## 前置条件
- [ ] `2026-03-pdf-consistency-fix` 验收通过
- [ ] 确认 Claude API key 的安全存储方案（`.env` 中，服务端只读）
- [ ] seed.json 或 Supabase quotes 表新增 `aiDescription` 字段（nullable）

## 技术方向
- 新增 `/api/generate-quote-description` 路由（server/app.js）
- 调用 Claude API（服务端，不暴露 API key 到前端）
- 输入：报价明细（item_type、名称、数量、金额、目的地）
- 输出：面向客户的中文说明段落
- 前端：报价详情页新增"AI 生成"按钮，生成后可编辑

## 注意
引入 Claude API 需要外部 HTTP 调用，本项目目前用内置 `node:http` 可实现，不需要新增 npm 包。
