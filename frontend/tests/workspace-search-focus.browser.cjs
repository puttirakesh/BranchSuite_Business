const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

test('mobile workspace search focuses only after tapping the search field', { timeout: 60000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer((request, response) => {
    const requested = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (requested !== root && !requested.startsWith(root + path.sep)) return response.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const user = { id: 'owner', name: 'Owner', email: 'owner@example.invalid' };
    const branch = { id: 'branch', companyId: 'company', name: 'Main', status: 'ACTIVE' };
    const session = { user, subscription: { status: 'ACTIVE', planId: 'scale', billingCycle: 'monthly', accessAllowed: true, canManageBilling: true, cancelAtPeriodEnd: false, currentPeriodEnd: null }, memberships: [{ id: 'membership', tenantId: 'tenant', companyId: 'company', companyName: 'Example', role: 'BUSINESS_OWNER', permissions: [], branches: [branch] }] };
    await page.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'workspace-search-fixture'));
    await page.route('**/api/v1/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/workspace/preferences') && route.request().method() !== 'GET') {
        return route.fulfill({ json: { value: route.request().postDataJSON().value } });
      }
      const data = url.pathname.endsWith('/auth/me') ? session
        : url.pathname.includes('branches') ? [branch] : [];
      return route.fulfill({ json: data });
    });

    await page.goto(`http://127.0.0.1:${server.address().port}/admin/dashboard`);
    await page.getByRole('button', { name: 'Search modules', exact: true }).tap();
    const search = page.getByTestId('workspace-search-sheet').getByRole('textbox', { name: 'Search modules', exact: true });
    await expect(search).toBeVisible();
    assert.equal(await search.evaluate(element => document.activeElement === element), false, 'Opening search must not focus the field');
    await search.tap();
    await expect(search).toBeFocused();
    await context.close();
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
