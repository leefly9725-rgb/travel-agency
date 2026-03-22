# 根因定位报告模板

> 使用方式：排障完成后填写此模板输出结论。不要跳过任何 Step，即使某步骤结果为"无异常"也要记录。

---

## 根因定位报告

**问题现象**：[一句话描述，如"点击 quotes.html 卡片后页面无跳转"]
**报告时间**：[YYYY-MM-DD HH:MM]
**环境**：本地 / Vercel 线上 / 两端都有

---

## 排障过程

### Step 1：Console / 语法错误
```
检查位置：浏览器 F12 → Console
结果：[ ] 有报错 / [ ] 无报错
报错内容（若有）：
  文件：
  行号：
  错误类型（SyntaxError / TypeError / ReferenceError）：
  完整信息：
```

### Step 2：Network / API 状态码
```
检查位置：浏览器 F12 → Network → Fetch/XHR
结果：[ ] 有失败请求 / [ ] 无失败请求
失败请求（若有）：
  URL：
  状态码：
  响应体（截取关键部分）：
```

### Step 3：本地 server vs 线上 API 差异
```
[ ] server/app.js 路由路径与 Vercel 一致
[ ] .env 变量名与 Vercel Dashboard 完全一致
[ ] 最新代码已 push 且 Vercel 已 Ready
[ ] api/[[...route]].js 未加业务逻辑
[ ] Supabase 激活状态：本地 [json/supabase] / 线上 [json/supabase]
```

### Step 4：最近改动审查
```bash
git diff HEAD~1 HEAD --stat
```
```
结果：
  涉及文件：
  危险操作（replace_all / 路由重排 / 字段删除）：
```

---

## 根因结论

**根因**：[具体原因，尽量精确到文件和行号]

**影响范围**：
- 页面/功能：
- 是否影响数据：是 / 否
- 是否影响 Vercel 线上：是 / 否

---

## 最小修复方案

```diff
// 文件：[路径]
// 说明：[为什么这样改]
- [旧代码]
+ [新代码]
```

**不需要改动的部分**：[明确说明哪些不动，避免过度修复]

---

## 验证步骤

1. [具体操作步骤 1]
2. [具体操作步骤 2]
3. `npm test` → 结果：[通过 / 失败]

---

## 后续预防措施

[如何避免类似问题再次发生，如"在 dataStore.js 读取新字段时统一补默认值"]
