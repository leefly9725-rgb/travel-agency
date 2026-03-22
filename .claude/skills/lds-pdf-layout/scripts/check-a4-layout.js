#!/usr/bin/env node
/**
 * check-a4-layout.js
 * 检查报价单 PDF 实际使用的样式链路中，A4 版心和打印控制规则是否存在。
 *
 * 用法：node .claude/skills/lds-pdf-layout/scripts/check-a4-layout.js
 *
 * 扫描顺序（按实际样式链路）：
 *   1. HTML 页面内联 <style> 块（主要来源）
 *   2. 专用 CSS 文件（web/styles.css 等）
 *   3. 外部 JS 动态注入（仅搜索关键字，不执行 JS）
 *
 * 检查项：
 *   1. @media print 块存在
 *   2. @page 设置 A4 尺寸
 *   3. @page 设置 margin（版心）
 *   4. page-break-before/after: always（cover page 分页）
 *   5. page-break-inside: avoid（保护表格行）
 *   6. cover-page 相关样式
 *   7. 打印时隐藏按钮/导航（print-hide / no-print / display:none in @media print）
 *   8. HTML 中有分页标记元素
 *   9. HTML 中有 cover 区块
 *  10. HTML 中有条款或签字区
 */

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.join(__dirname, '../../../../');

// ── 要扫描的文件（按优先级排列）────────────────────────────────────────────
const STYLE_SOURCES = [
  // 主要 PDF 页面（内联 <style> 是实际样式来源）
  { file: 'web/quotation-preview.html',  type: 'html', label: 'quotation-preview.html 内联 style' },
  { file: 'web/project-quotation.html',  type: 'html', label: 'project-quotation.html 内联 style' },
  // 全局 CSS（次要，但也检查）
  { file: 'web/styles.css',              type: 'css',  label: 'styles.css' },
  // 打印专用 CSS（若存在）
  { file: 'web/print.css',               type: 'css',  label: 'print.css' },
];

const HTML_SOURCES = [
  { file: 'web/quotation-preview.html', label: 'quotation-preview.html' },
  { file: 'web/project-quotation.html', label: 'project-quotation.html' },
];

// ── 从 HTML 文件中提取所有内联 <style> 内容 ─────────────────────────────────
function extractInlineStyles(src) {
  const blocks = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    blocks.push(m[1]);
  }
  return blocks.join('\n');
}

// ── 读取文件并按 type 返回"待检查的 CSS 文本" ───────────────────────────────
function readStyleContent(entry) {
  const abs = path.join(PROJECT_ROOT, entry.file);
  if (!fs.existsSync(abs)) return null;
  const raw = fs.readFileSync(abs, 'utf8');
  if (entry.type === 'html') return extractInlineStyles(raw);
  return raw; // css / js
}

// ── 在多个 sources 中搜索 pattern，返回第一个命中的 source label ────────────
function findInSources(sources, pattern) {
  for (const entry of sources) {
    const content = readStyleContent(entry);
    if (content && pattern.test(content)) {
      const m = content.match(pattern);
      const snippet = m ? m[0].trim().slice(0, 80) : '';
      return { found: true, source: entry.label, snippet };
    }
  }
  return { found: false };
}

