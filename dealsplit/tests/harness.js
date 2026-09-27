/* Shared Playwright harness: local server + page with self-hosted libs. */
const path = require('path');
const { chromium } = require('playwright');
const { start, libsFor } = require('./serve.js');

async function open({ headless = true } = {}) {
  const nodeModules = process.env.NODE_MODULES || path.join(__dirname, 'node_modules');
  const { server, port } = await start({ root: path.join(__dirname, '..'), nodeModules });
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ headless, executablePath: process.env.CHROMIUM || undefined, args: ['--enable-features=SharedArrayBuffer'] });
  const context = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
  // Block anything that is not our local server: proves "no network".
  const external = [];
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(base) || u.startsWith('blob:') || u.startsWith('data:')) return route.continue();
    external.push(u);
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript((libs) => { window.DEALSPLIT_LIBS = libs; }, libsFor(base));
  await page.goto(base + '/');
  await page.waitForFunction(() => window.DealSplit && document.getElementById('status').textContent.startsWith('Ready'), null, { timeout: 60000 });
  await page.addScriptTag({ path: path.join(__dirname, 'gen-synthetic.js') });
  return { browser, context, page, server, base, errors, external, close: async () => { await browser.close(); server.close(); } };
}

let failures = 0, checks = 0;
function check(cond, msg) { checks++; console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) failures++; }
function summary() { console.log(`\n${checks} checks, ${failures} failures`); return failures; }

module.exports = { open, check, summary };
