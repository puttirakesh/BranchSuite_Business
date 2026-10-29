const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium, expect } = require('@playwright/test');

test('mobile forms, direct employee profiles, and employee dashboard quick actions', { timeout: 180000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  fs.mkdirSync(path.join(root, 'audit'), { recursive: true });
  const server = http.createServer((req, res) => {
    const requested = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!requested.startsWith(root + path.sep) && requested !== root) return res.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const base = `http://127.0.0.1:${server.address().port}`;
    const branch = { id: 'branch', companyId: 'company', name: 'Main', status: 'ACTIVE' };
    const user = { id: 'person', name: 'Anil Kumar', email: 'anil@example.invalid', phone: '9876543210', status: 'ACTIVE' };
    const initialProfile = { id: 'profile', userId: user.id, user, tenantId: 'tenant', companyId: 'company', branchId: branch.id, company: { id: 'company', name: 'Example Ltd' }, branch, employeeCode: 'EMP-1', department: 'Sales', designation: 'Executive', employmentType: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2026-01-01', notes: 'Reporting manager: Maya Singh\nField sales team', createdAt: '2026-01-01' };
    for (const role of ['BUSINESS_OWNER', 'EMPLOYEE']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
      try {
        await context.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'fixture-token'));
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        let profile = { ...initialProfile, user: { ...user } };
        const session = { user, memberships: [{ id: 'membership', tenantId: 'tenant', companyId: 'company', companyName: 'Example Ltd', role, roles: [role], permissions: [], branches: [branch] }] };
        await page.route('**/api/v1/**', route => {
          const url = new URL(route.request().url()), endpoint = url.pathname.replace('/api/v1', '');
          const method = route.request().method();
          if (endpoint === '/workspace/preferences' && method !== 'GET') return route.fulfill({ json: { value: route.request().postDataJSON().value } });
          if (endpoint === '/employees/profile/status' && method === 'PATCH') {
            profile = { ...profile, status: route.request().postDataJSON().status };
            return route.fulfill({ json: profile });
          }
          if (endpoint === '/users/person/deactivate' && method === 'PATCH') {
            profile = { ...profile, user: { ...profile.user, status: 'INACTIVE' } };
            return route.fulfill({ json: profile.user });
          }
          assert.equal(method, 'GET', `Unexpected mutation: ${method} ${endpoint}`);
          const data = endpoint === '/auth/me' ? session
            : endpoint === '/tasks/assignees' ? [{ userId: user.id, user, branch }]
            : endpoint === '/employees/me' || endpoint === '/employees' ? [profile]
            : endpoint === '/employees/profile' ? profile
            : endpoint.includes('branches') ? [branch]
            : endpoint === '/workspace/preferences' ? null : [];
          return route.fulfill({ json: url.searchParams.has('page') ? { items: data, data, pagination: { page: 1, totalPages: 1, total: data.length } } : data });
        });
        for (const width of [320, 360, 390, 430, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          if (role === 'EMPLOYEE') {
            await page.goto(`${base}/employee/dashboard`);
            await expect(page.getByTestId('dashboard-greeting')).toContainText('Anil!');
            await expect(page.getByTestId('dashboard-greeting')).not.toContainText('Kumar');
            const quick = page.getByTestId('employee-quick-actions');
            const boxes = await Promise.all((await quick.getByRole('button').all()).map(button => button.boundingBox()));
            assert.equal(boxes.length, 4);
            assert.ok(boxes.every(box => Math.abs(box.y - boxes[0].y) < 2), `${width}px: employee actions share a row`);
            const clock = await page.getByTestId('dashboard-date-time').boundingBox();
            const row = await quick.boundingBox();
            assert.ok(row.y >= clock.y + clock.height + 16, 'Employee clock and quick actions are separated');
            if (width === 390) {
              fs.mkdirSync(path.join(root, 'audit'), { recursive: true });
              await page.screenshot({ path: path.join(root, 'audit', 'employee-dashboard-mobile.png') });
            }
            continue;
          }
          await page.goto(`${base}/admin/crm/lead-form`);
          const source = page.getByRole('button', { name: 'Source', exact: true });
          await expect(source).toBeEnabled();
          await expect(source).toContainText('Select an option');
          await expect(page.getByRole('button', { name: 'Stage', exact: true })).toContainText('Select an option');
          const input = page.getByRole('textbox', { name: 'Organisation *', exact: true });
          const before = await input.evaluate(element => getComputedStyle(element.parentElement).borderLeftColor);
          await input.fill('Example prospect');
          assert.equal(await input.evaluate(element => getComputedStyle(element.parentElement).borderLeftColor), before, 'Focused admin input retains its neutral border');
          await source.click();
          assert.equal(await source.evaluate(element => getComputedStyle(element).boxShadow), 'none');
          assert.notEqual(await source.evaluate(element => getComputedStyle(element).borderLeftColor), 'rgb(37, 99, 235)');
          await page.keyboard.press('Escape');
          const assigned = page.getByRole('button', { name: /^Assigned to:/ });
          await assigned.click();
          const options = page.getByTestId('lead-assignment-options');
          await expect(options).toBeVisible();
          const [trigger, menu] = await Promise.all([assigned.boundingBox(), options.boundingBox()]);
          assert.ok(menu.y >= trigger.y + trigger.height, 'Assignments open immediately below their input');
          if (width === 390) await page.screenshot({ path: path.join(root, 'audit', 'lead-assignment-mobile.png') });
          await options.getByRole('checkbox', { name: 'Anil Kumar, Main', exact: true }).click();
          await expect(assigned).toContainText('Anil Kumar');
          await options.getByRole('button', { name: 'Done', exact: true }).click();
          await expect(options).toHaveCount(0);
          assert.ok(page.url().endsWith('/admin/crm/lead-form'));
          await page.goto(`${base}/admin/employees`);
          await page.getByRole('button', { name: 'View Anil Kumar', exact: true }).click();
          await expect(page).toHaveURL(/\/admin\/employees\/profile$/);
          await expect(page.getByRole('heading', { name: 'Employee profile', exact: true })).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Anil Kumar', exact: true })).toBeVisible();
          await expect(page.getByText('Maya Singh', { exact: true })).toBeVisible();
          await expect(page.getByText('Field sales team', { exact: true })).toBeVisible();
          await expect(page.getByRole('button', { name: 'Edit employee', exact: true })).toBeVisible();
          if (width === 390) {
            const branchControl = page.getByRole('button', { name: 'Branch', exact: true });
            await branchControl.click();
            assert.equal(await branchControl.evaluate(element => getComputedStyle(element).boxShadow), 'none');
            assert.notEqual(await branchControl.evaluate(element => getComputedStyle(element).borderLeftColor), 'rgb(37, 99, 235)');
            await page.keyboard.press('Escape');
            await page.screenshot({ path: path.join(root, 'audit', 'employee-profile-mobile.png') });
            await page.getByRole('button', { name: 'Mark inactive', exact: true }).click();
            await expect(page.getByRole('button', { name: 'Mark active', exact: true })).toBeVisible();
            await page.getByRole('button', { name: 'Disable login', exact: true }).click();
            await expect(page.getByRole('button', { name: 'Enable login', exact: true })).toBeVisible();
            profile = { ...initialProfile, user: { ...user } };
          }
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Profile has no horizontal overflow');
          await page.getByRole('button', { name: 'Go back from Employee profile', exact: true }).click();
          await expect(page).toHaveURL(/\/admin\/employees$/);
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
