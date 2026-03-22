/**
 * auth-guard.js — 前端认证守卫
 * 引入方式：在受保护页面的 </head> 之前 <script src="/auth-guard.js"></script>
 * 配合 <body style="visibility: hidden"> 使用，检测通过后自动恢复可见性
 */
(async () => {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────────────────
  function parseJwtPayload(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }

  function revealPage() {
    const show = () => { if (document.body) document.body.style.visibility = 'visible'; };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', show);
    } else {
      show();
    }
  }

  function redirectTo(url) {
    window.location.replace(url);
  }

  // ── Supabase config（由服务端注入到 window.__ENV__）──────────────────────
  const SUPABASE_URL      = window.__ENV__?.SUPABASE_URL      || '';
  const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY || '';

  // ── Token 刷新 ─────────────────────────────────────────────────────────────
  async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('app_refresh_token');
    if (!refreshToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.access_token) return false;
      localStorage.setItem('app_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('app_refresh_token', data.refresh_token);
      }
      return true;
    } catch {
      return false;
    }
  }

  // ── Step 1：检查 token 存在 ────────────────────────────────────────────────
  let token = localStorage.getItem('app_token');
  if (!token) {
    redirectTo('/login.html');
    return;
  }

  // ── Step 2：解析 JWT，检查过期 ──────────────────────────────────────────────
  const payload = parseJwtPayload(token);
  const now = Date.now() / 1000;

  if (!payload || payload.exp < now) {
    // 已过期：尝试静默续期
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      localStorage.removeItem('app_token');
      redirectTo('/error.html?reason=session_expired');
      return;
    }
    token = localStorage.getItem('app_token');
  } else if (payload.exp - now < 300) {
    // 距过期不足 5 分钟：后台续期，不阻塞页面
    refreshAccessToken();
  }

  // ── Step 3：挂载基础用户信息（后续被 /api/auth/me 覆盖）──────────────────
  const finalPayload = parseJwtPayload(token);
  window.__CURRENT_USER__ = {
    userId:      finalPayload?.sub   || null,
    email:       finalPayload?.email || '',
    display_name: '',
    is_active:   true,
    roles:       [],
    permissions: [],
  };

  // ── Step 4：权限辅助函数（提前挂载，/api/auth/me 返回前也可调用）──────────
  window.can = function (permissionCode) {
    const perms = window.__CURRENT_USER__?.permissions || [];
    return perms.includes('*') || perms.includes(permissionCode);
  };

  // ── Step 5：调用 /api/auth/me 获取完整用户信息与权限 ──────────────────────
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem('app_token');
      redirectTo('/login.html');
      return;
    }
    if (res.status === 403) {
      redirectTo('/error.html?reason=no_permission');
      return;
    }

    if (res.ok) {
      const me = await res.json();
      window.__CURRENT_USER__ = {
        userId:       me.userId,
        display_name: me.display_name,
        email:        me.email,
        is_active:    me.is_active,
        roles:        me.roles        || [],
        permissions:  me.permissions  || [],
      };
    }
    // 非 200 但也非 401/403（如 5xx）：保留基础信息，不阻塞页面
  } catch {
    // 网络异常：保留基础信息，不阻塞页面
  }

  // ── Step 6：检测通过，恢复页面可见性 ──────────────────────────────────────
  revealPage();
})();
