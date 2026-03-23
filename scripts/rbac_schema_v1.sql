-- ============================================================
-- 泷鼎晟国际旅行社运营系统 V1.0
-- RBAC 权限体系 — 数据库建表脚本
-- 版本：V1.0  日期：2026-03-22
-- 执行环境：Supabase SQL Editor
-- ============================================================


-- ------------------------------------------------------------
-- 0. 扩展：确保 uuid 函数可用
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 1. resources — 资源定义表
--    存储系统所有权限资源，用于权限管理界面按组展示
-- ============================================================
CREATE TABLE IF NOT EXISTS public.resources (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT        NOT NULL UNIQUE,   -- 资源标识，如 project_quote
  name_zh     TEXT        NOT NULL,          -- 中文名称，如 项目型报价
  group_name  TEXT        NOT NULL,          -- 分组，如 报价业务 / 主数据 / 平台管理 / 门户
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.resources            IS '权限资源定义表';
COMMENT ON COLUMN public.resources.code       IS '资源唯一标识符，snake_case';
COMMENT ON COLUMN public.resources.group_name IS '资源所属分组，用于管理界面分类展示';

-- 初始数据
INSERT INTO public.resources (code, name_zh, group_name, sort_order) VALUES
  ('dashboard',              '工作台',         '门户',     10),
  ('standard_quote',         '标准报价',       '报价业务', 20),
  ('project_quote',          '项目型报价',     '报价业务', 30),
  ('project_quote_terms',    '项目报价商务条款','报价业务', 40),
  ('supplier',               '供应商管理',     '主数据',   50),
  ('supplier_catalog',       '供应商价格库',   '主数据',   60),
  ('project_type',           '项目类型管理',   '主数据',   70),
  ('user',                   '用户管理',       '平台管理', 80),
  ('role',                   '角色管理',       '平台管理', 90),
  ('permission',             '权限管理',       '平台管理', 100),
  ('system_settings',        '系统设置',       '平台管理', 110)
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 2. permissions — 权限点定义表
--    存储所有 resource.action 字符串
-- ============================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  code         TEXT        NOT NULL UNIQUE,  -- 如 project_quote.edit
  resource_id  UUID        NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  action       TEXT        NOT NULL,         -- view / create / edit / delete / export / approve / import / translate / manage_template
  description  TEXT,                         -- 可选备注
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.permissions             IS '权限点定义表，格式为 resource.action';
COMMENT ON COLUMN public.permissions.code        IS '权限点唯一标识，格式：resource_code.action';
COMMENT ON COLUMN public.permissions.action      IS '动作类型：view/create/edit/delete/export/approve/import/translate/manage_template';

-- 初始数据：按资源逐组插入
INSERT INTO public.permissions (code, resource_id, action) VALUES
  -- dashboard
  ('dashboard.view',                        (SELECT id FROM public.resources WHERE code='dashboard'),           'view'),
  -- standard_quote
  ('standard_quote.view',                   (SELECT id FROM public.resources WHERE code='standard_quote'),      'view'),
  ('standard_quote.create',                 (SELECT id FROM public.resources WHERE code='standard_quote'),      'create'),
  ('standard_quote.edit',                   (SELECT id FROM public.resources WHERE code='standard_quote'),      'edit'),
  ('standard_quote.delete',                 (SELECT id FROM public.resources WHERE code='standard_quote'),      'delete'),
  ('standard_quote.export',                 (SELECT id FROM public.resources WHERE code='standard_quote'),      'export'),
  ('standard_quote.approve',                (SELECT id FROM public.resources WHERE code='standard_quote'),      'approve'),
  -- project_quote
  ('project_quote.view',                    (SELECT id FROM public.resources WHERE code='project_quote'),       'view'),
  ('project_quote.create',                  (SELECT id FROM public.resources WHERE code='project_quote'),       'create'),
  ('project_quote.edit',                    (SELECT id FROM public.resources WHERE code='project_quote'),       'edit'),
  ('project_quote.delete',                  (SELECT id FROM public.resources WHERE code='project_quote'),       'delete'),
  ('project_quote.export',                  (SELECT id FROM public.resources WHERE code='project_quote'),       'export'),
  ('project_quote.approve',                 (SELECT id FROM public.resources WHERE code='project_quote'),       'approve'),
  -- project_quote_terms
  ('project_quote_terms.view',              (SELECT id FROM public.resources WHERE code='project_quote_terms'), 'view'),
  ('project_quote_terms.edit',              (SELECT id FROM public.resources WHERE code='project_quote_terms'), 'edit'),
  ('project_quote_terms.translate',         (SELECT id FROM public.resources WHERE code='project_quote_terms'), 'translate'),
  ('project_quote_terms.manage_template',   (SELECT id FROM public.resources WHERE code='project_quote_terms'), 'manage_template'),
  -- supplier
  ('supplier.view',                         (SELECT id FROM public.resources WHERE code='supplier'),            'view'),
  ('supplier.create',                       (SELECT id FROM public.resources WHERE code='supplier'),            'create'),
  ('supplier.edit',                         (SELECT id FROM public.resources WHERE code='supplier'),            'edit'),
  ('supplier.delete',                       (SELECT id FROM public.resources WHERE code='supplier'),            'delete'),
  -- supplier_catalog
  ('supplier_catalog.view',                 (SELECT id FROM public.resources WHERE code='supplier_catalog'),    'view'),
  ('supplier_catalog.create',               (SELECT id FROM public.resources WHERE code='supplier_catalog'),    'create'),
  ('supplier_catalog.edit',                 (SELECT id FROM public.resources WHERE code='supplier_catalog'),    'edit'),
  ('supplier_catalog.delete',               (SELECT id FROM public.resources WHERE code='supplier_catalog'),    'delete'),
  ('supplier_catalog.import',               (SELECT id FROM public.resources WHERE code='supplier_catalog'),    'import'),
  -- project_type
  ('project_type.view',                     (SELECT id FROM public.resources WHERE code='project_type'),        'view'),
  ('project_type.create',                   (SELECT id FROM public.resources WHERE code='project_type'),        'create'),
  ('project_type.edit',                     (SELECT id FROM public.resources WHERE code='project_type'),        'edit'),
  ('project_type.delete',                   (SELECT id FROM public.resources WHERE code='project_type'),        'delete'),
  -- user
  ('user.view',                             (SELECT id FROM public.resources WHERE code='user'),                'view'),
  ('user.create',                           (SELECT id FROM public.resources WHERE code='user'),                'create'),
  ('user.edit',                             (SELECT id FROM public.resources WHERE code='user'),                'edit'),
  ('user.delete',                           (SELECT id FROM public.resources WHERE code='user'),                'delete'),
  -- role
  ('role.view',                             (SELECT id FROM public.resources WHERE code='role'),                'view'),
  ('role.create',                           (SELECT id FROM public.resources WHERE code='role'),                'create'),
  ('role.edit',                             (SELECT id FROM public.resources WHERE code='role'),                'edit'),
  ('role.delete',                           (SELECT id FROM public.resources WHERE code='role'),                'delete'),
  -- permission
  ('permission.view',                       (SELECT id FROM public.resources WHERE code='permission'),          'view'),
  ('permission.edit',                       (SELECT id FROM public.resources WHERE code='permission'),          'edit'),
  -- system_settings
  ('system_settings.view',                  (SELECT id FROM public.resources WHERE code='system_settings'),     'view'),
  ('system_settings.edit',                  (SELECT id FROM public.resources WHERE code='system_settings'),     'edit')
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 3. roles — 角色定义表
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT        NOT NULL UNIQUE,  -- admin / standard_quote_staff / project_quote_staff / manager
  name_zh     TEXT        NOT NULL,
  description TEXT,
  is_system   BOOLEAN     NOT NULL DEFAULT FALSE,  -- TRUE 表示系统内置角色，不可删除
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.roles           IS '角色定义表';
COMMENT ON COLUMN public.roles.is_system IS '是否系统内置角色；内置角色不允许删除';

INSERT INTO public.roles (code, name_zh, description, is_system) VALUES
  ('admin',                 '系统管理员',     '拥有全部权限，负责用户、角色、权限配置及系统设置', TRUE),
  ('standard_quote_staff',  '标准报价专员',   '负责标准报价的新建、编辑、导出',                   TRUE),
  ('project_quote_staff',   '项目报价专员',   '负责项目型报价及商务条款的维护与翻译',             TRUE),
  ('manager',               '经理 / 主管',    '负责审核报价、管理供应商与主数据',                 TRUE)
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 4. role_permissions — 角色权限关联表（多对多）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id        UUID        NOT NULL REFERENCES public.roles(id)       ON DELETE CASCADE,
  permission_id  UUID        NOT NULL REFERENCES public.permissions(id)  ON DELETE CASCADE,
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by     UUID,       -- 记录是谁配置的（对应 auth.users.id），初始导入可为 NULL
  UNIQUE (role_id, permission_id)
);

