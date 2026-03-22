-- 权限管理模块 — Supabase 数据库 Schema
-- 执行时机：部署前在 Supabase SQL Editor 运行一次
-- 兼容性：全部使用 IF NOT EXISTS，可重复执行
-- 依赖：Supabase Auth（auth.users 已存在）

-- ── 1. resources（权限资源分组）─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  group_name  text NOT NULL,
  name_zh     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- ── 2. permissions（权限点）─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  action      text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- ── 3. roles（角色）──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name_zh     text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- ── 4. role_permissions（角色↔权限）─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id       uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ── 5. user_profiles（扩展 auth.users）──────────────────────────────────────
-- 通过 trigger 在用户注册时自动创建，也可手动 INSERT
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  email        text NOT NULL DEFAULT '',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ── 6. user_roles（用户↔角色）───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- ── 7. audit_log（操作审计）─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   text NOT NULL,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id       ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id       ON public.user_roles (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions (role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_code         ON public.permissions (code);
CREATE INDEX IF NOT EXISTS idx_audit_log_operator_id    ON public.audit_log (operator_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at     ON public.audit_log (created_at DESC);

-- ── Trigger：新用户注册时自动创建 user_profiles ──────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Seed：内置角色 ────────────────────────────────────────────────────────────
INSERT INTO public.roles (code, name_zh, description, is_system) VALUES
  ('admin',                '系统管理员',   '拥有全部权限，可管理用户与角色',         true),
  ('manager',              '经理/主管',    '可查看和编辑全部业务数据，不含用户管理', true),
  ('standard_quote_staff', '标准报价专员', '仅可操作标准报价相关功能',               true),
  ('project_quote_staff',  '项目报价专员', '可操作项目型报价，但不可见供应商信息',   true),
  ('reception_staff',      '接待执行人员', '可查看和更新接待任务',                   true),
  ('viewer',               '只读用户',     '只可查看，不可新建或编辑',               true)
ON CONFLICT (code) DO NOTHING;

-- ── Seed：资源分组 ────────────────────────────────────────────────────────────
INSERT INTO public.resources (code, group_name, name_zh) VALUES
  ('dashboard',          '系统',    '数据看板'),
  ('standard_quote',     '报价业务', '标准报价'),
  ('project_quote',      '报价业务', '项目型报价'),
  ('project_quote_terms','报价业务', '商务条款'),
  ('supplier',           '供应商',   '供应商管理'),
  ('supplier_catalog',   '供应商',   '供应商价格库'),
  ('project_type',       '系统设置', '项目类型'),
  ('user',               '系统设置', '用户管理'),
  ('template',           '系统设置', '报价模板')
ON CONFLICT (code) DO NOTHING;

-- ── Seed：权限点 ──────────────────────────────────────────────────────────────
INSERT INTO public.permissions (code, resource_id, action)
SELECT p.code, r.id, p.action FROM (VALUES
  ('dashboard.view',              'dashboard',          'view'),
  ('standard_quote.view',         'standard_quote',     'view'),
  ('standard_quote.create',       'standard_quote',     'create'),
  ('standard_quote.edit',         'standard_quote',     'edit'),
  ('standard_quote.delete',       'standard_quote',     'delete'),
  ('project_quote.view',          'project_quote',      'view'),
  ('project_quote.create',        'project_quote',      'create'),
  ('project_quote.edit',          'project_quote',      'edit'),
  ('project_quote.delete',        'project_quote',      'delete'),
  ('project_quote_terms.view',    'project_quote_terms','view'),
  ('project_quote_terms.edit',    'project_quote_terms','edit'),
  ('project_quote_terms.translate','project_quote_terms','translate'),
  ('supplier.view',               'supplier',           'view'),
  ('supplier.create',             'supplier',           'create'),
  ('supplier.edit',               'supplier',           'edit'),
  ('supplier.delete',             'supplier',           'delete'),
  ('supplier_catalog.view',       'supplier_catalog',   'view'),
  ('supplier_catalog.create',     'supplier_catalog',   'create'),
  ('supplier_catalog.edit',       'supplier_catalog',   'edit'),
  ('supplier_catalog.delete',     'supplier_catalog',   'delete'),
  ('project_type.view',           'project_type',       'view'),
  ('project_type.create',         'project_type',       'create'),
  ('project_type.edit',           'project_type',       'edit'),
  ('project_type.delete',         'project_type',       'delete'),
  ('user.view',                   'user',               'view'),
  ('user.create',                 'user',               'create'),
  ('user.edit',                   'user',               'edit'),
  ('user.delete',                 'user',               'delete'),
  ('template.view',               'template',           'view'),
  ('template.edit',               'template',           'edit')
) AS p(code, resource_code, action)
JOIN public.resources r ON r.code = p.resource_code
ON CONFLICT (code) DO NOTHING;

-- ── Seed：admin 角色拥有全部权限 ──────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

-- ── Seed：manager 拥有除用户管理外的全部权限 ──────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code NOT LIKE 'user.%'
WHERE r.code = 'manager'
ON CONFLICT DO NOTHING;

-- ── Seed：standard_quote_staff ────────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code LIKE 'standard_quote.%' OR p.code = 'dashboard.view' OR p.code = 'template.view'
WHERE r.code = 'standard_quote_staff'
ON CONFLICT DO NOTHING;

-- ── Seed：project_quote_staff ─────────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON (
  p.code LIKE 'project_quote%'
  OR p.code = 'supplier_catalog.view'
  OR p.code = 'project_type.view'
  OR p.code = 'dashboard.view'
)
WHERE r.code = 'project_quote_staff'
ON CONFLICT DO NOTHING;

-- ── Seed：viewer 只读 ─────────────────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.action = 'view'
WHERE r.code = 'viewer'
ON CONFLICT DO NOTHING;
