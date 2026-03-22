# lds-safe-backend — Gotchas

## 1. seed.json 新增字段必须给默认值，否则旧记录报错

`dataStore.js` 读取数据后直接使用，不做自动 schema 补全。

```js
// 错误：直接读取新字段
const nights = item.nights.toString(); // 旧记录 nights 为 undefined → 崩溃

// 正确：给默认值
const nights = (item.nights ?? 1).toString();
// 或在 dataStore.js 读取后统一补全：
// item.nights = item.nights ?? null;
```

---

## 2. server/app.js 路由顺序影响匹配

Node.js HTTP 路由是顺序匹配，catch-all 路由（如 `startsWith('/api/')`）如果放在前面会吞掉所有请求。

```js
// 危险：catch-all 路由提前
if (url.startsWith('/api/')) { handleAll(req, res); return; }
if (url === '/api/quotes')  { handleQuotes(); }  // 永远不会执行

// 正确：具体路由在前，catch-all 在后
if (url === '/api/quotes')  { handleQuotes(); return; }
if (url.startsWith('/api/')) { handle404(res); }
```

---

## 3. service_role_key 出现在前端 = 严重安全漏洞

`supabaseClient.js` 使用 service_role_key，该文件只能在 `server/` 目录下被 require，绝对不能被任何 `web/*.js` 加载或被打包进前端。

Vercel 侧：`SUPABASE_SERVICE_ROLE_KEY` 不加 `NEXT_PUBLIC_` 前缀（本项目不用 Next.js，类似地不能写进响应体返回给前端）。

---

## 4. API 返回结构改变会立即破坏前端

当前前端用 `response.data.xxx` 或 `response.quotes` 等固定路径读取数据。

```js
// 危险：改变返回结构
// 旧: res.end(JSON.stringify({ quotes: [...] }))
// 新: res.end(JSON.stringify({ data: [...] }))  ← 前端立即崩溃

// 安全：新增字段，不删除旧字段
res.end(JSON.stringify({ quotes: [...], total: n }));  // 新增 total，旧 quotes 还在
```

---

## 5. Vercel 部署后仍用旧代码（未触发重新部署）

推送到 GitHub 后 Vercel 自动部署，但有时需要手动确认：
- Vercel Dashboard → Deployments → 确认最新 commit 已 Ready
- 新增环境变量后必须重新部署才生效

---

## 6. `npm test` 使用 `--test-isolation=none`，测试共享状态

测试不隔离，前一个测试修改了 seed.json 内存状态会影响后续测试。改 dataStore.js 时格外小心，运行完整测试套件而不是单个文件。

---

## 7. api/[[...route]].js 只做转发，不加业务逻辑

这是 Vercel Serverless 入口，内容应极简：接收请求 → 传给 server/app.js → 返回。任何业务逻辑都放在 server/，不要在 api/ 里实现。
