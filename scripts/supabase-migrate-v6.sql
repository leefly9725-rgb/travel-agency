-- ============================================================
-- Migration v6: B1-04 project_tasks 表
-- 接待 / 执行任务内部追踪层（独立于 receptions，不影响现有数据）
-- 用法：在 Supabase SQL editor 或 psql 中执行
-- 全部使用 IF NOT EXISTS 保证幂等可重跑
-- ============================================================

-- 1. 创建 project_tasks 表
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id                        text PRIMARY KEY,
  project_id                text NOT NULL,
  source_execution_item_id  text NOT NULL,
  source_quote_item_id      text,
  source_group_id           text,
  source_group_title        text NOT NULL DEFAULT '',
  supplier_id               text NOT NULL DEFAULT '',
  supplier_catalog_item_id  text NOT NULL DEFAULT '',
  supplier_display          text NOT NULL DEFAULT '',
  task_type                 text NOT NULL DEFAULT 'execution',
  title                     text NOT NULL DEFAULT '',
  description               text NOT NULL DEFAULT '',
  assignee                  text NOT NULL DEFAULT '',
  due_date                  date,
  execution_date            date,
  location                  text NOT NULL DEFAULT '',
  status                    text NOT NULL DEFAULT 'todo'
    CONSTRAINT project_tasks_status_check
    CHECK (status IN ('todo','in_progress','done','cancelled')),
  priority                  text NOT NULL DEFAULT 'normal'
    CONSTRAINT project_tasks_priority_check
    CHECK (priority IN ('low','normal','high','urgent')),
  notes                     text NOT NULL DEFAULT '',
  sort_order                integer NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- 2. 唯一索引：每个 executionItem 最多生成一个 task（幂等保证）
-- 注：使用 CREATE UNIQUE INDEX IF NOT EXISTS 替代 ADD CONSTRAINT IF NOT EXISTS，
-- 后者在 PostgreSQL / Supabase 中不支持 IF NOT EXISTS 语法，前者完全幂等。
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_tasks_project_execution_unique
  ON public.project_tasks (project_id, source_execution_item_id);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_pt_project_id
  ON public.project_tasks (project_id);

CREATE INDEX IF NOT EXISTS idx_pt_project_status
  ON public.project_tasks (project_id, status);

CREATE INDEX IF NOT EXISTS idx_pt_project_assignee
  ON public.project_tasks (project_id, assignee);

CREATE INDEX IF NOT EXISTS idx_pt_project_due_date
  ON public.project_tasks (project_id, due_date);

CREATE INDEX IF NOT EXISTS idx_pt_project_supplier_id
  ON public.project_tasks (project_id, supplier_id);

-- 4. updated_at 自动更新触发器（复用已有函数 set_updated_at，不存在则创建）
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_project_tasks_updated_at ON public.project_tasks;
CREATE TRIGGER set_project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. RLS（与其他项目表保持一致，authenticated 用户可读写）
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_tasks_authenticated_all ON public.project_tasks;
CREATE POLICY project_tasks_authenticated_all
  ON public.project_tasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
