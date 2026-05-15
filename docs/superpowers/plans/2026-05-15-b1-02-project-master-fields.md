# B1-02 项目主档运营字段增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 projects 表新增 8 个运营字段，后端暴露 PATCH /api/projects/:id 接口，前端列表页增加筛选 + 卡片展示新字段，项目详情页新增可编辑"运营主档"面板。

**Architecture:** 最小侵入原则。SQL migration 只加列不删列；后端分离 create-payload（不含新字段，兼容未迁移的生产 DB）和 update-payload（含新字段）；前端只新增 DOM，不重构现有区域。

**Tech Stack:** Node.js (no deps), vanilla HTML/CSS/JS, Supabase REST API, local JSON fallback

---

## File Map

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `scripts/supabase-migrate-v3.sql` | 新建 | 8 个新字段 + 约束 + 索引 |
| `server/services/projectStore.js` | 修改 | normalize + updateProjectMaster + calculateProjectGroupTotals 加固 |
| `server/app.js` | 修改 | serializeProject + convertQuoteToProjectLocal + PATCH route |
| `tests/api.test.js` | 修改 | 7 组新测试 |
| `web/styles.css` | 修改 | 追加筛选栏 + badge + 主档面板样式 |
| `web/projects.html` | 修改 | 新增筛选栏 HTML |
| `web/projects.js` | 修改 | 筛选逻辑 + 卡片新字段 |
| `web/project-detail.js` | 修改 | 运营主档只读面板 + 编辑表单 |

---

## Task 1: SQL Migration

**Files:**
- Create: `scripts/supabase-migrate-v3.sql`

- [ ] **Step 1: 创建 migration 文件**

```sql
-- ============================================================
-- Migration v3: B1-02 项目主档运营字段增强
-- 用法：在 Supabase SQL editor 或 psql 中逐段执行
-- 全部使用 IF NOT EXISTS 保证幂等可重跑
-- ============================================================

-- 1. public.projects 新增运营字段
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS operation_owner   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sales_owner       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS coordinator       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority          text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS operation_status  text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS internal_deadline date,
  ADD COLUMN IF NOT EXISTS operation_notes   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS risk_notes        text NOT NULL DEFAULT '';

-- 2. Check constraints（幂等：先检查是否已存在）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_priority_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_priority_check
      CHECK (priority IN ('low','normal','high','urgent'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_operation_status_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_operation_status_check
      CHECK (operation_status IN ('not_started','preparing','ready','blocked'));
  END IF;
END $$;

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_projects_operation_status  ON public.projects (operation_status);
CREATE INDEX IF NOT EXISTS idx_projects_priority          ON public.projects (priority);
CREATE INDEX IF NOT EXISTS idx_projects_internal_deadline ON public.projects (internal_deadline);
```

- [ ] **Step 2: 验证文件存在**

```bash
ls scripts/supabase-migrate-v3.sql
```
Expected: 文件存在

---

## Task 2: Backend — projectStore.js

**Files:**
- Modify: `server/services/projectStore.js`

- [ ] **Step 1: 加固 calculateProjectGroupTotals — 支持 snake_case project_groups 键**

将第 10 行：
```js
const groups = Array.isArray(quoteOrSnap && quoteOrSnap.projectGroups) ? quoteOrSnap.projectGroups : [];
```
替换为：
```js
const groups = Array.isArray(quoteOrSnap?.projectGroups)
  ? quoteOrSnap.projectGroups
  : Array.isArray(quoteOrSnap?.project_groups)
    ? quoteOrSnap.project_groups
    : [];
```

- [ ] **Step 2: normalizeProjectRecordFromSupabase 新增 8 个字段**

在 `normalizeProjectRecordFromSupabase` 的 return 对象中，`updatedAt: row.updated_at || '',` 之后追加：
```js
    operationOwner: row.operation_owner || '',
    salesOwner: row.sales_owner || '',
    coordinator: row.coordinator || '',
    priority: row.priority || 'normal',
    operationStatus: row.operation_status || 'not_started',
    internalDeadline: row.internal_deadline || '',
    operationNotes: row.operation_notes || '',
    riskNotes: row.risk_notes || '',
```

- [ ] **Step 3: 新增常量 + updateProjectMaster 函数**

在 `updateProjectStatus` 函数之后、`module.exports` 之前插入：

