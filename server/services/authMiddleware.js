/**
 * authMiddleware.js
 * 认证 & 权限中间层
 * 泷鼎晟国际旅行社运营系统 V1.0
 *
 * 使用方式（在 app.js 的 handleApi 顶部）：
 *   const { resolveAuthContext, requirePermission } = require('./services/authMiddleware');
 *   const ctx = await resolveAuthContext(request, supabaseConfig);
 *   requirePermission(ctx, 'project_quote.edit');   // 不满足则直接抛出
 */

const { supabaseRequest } = require('../supabaseClient');

// ─── 免验证白名单 ──────────────────────────────────────────────
// 注意：/api/auth/me 不在白名单，需要有效 token 才可访问

// 精确匹配的公开 API 路径
const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/admin/bootstrap-status',
]);

// 公开 HTML 页面（无需登录）
const PUBLIC_HTML = new Set([
  '/login.html',
  '/error.html',
]);

// 静态资源后缀（无需登录）
// .html 也在此列：HTML 页面由前端 auth-guard.js 负责鉴权跳转，服务端不拦截
const STATIC_EXTS = new Set([
  '.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.svg',
  '.ico', '.woff', '.woff2', '.ttf', '.gif', '.webp',
]);

/**
 * 判断路径是否为公开路径（无需鉴权）
 */
function isPublicPath(pathname) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (PUBLIC_HTML.has(pathname)) return true;
  const dot = pathname.lastIndexOf('.');
  if (dot !== -1 && STATIC_EXTS.has(pathname.slice(dot).toLowerCase())) return true;
  return false;
}

// ─── 资源路径 → 权限点映射表 ──────────────────────────────────
// 格式：[method, pathname_pattern, permission_code]
// pathname_pattern 支持字符串精确匹配或正则
const ROUTE_PERMISSION_MAP = [
  // dashboard
  ['GET',    /^\/api\/dashboard$/,                     'dashboard.view'],

  // standard_quote
  ['GET',    /^\/api\/quotes$/,                        'standard_quote.view'],
  ['GET',    /^\/api\/quotes\/[^/]+$/,                 'standard_quote.view'],
  ['GET',    /^\/api\/customer-standard-quotations\/[^/]+$/, 'standard_quote.view'],
  ['POST',   /^\/api\/quotes\/calculate$/,             'standard_quote.view'],
  ['POST',   /^\/api\/quotes$/,                        'standard_quote.create'],
  ['PUT',    /^\/api\/quotes\/[^/]+$/,                 'standard_quote.edit'],
  ['DELETE', /^\/api\/quotes\/[^/]+$/,                 'standard_quote.delete'],

  // project_quote
  ['GET',    /^\/api\/project-quotes$/,                'project_quote.view'],
  ['GET',    /^\/api\/project-quotes\/[^/]+$/,         'project_quote.view'],
  ['GET',    /^\/api\/project-quotation\/export-pdf$/,  'project_quote.view'],
  ['POST',   /^\/api\/project-quotes$/,                'project_quote.create'],
  ['PUT',    /^\/api\/project-quotes\/[^/]+$/,         'project_quote.edit'],
  ['DELETE', /^\/api\/project-quotes\/[^/]+$/,         'project_quote.delete'],

  // project_quote_terms
  ['GET',    /^\/api\/terms\/snapshot$/,               'project_quote_terms.view'],
  ['POST',   /^\/api\/terms\/snapshot$/,               'project_quote_terms.edit'],
  ['POST',   /^\/api\/terms\/translate$/,              'project_quote_terms.translate'],
  ['POST',   /^\/api\/terms\/translate-all$/,          'project_quote_terms.translate'],

  // supplier
  ['GET',    /^\/api\/suppliers$/,                     'supplier.view'],
  ['GET',    /^\/api\/suppliers\/[^/]+$/,              'supplier.view'],
  ['POST',   /^\/api\/suppliers$/,                     'supplier.create'],
  ['PUT',    /^\/api\/suppliers\/[^/]+$/,              'supplier.edit'],
  ['DELETE', /^\/api\/suppliers\/[^/]+$/,              'supplier.delete'],

  // supplier_catalog（supplier-items）
  ['GET',    /^\/api\/supplier-items(\/.*)?$/,         'supplier_catalog.view'],
  ['POST',   /^\/api\/supplier-items$/,                'supplier_catalog.create'],
  ['PUT',    /^\/api\/supplier-items\/[^/]+$/,         'supplier_catalog.edit'],
  ['DELETE', /^\/api\/supplier-items\/[^/]+$/,         'supplier_catalog.delete'],
  ['POST',   /^\/api\/service-catalog-candidates$/,    'project_quote.edit'],

  // project_type（quote-item-types + project-group-types）
  ['GET',    /^\/api\/quote-item-types$/,              'project_type.view'],
  ['POST',   /^\/api\/quote-item-types$/,              'project_type.create'],
  ['PUT',    /^\/api\/quote-item-types\/[^/]+$/,       'project_type.edit'],
  ['DELETE', /^\/api\/quote-item-types\/[^/]+$/,       'project_type.delete'],
  ['GET',    /^\/api\/project-group-types$/,           'project_type.view'],
  ['POST',   /^\/api\/project-group-types$/,           'project_type.create'],
  ['PUT',    /^\/api\/project-group-types\/[^/]+$/,    'project_type.edit'],
  ['DELETE', /^\/api\/project-group-types\/[^/]+$/,    'project_type.delete'],

  // supplier_catalog（supplier-items + supplier-categories）
  ['GET',    /^\/api\/supplier-categories$/,           'supplier_catalog.view'],
  ['POST',   /^\/api\/supplier-categories$/,           'supplier_catalog.create'],
  ['PUT',    /^\/api\/supplier-categories\/[^/]+$/,    'supplier_catalog.edit'],
  ['DELETE', /^\/api\/supplier-categories\/[^/]+$/,    'supplier_catalog.delete'],

  // templates — 暂时归入 standard_quote
  ['GET',    /^\/api\/templates(\/.*)?$/,              'standard_quote.view'],
  ['POST',   /^\/api\/templates$/,                     'standard_quote.edit'],
  ['PUT',    /^\/api\/templates\/[^/]+$/,              'standard_quote.edit'],
  ['DELETE', /^\/api\/templates\/[^/]+$/,              'standard_quote.edit'],

  // receptions / documents / projects — 暂归 standard_quote.view
  ['GET',    /^\/api\/receptions(\/.*)?$/,             'standard_quote.view'],
  ['POST',   /^\/api\/receptions$/,                    'standard_quote.edit'],
  ['PUT',    /^\/api\/receptions\/[^/]+$/,             'standard_quote.edit'],
  ['DELETE', /^\/api\/receptions\/[^/]+$/,             'standard_quote.delete'],
  ['GET',    /^\/api\/documents(\/.*)?$/,              'standard_quote.view'],
  ['POST',   /^\/api\/documents$/,                     'standard_quote.edit'],
  ['PUT',    /^\/api\/documents\/[^/]+$/,              'standard_quote.edit'],
  ['GET',    /^\/api\/projects(\/.*)?$/,               'standard_quote.view'],
  ['GET',    /^\/api\/document-previews$/,             'standard_quote.view'],

  // meta — 已登录即可访问，不限资源权限（空字符串表示仅需登录）
  ['GET',    /^\/api\/meta$/,                          ''],
];

