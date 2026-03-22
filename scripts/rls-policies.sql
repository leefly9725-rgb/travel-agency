-- ────────────────────────────────────────────────────────────────────────────
-- 泷鼎晟国际旅行社运营系统 — Row Level Security 策略
-- 文件：scripts/rls-policies.sql
--
-- 执行方式：在 Supabase SQL Editor 中粘贴并执行，可重复执行（幂等）
-- 前置条件：supabase-auth-schema.sql 已先执行
--
-- 架构说明：
--   - 服务端使用 service_role key，自动绕过 RLS，不受以下策略影响
--   - 前端使用 anon key，当前架构下前端不直接访问权限表（全部经服务端中转）
--   - RLS 策略目标：防止任何直接使用 anon/authenticated key 的请求篡改权限数据
-- ────────────────────────────────────────────────────────────────────────────

-- ── 启用 RLS（幂等，已启用时无副作用）────────────────────────────────────────
ALTER TABLE public.resources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          ENABLE ROW LEVEL SECURITY;

-- ── 清理旧策略（幂等，不存在时 DROP IF EXISTS 不报错）────────────────────────
DROP POLICY IF EXISTS "resources_select_all"        ON public.resources;
DROP POLICY IF EXISTS "permissions_select_all"      ON public.permissions;
DROP POLICY IF EXISTS "roles_select_all"            ON public.roles;
DROP POLICY IF EXISTS "role_permissions_select_all" ON public.role_permissions;
DROP POLICY IF EXISTS "user_profiles_select_own"    ON public.user_profiles;
DROP POLICY IF EXISTS "user_roles_select_own"       ON public.user_roles;
DROP POLICY IF EXISTS "audit_log_deny_select"       ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_deny_insert"       ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_deny_update"       ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_deny_delete"       ON public.audit_log;

-- ════════════════════════════════════════════════════════════════════════════
-- resources（权限资源定义）
-- 策略：anon/authenticated 只读，不允许增删改
-- 理由：资源定义是系统静态配置，前端权限管理界面需要读取分组信息
-- ════════════════════════════════════════════════════════════════════════════
CREATE POLICY "resources_select_all"
  ON public.resources
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT / UPDATE / DELETE 无对应 policy → 默认拒绝（RLS 默认 deny-all）

-- ════════════════════════════════════════════════════════════════════════════
-- permissions（权限点定义）
-- 策略：anon/authenticated 只读，不允许增删改
-- 理由：权限点是系统静态配置，前端权限明细页需要读取 code/action
-- ════════════════════════════════════════════════════════════════════════════
CREATE POLICY "permissions_select_all"
  ON public.permissions
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ════════════════════════════════════════════════════════════════════════════
-- roles（角色定义）
-- 策略：anon/authenticated 只读，不允许增删改
-- 理由：角色列表是公开的参考数据，前端角色分配卡片需要读取
-- ════════════════════════════════════════════════════════════════════════════
CREATE POLICY "roles_select_all"
  ON public.roles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ════════════════════════════════════════════════════════════════════════════
-- role_permissions（角色权限关联）
-- 策略：anon/authenticated 只读，不允许增删改
-- 理由：前端权限明细页（Tab 2）通过角色反查权限时需要读取
-- ════════════════════════════════════════════════════════════════════════════
CREATE POLICY "role_permissions_select_all"
  ON public.role_permissions
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ════════════════════════════════════════════════════════════════════════════
-- user_profiles（用户信息）
-- 策略：anon/authenticated 只能读取自己的记录（auth.uid() 匹配）
-- 理由：用户只能看自己的 profile，不能枚举其他用户；增删改由服务端处理
-- ════════════════════════════════════════════════════════════════════════════
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles
  FOR SELECT
  TO anon, authenticated
  USING (id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- user_roles（用户角色关联）
-- 策略：anon/authenticated 只能读取自己的角色记录
-- 理由：用户可以查询自己的角色，但不能操作他人角色；增删改由服务端处理
-- ════════════════════════════════════════════════════════════════════════════
CREATE POLICY "user_roles_select_own"
  ON public.user_roles
  FOR SELECT
  TO anon, authenticated
  USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- audit_log（操作审计日志）
-- 策略：完全禁止 anon/authenticated 的任何访问
-- 理由：审计日志属于敏感数据，只允许服务端 service_role 读写
-- 实现方式：不创建任何 SELECT policy → RLS 默认拒绝所有访问
-- 以下显式策略仅作文档说明，实际效果与不创建 policy 相同（均为拒绝）
-- ════════════════════════════════════════════════════════════════════════════

-- 不创建任何 audit_log policy：
-- Supabase RLS 在 ENABLE ROW LEVEL SECURITY 后默认 deny-all，
-- 没有匹配 policy 的操作一律被拒绝。
-- 这意味着 anon/authenticated 对 audit_log 的 SELECT/INSERT/UPDATE/DELETE
-- 全部返回空集或权限错误，service_role 不受影响。

-- ════════════════════════════════════════════════════════════════════════════
-- 验证查询（执行后检查策略是否生效）
-- ════════════════════════════════════════════════════════════════════════════
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'resources', 'permissions', 'roles', 'role_permissions',
    'user_profiles', 'user_roles', 'audit_log'
  )
ORDER BY tablename, cmd;

-- 预期结果：
--   resources        → 1 行（SELECT，USING true）
--   permissions      → 1 行（SELECT，USING true）
--   roles            → 1 行（SELECT，USING true）
--   role_permissions → 1 行（SELECT，USING true）
--   user_profiles    → 1 行（SELECT，USING id=auth.uid()）
--   user_roles       → 1 行（SELECT，USING user_id=auth.uid()）
--   audit_log        → 0 行（无 policy，默认 deny-all）
