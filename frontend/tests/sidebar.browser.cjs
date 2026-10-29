const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

test('desktop sidebar animates, expands from icons, searches without floating labels and shows sign-out hints', { timeout: 90000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer((request, response) => {
    const requested = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
    if (!requested.startsWith(root + path.sep)) return response.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'sidebar-fixture-token'));
    let employee = false;
    const user = { id: 'user', name: 'Alex Morgan', email: 'alex@example.com' };
    const branch = { id: 'branch', name: 'Head office', companyId: 'company', status: 'ACTIVE' };
    const profile = { id: 'profile', userId: user.id, user, branchId: branch.id, branch, companyId: 'company', company: { id: 'company', name: 'Example' }, employeeCode: 'EMP-1', status: 'ACTIVE', joiningDate: '2026-01-01' };
    await page.route('**/api/v1/**', route => {
      const url = new URL(route.request().url());
      const endpoint = url.pathname;
      if (endpoint.endsWith('/auth/logout')) return route.fulfill({ json: {} });
      assert.equal(route.request().method(), 'GET');
      const data = endpoint.endsWith('/auth/me') ? { user, memberships: [{ id: 'membership', tenantId: 'tenant', companyId: 'company', companyName: 'Example', role: employee ? 'EMPLOYEE' : 'BUSINESS_OWNER', permissions: [], branches: [branch] }] }
        : endpoint.includes('branches') ? [branch] : endpoint.endsWith('/employees/me') ? [profile]
        : url.searchParams.has('page') ? { data: [], items: [], pagination: { page: 1, totalPages: 1, total: 0 } } : [];
      return route.fulfill({ json: data });
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const mode of ['Admin', 'Employee']) {
      employee = mode === 'Employee';
      await page.goto(`${base}/${employee ? 'employee' : 'admin'}/dashboard`);
      const sidebar = page.getByTestId('desktop-sidebar');
      await expect(sidebar).toBeVisible();
      for (const button of await page.locator('[data-testid^="workspace-header-"] [role="button"]').all()) {
        await button.hover();
        assert.equal(await button.evaluate(element => getComputedStyle(element).boxShadow), 'none', 'Main header controls have no hover shadow');
      }
      if (!employee) {
        const companySelector = page.getByRole('button', { name: 'Switch business', exact: true });
        await companySelector.hover();
        assert.equal(await companySelector.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', 'Company name has no hover background');
      }
      if (await sidebar.getByRole('button', { name: 'Expand sidebar', exact: true }).count()) await sidebar.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
      await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(248);
      assert.equal(await sidebar.evaluate(element => getComputedStyle(element).transitionDuration), '0.24s');
      await sidebar.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
      await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(76);
      const firstLink = sidebar.getByRole('link').first();
      await expect(firstLink).toHaveAttribute('title', employee ? 'My work' : 'Dashboard');
      assert.equal((await firstLink.innerText()).trim(), '', 'Collapsed links display icons only');
      await page.reload();
      await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(76);
      await sidebar.getByRole('link', { name: employee ? 'My tasks' : 'More', exact: true }).click();
      await expect(page).toHaveURL(employee ? /\/employee\/tasks/ : /\/admin\/more/);
      await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(248);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await sidebar.getByRole('link', { name: employee ? 'My work' : 'Dashboard', exact: true }).click();
      await sidebar.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
      await sidebar.getByRole('button', { name: 'Search navigation', exact: true }).click();
      const search = sidebar.getByRole('textbox', { name: `Find a page in ${mode.toLowerCase()} navigation`, exact: true });
      await expect(search).toBeFocused();
      await expect(search).toHaveAttribute('placeholder', 'Search');
      await expect(sidebar.getByText('Search', { exact: true })).toHaveCount(0);
      const appearance = await search.evaluate(input => {
        const field = input.parentElement;
        const panel = field.parentElement;
        return { panel: getComputedStyle(panel).backgroundColor, field: getComputedStyle(field).backgroundColor, input: getComputedStyle(input).backgroundColor };
      });
      assert.deepEqual(appearance, { panel: 'rgba(0, 0, 0, 0)', field: 'rgba(0, 0, 0, 0)', input: 'rgba(0, 0, 0, 0)' });
      const searchAudit = path.join(root, 'audit'); fs.mkdirSync(searchAudit, { recursive: true });
      await page.screenshot({ path: path.join(searchAudit, `sidebar-${mode.toLowerCase()}-search-focused.png`) });
      await search.fill(employee ? 'payslip' : 'payroll');
      await search.blur();
      await expect(sidebar.getByRole('link', { name: employee ? 'Payslips' : 'Payroll', exact: true })).toBeVisible();
      await expect(sidebar.getByText('Search', { exact: true })).toHaveCount(0);
      await sidebar.getByRole('button', { name: /^Clear find a page/ }).click();
      await search.blur();
      await expect(search).toHaveValue('');
      const logout = sidebar.getByRole('button', { name: 'Sign out', exact: true });
      await expect(logout).toBeVisible();
      assert.equal((await logout.innerText()).trim(), '', 'Sign out displays only its icon');
      await logout.hover();
      await expect(sidebar.getByText('Sign out', { exact: true })).toBeVisible();
      await page.locator('[data-testid="dashboard-greeting"]:visible').hover();
      await expect(sidebar.getByText('Sign out', { exact: true })).toHaveCount(0);
      await sidebar.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
      await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(76);
      await logout.focus();
      await expect(sidebar.getByText('Sign out', { exact: true })).toBeVisible();
      const audit = path.join(root, 'audit'); fs.mkdirSync(audit, { recursive: true });
      await page.screenshot({ path: path.join(audit, `sidebar-${mode.toLowerCase()}-signout-hint.png`) });
      await logout.blur();
      await sidebar.getByRole('button', { name: 'Expand sidebar for Alex Morgan', exact: true }).click();
      await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(248);
      await sidebar.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
      await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(76);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await sidebar.evaluate(element => getComputedStyle(element).transitionDuration), '0s');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width: 1024, height: 900 });
      await expect(sidebar).toHaveCount(0);
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(76);
      await page.screenshot({ path: path.join(audit, `sidebar-${mode.toLowerCase()}-collapsed.png`) });
    }
    await page.getByTestId('desktop-sidebar').getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
