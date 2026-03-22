---
name: lds-debug-runbook
description: 当任务涉及页面白屏卡住、加载态不消失、console 报错、本地正常但 Vercel 线上异常、API 404/500、PDF 导出无反应、JS 语法错误、批量替换后连锁报错、npm test 失败时触发此 Skill
---

# lds-debug-runbook — 系统化排障手册

## 触发条件（任一满足即触发）

- 页面白屏 / 加载圈不消失 / 操作无响应
- Browser Console 有红色报错
- 本地 `npm start` 正常，Vercel 线上出 404/500
- `npm test` 失败，不知道从哪里入手
- 最近做了批量文本替换后出现连锁错误
- PDF 导出点了无反应或 window.print() 没打开预览

## 本项目特殊排障上下文

```
本地服务：  node server/index.js（端口 3000，可配置）
Vercel 入口：api/[[...route]].js → server/app.js（同一个 handler）
数据源：    data/seed.json（本地）/ Supabase（线上，若已激活）
测试命令：  npm test（node:test，--test-isolation=none）
```

## 标准排障流程（5 步）

### Step 1：Console / 语法错误
```
浏览器 F12 → Console 标签
- 有无 SyntaxError / ReferenceError / TypeError？
- 报错指向哪个文件哪一行？
- 是否有 "Cannot read properties of undefined" → 新字段缺失，需加默认值
```

### Step 2：Network / API 状态码
```
F12 → Network → 筛选 Fetch/XHR
- 400：请求参数错误（检查前端发送的 payload）
- 404：路由不存在（server/app.js 中是否有对应路由？）
- 500：服务端报错（看 server 终端的 console.error 输出）
- CORS：检查 api/[[...route]].js 是否有 CORS 头处理
```

### Step 3：本地 server 与 Vercel 差异
```
[ ] server/app.js 的路由路径与 Vercel 实际路径是否一致？
[ ] .env 中的变量名与 Vercel Dashboard 配置是否完全一致？
[ ] 涉及的文件是否已 git push？（Vercel 从 GitHub 拉取）
[ ] api/[[...route]].js 是否保持只做转发，没加额外逻辑？
[ ] Supabase 激活状态：本地和线上是否一致？
```

### Step 4：最近改动审查
```bash
git diff HEAD~1 HEAD --stat     # 最近一次提交影响哪些文件
git diff HEAD                   # 当前未提交的改动

危险信号：
- '?' 被替换（破坏三元/可选链）
- 某个字段被重命名但旧引用未全部更新
- server/app.js 路由顺序被打乱（catch-all 提前）
```

### Step 5：输出根因报告
使用 `templates/root-cause-report.md` 格式输出。

## 最小修复原则

- 只改根因，不顺便重构
- 修复后重跑 `npm test`，必须通过
- 修复后在 screen 和打印预览都验证（如涉及 PDF）

## 参考文件

- `templates/root-cause-report.md` — 根因报告模板（可直接填写）
- `references/vercel-error-reference.md` — HTTP 状态码与 Vercel 常见错误
- `scripts/debug-checklist.md` — 排障检查清单
- `gotchas.md` — 最常见的 production 破坏来源
