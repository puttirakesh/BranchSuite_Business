// Run after npm run export:web: node --test tests/toast-auth.browser.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

test('responsive feedback, modal errors and both sign-in portals', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer((request, response) => {
    const requested = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!requested.startsWith(root + path.sep) && requested !== root) return response.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    for (const width of [320, 768, 1440]) {
      for (const portal of ['staff', 'employee']) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width < 1024 });
        const page = await context.newPage();
        const failures = [];
        page.on('pageerror', error => failures.push(error.message));
        const branch = { id: 'branch', name: 'Main branch', companyId: 'company', status: 'ACTIVE', manager: '', code: 'MAIN', location: '', employees: 0 };
        const user = { id: 'person', name: 'Test person', email: 'person@example.com', phone: null, status: 'ACTIVE' };
        const session = { user, memberships: [{ id: 'member', tenantId: 'tenant', companyId: 'company', companyName: 'Example', role: portal === 'staff' ? 'BUSINESS_OWNER' : 'EMPLOYEE', permissions: [], branches: [branch] }] };
        const profile = { id: 'profile', tenantId: 'tenant', companyId: 'company', branchId: 'branch', userId: user.id, employeeCode: 'EMP-1', department: 'Sales', designation: 'Associate', status: 'ACTIVE', workEmail: user.email, user, branch, company: { id: 'company', name: 'Example' }, joiningDate: '2026-01-01' };
        let rejectLogin = false;
        let loginRequests = 0;
        await page.route('**/api/v1/**', async route => {
          const request = route.request();
          const url = new URL(request.url());
          const pathname = url.pathname;
          if (pathname.endsWith('/auth/login')) {
            loginRequests++;
            assert.equal(request.postDataJSON().portal, portal);
            return rejectLogin ? route.fulfill({ status: 401, json: { message: 'Incorrect email or password. Please check your details and try again.' } })
              : route.fulfill({ json: { accessToken: 'fixture-token', session } });
          }
          if (request.method() === 'POST' && pathname.endsWith('/branches')) return route.fulfill({ status: 201, json: { ...branch, id: 'new-branch' } });
          if (request.method() === 'POST' && pathname.endsWith('/support/tickets')) return route.fulfill({ status: 201, json: { id: 'ticket', ...request.postDataJSON(), status: 'OPEN', createdAt: new Date().toISOString(), messages: [] } });
          assert.equal(request.method(), 'GET', `Unexpected mutation: ${pathname}`);
          const data = pathname.endsWith('/auth/me') ? session
            : pathname.endsWith('/employees/me') ? [profile]
            : pathname.includes('available') || pathname.endsWith('/branches') ? [branch]
            : url.searchParams.has('page') ? { data: [], pagination: { page: 1, totalPages: 1, total: 0 } }
            : [];
          return route.fulfill({ json: data });
        });
        await page.goto(`${base}/auth/login`);
        if (portal === 'employee') await page.getByRole('tab', { name: 'Employee', exact: true }).click();
        await page.getByLabel('Work email', { exact: true }).fill(user.email);
        await page.getByLabel('Password', { exact: true }).fill('valid-password');
        if (width === 320) {
          rejectLogin = true;
          await page.getByRole('button', { name: 'Sign In', exact: true }).click();
          await expect(page.getByTestId('app-toast')).toContainText('Incorrect email or password');
          await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeEnabled();
          assert.ok(page.url().endsWith('/auth/login'));
          const box = await page.getByTestId('app-toast').boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= width, 'long error wraps within the phone viewport');
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
          await expect(page.getByTestId('app-toast')).toHaveCount(0);
          rejectLogin = false;
        }
        const started = Date.now();
        const before = loginRequests;
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        const waiting = page.getByRole('button', { name: 'Signing in...', exact: true });
        await expect(waiting).toBeDisabled();
        await expect(waiting).toHaveAttribute('aria-busy', 'true');
        await page.waitForTimeout(250);
        assert.ok(page.url().endsWith('/auth/login'), 'fast authentication keeps the waiting state visible');
        await expect(page).toHaveURL(portal === 'staff' ? /\/admin(?:\/dashboard)?\/?$/ : /\/employee(?:\/dashboard)?\/?$/);
        assert.ok(Date.now() - started >= 950, 'dashboard opens after the one-second minimum');
        assert.equal(loginRequests - before, 1, 'one submission creates one login request');
        const toast = page.getByTestId('app-toast');
        await expect(toast).toContainText('Signed in successfully.');
        const box = await toast.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0);
        if (width >= 1024) assert.ok(box.x > width / 2, 'desktop feedback sits at the top-right');
        else assert.ok(Math.abs(box.x + box.width / 2 - width / 2) < 2, 'phone and tablet feedback is centered');
        await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
        if (portal === 'staff') {
          await page.goto(`${base}/admin/branches`);
          await page.getByRole('button', { name: 'Add branch', exact: true }).click();
          await page.getByRole('button', { name: 'Save branch', exact: true }).click();
          await expect(page.getByTestId('app-toast')).toContainText('Enter a branch name');
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
          await page.getByLabel('Branch name', { exact: true }).fill('New branch');
          await page.getByLabel('Branch code', { exact: true }).fill('NEW');
          await page.getByLabel('Branch code', { exact: true }).blur();
          await page.getByRole('button', { name: 'Save branch', exact: true }).click();
          await expect(page.getByTestId('app-toast')).toContainText('Branch created successfully.');
        } else {
          await page.goto(`${base}/employee/help`);
          await page.getByLabel('Support request subject', { exact: true }).fill('Attendance question');
          await page.getByLabel('Describe support request', { exact: true }).fill('Please help me understand my attendance record.');
          await page.getByRole('button', { name: 'Submit support request', exact: true }).click();
          await expect(page.getByTestId('app-toast')).toContainText('Your support request was submitted.');
        }
        assert.deepEqual(failures, []);
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