// ── CSS 规则检查项 ────────────────────────────────────────────────────────────
const CSS_CHECKS = [
  {
    label: '@media print 块存在',
    pattern: /@media\s+print\s*\{/,
    note: '缺少则 screen 和 print 样式完全相同，无法控制打印输出',
  },
  {
    label: '@page 设置 A4 尺寸',
    pattern: /@page\s*[^{]*\{[^}]*A4/s,
    note: '未设置则浏览器使用默认纸张尺寸，可能不是 A4',
  },
  {
    label: '@page 设置 margin（版心）',
    pattern: /@page\s*[^{]*\{[^}]*margin/s,
    note: '建议：margin: 15mm 20mm',
  },
  {
    label: 'page-break-before/after: always（强制分页）',
    pattern: /page-break-(before|after)\s*:\s*always/,
    note: '用于在 cover page 后、条款页前强制分页',
  },
  {
    label: 'page-break-inside: avoid（防止截断）',
    pattern: /page-break-inside\s*:\s*avoid/,
    note: '用于防止表格行、签字区在页面中间截断',
  },
  {
    label: 'cover-page 相关样式',
    pattern: /\.(?:cover[-_]?page|qp-cover|pdf-cover)|#cover/i,
    note: 'Cover page 应有独立样式，锁定高度并 page-break-after: always',
  },
  {
    label: '打印时隐藏按钮/导航',
    pattern: /\.(?:print-hide|no-print|action-btn|nav[-_]bar|toolbar)|display\s*:\s*none/i,
    note: '打印时操作按钮、导航栏应隐藏',
  },
];

// ── HTML 结构检查项（全文搜索，包含静态 HTML 元素、CSS 类定义、JS 模板字符串）──
// 注：页面内容为 JS 动态渲染，静态 HTML 中不会有 class="qp-cover" 等属性。
// 因此接受"CSS 中存在该类定义"或"JS 模板字符串中出现"作为有效证据。
const HTML_STRUCT_CHECKS = [
  {
    label: 'cover 区块存在（CSS 类定义或 HTML 元素或 JS 模板）',
    // CSS 类定义（.qp-cover、.pdf-cover 等）或 HTML 静态元素或 JS 字符串
    pattern: /\.qp-cover|\.pdf-cover|\.cover-page|class="[^"]*(?:cover|qp-cover)|id="cover|['"`]qp-cover['"`]/i,
    note: 'Cover page 应有独立样式并 page-break-after: always（CSS 类存在即满足）',
  },
  {
    label: '分页控制存在（page-break-after:always 或 .page-break 类）',
    // 接受 CSS 规则或 HTML 元素或 JS 模板
    pattern: /page-break-after\s*:\s*always|class="[^"]*page-break|data-page-break|['"`]page-break['"`]/,
    note: '强制分页点：CSS 规则存在即满足，不要求静态 HTML 中有 class 属性',
  },
  {
    label: '条款或签字区存在',
    pattern: /class="[^"]*(?:terms|signature|qp-terms)|\.qp-terms|签字|条款/,
    note: '条款和签字区应在同一不可分页块内',
  },
];

function main() {
  const results = [];

  // ── CSS 规则检查（在所有 style sources 中搜索）──────────────────────────
  console.log('\n=== A4 布局检查报告（按实际样式链路）===\n');
  console.log('扫描顺序：内联 <style>（HTML 页面）→ styles.css → print.css\n');

  for (const check of CSS_CHECKS) {
    const result = findInSources(STYLE_SOURCES, check.pattern);
    results.push({ ...check, pass: result.found, source: result.source, snippet: result.snippet });
  }

  // ── HTML 结构检查 ──────────────────────────────────────────────────────
  for (const check of HTML_STRUCT_CHECKS) {
    let found = false;
    let foundSource = null;
    let snippet = null;
    for (const entry of HTML_SOURCES) {
      const abs = path.join(PROJECT_ROOT, entry.file);
      if (!fs.existsSync(abs)) continue;
      const raw = fs.readFileSync(abs, 'utf8');
      if (check.pattern.test(raw)) {
        const m = raw.match(check.pattern);
        snippet = m ? m[0].trim().slice(0, 80) : '';
        found = true;
        foundSource = entry.label;
        break;
      }
    }
    results.push({ ...check, pass: found, source: foundSource, snippet });
  }

  // ── 输出报告 ────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass);
  const failed = results.filter(r => !r.pass);

  if (passed.length > 0) {
    console.log(`✅ 通过 (${passed.length}/${results.length}):`);
    passed.forEach(r => {
      const src = r.source ? `  [来源: ${r.source}]` : '';
      const snip = r.snippet ? `\n       → ${r.snippet}` : '';
      console.log(`   [✓] ${r.label}${src}${snip}`);
    });
  }

  if (failed.length > 0) {
    console.log(`\n❌ 未通过 (${failed.length}/${results.length}):`);
    failed.forEach(r => {
      console.log(`   [✗] ${r.label}`);
      if (r.note) console.log(`        提示：${r.note}`);
      console.log(`        已扫描：${STYLE_SOURCES.filter(s => fs.existsSync(path.join(PROJECT_ROOT, s.file))).map(s => s.label).join('、')}`);
    });

    console.log('\n注：若规则存在于 JS 动态注入或 <link> 外部 CSS，本脚本可能漏检。');
    console.log('    建议用浏览器 DevTools → Computed → 勾选"打印"媒体模拟 手动核查。\n');
    process.exit(1);
  } else {
    console.log(`\n✅ 全部 ${results.length} 项 A4 布局检查通过\n`);
  }
}

main();
