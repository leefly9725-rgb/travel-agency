-- ============================================================
-- Migration v8: B1-05B 供应商项目总成本 + 实际利润汇总
-- 新增 supplier_project_costs 表
-- 全部使用 IF NOT EXISTS 保证幂等可重跑
-- ============================================================

-- 1. 创建 supplier_project_costs 表
CREATE TABLE IF NOT EXISTS public.supplier_project_costs (
  id                        text PRIMARY KEY,
  project_id                text NOT NULL,
  supplier_id               text NOT NULL DEFAULT '',
  supplier_display          text NOT NULL DEFAULT '',
  cost_currency             text NOT NULL DEFAULT 'EUR',
  quoted_total_cost         numeric,
  execution_actual_total_cost numeric,
  actual_total_cost         numeric,
  use_supplier_total        boolean NOT NULL DEFAULT true,
  cost_status               text NOT NULL DEFAULT 'pending',
  invoice_number            text NOT NULL DEFAULT '',
  invoice_date              date,
  invoice_file_url          text NOT NULL DEFAULT '',
  source_type               text NOT NULL DEFAULT 'manual',
  notes                     text NOT NULL DEFAULT '',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- 2. cost_status check constraint
ALTER TABLE public.supplier_project_costs
  DROP CONSTRAINT IF EXISTS supplier_project_costs_cost_status_check;

ALTER TABLE public.supplier_project_costs
  ADD CONSTRAINT supplier_project_costs_cost_status_check
  CHECK (cost_status IN ('pending', 'estimated', 'confirmed', 'disputed'));

-- 3. source_type check constraint
ALTER TABLE public.supplier_project_costs
  DROP CONSTRAINT IF EXISTS supplier_project_costs_source_type_check;

ALTER TABLE public.supplier_project_costs
  ADD CONSTRAINT supplier_project_costs_source_type_check
  CHECK (source_type IN ('manual', 'invoice_text', 'ocr', 'import'));

-- 4. 唯一索引：同一项目同一供应商不重复建立总成本记录
--    supplier_id 为空时用 supplier_display 区分
CREATE UNIQUE INDEX IF NOT EXISTS idx_spc_project_supplier_unique
  ON public.supplier_project_costs (project_id, supplier_id, supplier_display);

-- 5. 普通索引
CREATE INDEX IF NOT EXISTS idx_spc_project_id
  ON public.supplier_project_costs (project_id);

CREATE INDEX IF NOT EXISTS idx_spc_project_supplier_display
  ON public.supplier_project_costs (project_id, supplier_display);

CREATE INDEX IF NOT EXISTS idx_spc_project_cost_status
  ON public.supplier_project_costs (project_id, cost_status);

-- 6. RLS — 与 project_tasks / project_execution_items 保持一致
ALTER TABLE public.supplier_project_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can manage supplier_project_costs" ON public.supplier_project_costs;

CREATE POLICY "authenticated users can manage supplier_project_costs"
  ON public.supplier_project_costs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
