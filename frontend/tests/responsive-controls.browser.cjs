const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, expect } = require('@playwright/test');

test('small-screen controls, payroll empty state and keyboard dropdown navigation', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer((request, response) => {
    const requested = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (requested !== root && !requested.startsWith(root + path.sep)) return response.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 320, height: 740 }, hasTouch: true });
    const base = `http://127.0.0.1:${server.address().port}`;
    const touchSized = async locator => {
      await expect(locator).toBeVisible();
      const box = await locator.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44, `Touch target is ${box.width} by ${box.height}`);
    };
    await page.goto(`${base}/auth/signup`);
    await touchSized(page.getByRole('button', { name: 'Back to subscription plans', exact: true }));
    for (const button of await page.getByRole('button', { name: 'Show password', exact: true }).all()) await touchSized(button);
    await page.goto(`${base}/auth/plans`);
    await touchSized(page.getByRole('button', { name: 'Back to sign in', exact: true }));
    await touchSized(page.getByRole('button', { name: 'Monthly billing', exact: true }));
    await page.getByRole('button', { name: 'Annual billing', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Annual billing', exact: true })).toHaveAttribute('aria-pressed', 'true');

    const user = { id: 'owner', name: 'Audit Owner', email: 'owner@example.com' };
    const branches = Array.from({ length: 12 }, (_, index) => ({ id: `branch-${index}`, name: `Branch ${index + 1}`, status: 'ACTIVE', companyId: 'company' }));
    branches[11].name = 'International operations and customer support branch with a long descriptive name';
    const session = { user, memberships: [{ id: 'membership', companyId: 'company', tenantId: 'tenant', companyName: 'Example', role: 'BUSINESS_OWNER', permissions: [], branches }] };
    const profile = { id: 'employee', userId: user.id, user, branchId: branches[0].id, branch: branches[0], companyId: 'company', company: { id: 'company', name: 'Example' }, status: 'ACTIVE', employeeCode: 'EMP-1', joiningDate: '2020-01-01' };
    let leaveTypes = [];
    await page.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'responsive-controls-fixture'));
    await page.route('**/api/v1/**', route => {
      const url = new URL(route.request().url());
      assert.equal(route.request().method(), 'GET', 'UX checks do not mutate business data');
      return route.fulfill({ json: url.pathname.endsWith('/auth/me') ? session : url.pathname.endsWith('/leave/types') ? leaveTypes : /\/(employees\/me|advances\/my-contexts)$/.test(url.pathname) ? [profile] : url.pathname.includes('branches') ? branches : url.searchParams.has('page') ? { data: [], items: [], pagination: { total: 0, totalPages: 1, page: 1 } } : [] });
    });
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/admin/dashboard`);
      const trigger = page.getByRole('button', { name: 'Branch', exact: true });
      await expect(trigger).toBeEnabled();
      await trigger.focus();
      await page.keyboard.press('ArrowDown');
      const menu = page.getByRole('listbox', { name: 'Branch', exact: true });
      await expect(menu).toBeVisible();
      const bounds = await menu.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, 'Portal dropdown fits the viewport');
      const search = page.getByRole('textbox', { name: 'Search branch', exact: true });
      await expect(search).toBeFocused();
      await search.fill('Branch 10');
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('option', { name: 'Branch 10', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(search).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(menu.getByRole('option').first()).toBeFocused();
      await page.keyboard.press('End');
      await expect(menu.getByRole('option').last()).toBeFocused();
      const longOption = menu.getByRole('option').last();
      assert.ok(await longOption.locator('span').first().evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'Long branch names wrap within the menu');
      await page.keyboard.press('Home');
      await expect(page.getByRole('option', { name: 'All branches', exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(menu).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(menu).toBeVisible();
      await page.keyboard.press('Tab');
      await expect(menu).toHaveCount(0);
      await expect(trigger).not.toBeFocused();
      await page.goto(`${base}/admin/employees/create`);
      for (const name of ['Profile', 'Pay & login', 'Review']) await touchSized(page.getByRole('button', { name, exact: true }));
      await page.goto(`${base}/admin/payroll/inputs`);
      const empty = page.getByText('No employees in this branch', { exact: true });
      await expect(empty).toBeVisible();
      const card = await empty.evaluate(element => { const box = element.parentElement.getBoundingClientRect(); return { left: box.left, right: box.right }; });
      assert.ok(card.left >= 0 && card.right <= width, 'Payroll empty card fits without clipping');
    }
    for (const width of [390, 768, 1366]) {
      session.memberships[0].role = 'BUSINESS_OWNER';
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/admin/tasks`);
      const title = page.getByLabel('Task Title *', { exact: true });
      const branch = page.getByRole('button', { name: 'Branch *', exact: true });
      await expect(title).toBeVisible();
      await expect(branch).toBeVisible();
      if (width < 768) {
        const field = await title.evaluate(element => { const box = element.parentElement.getBoundingClientRect(); return { y: box.y, height: box.height }; });
        const next = await branch.boundingBox();
        assert.ok(next.y - field.y - field.height >= 15, 'Stacked task fields have a visible gap');
      }
      await page.goto(`${base}/admin/crm/customers/create`);
      const email = page.getByLabel('Customer email', { exact: true });
      const phone = page.getByLabel('Customer phone', { exact: true });
      await expect(email).toBeVisible();
      const a = await email.boundingBox(), b = await phone.boundingBox();
      if (width >= 768) {
        assert.ok(Math.abs(a.y - b.y) < 2 && b.x > a.x + a.width, 'Customer fields share two columns on larger screens');
      } else assert.ok(b.y > a.y + a.height, 'Customer fields stack on mobile');
      session.memberships[0].role = 'EMPLOYEE';
      await page.goto(`${base}/employee/advances`);
      const preset = page.getByRole('button', { name: 'Set advance amount to 1000 rupees', exact: true });
      await touchSized(preset);
      const alignment = await preset.evaluate(element => { const box = element.getBoundingClientRect(), text = element.firstElementChild.getBoundingClientRect(); return { padding: text.x - box.x, offset: Math.abs(text.y + text.height / 2 - box.y - box.height / 2) }; });
      assert.ok(alignment.padding >= 10 && alignment.offset < 2, 'Advance presets have padding and vertically centered text');
      await page.goto(`${base}/employee/leave/apply`);
      await expect(page.getByRole('button', { name: 'Leave type', exact: true })).toBeDisabled();
      await expect(page.getByText('This option is no longer available. Choose another.', { exact: true })).toHaveCount(0);
    }
    leaveTypes = [
      { id: 'annual', companyId: 'company', status: 'ACTIVE', code: 'AL', annualAllowance: 20, name: 'Annual leave', isPaid: true },
      { id: 'medical', companyId: 'company', status: 'ACTIVE', code: 'ML', annualAllowance: 10, name: 'Medical leave', isPaid: true },
    ];
    for (const width of [320, 390, 768, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/employee/leave/apply`);
      const selector = page.getByRole('button', { name: 'Leave type', exact: true });
      const reason = page.getByLabel('Reason', { exact: true });
      await expect(selector).toBeEnabled();
      const before = await reason.boundingBox();
      await selector.focus();
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('listbox', { name: 'Leave type', exact: true })).toBeVisible();
      assert.equal((await reason.boundingBox()).y, before.y, 'Opening leave options does not move form fields');
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      await expect(selector).toBeFocused();
      await expect(selector).toContainText('Medical leave');
      await page.getByRole('button', { name: /^Leave start date:.*Open calendar$/ }).click();
      await touchSized(page.getByRole('button', { name: 'Next month', exact: true }));
      const today = page.getByRole('button', { name: 'Set leave start date to today', exact: true });
      const day = page.getByRole('button', { name: /^\d+ [A-Za-z]+ \d{4}$/ }).last();
      const bounds = await day.boundingBox();
      assert.ok(bounds.width >= 39.9 && bounds.height >= 44, `Calendar days remain usable at ${width}px`);
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, 'Calendar days fit the viewport');
      const output = path.join(root, 'responsive-interactions');
      fs.mkdirSync(output, { recursive: true });
      await page.screenshot({ path: path.join(output, `calendar-${width}.png`) });
      await today.click();
      await expect(page.getByRole('button', { name: 'Next month', exact: true })).toHaveCount(0);
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
