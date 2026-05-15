-- ============================================================
-- Migration v4: B1-03 项目执行清单
-- 用法：在 Supabase SQL editor 或 psql 中执行
-- 全部使用 IF NOT EXISTS 保证幂等可重跑
-- ============================================================

-- 1. 新建 project_execution_items 表
CREATE TABLE IF NOT EXISTS public.project_execution_items (
  id                   text        PRIMARY KEY,
  project_id           text        NOT NULL,
  source_quote_item_id text        NULL,
  source_group_id      text        NULL,
  source_group_title   text        NOT NULL DEFAULT '',
  category             text        NOT NULL DEFAULT '',
  type                 text        NOT NULL DEFAULT '',
  title                text        NOT NULL DEFAULT '',
  description          text        NOT NULL DEFAULT '',
  quantity             numeric     NULL,
  unit                 text        NOT NULL DEFAULT '',
  planned_date         date        NULL,
  start_date           date        NULL,
  end_date             date        NULL,
  location             text        NOT NULL DEFAULT '',
  owner                text        NOT NULL DEFAULT '',
  status               text        NOT NULL DEFAULT 'pending',
  supplier_status      text        NOT NULL DEFAULT 'not_started',
  notes                text        NOT NULL DEFAULT '',
  sort_order           integer     NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 2. Check constraints（幂等）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pei_status_check'
  ) THEN
    ALTER TABLE public.project_execution_items
      ADD CONSTRAINT pei_status_check
      CHECK (status IN ('pending','in_progress','done','cancelled'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pei_supplier_status_check'
  ) THEN
    ALTER TABLE public.project_execution_items
      ADD CONSTRAINT pei_supplier_status_check
      CHECK (supplier_status IN ('not_required','not_started','inquiring','quoted','selected','confirmed'));
  END IF;
END $$;

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_pei_project_id      ON public.project_execution_items (project_id);
CREATE INDEX IF NOT EXISTS idx_pei_status          ON public.project_execution_items (status);
CREATE INDEX IF NOT EXISTS idx_pei_supplier_status ON public.project_execution_items (supplier_status);
CREATE INDEX IF NOT EXISTS idx_pei_sort_order      ON public.project_execution_items (sort_order);
CREATE INDEX IF NOT EXISTS idx_pei_project_sort    ON public.project_execution_items (project_id, sort_order);
