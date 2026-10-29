const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

test('reported validation issues: email spaces, blank passwords, search phrases and task calendar submission', { timeout: 60000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer((req, res) => {
    const requested = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!requested.startsWith(root + path.sep)) return res.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    res.setHeader('Content-Type', ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let logins = 0;
    await page.route('**/api/v1/auth/login', route => { logins++; return route.abort(); });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/auth/login`);
    const email = page.getByLabel('Work email', { exact: true });
    await email.fill('person @example.com');
    await expect(email).toHaveValue('');
    await email.fill('  person@example.com  ');
    await expect(email).toHaveValue('person@example.com');
    const password = page.getByLabel('Password', { exact: true });
    await password.fill('        ');
    await password.blur();
    await expect(password).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('button', { name: /Sign in/i }).click();
    assert.equal(logins, 0);

    await page.goto(`${base}/auth/signup`);
    const name = page.getByLabel('Business name', { exact: true });
    await name.fill('123 Business');
    await expect(name).toHaveValue('');
    await name.fill('  Mary Jane  ');
    await name.blur();
    await expect(name).toHaveValue('Mary Jane');
    const phone = page.getByLabel('Mobile number', { exact: true });
    await phone.fill('  9876543210  ');
    await expect(phone).toHaveValue('9876543210');
    await page.getByLabel('Work email', { exact: true }).fill('  mary@example.com  ');
    await expect(page.getByLabel('Work email', { exact: true })).toHaveValue('mary@example.com');

    const user = { id: 'owner', name: 'Owner', email: 'owner@example.com' };
    const branch = { id: 'branch', name: 'Main', companyId: 'company', status: 'ACTIVE' };
    const session = { user, memberships: [{ id: 'member', tenantId: 'tenant', companyId: 'company', role: 'BUSINESS_OWNER', companyName: 'Example', permissions: [], branches: [branch] }] };
    const writes = [];
    await page.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'fixture-token'));
    await page.route('**/api/v1/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if ((route.request().method() === 'POST' && pathname.endsWith('/tasks')) || (route.request().method() === 'PATCH' && pathname.endsWith('/tasks/task'))) {
        const body = route.request().postDataJSON();
        writes.push(body);
        return route.fulfill({ json: { id: 'task', ...body } });
      }
      const data = pathname.endsWith('/auth/me') ? session
        : pathname.endsWith('/branches/available') ? [branch]
        : pathname.endsWith('/tasks/assignees') ? [{ userId: 'employee', user: { name: 'Test Employee' }, branch }]
        : pathname.endsWith('/tasks/task') ? { id: 'task', ...writes[0] }
        : [];
      return route.fulfill({ json: data });
    });
    await page.goto(`${base}/admin/tasks`);
    await page.getByLabel('Task Title *', { exact: true }).fill('Calendar regression');
    await page.getByRole('button', { name: /Assigned To/ }).click();
    await page.getByRole('option', { name: 'Test Employee', exact: true }).click();
    await page.getByRole('button', { name: /Due date:.*Open calendar/ }).click();
    await page.getByRole('button', { name: 'Set due date to today', exact: true }).click();
    await expect(page.getByRole('button', { name: /Due date:.*Open calendar/ })).toHaveAttribute('aria-invalid', 'false');
    await page.getByRole('button', { name: 'Assign Task', exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    assert.match(writes[0].dueDate, /^\d{4}-\d{2}-\d{2}T23:59:59\.000Z$/);
    await page.goto(`${base}/admin/tasks?edit=task`);
    await page.getByRole('button', { name: /Due date:.*Open calendar/ }).click();
    await page.getByRole('button', { name: 'Clear date', exact: true }).click();
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect.poll(() => writes.length).toBe(2);
    assert.equal(writes[1].dueDate, null);
    await page.setViewportSize({ width: 1440, height: 900 });
    const search = page.getByLabel(/^Find a page in .* navigation$/);
    await search.fill('  Team attendance  ');
    await expect(page.getByRole('link', { name: 'Team attendance', exact: true })).toBeVisible();
    await search.fill('Team  attendance');
    await expect(page.getByRole('link', { name: 'Team attendance', exact: true })).toHaveCount(0);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
