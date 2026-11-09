// Boots TypeR Studio's web version headless, from this repository, for What's New's demos.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const REPO = path.resolve(__dirname, '..', '..');
const { chromium } = require(path.join(REPO, 'desktop', 'node_modules', 'playwright-core'));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.properties': 'text/plain', '.webmanifest': 'application/json', '.wasm': 'application/wasm', '.mp4': 'video/mp4' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(REPO, p);
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(Number(process.env.PORT || 47123), '127.0.0.1', () => ok(server)));
}

async function boot(o = {}) {
  const server = await startServer();
  const port = server.address().port;
  const opts = { executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], viewport: { width: o.w || 1280, height: o.h || 800 }, deviceScaleFactor: o.dpr || 2, hasTouch: !!o.touch, isMobile: false, locale: 'en-US' };
  if (o.ua) opts.userAgent = o.ua;
  // One profile kept between runs, on a fixed port: LaMa Manga's download stays in its cache
  const context = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'typer-whats-new-demos', 'profile' + (o.profile || '')), opts);
  const browser = context;
  // The text detection only answers the site's origin: here, its answers are let through
  await context.route(/temizle\.saficizgi\.com/, async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...cors } });
  });
  const page = context.pages()[0] || await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text().slice(0, 300)); });
  await page.addInitScript((extra) => {
    if (window.top !== window) return;
    try {
      if (!sessionStorage.getItem('__seeded')) {
        localStorage.clear();
        ['typer-web-documents', 'typer-web-recent'].forEach((n) => indexedDB.deleteDatabase(n));
        localStorage.setItem('typer.web.onboarding', 'done');
        localStorage.setItem('typer.web.betaNotice', '1');
        if (!extra || !extra['typer.web.whatsNew']) localStorage.setItem('typer.web.whatsNew.off', '1');
        Object.entries(extra || {}).forEach(([k, v]) => localStorage.setItem(k, v));
        sessionStorage.setItem('__seeded', '1');
      }
    } catch (e) { /* */ }
  }, o.storage || {});
  await page.goto(`http://127.0.0.1:${port}/web/index.html?lang=${o.lang || 'en'}${o.query || ''}`, { waitUntil: 'load' });
  if (o.noWait) await page.waitForSelector('dialog.modal--whatsnew[open]', { timeout: 60000 });
  else await page.waitForFunction(() => window.TypeRApp && window.TypeRApp.booted, null, { timeout: 60000 });
  await sleep(800);
  return { server, browser, context, page, port };
}

async function openFile(page, file, name) {
  const b64 = fs.readFileSync(file).toString('base64');
  await page.evaluate(async ([b64, name]) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    await window.TypeRPhotoshop.ops.openBlob(new File([u], name), name);
  }, [b64, name || path.basename(file)]);
  await sleep(1500);
}

module.exports = { boot, openFile, sleep, REPO };
