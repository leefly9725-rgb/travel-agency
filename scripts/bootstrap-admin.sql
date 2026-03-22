-- ────────────────────────────────────────────────────────────────────────────
-- 泷鼎晟国际旅行社运营系统 — 首个管理员用户初始化脚本
-- 文件：scripts/bootstrap-admin.sql
--
-- 执行前必读：
--   1. 打开 Supabase Dashboard → Authentication → Users
--   2. 点击「Add user」→「Create new user」，填写邮箱和密码，完成创建
--   3. 在用户列表中复制该用户的 UUID（格式类似 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）
--   4. 将下方所有 'YOUR_ADMIN_USER_UUID' 替换为实际 UUID
--   5. 将 'YOUR_ADMIN_EMAIL' 替换为实际邮箱
--   6. 在 Supabase SQL Editor 中粘贴并执行本脚本
--   7. 查看末尾的验证查询结果，确认 1 行数据返回
--
-- 注意：本脚本可重复执行（ON CONFLICT 幂等处理），不会产生重复数据。
-- ────────────────────────────────────────────────────────────────────────────

-- ── Step 1：写入 user_profiles ────────────────────────────────────────────────
INSERT INTO public.user_profiles (id, display_name, email, is_active)
VALUES (
  'YOUR_ADMIN_USER_UUID',   -- ← 替换为实际 UUID
  '系统管理员',              -- ← 可修改为实际姓名
  'YOUR_ADMIN_EMAIL',        -- ← 替换为实际邮箱
  true
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  email        = EXCLUDED.email,
  is_active    = EXCLUDED.is_active,
  updated_at   = now();

-- ── Step 2：绑定 admin 角色 ───────────────────────────────────────────────────
INSERT INTO public.user_roles (user_id, role_id)
VALUES (
  'YOUR_ADMIN_USER_UUID',                              -- ← 同上，替换为实际 UUID
  (SELECT id FROM public.roles WHERE code = 'admin')   -- admin 角色由 supabase-auth-schema.sql 预置
)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ── Step 3：写入初始化审计日志 ────────────────────────────────────────────────
INSERT INTO public.audit_log (operator_id, action, target_type, target_id, detail)
VALUES (
  'YOUR_ADMIN_USER_UUID',
  'bootstrap_admin',
  'user',
  'YOUR_ADMIN_USER_UUID',
  jsonb_build_object(
    'note', '系统首个管理员账号初始化',
    'executed_at', now()
  )
);

-- ── Step 4：验证结果（执行后检查此查询是否返回 1 行）────────────────────────────
SELECT
  up.id,
  up.display_name,
  up.email,
  up.is_active,
  r.name_zh  AS role_name,
  r.code     AS role_code,
  r.is_system
FROM public.user_profiles up
JOIN public.user_roles ur ON ur.user_id = up.id
JOIN public.roles r       ON r.id       = ur.role_id
WHERE up.id = 'YOUR_ADMIN_USER_UUID';

-- 预期结果：1 行，role_code = 'admin'，is_active = true
-- 如果返回 0 行，检查：
--   - UUID 是否正确替换
--   - supabase-auth-schema.sql 是否已先执行（roles 表需存在且有 admin 记录）
