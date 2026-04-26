const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.resolve(__dirname, '..');
const WINDOWS_BROWSER_CANDIDATES = [
  process.env.PDF_EXPORT_BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = '1';
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function createClientJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    exp: 4102444800,
    sub: 'pdf-export',
    email: 'pdf-export@localhost',
  })).toString('base64url');
  return header + '.' + payload + '.';
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detectRuntime() {
  return {
    platform: process.platform,
    isWindows: process.platform === 'win32',
    isVercel: Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION),
    isServerless: Boolean(
      process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV ||
      process.env.FUNCTION_TARGET
    ),
  };
}

function resolveBrowserExecutable() {
  if (process.platform !== 'win32') {
    return process.env.PDF_EXPORT_BROWSER_PATH || '';
  }
  return WINDOWS_BROWSER_CANDIDATES.find((candidate) => candidate && fs.existsSync(candidate)) || '';
}

function request(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    }).on('error', reject);
  });
}

async function waitForHealth(baseUrl, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await request(baseUrl + '/api/health');
      if (res.status === 200) return;
    } catch (_) {}
    await wait(500);
  }
  throw new Error('Server did not respond on ' + baseUrl + ' within ' + timeoutMs + 'ms');
}

async function exportProjectQuotationPdf(options = {}) {
  const runtime = detectRuntime();
  const quoteId = options.quoteId || 'Q-1773570112434';
  const port = Number(options.port || 3310);
  const outPath = options.outPath ? path.resolve(root, options.outPath) : null;
  const lang = options.lang || 'zh';
  const mode = options.mode || 'professional';
  const grouping = options.grouping || 'grouped';
  const overview = options.overview === '0' ? '0' : (options.overview === 0 ? '0' : '1');
  const sign = options.sign === '0' ? '0' : (options.sign === 0 ? '0' : '1');
  const serverUrl = options.serverUrl || ('http://127.0.0.1:' + port);
  const composer = options.composer === '0' ? '0' : (options.composer === 0 ? '0' : '1');
  const authToken = options.authToken || process.env.PDF_EXPORT_AUTH_TOKEN || 'dev-bypass-token';
  const clientJwt = options.clientJwt || createClientJwt();
  const pdfScale = Number(options.scale || '1');
  const pdfMargins = {
    top: options.marginTop || '0',
    right: options.marginRight || '0',
    bottom: options.marginBottom || '0',
    left: options.marginLeft || '0',
  };

  const browserExecutable = resolveBrowserExecutable();

  if (runtime.isServerless) {
    throw new Error('PDF export runtime unsupported in current serverless environment. Use a local Node worker or dedicated export service.');
  }

  if (!browserExecutable) {
    throw new Error('No supported local browser executable found. Set PDF_EXPORT_BROWSER_PATH or install Edge/Chrome on the export host.');
  }

  let server = null;
  let serverLog = '';

  if (!options.serverUrl) {
    server = spawn('node', ['server/index.js'], {
      cwd: root,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', (chunk) => { serverLog += chunk.toString('utf8'); });
    server.stderr.on('data', (chunk) => { serverLog += chunk.toString('utf8'); });
  }

  try {
    await waitForHealth(serverUrl);

    const browser = await chromium.launch({
      executablePath: browserExecutable,
      headless: true,
      args: ['--disable-gpu', '--no-sandbox'],
    });
    const page = await browser.newPage({
      viewport: { width: 1600, height: 2200 },
      deviceScaleFactor: 1,
    });
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const headers = { ...request.headers() };
      if (authToken) {
        headers.authorization = 'Bearer ' + authToken;
      }
      await route.continue({ headers });
    });
    await page.addInitScript((token) => {
      window.localStorage.setItem('app_token', token);
    }, clientJwt);

    const url = serverUrl + '/project-quotation.html?id=' + encodeURIComponent(quoteId)
      + '&lang=' + encodeURIComponent(lang)
      + '&mode=' + encodeURIComponent(mode)
      + '&grouping=' + encodeURIComponent(grouping)
      + '&overview=' + overview
      + '&sign=' + sign
      + '&composer=' + composer;

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((enabled) => {
      if (!window.__QP_READY__ || !window.__QP_PAGES_STABLE__) return false;
      if (enabled !== '0' && Number(window.__QP_TOTAL_PAGES__ || 0) === 0) return false;
      return true;
    }, composer, { timeout: 30000 });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.waitForFunction(() => {
      const coverBottom = document.querySelector('.qp-cover-bottom');
      const meta = document.querySelector('.qp-cover-meta-strip');
      const total = document.querySelector('.qp-cover-total-strip');
      if (!coverBottom || !meta || !total) return false;
      const coverRect = coverBottom.getBoundingClientRect();
      const metaRect = meta.getBoundingClientRect();
      const totalRect = total.getBoundingClientRect();
      return coverRect.height > 0 && metaRect.height > 0 && totalRect.height > 0;
    }, { timeout: 10000 });
    await page.waitForTimeout(300);
    const pdfBuffer = await page.pdf({
      path: outPath || undefined,
      format: 'A4',
      scale: pdfScale,
      printBackground: true,
      preferCSSPageSize: false,
      margin: pdfMargins,
    });
    await browser.close();
    return { outPath, pdfBuffer, serverLog };
  } catch (error) {
    if (error && typeof error.message === 'string' && error.message.includes('spawn EPERM')) {
      error.message = 'Browser launch blocked by host runtime (spawn EPERM). The current server process cannot execute the configured browser binary.';
    }
    error.serverLog = serverLog;
    throw error;
  } finally {
    if (server) {
      server.kill();
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  try {
    const result = await exportProjectQuotationPdf({
      quoteId: args.id,
      port: args.port,
      outPath: args.out || 'artifacts-project-quotation-controlled.pdf',
      lang: args.lang,
      mode: args.mode,
      grouping: args.grouping,
      overview: args.overview,
      sign: args.sign,
      serverUrl: args['server-url'],
      composer: args.composer,
      authToken: args['auth-token'],
      clientJwt: args['client-jwt'],
      scale: args.scale,
      marginTop: args['margin-top'],
      marginRight: args['margin-right'],
      marginBottom: args['margin-bottom'],
      marginLeft: args['margin-left'],
    });
    console.log('PDF_OK ' + result.outPath);
  } catch (error) {
    console.error('EXPORT_FAILED');
    console.error(error.stack || error.message || String(error));
    if (error.serverLog) {
      console.error(error.serverLog);
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  exportProjectQuotationPdf,
  parseArgs,
};
