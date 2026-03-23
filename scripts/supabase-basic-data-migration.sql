-- ============================================================
-- Migration: 基础数据管理表
-- 1. project_group_types — 项目分组类型（旅游接待/活动服务/综合项目）
-- 2. supplier_categories — 供应商物料类别（从硬编码迁移）
-- ============================================================

-- ── 1. project_group_types ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_group_types (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT        NOT NULL UNIQUE,
  name_zh     TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.project_group_types         IS '项目报价分组类型主数据';
COMMENT ON COLUMN public.project_group_types.code    IS '英文标识符，如 travel / event / mixed';
COMMENT ON COLUMN public.project_group_types.is_active IS 'FALSE 表示软删除，不再出现在选项中';

CREATE INDEX IF NOT EXISTS idx_project_group_types_active
  ON public.project_group_types (is_active, sort_order);

-- 初始数据（与 ui-labels.js projectGroupTypeLabels 对应）
INSERT INTO public.project_group_types (code, name_zh, sort_order) VALUES
  ('travel', '旅游接待', 1),
  ('event',  '活动服务', 2),
  ('mixed',  '综合项目', 3)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.project_group_types ENABLE ROW LEVEL SECURITY;
-- service_role 绕过 RLS；authenticated 通过下方策略只读
CREATE POLICY "project_group_types_select" ON public.project_group_types
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "project_group_types_modify" ON public.project_group_types
  FOR ALL TO service_role USING (TRUE);


-- ── 2. supplier_categories ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_categories (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT        NOT NULL UNIQUE,
  name_zh     TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.supplier_categories         IS '供应商物料类别主数据（对应 supplier_items.category）';
COMMENT ON COLUMN public.supplier_categories.code    IS '英文标识符，如 av_equipment / stage_structure 等';
COMMENT ON COLUMN public.supplier_categories.is_active IS 'FALSE 表示软删除，仍可被旧数据引用，但不出现在新建选项中';

CREATE INDEX IF NOT EXISTS idx_supplier_categories_active
  ON public.supplier_categories (is_active, sort_order);

-- 初始数据（从 server/app.js supportedItemCategories 硬编码迁移）
INSERT INTO public.supplier_categories (code, name_zh, sort_order) VALUES
  ('av_equipment',    '音视频设备', 1),
  ('stage_structure', '舞台搭建',   2),
  ('print_display',   '印刷展示',   3),
  ('decoration',      '装饰物料',   4),
  ('furniture',       '家具陈设',   5),
  ('personnel',       '人员服务',   6),
  ('logistics',       '物流配送',   7),
  ('management',      '管理费用',   8)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.supplier_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_categories_select" ON public.supplier_categories
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "supplier_categories_modify" ON public.supplier_categories
  FOR ALL TO service_role USING (TRUE);