COMMENT ON TABLE public.role_permissions IS '角色与权限点的多对多关联表';

-- 初始权限分配：按权限矩阵 V3 写入
-- 辅助函数：通过 code 查 id
DO $$
DECLARE
  r_admin   UUID := (SELECT id FROM public.roles WHERE code='admin');
  r_std     UUID := (SELECT id FROM public.roles WHERE code='standard_quote_staff');
  r_proj    UUID := (SELECT id FROM public.roles WHERE code='project_quote_staff');
  r_mgr     UUID := (SELECT id FROM public.roles WHERE code='manager');

  -- 权限点 ID 批量声明
  p_ids     UUID[];
  p_code    TEXT;
  p_id      UUID;

  -- 按矩阵定义：角色 -> 权限点列表
  admin_perms TEXT[] := ARRAY[
    'dashboard.view',
    'standard_quote.view','standard_quote.create','standard_quote.edit','standard_quote.delete','standard_quote.export','standard_quote.approve',
    'project_quote.view','project_quote.create','project_quote.edit','project_quote.delete','project_quote.export','project_quote.approve',
    'project_quote_terms.view','project_quote_terms.edit','project_quote_terms.translate','project_quote_terms.manage_template',
    'supplier.view','supplier.create','supplier.edit','supplier.delete',
    'supplier_catalog.view','supplier_catalog.create','supplier_catalog.edit','supplier_catalog.delete','supplier_catalog.import',
    'project_type.view','project_type.create','project_type.edit','project_type.delete',
    'user.view','user.create','user.edit','user.delete',
    'role.view','role.create','role.edit','role.delete',
    'permission.view','permission.edit',
    'system_settings.view','system_settings.edit'
  ];

  std_perms TEXT[] := ARRAY[
    'dashboard.view',
    'standard_quote.view','standard_quote.create','standard_quote.edit','standard_quote.export',
    'project_quote.view'   -- 仅查看，接口层控制只读
  ];

  proj_perms TEXT[] := ARRAY[
    'dashboard.view',
    'standard_quote.view', -- 仅查看
    'project_quote.view','project_quote.create','project_quote.edit','project_quote.export',
    'project_quote_terms.view','project_quote_terms.edit','project_quote_terms.translate',
    'supplier_catalog.view', -- 仅查看，接口层过滤供应商字段
    'project_type.view'      -- 仅查看
  ];

  mgr_perms TEXT[] := ARRAY[
    'dashboard.view',
    'standard_quote.view','standard_quote.export','standard_quote.approve',
    'project_quote.view','project_quote.export','project_quote.approve',
    'project_quote_terms.view','project_quote_terms.manage_template',
    'supplier.view','supplier.create','supplier.edit',
    'supplier_catalog.view','supplier_catalog.create','supplier_catalog.edit','supplier_catalog.import',
    'project_type.view','project_type.create','project_type.edit'
  ];

