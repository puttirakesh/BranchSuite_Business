const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium, expect } = require('@playwright/test');

test('staff role panels render scoped navigation, personal pages and working HR/sales entry points', { timeout: 180000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer((req, res) => {
    const requested = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!requested.startsWith(root + path.sep) && requested !== root) return res.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const base = `http://127.0.0.1:${server.address().port}`;
    const variants = {
      BUSINESS_OWNER: ['Business Owner', ['Home', 'CRM', 'People', 'Payroll', 'More']],
      BUSINESS_ADMIN: ['Business Admin', ['Home', 'CRM', 'People', 'Payroll', 'More']],
      COMPANY_MANAGER: ['Company Manager', ['Home', 'CRM', 'Team', 'Approvals', 'More']],
      BRANCH_MANAGER: ['Branch Manager', ['Home', 'CRM', 'Team', 'Approvals', 'More']],
      HR_MANAGER: ['HR Manager', ['Home', 'Team', 'Attendance', 'Approvals', 'More']],
      PAYROLL_MANAGER: ['Payroll Officer', ['Home', 'Team', 'Payroll', 'Payments', 'More']],
      SALES_MANAGER: ['Sales Executive', ['Home', 'Leads', 'Deals', 'Tasks', 'More']],
    };
    for (const width of [390, 1440]) for (const [role, [label, tabs]] of Object.entries(variants)) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, acceptDownloads: true });
      try {
        await context.addInitScript(() => { sessionStorage.setItem('branchsuite_access_token', 'role-test-token'); sessionStorage.setItem('branchsuite_admin_workspace_selection', JSON.stringify({ companyId: 'company', branchId: 'branch' })); });
        const page = await context.newPage(), failures = [], blocked = [], reads = [];
        page.on('pageerror', error => failures.push(error.message));
        const branch = { id: 'branch', companyId: 'company', name: 'North', status: 'ACTIVE', code: 'NORTH', location: '', manager: '', employees: 1 };
        const user = { id: 'person', name: 'Role Test', email: 'role@example.invalid', phone: null, status: 'ACTIVE' };
        const canPeople = role !== 'SALES_MANAGER', canCrm = !['HR_MANAGER', 'PAYROLL_MANAGER'].includes(role);
        const permissions = [...(canPeople ? ['users.read', 'attendance.read'] : []), ...(canCrm ? ['crm.read'] : []), ...(!['HR_MANAGER', 'SALES_MANAGER'].includes(role) ? ['payroll.read'] : [])];
        const session = { user, memberships: [{ id: 'm', tenantId: 'tenant', companyId: 'company', companyName: 'Example Company', role, roles: [role], permissions, branches: [branch] }] };
        const profile = { id: 'profile', userId: user.id, companyId: 'company', branchId: 'branch', employeeCode: 'EMP-1', status: 'ACTIVE', department: 'Operations', designation: 'Team member', joiningDate: '2026-01-01', createdAt: '2026-01-01', notes: null, user, branch, company: { id: 'company', name: 'Example Company' } };
        const personalTask = { id: 'personal-task', title: 'Assigned role task', description: 'Personal assignment', assignedToId: user.id, assignedTo: user, createdBy: user,
          companyId: 'company', branchId: 'branch', status: 'TODO', priority: 'MEDIUM', dueDate: null, createdAt: '2026-10-01', updatedAt: '2026-10-01', completedAt: null, comments: [] };
        await page.route('**/api/v1/**', route => {
          const url = new URL(route.request().url());
          const pathname = url.pathname.replace('/api/v1', ''); reads.push(pathname);
          if (pathname === '/tasks/personal-task/status' && route.request().method() === 'PATCH') {
            personalTask.status = route.request().postDataJSON().status;
            return route.fulfill({ json: personalTask });
          }
          if (pathname === '/users' || pathname === '/employees' && !canPeople) { blocked.push(pathname); return route.fulfill({ status: 403, json: { message: 'Forbidden' } }); }
          const data = pathname === '/auth/me' ? session
            : pathname === '/branches' || pathname === '/branches/available' ? [branch]
            : pathname === '/employees' || pathname === '/employees/me' ? [profile]
            : pathname === '/employees/reporting-managers' ? [{ ...user, roles: [{ role: { id: 'hr', name: role } }], companyAccess: [{ company: { id: 'company', name: 'Example Company' } }], branchAccess: [{ branch }], createdAt: '2026-01-01' }]
            : pathname === '/departments' ? [{ id: 'department', companyId: 'company', branchId: null, name: 'Operations', branch: null, employeeCount: 1 }]
            : pathname === '/tasks/assignees' ? [{ userId: user.id, user: { name: user.name }, branch }]
            : pathname === '/deals' ? [{ id: 'deal', companyId: 'company', branchId: 'branch', title: 'Verified sales opportunity', amount: '5000', currency: 'INR', stage: 'QUALIFIED', createdAt: '2026-10-01', expectedCloseAt: '2026-10-31' }]
            : pathname === '/tasks/my' ? [personalTask]
            : pathname === '/tasks/personal-task' ? personalTask
            : pathname === '/workspace/preferences' ? null : [];
          return route.fulfill({ json: url.searchParams.has('page') ? { data, items: data, pagination: { page: 1, totalPages: 1, total: data.length } } : data });
        });
        await page.goto(`${base}/admin/dashboard`);
        await expect(page.getByText(`${label} workspace`, { exact: true })).toHaveCount(0);
        await expect(page.getByTestId('dashboard-greeting')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Refresh dashboard', exact: true })).toBeVisible();
        await expect(page.getByTestId('dashboard-overview').getByText('—', { exact: true })).toHaveCount(0);
        await expect(page.getByText(/Cannot read properties|Could not load backend/)).toHaveCount(0);
        if (process.env.ROLE_SCREENSHOT_DIR) {
          fs.mkdirSync(process.env.ROLE_SCREENSHOT_DIR, { recursive: true });
          await page.screenshot({ path: path.join(process.env.ROLE_SCREENSHOT_DIR, `${role}-${width}.png`), fullPage: true });
        }
        if (width === 390) {
          const bar = page.getByLabel('Admin bottom navigation', { exact: true });
          await expect(bar).toBeVisible();
          assert.deepEqual(await bar.getByRole('button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))), tabs);
          if (role === 'PAYROLL_MANAGER') {
            await bar.getByRole('button', { name: 'Payments', exact: true }).click();
            await expect(page.getByText('Payment tracker', { exact: true })).toBeVisible();
            await expect(bar.getByRole('button', { name: 'Payments', exact: true })).toHaveAttribute('aria-selected', 'true');
            await bar.getByRole('button', { name: 'Payroll', exact: true }).click();
            await expect(page).not.toHaveURL(/view=payments/);
            await expect(bar.getByRole('button', { name: 'Payroll', exact: true })).toHaveAttribute('aria-selected', 'true');
          }
        }
        if (role === 'HR_MANAGER') {
          await page.getByRole('button', { name: 'Add employee', exact: true }).click();
          await expect(page.getByLabel('Full name *', { exact: true })).toBeVisible();
          await expect.poll(() => reads.includes('/employees/reporting-managers') && reads.includes('/departments')).toBe(true);
        }
        if (role === 'SALES_MANAGER') {
          await page.goto(`${base}/admin/crm`);
          await expect.poll(() => reads.includes('/tasks/assignees')).toBe(true);
          await page.goto(`${base}/admin/crm/lead-form`);
          await expect(page.getByLabel('Organisation *', { exact: true })).toBeVisible();
          await page.goto(`${base}/admin/tasks/follow-ups`);
          await expect.poll(() => reads.includes('/tasks/assignees')).toBe(true);
          await page.goto(`${base}/admin/reports`);
          await expect(page.getByText('Verified sales opportunity', { exact: true }).first()).toBeVisible();
        }
        await page.goto(`${base}/admin/payslips`);
        await expect(page.getByText('My Payroll', { exact: true })).toBeVisible();
        await page.goto(`${base}/admin/my-advances`);
        await expect(page.getByText('My salary advances', { exact: true })).toBeVisible();
        await page.goto(`${base}/admin/more`);
        await page.getByRole('button', { name: 'My tasks', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'My tasks', exact: true })).toBeVisible();
        await page.getByText('Assigned role task', { exact: true }).click();
        await expect(page).toHaveURL(/\/admin\/my-tasks\/personal-task$/);
        await page.getByRole('button', { name: 'In Progress', exact: true }).click();
        await page.getByRole('button', { name: 'Save Progress', exact: true }).click();
        await expect(page.getByTestId('app-toast')).toContainText('Task status updated.');
        assert.equal(personalTask.status, 'IN_PROGRESS');
        await page.getByRole('button', { name: 'Go back from Task details', exact: true }).click();
        await expect(page).toHaveURL(/\/admin\/my-tasks\/?$/);
        if (['HR_MANAGER', 'PAYROLL_MANAGER'].includes(role)) {
          await page.goto(`${base}/admin/tasks`);
          await expect(page.getByText('Access required', { exact: true })).toBeVisible();
          assert.equal(reads.includes('/tasks/assignees'), false, 'Personal tasks do not grant the management directory');
        }
        assert.deepEqual(blocked, [], `${role} must not request inaccessible directories`);
        assert.deepEqual(failures, [], `${role} must render without runtime errors`);
      } finally { await context.close(); }
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