```js
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const VALID_OPERATION_STATUSES = ['not_started', 'preparing', 'ready', 'blocked'];

const MASTER_CAMEL_TO_SNAKE = {
  projectName: 'project_name',
  clientName: 'client_name',
  contactName: 'contact_name',
  contactPhone: 'contact_phone',
  destination: 'destination',
  startDate: 'start_date',
  endDate: 'end_date',
  paxCount: 'pax_count',
  operationOwner: 'operation_owner',
  salesOwner: 'sales_owner',
  coordinator: 'coordinator',
  priority: 'priority',
  operationStatus: 'operation_status',
  internalDeadline: 'internal_deadline',
  operationNotes: 'operation_notes',
  riskNotes: 'risk_notes',
};

async function updateProjectMaster(config, id, patch) {
  // 1. 确认存在
  const existing = await supabaseRequest(
    config,
    `projects?select=id&id=eq.${encodeURIComponent(id)}`,
  );
  if (!Array.isArray(existing) || existing.length === 0) {
    const err = new Error('项目不存在。');
    err.status = 404;
    throw err;
  }

  // 2. 枚举校验
  if (patch.priority !== undefined && !VALID_PRIORITIES.includes(patch.priority)) {
    const err = new Error(`priority 不合法：${patch.priority}`);
    err.status = 400;
    throw err;
  }
  if (patch.operationStatus !== undefined && !VALID_OPERATION_STATUSES.includes(patch.operationStatus)) {
    const err = new Error(`operationStatus 不合法：${patch.operationStatus}`);
    err.status = 400;
    throw err;
  }
  if (patch.paxCount !== undefined) {
    const pc = Number(patch.paxCount);
    if (isNaN(pc) || pc < 0) {
      const err = new Error('paxCount 必须为非负数。');
      err.status = 400;
      throw err;
    }
  }

  // 3. 构造 snake_case payload（仅白名单字段）
  const payload = { updated_at: new Date().toISOString() };
  for (const [camelKey, snakeKey] of Object.entries(MASTER_CAMEL_TO_SNAKE)) {
    if (patch[camelKey] !== undefined) {
      let val = patch[camelKey];
      if (camelKey === 'paxCount') val = Number(val);
      if ((camelKey === 'startDate' || camelKey === 'endDate' || camelKey === 'internalDeadline') && val === '') {
        val = null;
      }
      payload[snakeKey] = val;
    }
  }

  // 4. Supabase PATCH
  const rows = await supabaseRequest(
    config,
    `projects?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    },
  );

  const updated = Array.isArray(rows) ? rows[0] : rows;
  if (!updated) throw new Error('更新失败，Supabase 未返回记录。');
  return normalizeProjectRecordFromSupabase(updated);
}
```

- [ ] **Step 4: 导出 updateProjectMaster**

将 `module.exports` 中加入 `updateProjectMaster`:
```js
module.exports = {
  deriveProjectFinancials,
  normalizeProjectRecordFromSupabase,
  buildSupabaseProjectPayload,
  convertToProject,
  listProjects,
  getProjectById,
  updateProjectStatus,
  updateProjectMaster,
};
```

- [ ] **Step 5: 语法检查**

```bash
node --check server/services/projectStore.js
```
Expected: 无输出（无错误）

---

## Task 3: Backend — app.js

**Files:**
- Modify: `server/app.js`

- [ ] **Step 1: 加固 calculateProjectGroupTotals（app.js 副本）**

找到 app.js 中 `calculateProjectGroupTotals`（约 1099 行）：
```js
const groups = Array.isArray(quoteOrSnap && quoteOrSnap.projectGroups) ? quoteOrSnap.projectGroups : [];
```
替换为：
```js
const groups = Array.isArray(quoteOrSnap?.projectGroups)
  ? quoteOrSnap.projectGroups
  : Array.isArray(quoteOrSnap?.project_groups)
    ? quoteOrSnap.project_groups
    : [];
```

- [ ] **Step 2: serializeProject 新增 8 个字段**

在 `serializeProject` 的 return 对象中，`updatedAt: project.updatedAt || '',` 之后追加（在 `}` 之前）：
```js
    operationOwner: project.operationOwner || project.ownerName || '',
    salesOwner: project.salesOwner || '',
    coordinator: project.coordinator || '',
    priority: project.priority || 'normal',
    operationStatus: project.operationStatus || 'not_started',
    internalDeadline: project.internalDeadline || '',
    operationNotes: project.operationNotes || '',
    riskNotes: project.riskNotes || '',
```

- [ ] **Step 3: convertQuoteToProjectLocal 新增默认运营字段**

在 `convertQuoteToProjectLocal` 中，project 对象的 `ownerName: '',` 之后追加：
```js
    operationOwner: '',
    salesOwner: '',
    coordinator: '',
    priority: 'normal',
    operationStatus: 'not_started',
    internalDeadline: '',
    operationNotes: '',
    riskNotes: '',
```

- [ ] **Step 4: 新增 PATCH /api/projects/:id 路由**

找到 app.js 中 `// PATCH /api/projects/:id/status` 注释（约 2161 行）。
将整个 PATCH 块从：
```js
  // PATCH /api/projects/:id/status
  if (request.method === "PATCH") {
    const statusMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/status$/);
    if (statusMatch) {
      const projectId = decodeURIComponent(statusMatch[1]);
      const body = parseJsonBody(await readRequestBody(request));
      const newStatus = body.status;
      if (!VALID_PROJECT_STATUSES.includes(newStatus)) {
        sendJson(response, 400, { error: `status 不合法，允许值：${VALID_PROJECT_STATUSES.join(", ")}` });
        return true;
      }
      const supabase = getSupabaseConfig();
      if (supabase.enabled) {
        try {
          const project = await projectStore.updateProjectStatus(supabase, projectId, newStatus);
          sendJson(response, 200, serializeProject(project));
        } catch (err) {
          sendJson(response, err.status || 500, { error: err.message });
        }
        return true;
      }
      const data = loadSeedData();
      ensureProjectData(data);
      const idx = data.projects.findIndex((p) => p.id === projectId);
      if (idx < 0) {
        sendJson(response, 404, { error: "项目不存在。" });
        return true;
      }
      data.projects[idx] = { ...data.projects[idx], status: newStatus, updatedAt: new Date().toISOString() };
      saveSeedData(data);
      sendJson(response, 200, serializeProject(data.projects[idx]));
      return true;
    }
  }
```

