-- ============================================================
-- Migration v7: B1-05A 执行项供应商锁定 + 实际成本
-- 在 project_execution_items 上新增成本跟踪字段
-- 全部使用 IF NOT EXISTS 保证幂等可重跑
-- ============================================================

-- 1. 新增成本跟踪字段
ALTER TABLE public.project_execution_items
  ADD COLUMN IF NOT EXISTS quote_unit_cost    numeric,
  ADD COLUMN IF NOT EXISTS quote_total_cost   numeric,
  ADD COLUMN IF NOT EXISTS actual_unit_cost   numeric,
  ADD COLUMN IF NOT EXISTS actual_total_cost  numeric,
  ADD COLUMN IF NOT EXISTS cost_currency      text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS cost_status        text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS supplier_locked    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supplier_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS supplier_lock_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cost_notes         text NOT NULL DEFAULT '';

-- 2. cost_status check constraint（先 drop 旧的（如有），再 add）
ALTER TABLE public.project_execution_items
  DROP CONSTRAINT IF EXISTS project_execution_items_cost_status_check;

ALTER TABLE public.project_execution_items
  ADD CONSTRAINT project_execution_items_cost_status_check
  CHECK (cost_status IN ('not_started', 'estimated', 'confirmed', 'changed'));

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_pei_project_supplier_locked
  ON public.project_execution_items (project_id, supplier_locked);

CREATE INDEX IF NOT EXISTS idx_pei_project_cost_status
  ON public.project_execution_items (project_id, cost_status);
