# 报价列表默认排序优化

## 类型
轻量改动（可打包）

## 状态
backlog — 可与 project-based-phase2 打包完成

## 目标
- `/api/quotes` 返回结果默认按 `updatedAt DESC` 排序
- 前端列表无需额外排序代码

## 实现
```js
// server/app.js 中 /api/quotes 处理
const quotes = dataStore.getQuotes();
quotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
res.end(JSON.stringify({ quotes }));
```

## 打包建议
此改动 < 5 行，建议与 `2026-03-project-based-phase2` 的 P1 一起完成，节省一次调用。

## 验收
新建报价 → 修改后保存 → 刷新列表 → 该报价排在第一位。
