-- ============================================================
-- Migration: username 登录支持
-- 1. user_profiles 新增 username 字段
-- 2. 新建 login_attempts 表（防暴力破解）
-- ============================================================

-- 1. user_profiles 加 username 列（唯一，可空兼容旧数据）
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

-- 为现有用户生成临时 username（取邮箱 @ 前缀）
UPDATE public.user_profiles
  SET username = split_part(email, '@', 1)
  WHERE username IS NULL;

-- 加唯一索引（允许 NULL，只对非 NULL 值保证唯一）
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username
  ON public.user_profiles (username)
  WHERE username IS NOT NULL;

-- 2. login_attempts 表（记录登录尝试，用于5次失败锁定）
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id           BIGSERIAL    PRIMARY KEY,
  username     TEXT         NOT NULL,
  success      BOOLEAN      NOT NULL DEFAULT FALSE,
  ip_address   TEXT,
  attempted_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_username_time
  ON public.login_attempts (username, attempted_at DESC);

-- RLS: login_attempts 只允许 service_role 读写
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- service_role 绕过 RLS，无需额外策略
-- anon/authenticated 不能读写此表（安全）
