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
    await page.route('**/api/v1/**', route => {
      const url = new URL(route.request().url()), endpoint = url.pathname;
      const data = endpoint.endsWith('/auth/me') ? session : endpoint.endsWith('/employees/me') ? [profile] : endpoint.endsWith('/tasks/my') ? tasks : endpoint.includes('branches') ? [branch] : url.searchParams.has('page') ? { items: [], data: [], pagination: { page: 1, totalPages: 1 } } : [];
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
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const boxes = await Promise.all([todo, due, done].map(card => card.boundingBox()));
      assert.ok(boxes.every(box => Math.abs(box.y - boxes[0].y) < 1 && box.x >= 0 && box.x + box.width <= width + 1));
      for (const card of [todo, due, done]) {
        const icon = await card.evaluate(element => element.firstElementChild.getBoundingClientRect().height);
        assert.equal(icon, 22, 'Compact icon remains visible on mobile');
      }
    }
    assert.deepEqual(failures, []);
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
