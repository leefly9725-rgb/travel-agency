-- Migration: 用户个人权限覆盖表
-- 执行时机：在 Supabase SQL Editor 运行一次（幂等，可重复执行）
-- 用途：支持对单个用户的权限进行显式开启/关闭，覆盖角色默认权限

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id         uuid    NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  permission_code text    NOT NULL,
  granted         boolean NOT NULL DEFAULT true,
  updated_at      timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id
  ON public.user_permissions (user_id);

-- 说明：
--   granted = true  → 显式开启（与角色默认一致，但记录为手动确认）
--   granted = false → 显式拒绝，即使角色包含此权限也不生效
--   无记录          → 完全由角色决定（等同于 true）