替换为（保留 status 路由，在其后添加 master 路由）：
```js
  // PATCH /api/projects/:id/status
  if (request.method === "PATCH") {
    const statusMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/status$/);
    if (statusMatch) {
      const projectId = decodeURIComponent(statusMatch[1]);
      const body = parseJsonBody(await readRequestBody(request));
      const newStatus = body.status;
      if (!VALID_PROJECT_STATUSES.includes(newStatus)) {
        sendJson(response, 400, { error: `status 不合法，允许值：${VALID_PROJECT_STATUSES.join(", ")}` });
        return true;
      }
      const supabase = getSupabaseConfig();
      if (supabase.enabled) {
        try {
          const project = await projectStore.updateProjectStatus(supabase, projectId, newStatus);
          sendJson(response, 200, serializeProject(project));
        } catch (err) {
          sendJson(response, err.status || 500, { error: err.message });
        }
        return true;
      }
      const data = loadSeedData();
      ensureProjectData(data);
      const idx = data.projects.findIndex((p) => p.id === projectId);
      if (idx < 0) {
        sendJson(response, 404, { error: "项目不存在。" });
        return true;
      }
      data.projects[idx] = { ...data.projects[idx], status: newStatus, updatedAt: new Date().toISOString() };
      saveSeedData(data);
      sendJson(response, 200, serializeProject(data.projects[idx]));
      return true;
    }

    // PATCH /api/projects/:id (项目主档编辑)
    const masterMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (masterMatch) {
      const projectId = decodeURIComponent(masterMatch[1]);
      const body = parseJsonBody(await readRequestBody(request));

      // 受保护字段（不允许客户端覆盖）
      const PROTECTED = new Set([
        'id','projectNumber','sourceQuoteId','sourceQuoteNumber','sourcePricingMode',
        'quoteSnapshot','totalCost','totalSales','grossProfit','grossMargin',
        'createdAt','updatedAt','currency','ownerName','notes','status',
      ]);
      const patch = {};
      for (const [k, v] of Object.entries(body)) {
        if (!PROTECTED.has(k)) patch[k] = v;
      }

      // 枚举校验
      const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
      const VALID_OP_STATUSES = ['not_started', 'preparing', 'ready', 'blocked'];
      if (patch.priority !== undefined && !VALID_PRIORITIES.includes(patch.priority)) {
        sendJson(response, 400, { error: `priority 不合法：${patch.priority}` });
        return true;
      }
      if (patch.operationStatus !== undefined && !VALID_OP_STATUSES.includes(patch.operationStatus)) {
        sendJson(response, 400, { error: `operationStatus 不合法：${patch.operationStatus}` });
        return true;
      }
      if (patch.paxCount !== undefined) {
        const pc = Number(patch.paxCount);
        if (isNaN(pc) || pc < 0) {
          sendJson(response, 400, { error: 'paxCount 必须为非负数。' });
          return true;
        }
        patch.paxCount = pc;
      }

      const supabase = getSupabaseConfig();
      if (supabase.enabled) {
        try {
          const project = await projectStore.updateProjectMaster(supabase, projectId, patch);
          sendJson(response, 200, serializeProject(project));
        } catch (err) {
          sendJson(response, err.status || 500, { error: err.message });
        }
        return true;
      }

      // Local JSON fallback
      const data = loadSeedData();
      ensureProjectData(data);
      const idx = data.projects.findIndex((p) => p.id === projectId);
      if (idx < 0) {
        sendJson(response, 404, { error: '项目不存在。' });
        return true;
      }
      const MASTER_FIELDS = [
        'projectName','clientName','contactName','contactPhone','destination',
        'startDate','endDate','paxCount',
        'operationOwner','salesOwner','coordinator',
        'priority','operationStatus','internalDeadline',
        'operationNotes','riskNotes',
      ];
      const updated = { ...data.projects[idx] };
      for (const field of MASTER_FIELDS) {
        if (patch[field] !== undefined) updated[field] = patch[field];
      }
      updated.updatedAt = new Date().toISOString();
      data.projects[idx] = updated;
      saveSeedData(data);
      sendJson(response, 200, serializeProject(updated));
      return true;
    }
  }
```

- [ ] **Step 5: 语法检查**

```bash
node --check server/app.js
```
Expected: 无输出

---

## Task 4: Tests — api.test.js

**Files:**
- Modify: `tests/api.test.js`

在文件末尾（1795 行之后）追加以下测试：

- [ ] **Step 1: 追加测试**

```js
// ── B1-02 运营主档字段测试 ──────────────────────────────────────────────────────

test("B1-02: convert-to-project sets default operational fields", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const res = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    assert.equal(res.status, 201);
    const project = await res.json();
    assert.equal(project.priority, "normal", "priority defaults to normal");
    assert.equal(project.operationStatus, "not_started", "operationStatus defaults to not_started");
    assert.equal(project.operationOwner, "", "operationOwner defaults to empty string");
    assert.equal(project.salesOwner, "", "salesOwner defaults to empty string");
    assert.equal(project.coordinator, "", "coordinator defaults to empty string");
    assert.equal(project.internalDeadline, "", "internalDeadline defaults to empty string");
    assert.equal(project.operationNotes, "", "operationNotes defaults to empty string");
    assert.equal(project.riskNotes, "", "riskNotes defaults to empty string");
  });
});

test("B1-02: PATCH /api/projects/:id updates master fields and persists", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: "更新后的项目名",
        clientName: "新客户",
        contactName: "张三",
        contactPhone: "13800138000",
        destination: "Niš",
        startDate: "2026-09-01",
        endDate: "2026-09-05",
        paxCount: 30,
        operationOwner: "李四",
        salesOwner: "王五",
        coordinator: "赵六",
        priority: "high",
        operationStatus: "preparing",
        internalDeadline: "2026-08-20",
        operationNotes: "需要提前确认场地",
        riskNotes: "签证存在风险",
      }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.projectName, "更新后的项目名");
    assert.equal(updated.clientName, "新客户");
    assert.equal(updated.contactName, "张三");
    assert.equal(updated.contactPhone, "13800138000");
    assert.equal(updated.destination, "Niš");
    assert.equal(updated.startDate, "2026-09-01");
    assert.equal(updated.endDate, "2026-09-05");
    assert.equal(updated.paxCount, 30);
    assert.equal(updated.operationOwner, "李四");
    assert.equal(updated.salesOwner, "王五");
    assert.equal(updated.coordinator, "赵六");
    assert.equal(updated.priority, "high");
    assert.equal(updated.operationStatus, "preparing");
    assert.equal(updated.internalDeadline, "2026-08-20");
    assert.equal(updated.operationNotes, "需要提前确认场地");
    assert.equal(updated.riskNotes, "签证存在风险");

    // 确认持久化
    const getRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`);
    assert.equal(getRes.status, 200);
    const fetched = await getRes.json();
    assert.equal(fetched.projectName, "更新后的项目名");
    assert.equal(fetched.operationOwner, "李四");
    assert.equal(fetched.priority, "high");
    assert.equal(fetched.operationStatus, "preparing");
    assert.equal(fetched.riskNotes, "签证存在风险");
  });
});

