-- ============================================================
-- Migration v9: B1-05C 供应商发票文本导入
-- 新增 supplier_invoice_text_imports 表
-- 全部使用 IF NOT EXISTS 保证幂等可重跑
-- ============================================================

-- 1. 创建 supplier_invoice_text_imports 表
CREATE TABLE IF NOT EXISTS public.supplier_invoice_text_imports (
  id                        text PRIMARY KEY,
  project_id                text NOT NULL,
  supplier_id               text NOT NULL DEFAULT '',
  supplier_display          text NOT NULL DEFAULT '',

  raw_text                  text NOT NULL DEFAULT '',
  ocr_language              text NOT NULL DEFAULT 'sr',
  parse_status              text NOT NULL DEFAULT 'parsed',
  parse_error               text NOT NULL DEFAULT '',

  parsed_supplier_name      text NOT NULL DEFAULT '',
  parsed_supplier_pib       text NOT NULL DEFAULT '',
  invoice_number            text NOT NULL DEFAULT '',
  invoice_date              date,
  currency                  text NOT NULL DEFAULT 'RSD',

  subtotal_without_tax      numeric,
  tax_amount                numeric,
  total_with_tax            numeric,

  suggested_supplier_id     text NOT NULL DEFAULT '',
  suggested_supplier_display text NOT NULL DEFAULT '',
  match_confidence          numeric,
  match_reason              text NOT NULL DEFAULT '',

  review_status             text NOT NULL DEFAULT 'pending',
  target_supplier_cost_id   text NOT NULL DEFAULT '',
  applied_at                timestamptz,

  notes                     text NOT NULL DEFAULT '',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- 2. parse_status check constraint
ALTER TABLE public.supplier_invoice_text_imports
  DROP CONSTRAINT IF EXISTS supplier_invoice_text_imports_parse_status_check;

ALTER TABLE public.supplier_invoice_text_imports
  ADD CONSTRAINT supplier_invoice_text_imports_parse_status_check
  CHECK (parse_status IN ('parsed', 'failed'));

-- 3. review_status check constraint
ALTER TABLE public.supplier_invoice_text_imports
  DROP CONSTRAINT IF EXISTS supplier_invoice_text_imports_review_status_check;

ALTER TABLE public.supplier_invoice_text_imports
  ADD CONSTRAINT supplier_invoice_text_imports_review_status_check
  CHECK (review_status IN ('pending', 'applied', 'rejected'));

-- 4. 索引
CREATE INDEX IF NOT EXISTS idx_siti_project_id
  ON public.supplier_invoice_text_imports (project_id);

CREATE INDEX IF NOT EXISTS idx_siti_project_review_status
  ON public.supplier_invoice_text_imports (project_id, review_status);

CREATE INDEX IF NOT EXISTS idx_siti_project_supplier_display
  ON public.supplier_invoice_text_imports (project_id, supplier_display);

CREATE INDEX IF NOT EXISTS idx_siti_invoice_number
  ON public.supplier_invoice_text_imports (invoice_number)
  WHERE invoice_number <> '';

CREATE INDEX IF NOT EXISTS idx_siti_parsed_pib
  ON public.supplier_invoice_text_imports (parsed_supplier_pib)
  WHERE parsed_supplier_pib <> '';

-- 5. RLS（与 supplier_project_costs 保持一致）
ALTER TABLE public.supplier_invoice_text_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read supplier_invoice_text_imports" ON public.supplier_invoice_text_imports;
CREATE POLICY "Authenticated users can read supplier_invoice_text_imports"
  ON public.supplier_invoice_text_imports FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert supplier_invoice_text_imports" ON public.supplier_invoice_text_imports;
CREATE POLICY "Authenticated users can insert supplier_invoice_text_imports"
  ON public.supplier_invoice_text_imports FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update supplier_invoice_text_imports" ON public.supplier_invoice_text_imports;
CREATE POLICY "Authenticated users can update supplier_invoice_text_imports"
  ON public.supplier_invoice_text_imports FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete supplier_invoice_text_imports" ON public.supplier_invoice_text_imports;
CREATE POLICY "Authenticated users can delete supplier_invoice_text_imports"
  ON public.supplier_invoice_text_imports FOR DELETE
  TO authenticated
  USING (true);
