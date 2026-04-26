/**
 * auth-guard.js — 前端认证守卫
 * 引入方式：在受保护页面的 </head> 之前 <script src="/auth-guard.js"></script>
 * 配合 <body style="visibility: hidden"> 使用，检测通过后自动恢复可见性
 *
 * 同时暴露 window.AuthStore，供其他脚本统一读写 token，
 * 支持 rememberMe（localStorage + 7 天到期）和 session-only（sessionStorage）两种模式。
 */
window.AuthStore = (function () {
  const T  = 'app_token';
  const R  = 'app_refresh_token';
  const EX = 'app_token_expires';
  const UN = 'app_saved_username';
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  return {
    getToken() {
      const s = sessionStorage.getItem(T);
      if (s) return s;
      const l = localStorage.getItem(T);
      if (!l) return null;
      const exp = localStorage.getItem(EX);
      if (exp && Date.now() > parseInt(exp, 10)) { this.clearSession(); return null; }
      return l;
    },
    getRefreshToken() {
      return sessionStorage.getItem(R) || localStorage.getItem(R);
    },
    isRememberMe() {
      return !!localStorage.getItem(T);
    },
    setSession(token, refreshToken, rememberMe) {
      this.clearSession();
      if (rememberMe) {
        localStorage.setItem(T, token);
        if (refreshToken) localStorage.setItem(R, refreshToken);
        localStorage.setItem(EX, String(Date.now() + SEVEN_DAYS));
      } else {
        sessionStorage.setItem(T, token);
        if (refreshToken) sessionStorage.setItem(R, refreshToken);
      }
    },
    updateToken(token, refreshToken) {
      if (localStorage.getItem(T)) {
        localStorage.setItem(T, token);
        if (refreshToken) localStorage.setItem(R, refreshToken);
        localStorage.setItem(EX, String(Date.now() + SEVEN_DAYS));
      } else {
        sessionStorage.setItem(T, token);
        if (refreshToken) sessionStorage.setItem(R, refreshToken);
      }
    },
    clearSession() {
      localStorage.removeItem(T);
      localStorage.removeItem(R);
      localStorage.removeItem(EX);
      sessionStorage.removeItem(T);
      sessionStorage.removeItem(R);
    },
    getSavedUsername() { return localStorage.getItem(UN) || ''; },
    setSavedUsername(u) {
      u ? localStorage.setItem(UN, u) : localStorage.removeItem(UN);
    },
  };
})();

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
    const refreshToken = window.AuthStore.getRefreshToken();
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
      window.AuthStore.updateToken(data.access_token, data.refresh_token || null);
      return true;
    } catch {
      return false;
    }
  }

  // ── Step 1：检查 token 存在 ────────────────────────────────────────────────
  let token = window.AuthStore.getToken();
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
      window.AuthStore.clearSession();
      redirectTo('/error.html?reason=session_expired');
      return;
    }
    token = window.AuthStore.getToken();
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
      window.AuthStore.clearSession();
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

  // ── Step 6：检测通过，通知页面权限已就绪，然后恢复可见性 ────────────────
  document.dispatchEvent(new CustomEvent('authReady'));
  revealPage();
})();