BEGIN
  -- 写入 admin
  FOREACH p_code IN ARRAY admin_perms LOOP
    SELECT id INTO p_id FROM public.permissions WHERE code = p_code;
    INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (r_admin, p_id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- 写入 standard_quote_staff
  FOREACH p_code IN ARRAY std_perms LOOP
    SELECT id INTO p_id FROM public.permissions WHERE code = p_code;
    INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (r_std, p_id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- 写入 project_quote_staff
  FOREACH p_code IN ARRAY proj_perms LOOP
    SELECT id INTO p_id FROM public.permissions WHERE code = p_code;
    INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (r_proj, p_id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- 写入 manager
  FOREACH p_code IN ARRAY mgr_perms LOOP
    SELECT id INTO p_id FROM public.permissions WHERE code = p_code;
    INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (r_mgr, p_id) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;


-- ============================================================
-- 5. user_profiles — 用户扩展信息表
--    关联 Supabase Auth 的 auth.users，存业务侧需要的字段
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.user_profiles          IS '用户扩展信息表，主键关联 auth.users';
COMMENT ON COLUMN public.user_profiles.is_active IS '账号是否启用；FALSE 表示停用，不影响 auth.users';


-- ============================================================
-- 6. user_roles — 用户角色关联表（多对多）
--    一个用户可以拥有多个角色
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role_id      UUID        NOT NULL REFERENCES public.roles(id)          ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by  UUID,       -- 操作人，对应 auth.users.id
  UNIQUE (user_id, role_id)
);

COMMENT ON TABLE public.user_roles IS '用户与角色的多对多关联表';


-- ============================================================
-- 7. audit_log — 权限操作审计日志
--    记录管理员对用户角色/权限的所有变更
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id  UUID        REFERENCES auth.users(id),   -- 执行操作的管理员
  action       TEXT        NOT NULL,  -- assign_role / revoke_role / update_permission 等
  target_type  TEXT        NOT NULL,  -- user / role / permission
  target_id    UUID        NOT NULL,
  detail       JSONB,                 -- 变更详情快照
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.audit_log            IS '权限操作审计日志，记录所有角色/权限变更';
COMMENT ON COLUMN public.audit_log.detail     IS '变更前后详情，JSON 快照，便于回溯';


-- ============================================================
-- 8. updated_at 自动更新触发器
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 9. RLS（Row Level Security）基础配置
--    服务端使用 service_role key 访问，跳过 RLS
--    此处仅开启 RLS，具体策略后续按需添加
-- ============================================================
ALTER TABLE public.resources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log        ENABLE ROW LEVEL SECURITY;

-- service_role 绕过 RLS（Supabase 默认行为，此处显式确认）
-- 前端 anon key 不应直接访问这些表，全部通过服务端 API 中转


-- ============================================================
-- 完成
-- ============================================================