test("B1-02: PATCH /api/projects/:id returns 400 for invalid priority", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: "critical" }),
    });
    assert.equal(res.status, 400);
    const payload = await res.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("B1-02: PATCH /api/projects/:id returns 400 for invalid operationStatus", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operationStatus: "done" }),
    });
    assert.equal(res.status, 400);
    const payload = await res.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("B1-02: PATCH /api/projects/:id returns 404 for non-existent project", async () => {
  await withServer(async (port) => {
    const res = await apiFetch(port, "/api/projects/PRJ-NONEXISTENT-MASTER", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName: "测试" }),
    });
    assert.equal(res.status, 404);
    const payload = await res.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("B1-02: PATCH /api/projects/:id does not allow updating protected fields", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const original = await convertRes.json();
    const projectId = original.id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteSnapshot: { injected: true },
        totalCost: 99999,
        grossProfit: 99999,
        projectNumber: "FAKE-NUMBER",
        operationOwner: "合法字段",
      }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    // 受保护字段不能被覆盖
    assert.equal(updated.totalCost, original.totalCost, "totalCost must not change");
    assert.equal(updated.grossProfit, original.grossProfit, "grossProfit must not change");
    assert.equal(updated.projectNumber, original.projectNumber, "projectNumber must not change");
    assert.ok(updated.quoteSnapshot && !updated.quoteSnapshot.injected, "quoteSnapshot must not be replaced");
    // 合法字段正常更新
    assert.equal(updated.operationOwner, "合法字段");
  });
});

test("B1-02: existing PATCH /api/projects/:id/status still works after adding master route", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "running" }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.status, "running");
  });
});
```

- [ ] **Step 2: 运行所有测试，确认通过**

```bash
npm test
```
Expected: 所有测试 PASS（原有 81 个 + 新增 7 个 = 88 个）

---

## Task 5: CSS — styles.css

**Files:**
- Modify: `web/styles.css`

在文件末尾追加：

- [ ] **Step 1: 追加样式**

```css
/* ── B1-02 项目列表筛选栏 ─────────────────────────────────────────────────────── */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 0 16px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 16px;
}

.filter-bar select {
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--ink);
  font-size: 13px;
  cursor: pointer;
  min-width: 120px;
}

.filter-bar select:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.filter-empty {
  text-align: center;
  padding: 32px;
  color: var(--muted);
  font-size: 14px;
}

/* ── B1-02 优先级 badge ───────────────────────────────────────────────────────── */
.priority-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 4px;
  white-space: nowrap;
  border: 1px solid transparent;
}