// ─── 权限缓存（进程级，TTL 60 秒）────────────────────────────
const _cache = new Map(); // key: userId → { perms: Set, exp: timestamp }
const CACHE_TTL_MS = 60 * 1000;

function _cacheGet(userId) {
  const entry = _cache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.exp) { _cache.delete(userId); return null; }
  return entry.perms;
}

function _cacheSet(userId, perms) {
  _cache.set(userId, { perms, exp: Date.now() + CACHE_TTL_MS });
}

// ─── 从请求头提取 Bearer Token ────────────────────────────────
function extractBearerToken(request) {
  const auth = request.headers && request.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

// ─── 用 Supabase Auth 验证 token，返回 userId ─────────────────
async function verifyToken(token, supabaseConfig) {
  try {
    // 调用 Supabase Auth getUser 接口
    const key = supabaseConfig.serviceRoleKey || supabaseConfig.anonKey || '';
    const res = await fetch(`${supabaseConfig.url}/auth/v1/user`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

// ─── 从 Supabase 拉取用户权限点列表 ──────────────────────────
async function fetchUserPermissions(userId, supabaseConfig) {
  const cached = _cacheGet(userId);
  if (cached) return cached;

  // 查询：user_roles → roles → role_permissions → permissions
  // 使用 Supabase REST API 嵌套查询
  const rows = await supabaseRequest(
    supabaseConfig,
    `user_roles?select=roles(role_permissions(permissions(code)))&user_id=eq.${userId}`,
    { method: 'GET' }
  );

  const perms = new Set();
  if (Array.isArray(rows)) {
    for (const ur of rows) {
      const rps = ur.roles?.role_permissions || [];
      for (const rp of rps) {
        const code = rp.permissions?.code;
        if (code) perms.add(code);
      }
    }
  }

  _cacheSet(userId, perms);
  return perms;
}

// ─── 公开 API：解析当前请求的认证上下文 ──────────────────────
/**
 * 解析认证上下文
 * @returns {{ userId, user, permissions: Set<string>, isPublicPath: boolean }}
 */
async function resolveAuthContext(request, supabaseConfig) {
  const pathname = (() => {
    try {
      const base = request.headers?.host ? `http://${request.headers.host}` : 'http://localhost';
      return new URL(request.url, base).pathname;
    } catch { return '/'; }
  })();

  // 白名单路径不需要鉴权
  if (isPublicPath(pathname)) {
    return { userId: null, user: null, permissions: new Set(), isPublicPath: true };
  }

  const token = extractBearerToken(request);
  if (!token) {
    return { userId: null, user: null, permissions: new Set(), isPublicPath: false };
  }

  // 本地开发绕过：token 为 dev-bypass-token 时返回超级管理员上下文
  // 需在 .env.local 中显式配置 ALLOW_DEV_BYPASS=true 才生效，线上不配置此变量
  const devBypassEnabled = process.env.ALLOW_DEV_BYPASS === 'true';
  if (token === 'dev-bypass-token' && devBypassEnabled) {
    return {
      userId: 'dev-user',
      user: { id: 'dev-user', email: 'dev@localhost', display_name: '本地开发管理员', roles: ['admin'] },
      permissions: new Set(['*']),
      isPublicPath: false,
    };
  }

  const user = await verifyToken(token, supabaseConfig);
  if (!user) {
    return { userId: null, user: null, permissions: new Set(), isPublicPath: false };
  }

  const permissions = await fetchUserPermissions(user.id, supabaseConfig);
  return { userId: user.id, user, permissions, isPublicPath: false };
}

// ─── 公开 API：检查单个权限点，不满足则抛出错误 ──────────────
/**
 * 校验权限，失败直接 throw（由 handleApi 的 catch 捕获后返回 403）
 * @param {object} ctx  resolveAuthContext 返回的上下文
 * @param {string} permCode  权限点，如 'project_quote.edit'
 */
function requirePermission(ctx, permCode) {
  if (!ctx.userId) {
    const err = new Error('未登录，请先登录。');
    err.statusCode = 401;
    throw err;
  }
  // permCode 为空字符串表示"仅需登录"
  if (permCode === '') return;
  // 通配权限（开发绕过超级管理员）
  if (ctx.permissions.has('*')) return;
  if (!ctx.permissions.has(permCode)) {
    const err = new Error(`权限不足：缺少 ${permCode}。`);
    err.statusCode = 403;
    throw err;
  }
}

// ─── 公开 API：根据路由映射自动检查权限（用于 handleApi 入口）
/**
 * 根据 ROUTE_PERMISSION_MAP 自动匹配并校验权限
 * 找不到映射的路由默认放行（保持现有行为不变，逐步收紧）
 */
function requireRoutePermission(ctx, method, pathname) {
  if (ctx.isPublicPath) return;

  for (const [m, pattern, permCode] of ROUTE_PERMISSION_MAP) {
    if (m !== method) continue;
    const matched = pattern instanceof RegExp
      ? pattern.test(pathname)
      : pattern === pathname;
    if (matched) {
      requirePermission(ctx, permCode);
      return;
    }
  }
  // 未在映射表中的路由：已登录即放行，未登录则拦截
  if (!ctx.userId) {
    const err = new Error('未登录，请先登录。');
    err.statusCode = 401;
    throw err;
  }
}

// ─── supplier_catalog 专用：过滤供应商敏感字段 ───────────────
/**
 * 如果当前用户是项目报价专员（没有 supplier.view），
 * 则从 supplier-items 返回数据中删除供应商相关字段
 */
function filterSupplierCatalogFields(ctx, items) {
  if (ctx.permissions.has('supplier.view')) return items; // 有权限，原样返回
  if (!Array.isArray(items)) return items;
  return items.map(item => {
    const { supplierId, supplier_id, supplierName, supplier_name, ...rest } = item;
    return rest;
  });
}

// ─── 清除指定用户的权限缓存（角色变更后调用）────────────────
function invalidatePermissionCache(userId) {
  _cache.delete(userId);
}

module.exports = {
  resolveAuthContext,
  requirePermission,
  requireRoutePermission,
  filterSupplierCatalogFields,
  invalidatePermissionCache,
  PUBLIC_PATHS,
};
