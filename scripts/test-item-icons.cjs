const { build } = require('esbuild');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const bundle = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {ItemsPage} from './apps/web/src/features/items/ItemsPage';import './apps/web/src/app.css';import './apps/web/src/styles/fantasy-theme.css';import './apps/web/src/styles/workspace.css';createRoot(document.getElementById('root')).render(<div className="shell" style={{display:'block',padding:16}}><ItemsPage campaignId="icon-test"/></div>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, outdir: 'tmp/items-test', jsx: 'automatic', define: { 'import.meta.env.VITE_API_BASE_URL': '""' }, loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.ttf': 'dataurl' } });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.startsWith('/api/')) return route.fulfill({ json: { data: { items: [] } } });
      if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/test.css"><script src="/test.js"></script>' });
      const file = bundle.outputFiles.find(f => f.path.endsWith(path.endsWith('.css') ? '.css' : '.js'));
      return route.fulfill({ contentType: path.endsWith('.css') ? 'text/css' : 'application/javascript', body: file.text });
    });
    await page.goto('http://items-test.local');
    await page.locator('.items-list-card-title .item-category-icon').first().waitFor();
    for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.locator('.items-list-card').count(), await page.locator('.items-list-card .item-category-icon svg').count());
      assert.ok(await page.locator('.item-category-icon').first().evaluate(e => e.getBoundingClientRect().width === 44));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'page overflow');
      await page.screenshot({ path: `tmp/items-${name}.png` });
      await page.locator('.items-list-card-trigger').first().click();
      await page.locator('[role="dialog"] .item-category-icon svg').waitFor();
      await page.getByRole('button', { name: 'Закрыть карточку предмета' }).click();
    }
    await page.getByRole('button', { name: 'Зелье', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.items-list-card .item-category-icon')].every(e => e.dataset.category === 'potion'));
    assert.ok(await page.locator('.items-list-card').count() > 0);
    assert.deepEqual(errors, []);
    console.log('Item icons: desktop/mobile visibility, modal, category filter, no overflow or runtime errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