.priority-badge-low      { background: rgba(95,107,122,0.08); border-color: rgba(95,107,122,0.2);   color: #5f6b7a; }
.priority-badge-normal   { background: rgba(2,119,189,0.07);  border-color: rgba(2,119,189,0.18);   color: #0277bd; }
.priority-badge-high     { background: rgba(230,126,34,0.10); border-color: rgba(230,126,34,0.25);  color: #b05d10; }
.priority-badge-urgent   { background: rgba(163,61,47,0.08);  border-color: rgba(163,61,47,0.2);    color: #a33d2f; }

/* ── B1-02 运营准备状态 badge ────────────────────────────────────────────────── */
.op-status-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 4px;
  white-space: nowrap;
  border: 1px solid transparent;
}

.op-status-badge-not_started { background: rgba(95,107,122,0.08); border-color: rgba(95,107,122,0.2);  color: #5f6b7a; }
.op-status-badge-preparing   { background: rgba(2,119,189,0.07);  border-color: rgba(2,119,189,0.18);  color: #0277bd; }
.op-status-badge-ready       { background: var(--success-bg);     border-color: rgba(36,97,59,0.2);    color: var(--success-text); }
.op-status-badge-blocked     { background: var(--error-bg);       border-color: rgba(163,61,47,0.2);   color: var(--error-text); }

/* ── B1-02 项目主档面板 ──────────────────────────────────────────────────────── */
.project-master-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px 20px;
  margin-top: 12px;
}

.project-master-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.project-master-field label {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.project-master-field .field-value {
  font-size: 14px;
  color: var(--ink);
  font-weight: 500;
  word-break: break-word;
}

.project-master-field .field-value.empty-value {
  color: var(--muted);
  font-weight: 400;
}

.project-master-textarea-field {
  grid-column: 1 / -1;
}

.project-master-form {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px 20px;
  margin-top: 12px;
}

.project-master-form .form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.project-master-form .form-field label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}

.project-master-form .form-field input,
.project-master-form .form-field select {
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: white;
  color: var(--ink);
  font-size: 13px;
}

.project-master-form .form-field input:focus,
.project-master-form .form-field select:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  border-color: transparent;
}

.project-master-form .form-field-full {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.project-master-form .form-field-full label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}

.project-master-form textarea {
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: white;
  color: var(--ink);
  font-size: 13px;
  min-height: 72px;
  resize: vertical;
  width: 100%;
}

.project-master-form textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  border-color: transparent;
}

.project-master-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 16px;
  flex-wrap: wrap;
}

.project-master-save-hint {
  font-size: 12px;
  color: var(--success-text);
  min-width: 60px;
}
```

- [ ] **Step 2: 验证无语法问题**

```bash
node --check web/projects.js 2>/dev/null; echo "styles checked"
```
Expected: styles checked（CSS 无法被 node --check，仅确认文件已写入）

---

## Task 6: Frontend — projects.html + projects.js

**Files:**
- Modify: `web/projects.html`
- Modify: `web/projects.js`

- [ ] **Step 1: projects.html 新增筛选栏**

将 `<div id="project-list" class="stack"></div>` 改为：
```html
      <div id="project-filters" class="filter-bar">
        <select id="filter-status" aria-label="筛选项目状态">
          <option value="">全部项目状态</option>
          <option value="draft">草稿</option>
          <option value="confirmed">已确认</option>
          <option value="running">执行中</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </select>
        <select id="filter-op-status" aria-label="筛选运营准备状态">
          <option value="">全部运营状态</option>
          <option value="not_started">未开始</option>
          <option value="preparing">准备中</option>
          <option value="ready">已准备</option>
          <option value="blocked">阻塞</option>
        </select>
        <select id="filter-priority" aria-label="筛选优先级">
          <option value="">全部优先级</option>
          <option value="low">低</option>
          <option value="normal">普通</option>
          <option value="high">高</option>
          <option value="urgent">紧急</option>
        </select>
      </div>
      <div id="project-list" class="stack"></div>
```

- [ ] **Step 2: 重写 projects.js**

完整替换 `web/projects.js`：

```js
const PROJECT_STATUS_LABELS = {
  draft: "草稿",
  confirmed: "已确认",
  running: "执行中",
  completed: "已完成",
  cancelled: "已取消",
};

const PRIORITY_LABELS = {
  low: "低",
  normal: "普通",
  high: "高",
  urgent: "紧急",
};

const OP_STATUS_LABELS = {
  not_started: "未开始",
  preparing: "准备中",
  ready: "已准备",
  blocked: "阻塞",
};

function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function statusBadgeClass(status) {
  return { draft: "", confirmed: "e-preparing", running: "e-executing", completed: "e-completed", cancelled: "e-cancelled" }[status] || "";
}

function formatCurrency(amount, currency) {
  if (typeof window.AppUtils?.formatCurrency === "function") {
    return window.AppUtils.formatCurrency(amount, currency);
  }
  return `${currency || "EUR"} ${Number(amount || 0).toFixed(2)}`;
}

function renderProjectCard(project) {
  const statusLabel = PROJECT_STATUS_LABELS[project.status] || project.status;
  const statusCls = statusBadgeClass(project.status);
  const currency = project.currency || "EUR";
  const priorityLabel = PRIORITY_LABELS[project.priority] || project.priority || "普通";
  const priorityCls = `priority-badge priority-badge-${project.priority || "normal"}`;
  const opStatusLabel = OP_STATUS_LABELS[project.operationStatus] || project.operationStatus || "未开始";
  const opStatusCls = `op-status-badge op-status-badge-${project.operationStatus || "not_started"}`;
  const deadline = project.internalDeadline ? esc(project.internalDeadline) : "—";
  const owner = project.operationOwner ? esc(project.operationOwner) : "—";

  return `
    <article class="card">
      <div class="list-row list-row-top">
        <div>
          <div class="title-row">
            <h3>${esc(project.projectName || "未命名项目")}</h3>
            <span class="status-badge ${statusCls}">${esc(statusLabel)}</span>
          </div>
          <p class="meta">${esc(project.clientName)} · ${esc(project.destination || "目的地待定")} · ${esc(project.startDate || "日期待定")}</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
            <span class="${esc(priorityCls)}">${esc(priorityLabel)}</span>
            <span class="${esc(opStatusCls)}">${esc(opStatusLabel)}</span>
          </div>
        </div>
        <a class="button-link small-link" href="/project-detail.html?id=${encodeURIComponent(project.id)}">查看详情</a>
      </div>
      <div class="detail-grid">
        <div class="metric"><span>项目编号</span><strong>${esc(project.projectNumber)}</strong></div>
        <div class="metric"><span>来源报价</span><strong>${esc(project.sourceQuoteNumber || "—")}</strong></div>
        <div class="metric"><span>销售额</span><strong>${formatCurrency(project.totalSales, currency)}</strong></div>
        <div class="metric"><span>毛利</span><strong>${formatCurrency(project.grossProfit, currency)}</strong></div>
        <div class="metric"><span>项目负责人</span><strong>${owner}</strong></div>
        <div class="metric"><span>内部截止</span><strong>${deadline}</strong></div>
      </div>
    </article>
  `;
}

let allProjects = [];

function applyFilters() {
  const statusVal = document.getElementById("filter-status")?.value || "";
  const opStatusVal = document.getElementById("filter-op-status")?.value || "";
  const priorityVal = document.getElementById("filter-priority")?.value || "";

  const filtered = allProjects.filter((p) => {
    if (statusVal && p.status !== statusVal) return false;
    if (opStatusVal && (p.operationStatus || "not_started") !== opStatusVal) return false;
    if (priorityVal && (p.priority || "normal") !== priorityVal) return false;
    return true;
  });

  const container = document.getElementById("project-list");
  if (filtered.length === 0) {
    container.innerHTML = '<p class="filter-empty">当前筛选条件下暂无项目。</p>';
    return;
  }
  container.innerHTML = filtered.map(renderProjectCard).join("");
}

async function bootstrap() {
  window.AppUtils.applyFlash("project-message");
  try {
    allProjects = await window.AppUtils.fetchJson("/api/projects", null, "项目列表加载失败，请稍后重试");
    const container = document.getElementById("project-list");

    if (allProjects.length === 0) {
      container.innerHTML = '<p class="empty">当前还没有项目。请在项目型报价列表中点击"转为项目"来创建第一个项目。</p>';
      return;
    }

    applyFilters();

    ["filter-status", "filter-op-status", "filter-priority"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", applyFilters);
    });
  } catch (error) {
    window.AppUtils.showMessage("project-message", error.message, "error");
    document.getElementById("project-list").innerHTML = '<p class="empty">项目列表暂时无法显示，请稍后再试。</p>';
  }
}

