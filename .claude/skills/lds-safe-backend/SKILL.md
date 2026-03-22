---
name: lds-safe-backend
description: 当任务涉及 server/app.js 路由、dataStore.js 读写、Supabase schema 变更、API 返回结构兼容性、service_role_key 使用边界、Vercel api/ 入口、data/seed.json 字段结构时触发此 Skill
---

# lds-safe-backend — 后端安全操作规范

## 触发条件（任一满足即触发）

- 新增或修改 `server/app.js` 中的 API 路由
- 修改 `server/dataStore.js` 的读写逻辑或 seed.json 字段结构
- 编写或修改 `scripts/supabase-schema.sql` 或 `supabase-migrate-v2.sql`
- 使用 `server/supabaseClient.js`（service role 路径）
- 修改 `api/[[...route]].js`（Vercel 入口）
- 出现本地正常、Vercel 线上 404/500 的差异

## 项目持久化层

```
本地开发：data/seed.json（通过 server/dataStore.js 读写）
线上生产：Supabase PostgreSQL（已部署，由 SUPABASE_URL 环境变量驱动）

判断当前层：
  访问 http://localhost:3000/api/meta
  返回 { "storage": "json" } 或 { "storage": "supabase" }
```

> 改动数据结构时，必须同时更新 seed.json 兼容逻辑和 scripts/supabase-schema.sql（或 migration SQL），确保两端一致。

## 操作流程

### 1. 改动前确认持久化层
```bash
curl http://localhost:3000/api/meta
# 返回 { "storage": "json" } 或 { "storage": "supabase" }
```

### 2. seed.json 字段变更规则
- **新增字段**：必须在 `dataStore.js` 的读取逻辑中给默认值，不得让旧记录因字段缺失报错
- **删除字段**：禁止直接删除；改为在读取时忽略，写入时不包含
- **重命名字段**：两阶段（先双写，再下线旧字段）

### 3. API 路由变更规则
- 不得改动现有路由路径（`/api/quotes`、`/api/suppliers` 等）
- 不得从现有 API 响应中删除字段（可新增）
- 错误响应统一格式：`{ error: "描述", code: "可选错误码" }`

### 4. Supabase schema 变更规则
```sql
-- 正确：ADD COLUMN IF NOT EXISTS + 给默认值
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'standard';

-- 错误：直接 DROP COLUMN（破坏旧数据）
-- ALTER TABLE quotes DROP COLUMN old_field;
```

### 5. 改动后验证
```bash
npm test                         # 必须通过
node --test tests/api.test.js    # 单独跑 API 集成测试
node scripts/api-compat-check.js # 检查路由兜底
```

## 参考文件

- `references/api-route-inventory.md` — 当前所有 API 路由清单
- `references/seed-json-schema.md` — seed.json 当前字段结构
- `templates/backend-change-checklist.md` — 改动前后检查清单
- `scripts/api-compat-check.js` — **可直接运行**：检查所有路由有无错误兜底
- `gotchas.md` — 最容易破坏 production 的操作
