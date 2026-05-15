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