bootstrap();
```

- [ ] **Step 3: 语法检查**

```bash
node --check web/projects.js
```
Expected: 无输出

---

## Task 7: Frontend — project-detail.js

**Files:**
- Modify: `web/project-detail.js`

- [ ] **Step 1: 在 renderRealProject 之前插入辅助函数 renderMasterPanel 和 renderMasterEditForm**

在 `function renderRealProject(project)` 之前插入：

```js
const PRIORITY_LABELS = {
  low: "低",
  normal: "普通",
  high: "高",
  urgent: "紧急",
};

const OP_STATUS_LABELS = {
  not_started: "未开始",
  preparing: "准备中",
  ready: "已准备",
  blocked: "阻塞",
};

function renderMasterPanel(project) {
  const def = (v) => v
    ? `<span class="field-value">${esc(v)}</span>`
    : `<span class="field-value empty-value">—</span>`;

  return `
    <section class="panel" id="master-panel">
      <div class="panel-head" style="display:flex;justify-content:space-between;align-items:center">
        <h2>运营主档</h2>
        <button type="button" class="button-link small-link" id="edit-master-btn">编辑主档</button>
      </div>
      <div class="project-master-grid" id="master-readonly">
        <div class="project-master-field">
          <label>项目名称</label>${def(project.projectName)}
        </div>
        <div class="project-master-field">
          <label>客户名称</label>${def(project.clientName)}
        </div>
        <div class="project-master-field">
          <label>联系人</label>${def(project.contactName)}
        </div>
        <div class="project-master-field">
          <label>联系电话</label>${def(project.contactPhone)}
        </div>
        <div class="project-master-field">
          <label>目的地</label>${def(project.destination)}
        </div>
        <div class="project-master-field">
          <label>开始日期</label>${def(project.startDate)}
        </div>
        <div class="project-master-field">
          <label>结束日期</label>${def(project.endDate)}
        </div>
        <div class="project-master-field">
          <label>人数</label>${def(project.paxCount != null ? project.paxCount + " 人" : null)}
        </div>
        <div class="project-master-field">
          <label>项目负责人</label>${def(project.operationOwner)}
        </div>
        <div class="project-master-field">
          <label>销售负责人</label>${def(project.salesOwner)}
        </div>
        <div class="project-master-field">
          <label>协作人</label>${def(project.coordinator)}
        </div>
        <div class="project-master-field">
          <label>优先级</label>
          <span class="field-value">${esc(PRIORITY_LABELS[project.priority] || project.priority || "普通")}</span>
        </div>
        <div class="project-master-field">
          <label>运营准备状态</label>
          <span class="field-value">${esc(OP_STATUS_LABELS[project.operationStatus] || project.operationStatus || "未开始")}</span>
        </div>
        <div class="project-master-field">
          <label>内部准备截止日期</label>${def(project.internalDeadline)}
        </div>
        <div class="project-master-field project-master-textarea-field">
          <label>内部运营备注</label>${def(project.operationNotes)}
        </div>
        <div class="project-master-field project-master-textarea-field">
          <label>风险/阻塞说明</label>${def(project.riskNotes)}
        </div>
      </div>
      <div id="master-edit-form" style="display:none"></div>
    </section>
  `;
}

