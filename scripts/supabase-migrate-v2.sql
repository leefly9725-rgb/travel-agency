-- ============================================================
-- Migration v2: 项目型报价并入主报价系统
-- 用法：在 Supabase SQL editor 或 psql 中逐段执行
-- 全部使用 IF NOT EXISTS / IF EXISTS 保证幂等可重跑
-- ============================================================

-- 1. quotes 主表新增字段
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS total_cost    numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sales   numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_profit  numeric(14, 2) NOT NULL DEFAULT 0;

-- 2. quotation_projects 新增 quotation_id 外键及其他字段
--    quotation_id = null 表示旧独立记录，兼容保留
ALTER TABLE public.quotation_projects
  ADD COLUMN IF NOT EXISTS quotation_id         text REFERENCES public.quotes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS project_type         text NOT NULL DEFAULT 'event',
  ADD COLUMN IF NOT EXISTS project_title        text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sort_order           integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS project_cost_total   numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS project_sales_total  numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS project_profit_total numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at           timestamptz NOT NULL DEFAULT timezone('utc', now());

-- 3. quotation_project_items 新增字段
ALTER TABLE public.quotation_project_items
  ADD COLUMN IF NOT EXISTS item_type              text NOT NULL DEFAULT 'misc',
  ADD COLUMN IF NOT EXISTS item_category          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS item_name              text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS specification          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS currency               text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS supplier_id            text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS supplier_catalog_item_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cost_unit_price        numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_unit_price       numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_subtotal          numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_subtotal         numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_json             jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at             timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at             timestamptz NOT NULL DEFAULT timezone('utc', now());

-- 4. 索引
CREATE INDEX IF NOT EXISTS idx_quotation_projects_quotation_id
  ON public.quotation_projects (quotation_id);

CREATE INDEX IF NOT EXISTS idx_quotes_pricing_mode
  ON public.quotes (pricing_mode);

-- ============================================================
-- 兼容说明：
--   · 旧 quotation_projects 行 quotation_id = NULL，不受影响
--   · 旧 standard 报价 pricing_mode 默认 'standard'
--   · 旧 quotation_project_items 新列均有 DEFAULT，不破坏旧数据
-- ============================================================
