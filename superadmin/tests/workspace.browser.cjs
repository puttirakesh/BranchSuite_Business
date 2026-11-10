const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
// Reuse the workspace's existing browser tooling; application builds have no cross-project imports.
const { chromium } = require(require.resolve('@playwright/test', { paths: [__dirname, path.resolve(__dirname, '../../frontend')] }));

test('preview navigation, calendar selection, bounds, forms and responsive layouts', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) file = path.join(root, 'index.html');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.css': 'text/css' };
    res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const origin = `http://127.0.0.1:${server.address().port}`;
    await context.route('**/*', route => route.request().url().startsWith(origin) || route.request().url().startsWith('data:') ? route.continue() : route.abort());
    await page.goto(origin);
    await page.getByLabel('Admin email', { exact: true }).fill('platform@demo.example');
    await page.getByLabel('Password', { exact: true }).fill('Demo123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Your platform', exact: true }).waitFor();
    const routes = ['/dashboard', '/customers', '/customers/t1', '/plans', '/plans/create', '/billing', '/billing/BS-DEMO-1001', '/support', '/support/BS-TK-101', '/marketing', '/marketing/BS-LD-101', '/offers', '/settings', '/audit', '/more'];
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        console.log(`Review ${width}px ${route}`);
        await page.goto(origin + route);
        await page.getByRole('heading').first().waitFor();
        await page.waitForTimeout(250);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} overflows at ${width}px`);
      }
    }
    await page.goto(origin + '/billing');
    const from = page.getByRole('button', { name: /^Issued from:/ });
    await from.click();
    await page.getByTestId('calendar-dialog').waitFor();
    const day = page.locator('[data-testid^="calendar-day-"]:not([aria-disabled="true"])').nth(10);
    const selectedKey = (await day.getAttribute('data-testid')).replace('calendar-day-', '');
    await day.click();
    await page.getByTestId('calendar-dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: /^Issued to:/ }).click();
    const forbidden = await page.locator('[data-testid^="calendar-day-"][aria-disabled="true"]').count();
    assert.ok(forbidden > 0, 'dates before range start must be disabled');
    await page.getByTestId('calendar-dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByTestId('calendar-dialog').waitFor({ state: 'hidden' });
    await from.click();
    await page.getByRole('button', { name: 'Clear date', exact: true }).click();
    await page.getByTestId('calendar-dialog').waitFor({ state: 'hidden' });
    assert.match(await from.getAttribute('aria-label'), /No date selected/);
    await page.goto(origin + '/offers/create');
    await page.getByRole('button', { name: 'Save offer', exact: true }).click();
    await page.getByRole('alert').first().waitFor();
    const expires = page.getByRole('button', { name: /^Expires on:/ });
    await expires.click();
    await page.getByTestId('calendar-dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByTestId('calendar-dialog').waitFor({ state: 'hidden' });
    await page.goto(origin + '/dashboard');
    await page.getByRole('heading', { name: 'Your platform', exact: true }).waitFor();
    await page.getByText('Revenue overview', { exact: true }).waitFor();
    fs.mkdirSync(path.join(root, 'review'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'review/dashboard-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, 'review/dashboard-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    await page.getByRole('button', { name: /Platform Support/ }).click();
    await page.goto(origin + '/plans');
    await page.getByText('Your role does not include this module.', { exact: false }).waitFor();
    assert.deepEqual(errors, []);
    console.log(`Reviewed ${routes.length} routes at four widths; calendar date ${selectedKey}; role restriction and validation checked.`);
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