function renderMasterEditForm(project) {
  return `
    <form class="project-master-form" id="master-form" novalidate>
      <div class="form-field">
        <label for="mf-projectName">项目名称</label>
        <input id="mf-projectName" name="projectName" type="text" value="${esc(project.projectName || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-clientName">客户名称</label>
        <input id="mf-clientName" name="clientName" type="text" value="${esc(project.clientName || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-contactName">联系人</label>
        <input id="mf-contactName" name="contactName" type="text" value="${esc(project.contactName || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-contactPhone">联系电话</label>
        <input id="mf-contactPhone" name="contactPhone" type="text" value="${esc(project.contactPhone || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-destination">目的地</label>
        <input id="mf-destination" name="destination" type="text" value="${esc(project.destination || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-startDate">开始日期</label>
        <input id="mf-startDate" name="startDate" type="date" value="${esc(project.startDate || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-endDate">结束日期</label>
        <input id="mf-endDate" name="endDate" type="date" value="${esc(project.endDate || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-paxCount">人数</label>
        <input id="mf-paxCount" name="paxCount" type="number" min="0" value="${esc(String(project.paxCount ?? ""))}">
      </div>
      <div class="form-field">
        <label for="mf-operationOwner">项目负责人</label>
        <input id="mf-operationOwner" name="operationOwner" type="text" value="${esc(project.operationOwner || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-salesOwner">销售负责人</label>
        <input id="mf-salesOwner" name="salesOwner" type="text" value="${esc(project.salesOwner || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-coordinator">协作人</label>
        <input id="mf-coordinator" name="coordinator" type="text" value="${esc(project.coordinator || "")}" />
      </div>
      <div class="form-field">
        <label for="mf-priority">优先级</label>
        <select id="mf-priority" name="priority">
          <option value="low"${project.priority === "low" ? " selected" : ""}>低</option>
          <option value="normal"${(!project.priority || project.priority === "normal") ? " selected" : ""}>普通</option>
          <option value="high"${project.priority === "high" ? " selected" : ""}>高</option>
          <option value="urgent"${project.priority === "urgent" ? " selected" : ""}>紧急</option>
        </select>
      </div>
      <div class="form-field">
        <label for="mf-operationStatus">运营准备状态</label>
        <select id="mf-operationStatus" name="operationStatus">
          <option value="not_started"${(!project.operationStatus || project.operationStatus === "not_started") ? " selected" : ""}>未开始</option>
          <option value="preparing"${project.operationStatus === "preparing" ? " selected" : ""}>准备中</option>
          <option value="ready"${project.operationStatus === "ready" ? " selected" : ""}>已准备</option>
          <option value="blocked"${project.operationStatus === "blocked" ? " selected" : ""}>阻塞</option>
        </select>
      </div>
      <div class="form-field">
        <label for="mf-internalDeadline">内部准备截止日期</label>
        <input id="mf-internalDeadline" name="internalDeadline" type="date" value="${esc(project.internalDeadline || "")}" />
      </div>
      <div class="form-field-full">
        <label for="mf-operationNotes">内部运营备注</label>
        <textarea id="mf-operationNotes" name="operationNotes">${esc(project.operationNotes || "")}</textarea>
      </div>
      <div class="form-field-full">
        <label for="mf-riskNotes">风险/阻塞说明</label>
        <textarea id="mf-riskNotes" name="riskNotes">${esc(project.riskNotes || "")}</textarea>
      </div>
      <div class="project-master-actions" style="grid-column:1/-1">
        <button type="submit" class="button-primary">保存</button>
        <button type="button" id="cancel-master-btn" class="button-link small-link">取消</button>
        <span id="master-save-hint" class="project-master-save-hint" aria-live="polite"></span>
      </div>
    </form>
  `;
}
```

- [ ] **Step 2: 修改 renderRealProject 以包含 renderMasterPanel**

将 `renderRealProject` 中第一个 `</section>` 之后（状态面板所在 section 末尾之后），在 `<section class="panel">` `<div class="panel-head"><h2>来源报价</h2>` 之前插入：

```
${renderMasterPanel(project)}
```

具体：将原来的：
```js
      ${renderStatusPanel(project.status, project.id)}
      <div class="detail-grid section-spacing">
        <div class="metric"><span>联系人</span>...
