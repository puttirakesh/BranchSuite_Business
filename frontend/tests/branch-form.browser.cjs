const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium, expect } = require('@playwright/test');

test('branch create and edit use dedicated screens with back navigation and keyboard-sized viewports', { timeout: 90000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer((req, res) => {
    const requested = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (requested !== root && !requested.startsWith(root + path.sep)) return res.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, hasTouch: true });
    const branch = { id: 'branch', companyId: 'company', name: 'Main branch', code: 'MAIN', status: 'ACTIVE', employees: 1, location: '', manager: '' };
    const session = { user: { id: 'owner', name: 'Owner', email: 'owner@example.com' }, subscription: { status: 'ACTIVE', planId: 'scale', billingCycle: 'monthly', accessAllowed: true }, memberships: [{ id: 'membership', companyId: 'company', tenantId: 'tenant', companyName: 'Example', role: 'BUSINESS_OWNER', permissions: [], branches: [branch] }] };
    const branches = [branch], writes = [], updates = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'branch-dialog-fixture'));
    await page.route('**/api/v1/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/branches/locations/reverse')) {
        return route.fulfill({ json: {
          latitude: Number(url.searchParams.get('latitude')),
          longitude: Number(url.searchParams.get('longitude')),
          address: 'Guntur, Andhra Pradesh',
        } });
      }
      if (route.request().method() === 'POST' && url.pathname.endsWith('/branches')) {
        const body = route.request().postDataJSON();
        writes.push(body);
        const created = { ...branch, ...body, id: 'created-branch' };
        branches.push(created);
        return route.fulfill({ json: created });
      }
      if (route.request().method() === 'PATCH' && url.pathname.endsWith('/branches/branch')) {
        const body = route.request().postDataJSON(); updates.push(body);
        Object.assign(branch, body);
        return route.fulfill({ json: branch });
      }
      assert.equal(route.request().method(), 'GET');
      return route.fulfill({ json: url.pathname.endsWith('/auth/me') ? session : url.pathname.includes('branches') ? branches : [] });
    });
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`http://127.0.0.1:${server.address().port}/admin/branches`);
      await page.getByRole('button', { name: 'Add branch', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/branches\/create$/);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const name = page.getByLabel('Branch name', { exact: true });
      await name.fill('Guntur');
      if (width === 390) {
        await page.getByRole('button', { name: 'Choose branch location on map' }).click();
        await page.getByTestId('branch-location-map').click({ position: { x: 120, y: 120 } });
        await page.getByRole('button', { name: 'Use this branch location' }).click();
      }
      await page.setViewportSize({ width, height: 460 });
      const save = page.getByRole('button', { name: 'Save branch', exact: true });
      const back = page.getByRole('button', { name: 'Go back from Add branch', exact: true });
      await expect(back).toBeInViewport();
      const body = await name.evaluate(element => {
        let parent = element.parentElement;
        while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
        return parent && { height: parent.clientHeight, scrollHeight: parent.scrollHeight };
      });
      assert.ok(body && body.height >= 100 && body.scrollHeight > body.height, 'Full-page form retains a useful scrolling area');
      await page.getByLabel('Grace period (minutes)', { exact: true }).fill('15');
      await save.scrollIntoViewIfNeeded();
      await expect(save).toBeInViewport();
      const output = path.join(root, 'responsive-interactions');
      fs.mkdirSync(output, { recursive: true });
      await page.screenshot({ path: path.join(output, `branch-page-${width}.png`) });
      if (width === 390) {
        await save.click();
        await expect(page).toHaveURL(/\/admin\/branches$/);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].name, 'Guntur');
        assert.equal(writes[0].location, 'Guntur, Andhra Pradesh');
        assert.equal(typeof writes[0].latitude, 'number');
        assert.equal(typeof writes[0].longitude, 'number');
        assert.equal(writes[0].graceMinutes, 15);
      } else { await back.click(); await expect(page).toHaveURL(/\/admin\/branches$/); }
    }
    await page.setViewportSize({ width: 390, height: 740 });
    await page.goto(`http://127.0.0.1:${server.address().port}/admin/branches`);
    await page.getByRole('button', { name: 'Edit Main branch branch details', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/branches\/branch\/edit$/);
    await page.getByLabel('Branch name', { exact: true }).fill('Main updated');
    const save = page.getByRole('button', { name: 'Save branch', exact: true });
    await save.scrollIntoViewIfNeeded(); await save.click();
    await expect(page).toHaveURL(/\/admin\/branches$/);
    assert.equal(updates.length, 1); assert.equal(updates[0].name, 'Main updated');
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
