#!/usr/bin/env node
/**
 * api-compat-check.js
 * 检查 server/app.js 中所有 API 路由是否具备基本的错误兜底。
 *
 * 用法：node .claude/skills/lds-safe-backend/scripts/api-compat-check.js
 *
 * 检查项：
 *   1. 每个路由是否有 try/catch 包裹（防止未捕获异常导致服务崩溃）
 *   2. 每个路由是否有 res.status(500) 的错误响应
 *   3. 是否存在删除/重命名核心 API 路径的迹象
 *   4. 统计当前所有 API 路由列表（用于对比变更前后）
 */

const fs = require('node:fs');
const path = require('node:path');

const APP_JS = path.join(__dirname, '../../../../server/app.js');

function main() {
  if (!fs.existsSync(APP_JS)) {
    console.error(`[ERROR] 找不到 server/app.js: ${APP_JS}`);
    process.exit(1);
  }

  const src = fs.readFileSync(APP_JS, 'utf8');
  const lines = src.split('\n');

  // 已知核心路由（任何改动都需要人工确认）
  const CORE_ROUTES = [
    '/api/quotes',
    '/api/suppliers',
    '/api/receptions',
    '/api/documents',
    '/api/templates',
    '/api/projects',
    '/api/meta',
  ];

  const issues = [];
  const foundRoutes = [];

  // ── 1. 提取所有路由路径 ──────────────────────────────────────────────
  const routeRegex = /['"`](\/api\/[^'"`\s]+)['"`]/g;
  let match;
  while ((match = routeRegex.exec(src)) !== null) {
    const route = match[1].replace(/\?.+$/, '').replace(/:[^/]+/g, ':param');
    if (!foundRoutes.includes(route)) foundRoutes.push(route);
  }

  // ── 2. 检查核心路由是否还在 ──────────────────────────────────────────
  for (const core of CORE_ROUTES) {
    const base = core.replace(/\/$/, '');
    const present = foundRoutes.some(r => r === base || r.startsWith(base + '/') || r.startsWith(base + '?'));
    if (!present) {
      issues.push(`[MISSING ROUTE] 核心路由已消失：${core}（可能被误删或重命名）`);
    }
  }

  // ── 3. 统计 try/catch 覆盖率 ─────────────────────────────────────────
  // 寻找 if (url.startsWith('/api/...') 或 case '/api/' 块，判断其内是否有 try {
  // 简化判断：统计全文 try { 出现次数 vs route 出现次数
  const routeHandlerCount = (src.match(/url\.startsWith\(['"`]\/api/g) || []).length
    + (src.match(/url\s*===\s*['"`]\/api/g) || []).length
    + (src.match(/case\s+['"`]\/api/g) || []).length;
  const tryCatchCount = (src.match(/\btry\s*\{/g) || []).length;

  if (tryCatchCount < Math.max(1, routeHandlerCount * 0.5)) {
    issues.push(`[LOW COVERAGE] try/catch 数量(${tryCatchCount}) 明显少于路由处理块(${routeHandlerCount})，部分路由可能缺少错误兜底`);
  }

  // ── 4. 检查是否有 res.status(500) ──────────────────────────────────
  const has500 = /status\(500\)/.test(src);
  if (!has500) {
    issues.push('[NO 500] server/app.js 中未发现 status(500) 响应，服务端错误可能以非标准方式返回');
  }

  // ── 5. 检查错误响应格式一致性 ─────────────────────────────────────
  // 期望：{ error: '...' } 格式
  const jsonErrorMatches = (src.match(/JSON\.stringify\(\{[^}]*error[^}]*\}\)/g) || []).length;
  const rawStringErrors = (src.match(/res\.end\(['"`][^'"`]*[错误error][^'"`]*['"`]\)/g) || []).length;
  if (rawStringErrors > 0 && jsonErrorMatches === 0) {
    issues.push(`[FORMAT] 错误响应使用了原始字符串(${rawStringErrors}处)，建议统一为 JSON { error: '...' }`);
  }

  // ── 输出结果 ─────────────────────────────────────────────────────────
  console.log('\n=== API 兼容性检查报告 ===\n');

  console.log('【当前检测到的 API 路由】');
  foundRoutes.sort().forEach(r => console.log(`  ${r}`));

  console.log(`\n【统计】`);
  console.log(`  路由路径数量: ${foundRoutes.length}`);
  console.log(`  try/catch 数量: ${tryCatchCount}`);
  console.log(`  status(500) 存在: ${has500 ? '✅' : '❌'}`);

  if (issues.length === 0) {
    console.log('\n✅ 未发现明显问题\n');
  } else {
    console.log('\n⚠️  发现以下问题：');
    issues.forEach(i => console.log(`  ${i}`));
    console.log('');
    process.exit(1);
  }
}

main();