```
中的 `detail-grid` 段删除（这些字段已在 masterPanel 显示），同时在 `renderStatusPanel` 调用之后添加 `renderMasterPanel`。

实际上，要保留原有 detail-grid 字段展示（兼容性），只新增 masterPanel：

将 `renderRealProject` 的 return 改为：
```js
function renderRealProject(project) {
  const snap = project.quoteSnapshot || {};
  const currency = project.currency || snap.currency || "EUR";

  return `
    <section class="panel">
      <div class="panel-head panel-head-wrap">
        <div>
          <p class="section-kicker">项目编号：${esc(project.projectNumber)}</p>
          <h1>${esc(project.projectName || "未命名项目")}</h1>
          <p class="meta">${esc(project.clientName)}</p>
        </div>
      </div>
      ${renderStatusPanel(project.status, project.id)}
    </section>

    ${renderMasterPanel(project)}

    <section class="panel">
      <div class="panel-head"><h2>来源报价</h2></div>
      <div class="detail-grid">
        <div class="metric"><span>报价编号</span><strong>${esc(project.sourceQuoteNumber || "—")}</strong></div>
        <div class="metric"><span>报价模式</span><strong>项目型报价</strong></div>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        ${project.sourceQuoteId
          ? `<a class="button-link small-link" href="/quote-new.html?id=${encodeURIComponent(project.sourceQuoteId)}&mode=project_based" target="_blank" rel="noopener">查看原报价</a>
             <a class="button-link small-link" href="/project-quotation.html?id=${encodeURIComponent(project.sourceQuoteId)}" target="_blank" rel="noopener">客户报价单</a>`
          : '<span style="color:#999;font-size:13px">来源报价不可链接</span>'
        }
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>报价快照 · 明细</h2></div>
      ${renderSnapshotGroups(snap.projectGroups, currency)}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>汇总</h2></div>
      <div class="detail-grid">
        <div class="metric"><span>成本合计</span><strong>${formatCurrency(project.totalCost, currency)}</strong></div>
        <div class="metric"><span>销售合计</span><strong>${formatCurrency(project.totalSales, currency)}</strong></div>
        <div class="metric"><span>毛利</span><strong>${formatCurrency(project.grossProfit, currency)}</strong></div>
        <div class="metric"><span>毛利率</span><strong>${Number(project.grossMargin || 0).toFixed(1)}%</strong></div>
      </div>
    </section>
  `;
}
```

- [ ] **Step 3: 新增 master 面板的编辑/保存/取消事件处理**

在 `handleStatusButtonClick` 函数之前插入：

```js
async function handleMasterPanelEvents(container, project) {
  const editBtn = container.querySelector("#edit-master-btn");
  if (!editBtn) return;

  editBtn.addEventListener("click", () => {
    const readonly = container.querySelector("#master-readonly");
    const editArea = container.querySelector("#master-edit-form");
    if (!readonly || !editArea) return;
    readonly.style.display = "none";
    editBtn.style.display = "none";
    editArea.style.display = "block";
    editArea.innerHTML = renderMasterEditForm(project);

    const form = editArea.querySelector("#master-form");
    const cancelBtn = editArea.querySelector("#cancel-master-btn");
    const hint = editArea.querySelector("#master-save-hint");

    cancelBtn?.addEventListener("click", () => {
      editArea.style.display = "none";
      editArea.innerHTML = "";
      editBtn.style.display = "";
      readonly.style.display = "";
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const patch = {};
      for (const [k, v] of data.entries()) {
        patch[k] = v;
      }
      // paxCount 数字转换
      if (patch.paxCount !== undefined) patch.paxCount = Number(patch.paxCount);

      const submitBtns = form.querySelectorAll("button[type=submit]");
      submitBtns.forEach((b) => { b.disabled = true; });
      if (hint) hint.textContent = "保存中…";

      try {
        const updated = await window.AppUtils.fetchJson(
          `/api/projects/${encodeURIComponent(project.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
          "保存失败，请稍后重试。"
        );
        // 更新 project 引用并重新渲染只读视图
        Object.assign(project, updated);
        // 重新渲染 readonly
        const newReadonly = document.createElement("div");
        newReadonly.id = "master-readonly";
        newReadonly.className = "project-master-grid";
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = renderMasterPanel(updated);
        const newGrid = tempDiv.querySelector("#master-readonly");
        if (newGrid) {
          readonly.innerHTML = newGrid.innerHTML;
        }
        editArea.style.display = "none";
        editArea.innerHTML = "";
        editBtn.style.display = "";
        readonly.style.display = "";
        window.AppUtils.showMessage("project-message", "运营主档已保存。", "success");
      } catch (err) {
        if (hint) hint.textContent = "保存失败";
        window.AppUtils.showMessage("project-message", err.message, "error");
      } finally {
        submitBtns.forEach((b) => { b.disabled = false; });
      }
    });
  });
}
```

- [ ] **Step 4: 修改 bootstrap 函数，在 renderRealProject 后调用 handleMasterPanelEvents**

将 bootstrap 中：
```js
    if (project.quoteSnapshot !== undefined) {
      container.innerHTML = renderRealProject(project);
      document.title = `项目 · ${project.projectName || project.projectNumber}`;
      container.addEventListener("click", handleStatusButtonClick);
    } else {
```
改为：
```js
    if (project.quoteSnapshot !== undefined) {
      container.innerHTML = renderRealProject(project);
      document.title = `项目 · ${project.projectName || project.projectNumber}`;
      container.addEventListener("click", handleStatusButtonClick);
      handleMasterPanelEvents(container, project);
    } else {
```

- [ ] **Step 5: 语法检查**

```bash
node --check web/project-detail.js
```
Expected: 无输出

---

## Task 8: 最终验证 + commit

- [ ] **Step 1: 运行全量测试**

```bash
npm test
```
Expected: 所有测试 PASS

- [ ] **Step 2: 语法检查所有修改文件**

```bash
node --check server/app.js && node --check server/services/projectStore.js && node --check web/projects.js && node --check web/project-detail.js
```
Expected: 无输出

- [ ] **Step 3: commit + push**

```bash
git add scripts/supabase-migrate-v3.sql server/services/projectStore.js server/app.js tests/api.test.js web/styles.css web/projects.html web/projects.js web/project-detail.js docs/superpowers/plans/2026-05-15-b1-02-project-master-fields.md
git commit -m "feat(B1-02): add operational fields to project master — PATCH /api/projects/:id, filter bar, edit panel"
git push
```

---

## Self-Review

### Spec Coverage Check

| 需求 | Task |
|---|---|
| SQL migration — 8 字段 + 约束 + 索引 | Task 1 |
| normalizeProjectRecordFromSupabase 新增 8 字段 | Task 2 |
| updateProjectMaster + 白名单 + 枚举校验 | Task 2 |
| calculateProjectGroupTotals snake_case 兼容 | Task 2 + 3 |
| serializeProject 新增 8 字段 | Task 3 |
| convertQuoteToProjectLocal 默认运营字段 | Task 3 |
| PATCH /api/projects/:id — Supabase + local fallback | Task 3 |
| 受保护字段不允许更新 | Task 3 |
| 测试：默认字段、PATCH 更新、400 校验、保护字段 | Task 4 |
| 筛选栏 — status + operationStatus + priority | Task 6 |
| 卡片新增 operationOwner / priority / operationStatus / internalDeadline | Task 6 |
| 详情页运营主档只读面板 | Task 7 |
| 详情页编辑表单 + 保存 + 取消 | Task 7 |
| 客户输出安全边界不受影响 | Task 3 (PROTECTED set) + Task 4 |
| 生产兼容 (create payload 不含新字段) | Task 3 (convertQuoteToProjectLocal only adds defaults locally) |
| migration 幂等 | Task 1 (IF NOT EXISTS + DO $$ BEGIN) |

### 生产兼容关键点

**convert-to-project 不会因生产 DB 未迁移而崩溃：**
`buildSupabaseProjectPayload` 不包含新字段（`operation_owner` 等），因此 Supabase INSERT 不包含这些列，不会因为字段不存在而报错。新字段只通过 `PATCH /api/projects/:id` 写入，该路由上线后用户主动调用时数据库必须已迁移。这是合理的时序。

**local JSON：** `convertQuoteToProjectLocal` 写入新字段默认值，seed.json 旧记录无新字段时 `serializeProject` 用 `|| ''` / `|| 'normal'` 兜底。
