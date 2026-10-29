// Run after npm run export:web: node --test tests/task-overview.browser.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

test('task overview cards show icons and filter their matching tasks', { timeout: 60000 }, async () => {
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
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    const user = { id: 'person', name: 'Test Person', email: 'person@example.com' };
    const branch = { id: 'branch', companyId: 'company', name: 'Main', status: 'ACTIVE' };
    const profile = { id: 'profile', userId: user.id, companyId: 'company', branchId: 'branch', employeeCode: 'EMP-1', status: 'ACTIVE', user, branch, company: { id: 'company', name: 'Example' }, joiningDate: '2026-01-01' };
    const session = { user, memberships: [{ id: 'member', tenantId: 'tenant', companyId: 'company', companyName: 'Example', role: 'EMPLOYEE', permissions: [], branches: [branch] }] };
    const today = new Date().toISOString();
    const tasks = [
      { id: 'open', title: 'Prepare report', status: 'TODO', dueDate: today },
      { id: 'progress', title: 'Review budget', status: 'IN_PROGRESS', dueDate: null },
      { id: 'hold', title: 'Await vendor', status: 'ON_HOLD', dueDate: null },
      { id: 'done', title: 'Finished report', status: 'COMPLETED', dueDate: today },
      { id: 'cancelled', title: 'Cancelled report', status: 'CANCELLED', dueDate: today },
    ].map(task => ({ ...task, description: null, priority: 'MEDIUM', createdAt: today, updatedAt: today, assignedToId: user.id, companyId: 'company', branchId: 'branch' }));
    await page.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'fixture-token'));
    let dashboardMode = false;
    const reads = [];
    await page.route('**/api/v1/**', route => {
      const url = new URL(route.request().url()), endpoint = url.pathname;
      reads.push(endpoint);
      const data = endpoint.endsWith('/auth/me') ? session : endpoint.endsWith('/employees/me') ? [profile] : endpoint.endsWith('/tasks/my') ? dashboardMode ? [] : tasks
        : endpoint.endsWith('/attendance/my-history') ? { data: [{ id: 'shift', companyId: 'company', branchId: 'branch', userId: user.id, attendanceDate: today.slice(0, 10) + 'T00:00:00Z', checkInAt: today, checkOutAt: today, status: 'PRESENT', totalMinutes: 1, source: 'SELF' }], pagination: { page: 1, totalPages: 1 } }
        : endpoint.includes('branches') ? [branch] : url.searchParams.has('page') ? { items: [], data: [], pagination: { page: 1, totalPages: 1 } } : [];
      return route.fulfill({ json: data });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/employee/tasks`);
    const todo = page.getByTestId('employee-task-summary-todo');
    const due = page.getByTestId('employee-task-summary-due-today');
    const done = page.getByTestId('employee-task-summary-completed');
    await expect(todo).toBeEnabled();
    await expect(todo).toHaveAccessibleName('To do: 3');
    await expect(due).toHaveAccessibleName('Due today: 1');
    await expect(done).toHaveAccessibleName('Completed: 1');
    await todo.click();
    await expect(todo).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'To do', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Prepare report', { exact: true })).toBeVisible();
    await expect(page.getByText('Review budget', { exact: true })).toBeVisible();
    await expect(page.getByText('Await vendor', { exact: true })).toBeVisible();
    await expect(page.getByText('Finished report', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Cancelled report', { exact: true })).toHaveCount(0);
    await due.click();
    await expect(todo).toHaveAttribute('aria-pressed', 'false');
    await expect(due).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Prepare report', { exact: true })).toBeVisible();
    await expect(page.getByText('Review budget', { exact: true })).toHaveCount(0);
    await done.click();
    await expect(page.getByText('Finished report', { exact: true })).toBeVisible();
    await expect(page.getByText('Prepare report', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(done).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('Cancelled report', { exact: true })).toBeVisible();
    await page.getByLabel('Search tasks', { exact: true }).fill('budget');
    await todo.click();
    await expect(page.getByText('Review budget', { exact: true })).toBeVisible();
    await expect(page.getByText('Prepare report', { exact: true })).toHaveCount(0);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 640 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const boxes = await Promise.all([todo, due, done].map(card => card.boundingBox()));
      assert.ok(boxes.every(box => Math.abs(box.y - boxes[0].y) < 1 && box.x >= 0 && box.x + box.width <= width + 1));
      for (const card of [todo, due, done]) {
        const icon = await card.locator('svg').first().boundingBox();
        assert.ok(icon && icon.width >= 14 && icon.height >= 14, 'Compact icon remains visible on mobile');
      }
    }
    dashboardMode = true;
    await page.goto(`http://127.0.0.1:${server.address().port}/employee/dashboard`);
    await expect(page.getByText('Your shift is complete. View attendance to see the recorded details.', { exact: true })).toBeVisible();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 640 });
      await expect.poll(async () => {
        const boxes = await Promise.all([page.getByTestId('dashboard-greeting'), page.getByTestId('dashboard-date-time'), page.getByRole('button', { name: 'Choose work branch', exact: true }), page.getByRole('button', { name: 'Refresh dashboard', exact: true })].map(control => control.boundingBox()));
        return boxes.every(box => box && box.x >= 0 && box.x + box.width <= width + 1) && boxes[2].width >= (width >= 768 ? 160 : 70) && (width >= 768
          ? boxes.every(box => Math.abs(box.y + box.height / 2 - boxes[0].y - boxes[0].height / 2) < 2)
          : boxes.slice(1).every(box => box.y >= boxes[0].y + boxes[0].height));
      }, { message: `Employee dashboard header fits at ${width}px` }).toBe(true);
      const profileTile = page.getByRole('button', { name: /My profile Details & documents/ });
      const overview = page.getByRole('heading', { name: 'Your overview', exact: true }).locator('..').locator('..');
      await expect(profileTile).toBeVisible();
      await expect.poll(async () => {
        const [profileBox, overviewBox] = await Promise.all([profileTile.boundingBox(), overview.boundingBox()]);
        return width < 768 ? overviewBox.y >= profileBox.y + profileBox.height + 8 : overviewBox.x >= profileBox.x + profileBox.width + 8;
      }, { message: `Employee overview follows profile tile without overlap at ${width}px` }).toBe(true);
    }
    const refreshed = ['/tasks/my', '/payroll/my-payslips', '/attendance/my-history'];
    const previousReads = refreshed.map(endpoint => reads.filter(read => read.endsWith(endpoint)).length);
    await page.getByRole('button', { name: 'Refresh dashboard', exact: true }).click();
    await expect.poll(() => refreshed.every((endpoint, index) => reads.filter(read => read.endsWith(endpoint)).length > previousReads[index])).toBe(true);
    await page.goto(`http://127.0.0.1:${server.address().port}/employee/profile`);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 640 });
      const details = page.getByText('Personal details', { exact: true }).locator('..');
      const links = page.getByText('Quick links', { exact: true }).locator('..');
      await expect.poll(async () => {
        const [detailsBox, linksBox] = await Promise.all([details.boundingBox(), links.boundingBox()]);
        return width < 768 ? linksBox.y >= detailsBox.y + detailsBox.height + 8 : linksBox.x >= detailsBox.x + detailsBox.width + 8;
      }, { message: `Profile details and quick links do not overlap at ${width}px` }).toBe(true);
    }
    assert.deepEqual(failures, []);
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
