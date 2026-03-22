# lds-debug-runbook — Gotchas

## 1. 本地和线上使用同一个 server/app.js，但数据源可能不同

- 本地：`data/seed.json`（如果 Supabase 未激活）
- 线上：Supabase（如果 `.env` 中配置了 Supabase credentials）

排查"本地有数据线上没有"时，先检查 `/api/meta` 返回的 storage 类型。

---

## 2. `npm test` 的 `--test-isolation=none` 意味着测试顺序有影响

测试失败时，如果失败的测试不是第一个，可能是前面某个测试污染了状态。逐步缩小范围：

```bash
node --test tests/quoteService.test.js          # 单独跑
node --test tests/api.test.js                   # 单独跑
npm test                                         # 全套
```

---

## 3. 批量替换 `?` 是最危险的操作

项目代码中 `?` 用于：
- 可选链：`obj?.field`
- 空值合并：`a ?? b`
- 三元：`cond ? a : b`
- URL 查询字符串：`url.includes('?')`
- CSS 选择器（HTML 文件中）

一次 replace_all 可能同时破坏多种语义。发现此类问题后：
```bash
git diff HEAD  # 立即查看改动范围
git stash      # 如果破坏严重，先 stash 再定点修复
```

---

## 4. server/app.js 没有 status(500)（当前已知问题）

api-compat-check.js 检测到：服务端错误可能没有通过 HTTP 500 状态码返回，前端依赖响应体中的 `error` 字段判断错误。调试时不要只看 Network 的状态码是否为 500，还要看响应体。

---

## 5. PDF 导出 window.print() 在某些触发方式下被浏览器拦截

`window.print()` 必须在用户直接触发的事件回调中调用（如 `button.onclick`），不能在异步 `setTimeout` 或 `fetch.then()` 中调用（被视为非用户触发，浏览器拦截弹窗）。

---

## 6. Vercel Functions 日志位置

```
Vercel Dashboard → 选项目 → Deployments → 点击最新部署
→ Functions 标签（不是 Build Output！）
→ 找到对应的 /api/[[...route]] → 查看日志
```

注意：Vercel 免费计划的函数日志只保留 24 小时。
