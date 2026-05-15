-- ============================================================
-- Migration v5: B1-03A 执行清单供应商字段
-- 用法：在 Supabase SQL editor 或 psql 中执行
-- 全部使用 IF NOT EXISTS 保证幂等可重跑
-- ============================================================

-- 1. 新增供应商字段（NOT NULL DEFAULT '' 保证旧数据安全）
ALTER TABLE public.project_execution_items
  ADD COLUMN IF NOT EXISTS supplier_id              text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS supplier_catalog_item_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS supplier_display         text NOT NULL DEFAULT '';

-- 2. 索引（按 project_id 分区检索同供应商项目）
CREATE INDEX IF NOT EXISTS idx_pei_supplier_id      ON public.project_execution_items (project_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_pei_supplier_display ON public.project_execution_items (project_id, supplier_display);
