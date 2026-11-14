// Run after npm run export:web: node --test tests/employee-reporting-manager.browser.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

test('admins create company and branch departments before assigning employees', { timeout: 60000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer((request, response) => {
    const requested = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!requested.startsWith(root + path.sep) && requested !== root) { response.writeHead(403).end(); return; }
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' };
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    const branches = [{ id: 'north', name: 'North', companyId: 'company', status: 'ACTIVE' }, { id: 'south', name: 'South', companyId: 'company', status: 'ACTIVE' }];
    const session = { user: { id: 'owner', name: 'Owner', email: 'owner@example.com' }, subscription: { status: 'ACTIVE', planId: 'scale', billingCycle: 'monthly', accessAllowed: true, canManageBilling: true, cancelAtPeriodEnd: false, currentPeriodEnd: null }, memberships: [{ id: 'membership', tenantId: 'tenant', companyId: 'company', companyName: 'Example', role: 'BUSINESS_OWNER', permissions: [], branches }] };
    const user = (id, name, role, branchId, status = 'ACTIVE') => ({ id, name, email: `${id}@example.com`, status, roles: [{ role: { name: role } }], companyAccess: [{ company: { id: 'company' } }], branchAccess: [{ branch: { id: branchId } }] });
    const users = [user('owner', 'Owner', 'BUSINESS_OWNER', 'north'), user('sales', 'Ravi', 'BRANCH_MANAGER', 'north'), user('hr', 'Meera', 'HR_MANAGER', 'south'), user('peer', 'Peer', 'EMPLOYEE', 'north'), user('south-peer', 'South teammate', 'EMPLOYEE', 'south'), user('inactive', 'Inactive manager', 'HR_MANAGER', 'north', 'INACTIVE')];
    const profiles = [
      { id: 'sales-profile', userId: 'sales', companyId: 'company', branchId: 'north', designation: 'Sales Head', department: 'Sales', status: 'ACTIVE' },
      { id: 'peer-profile', userId: 'peer', companyId: 'company', branchId: 'north', department: ' sales ', status: 'ACTIVE' },
      { id: 'hr-profile', userId: 'hr', companyId: 'company', branchId: 'south', department: 'Human Resources', status: 'ACTIVE' },
      { id: 'south-peer-profile', userId: 'south-peer', companyId: 'company', branchId: 'south', department: 'Sales', status: 'ACTIVE' },
      { id: 'other-profile', userId: 'other', companyId: 'other-company', branchId: 'other-branch', department: 'Other company department', status: 'ACTIVE' },
    ];
    const departments = [
      { id: 'sales-department', companyId: 'company', branchId: 'north', name: 'Sales', branch: { id: 'north', name: 'North' } },
      { id: 'hr-department', companyId: 'company', branchId: 'south', name: 'Human Resources', branch: { id: 'south', name: 'South' } },
      { id: 'south-sales-department', companyId: 'company', branchId: 'south', name: 'Sales', branch: { id: 'south', name: 'South' } },
    ];
    await page.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'browser-fixture-token'));
    let failDirectory = true;
    await page.route('**/api/v1/**', route => {
      const url = new URL(route.request().url());
      const pathname = url.pathname;
      const filterBranchId = url.searchParams.get('branchId');
      const normalize = name => name.trim().replace(/\s+/g, ' ').toLowerCase();
      const matches = department => profiles.filter(profile => profile.companyId === department.companyId && normalize(profile.department) === normalize(department.name) && (!filterBranchId || profile.branchId === filterBranchId));
      if (pathname === '/api/v1/workspace/preferences' && route.request().method() !== 'GET') {
        return route.fulfill({ json: { value: route.request().postDataJSON().value } });
      }
      if (pathname === '/api/v1/payroll/salary-breakdown/preview' && route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        const components = body.components ?? [];
        const allowances = components.filter(item => item.kind === 'EARNING').reduce((total, item) => total + Number(item.amount), 0);
        const deductions = components.filter(item => item.kind === 'DEDUCTION').reduce((total, item) => total + Number(item.amount), 0);
        const money = value => value.toFixed(2);
        return route.fulfill({ json: {
          monthlyGross: body.monthlyGross,
          basicAmount: money(Number(body.monthlyGross) - allowances),
          components,
          allowancesTotal: money(allowances),
          deductionsTotal: money(deductions),
          estimatedNet: money(Number(body.monthlyGross) - deductions),
          statutory: [],
          basis: 'Monthly gross',
        } });
      }
      if (route.request().method() === 'POST') {
        assert.equal(pathname, '/api/v1/departments', 'Only the mocked department API may receive writes');
        const body = route.request().postDataJSON();
        assert.equal(body.companyId, 'company');
        const branchId = body.branchId ?? null;
        const saved = { id: `department-${departments.length}`, ...body, branchId, branch: branches.find(branch => branch.id === branchId) ?? null };
        departments.push(saved);
        return route.fulfill({ status: 201, json: saved });
      }
      assert.equal(route.request().method(), 'GET');
      const members = pathname.match(/^\/api\/v1\/departments\/([^/]+)\/employees$/);
      if (members) {
        const department = departments.find(item => item.id === members[1]);
        return route.fulfill({ json: matches(department).map(profile => {
          const person = users.find(person => person.id === profile.userId);
          return { id: profile.userId, name: person.name, email: person.email, employeeCode: 'EMP-' + profile.userId, designation: profile.designation ?? null, status: profile.status, branches: branches.filter(branch => branch.id === profile.branchId) };
        }) });
      }
      if (pathname.endsWith('/employees/reporting-managers') && failDirectory) return route.fulfill({ status: 500, json: { message: 'Could not load reporting managers.' } });
      const data = pathname.endsWith('/auth/me') ? session
        : pathname.endsWith('/employees/reporting-managers') ? users
        : pathname.includes('available') ? branches
        : pathname.endsWith('/employees') ? { items: profiles, pagination: { page: 1, totalPages: 1 } }
        : pathname.endsWith('/departments') ? departments.filter(item => !filterBranchId || !item.branchId || item.branchId === filterBranchId).map(item => ({ ...item,
          employeeCount: matches(item).filter(profile => !item.branchId || profile.branchId === item.branchId).length,
          totalEmployeeCount: matches(item).length,
        }))
        : [];
      return route.fulfill({ json: data });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/admin/departments`);
    const departmentName = page.getByRole('textbox', { name: 'Department name', exact: true });
    await expect(departmentName).toBeEnabled();
    await departmentName.fill('Operations');
    await page.getByRole('button', { name: 'Create department', exact: true }).click();
    await expect(page.getByTestId('app-toast').getByText('Operations created. It is now available when adding employees.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Operations', { exact: true })).toBeVisible();
    const salesAll = page.getByRole('button', { name: /^View employees in Sales, All branches: 3 / });
    await expect(salesAll).toHaveCount(1);
    await salesAll.click();
    const employeeModal = () => page.getByRole('heading', { name: 'Sales employees', exact: true }).locator('..').locator('..');
    await expect(employeeModal().getByText('Ravi', { exact: true })).toBeVisible();
    await expect(employeeModal().getByText('South teammate', { exact: true })).toBeVisible();
    await expect(employeeModal().getByText('Meera', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close department employees', exact: true }).click();
    const branchFilter = page.getByRole('button', { name: 'Filter branch', exact: true });
    await branchFilter.click();
    await page.getByRole('option', { name: 'North', exact: true }).click();
    await page.getByRole('button', { name: /^View employees in Sales, North: 2 / }).click();
    await expect(employeeModal().getByText('Ravi', { exact: true })).toBeVisible();
    await expect(employeeModal().getByText('South teammate', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close department employees', exact: true }).click();
    await branchFilter.click();
    await page.getByRole('option', { name: 'South', exact: true }).click();
    await page.getByRole('button', { name: /^View employees in Sales, South: 1 / }).click();
    await expect(employeeModal().getByText('South teammate', { exact: true })).toBeVisible();
    await expect(employeeModal().getByText('Ravi', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close department employees', exact: true }).click();
    await page.getByRole('button', { name: /^View employees in Operations, South: 0 / }).click();
    await expect(page.getByText('No employees are assigned to this department in this branch.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close department employees', exact: true }).click();
    await branchFilter.click();
    await page.getByRole('option', { name: 'All branches', exact: true }).click();
    await expect(departmentName).toBeEnabled();
    await departmentName.fill('Operations');
    await page.getByRole('button', { name: 'Create department', exact: true }).click();
    await expect(page.getByTestId('app-toast').getByText('This department already exists for the selected scope.', { exact: true })).toBeVisible();
    await departmentName.fill('Research');
    await page.getByRole('button', { name: 'Available in', exact: true }).click();
    await page.getByRole('option', { name: 'North', exact: true }).click();
    await page.getByRole('button', { name: 'Create department', exact: true }).click();
    await expect(page.getByTestId('app-toast').getByText('Research created. It is now available when adding employees.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add an employee', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry loading reporting managers', exact: true })).toBeVisible();
    const dateOfBirth = page.getByRole('button', { name: /Date of birth \(optional\): No date selected/ });
    await dateOfBirth.click();
    await page.getByRole('button', { name: /^Choose year, current / }).click();
    const targetYear = page.getByRole('button', { name: '1992', exact: true });
    for (let pageIndex = 0; pageIndex < 20 && await targetYear.count() === 0; pageIndex++) {
      await page.getByRole('button', { name: 'Previous years', exact: true }).click();
    }
    await expect(targetYear).toBeVisible();
    await targetYear.click();
    const currentMonth = await page.evaluate(() => new Date().toLocaleDateString('en-IN', { month: 'long' }));
    await page.getByRole('button', { name: `1 ${currentMonth} 1992`, exact: true }).click();
    await expect(page.getByRole('button', { name: /Date of birth \(optional\).*1992/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
    const department = page.getByRole('button', { name: 'Department', exact: true });
    await expect(department).toBeEnabled();
    await department.click();
    await expect(page.getByRole('option', { name: 'Sales', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Human Resources', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    failDirectory = false;
    await page.getByRole('button', { name: 'Retry loading reporting managers', exact: true }).click();
    await expect(page.getByText('Loading reporting managers…', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Manage departments', exact: true })).toHaveCount(0);
    await expect(department).toBeEnabled();
    await department.click();
    await expect(page.getByRole('option', { name: /^sales$/i })).toHaveCount(1);
    await expect(page.getByRole('option', { name: 'Other company department', exact: true })).toHaveCount(0);
    await expect(page.getByRole('option', { name: 'Add department…', exact: true })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'New department', exact: true })).toHaveCount(0);
    await page.getByRole('option', { name: /^sales$/i }).click();
    await expect(department).toContainText('Sales');
    await page.getByRole('button', { name: 'Branch *', exact: true }).click();
    await page.getByRole('option', { name: 'North', exact: true }).click();
    await expect(department).toContainText('Sales');
    await department.click();
    await expect(page.getByRole('option', { name: 'Human Resources', exact: true })).toHaveCount(0);
    await expect(page.getByRole('option', { name: 'Operations', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Research', exact: true })).toBeVisible();
    await page.getByRole('option', { name: 'Research', exact: true }).click();
    const manager = page.getByRole('button', { name: 'Reporting manager *', exact: true });
    await expect(manager).toBeEnabled();
    await manager.click();
    await expect(page.getByRole('option', { name: 'Ravi · Sales Head · Sales', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Owner · Business Owner', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: /^Peer ·|^Inactive manager ·|^Meera ·/ })).toHaveCount(0);
    await page.getByRole('option', { name: 'Ravi · Sales Head · Sales', exact: true }).click();
    await expect(manager).toContainText('Ravi · Sales Head · Sales');
    await page.getByRole('button', { name: 'Branch *', exact: true }).click();
    await page.getByRole('option', { name: 'South', exact: true }).click();
    await expect(department).toContainText('Select department');
    await department.click();
    await expect(page.getByRole('option', { name: /^sales$/i })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Research', exact: true })).toHaveCount(0);
    await page.getByRole('option', { name: 'Operations', exact: true }).click();
    await expect(manager).not.toContainText('Ravi');
    await manager.click();
    await expect(page.getByRole('option', { name: 'Ravi · Sales Head · Sales', exact: true })).toHaveCount(0);
    await page.getByRole('option', { name: 'Meera · HR Manager · Human Resources', exact: true }).click();
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: 'Gender (optional)', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Date of birth \(optional\):/ })).toBeVisible();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `Employee profile overflows at ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByLabel('Full name *', { exact: true }).fill('New teammate');
    await page.getByLabel('Work email *', { exact: true }).fill('teammate@example.com');
    await page.getByLabel('Joining date *', { exact: true }).fill('21/10/2026');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByText('Payroll identity', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Bank account number (optional)', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Bank branch (optional)', { exact: true })).toBeVisible();
    await expect(page.getByLabel('IFSC *', { exact: true })).toBeVisible();
    await expect(page.getByLabel('PAN *', { exact: true })).toBeVisible();
    await expect(page.getByLabel('PF UAN *', { exact: true })).toBeVisible();
    await page.getByLabel('IFSC *', { exact: true }).fill('sbin0000001');
    await page.getByLabel('PAN *', { exact: true }).fill('abcde1234f');
    await page.getByLabel('PF UAN *', { exact: true }).fill('123456789012');
    await expect(page.getByLabel('IFSC *', { exact: true })).toHaveValue('SBIN0000001');
    await expect(page.getByLabel('PAN *', { exact: true })).toHaveValue('ABCDE1234F');
    await page.getByRole('checkbox', { name: 'Enable employee login', exact: true }).click();
    await page.getByLabel('Monthly gross salary', { exact: true }).fill('1000');
    await expect(page.getByLabel('House Rent Allowance amount', { exact: true })).toHaveValue('200.00');
    await expect(page.getByLabel('Special Allowance amount', { exact: true })).toHaveValue('300.00');
    await expect(page.getByLabel('Provident Fund (PF) amount', { exact: true })).toHaveValue('60.00');
    await expect(page.getByLabel('Employee State Insurance (ESI) amount', { exact: true })).toHaveValue('7.50');
    await expect(page.getByText('₹932.50', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByText('Meera · HR Manager · Human Resources', { exact: true })).toBeVisible();
    await expect(page.getByText('Review employee', { exact: true }).locator('..').getByText('Operations', { exact: true })).toBeVisible();
    assert.deepEqual(failures, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
