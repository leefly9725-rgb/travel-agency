const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const root = path.resolve(__dirname, '..');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      const res = await request(`${baseUrl}/api/health`);
      if (res.status === 200) return;
    } catch (error) {
      // keep waiting
    }
    await wait(500);
  }
  throw new Error(`Server did not respond on ${baseUrl} within ${timeoutMs}ms`);
}

async function main() {
  const args = parseArgs(process.argv);
  const quoteId = args.id || 'Q-1773570112434';
  const port = Number(args.port || 3310);
  const outPath = path.resolve(root, args.out || 'artifacts-project-quotation-controlled.pdf');
  const lang = args.lang || 'zh';
  const mode = args.mode || 'professional';
  const grouping = args.grouping || 'grouped';
  const overview = args.overview === '0' ? '0' : '1';
  const sign = args.sign === '0' ? '0' : '1';
  const serverUrl = args['server-url'] || `http://127.0.0.1:${port}`;
  const composer = args.composer === '0' ? '0' : '1';

  if (!fs.existsSync(edgePath)) {
    throw new Error(`Edge not found: ${edgePath}`);
  }

  let server = null;
  let serverLog = '';

  if (!args['server-url']) {
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
      executablePath: edgePath,
      headless: true,
      args: ['--disable-gpu', '--no-sandbox'],
    });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
    });
    const url = `${serverUrl}/project-quotation.html?id=${encodeURIComponent(quoteId)}&lang=${encodeURIComponent(lang)}&mode=${encodeURIComponent(mode)}&grouping=${encodeURIComponent(grouping)}&overview=${overview}&sign=${sign}&composer=${composer}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    // Wait for both __QP_READY__ and __QP_PAGES_STABLE__ to confirm composer has
    // settled and the second layout pass is complete before switching to print mode.
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
      // Two rAF cycles: let print-mode CSS changes settle before measuring.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.waitForTimeout(300);
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    await browser.close();
    console.log(`PDF_OK ${outPath}`);
  } catch (error) {
    console.error('EXPORT_FAILED');
    console.error(error.stack || error.message || String(error));
    console.error(serverLog);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.kill();
    }
  }
}

main();



