// Run after npm run export:web: node --test tests/branch-selection.browser.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

test('branch filters combine data, show empty branches, stay on the current page and synchronize modules', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer((request, response) => {
    const requested = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!requested.startsWith(root + path.sep) && requested !== root) return response.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const width of [390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const failures = [];
      page.on('pageerror', error => failures.push(error.message));
      const branches = ['North', 'South', 'Empty'].map(name => ({ id: name.toLowerCase(), name, code: name.toUpperCase(), companyId: 'company', status: 'ACTIVE', employees: name === 'North' ? 1 : name === 'South' ? 2 : 0, manager: '', location: '' }));
      const session = { user: { id: 'owner', name: 'Owner', email: 'owner@example.com' }, memberships: [{ id: 'member', tenantId: 'tenant', companyId: 'company', companyName: 'Example', role: 'BUSINESS_OWNER', permissions: [], branches }] };
      const profiles = ['north', 'south', 'south'].map((branchId, i) => ({ id: `profile-${i}`, userId: `person-${i}`, companyId: 'company', branchId, employeeCode: `EMP-${i}`, status: 'ACTIVE', department: 'Sales', designation: 'Associate', joiningDate: '2026-01-01', createdAt: '2026-01-01T00:00:00Z', notes: null, branch: branches.find(branch => branch.id === branchId), user: { id: `person-${i}`, name: `Person ${i}`, email: `person${i}@example.com`, status: 'ACTIVE' } }));
      const customers = branches.slice(0, 2).map(branch => ({ id: `customer-${branch.id}`, companyId: 'company', branchId: branch.id, name: `Customer ${branch.name}`, status: 'ACTIVE', email: null, phone: null, address: null, notes: null }));
      const deals = branches.slice(0, 2).map(branch => ({ id: `deal-${branch.id}`, companyId: 'company', branchId: branch.id, title: `Deal ${branch.name}`, stage: 'DISCOVERY', amount: '1000', currency: 'INR', customerId: null, ownerId: 'owner' }));
      const quotes = deals.map(deal => ({ id: `quote-${deal.branchId}`, companyId: 'company', branchId: deal.branchId, dealId: deal.id, title: `Quote ${deal.branchId}`, status: 'DRAFT', version: 1, currency: 'INR', total: '1000', items: [], notes: null }));
      const today = new Date().toISOString().slice(0, 10);
      const shifts = ['north', 'south'].map(branchId => ({ id: branchId, companyId: 'company', branchId, userId: 'owner', attendanceDate: `${today}T00:00:00Z`, status: 'PRESENT', checkInAt: `${today}T04:00:00Z`, checkOutAt: branchId === 'south' ? `${today}T12:00:00Z` : null, createdAt: `${today}T04:00:00Z` }));
      const corrections = shifts.map(shift => ({ id: shift.id, companyId: shift.companyId, branchId: shift.branchId, attendanceId: shift.id, requestedCheckInAt: shift.checkInAt, requestedCheckOutAt: `${today}T12:00:00Z`, status: 'PENDING', reason: `${shift.branchId} correction`, createdAt: shift.createdAt, reviewedAt: null, reviewNote: null }));
      const leaveType = { id: 'leave-type', companyId: 'company', code: 'ANNUAL', name: 'Annual leave', status: 'ACTIVE', isPaid: true, annualAllowance: 20 };
      const leaveRequests = ['north', 'south'].map(branchId => ({ id: branchId, companyId: 'company', branchId, userId: 'owner', leaveTypeId: leaveType.id, leaveType, startDate: `${today}T00:00:00Z`, endDate: `${today}T00:00:00Z`, days: 1, status: 'PENDING', reason: `${branchId} personal leave`, createdAt: `${today}T04:00:00Z` }));
      await page.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'fixture-token'));
      await page.route('**/api/v1/**', route => {
        assert.equal(route.request().method(), 'GET', 'filter tests must not write business data');
        const url = new URL(route.request().url());
        const pathname = url.pathname;
        const selected = url.searchParams.get('branchId');
        const filter = rows => rows.filter(row => !selected || row.branchId === selected);
        const data = pathname.endsWith('/auth/me') ? session
          : pathname.endsWith('/branches/available') || pathname.endsWith('/branches') ? branches
          : pathname.endsWith('/employees') ? { items: filter(profiles), pagination: { page: 1, totalPages: 1, total: filter(profiles).length } }
          : pathname.endsWith('/customers') ? { data: filter(customers), pagination: { page: 1, totalPages: 1 } }
          : pathname.endsWith('/deals') ? filter(deals)
          : pathname.endsWith('/quotes') ? filter(quotes)
          : pathname.endsWith('/attendance/my-history') ? { data: shifts, pagination: { page: 1, totalPages: 1 } }
          : pathname.endsWith('/attendance/corrections/my') ? corrections
          : pathname.endsWith('/leave/types') ? [leaveType]
          : pathname.endsWith('/leave/requests/my') ? { data: filter(leaveRequests), pagination: { page: 1, totalPages: 1 } }
          : pathname.endsWith('/leave/balances/my') ? [{ id: 'balance', companyId: 'company', userId: 'owner', leaveTypeId: leaveType.id, year: Number(today.slice(0, 4)), allocatedDays: 10, usedDays: 2, remainingDays: 8 }]
          : url.searchParams.has('page') ? { data: [], pagination: { page: 1, totalPages: 1 } } : [];
        return route.fulfill({ json: data });
      });
      const chooseHeader = async name => {
        await page.getByRole('button', { name: 'Choose branch', exact: true }).first().click();
        await page.getByRole('button', { name: name === 'All branches' ? 'Select all branches' : `Select branch ${name}`, exact: true }).click();
      };
      await page.goto(`${base}/admin/employees/active-employees`);
      const total = page.getByTestId('employee-summary-all');
      await expect(total).toHaveAccessibleName('Total employees: 3');
      await chooseHeader('South');
      await expect(total).toHaveAccessibleName('Total employees: 2');
      assert.ok(page.url().endsWith('/admin/employees/active-employees'), 'header changes keep the current screen');
      await expect(page.getByRole('button', { name: 'View Person 0', exact: true })).toHaveCount(0);
      await chooseHeader('Empty');
      await expect(total).toHaveAccessibleName('Total employees: 0');
      await chooseHeader('All branches');
      await expect(total).toHaveAccessibleName('Total employees: 3');
      await page.getByRole('button', { name: 'Choose branch', exact: true }).last().click();
      await expect(page.getByRole('dialog').getByText('Empty', { exact: true })).toBeVisible();
      await page.getByRole('dialog').getByText('South', { exact: true }).click();
      await expect(total).toHaveAccessibleName('Total employees: 2');
      await expect(page.getByRole('button', { name: 'Choose branch', exact: true }).first()).toContainText('South');
      await chooseHeader('All branches');
      await page.goto(`${base}/admin/crm/customers-live?branch=North`);
      await expect(page.getByText('Customer North', { exact: true })).toBeVisible();
      await expect(page.getByText('Customer South', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Filter customer branch', exact: true }).click();
      await page.getByRole('button', { name: 'North', exact: true }).click();
      await expect(page.getByText('Customer South', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Choose branch', exact: true }).first()).toContainText('North');
      await chooseHeader('All branches');
      await chooseHeader('South');
      await expect(page.getByText('Customer South', { exact: true })).toBeVisible();
      await expect(page.getByText('Customer North', { exact: true })).toHaveCount(0);
      await chooseHeader('All branches');
      await expect(page.getByText('Customer North', { exact: true })).toBeVisible();
      await page.goto(`${base}/admin/crm/quotes-live`);
      await expect(page.getByText('Quote north · DRAFT', { exact: true })).toBeVisible();
      await expect(page.getByText('Quote south · DRAFT', { exact: true })).toBeVisible();
      await chooseHeader('North');
      await expect(page.getByText('Quote north · DRAFT', { exact: true })).toBeVisible();
      await expect(page.getByText('Quote south · DRAFT', { exact: true })).toHaveCount(0);
      await page.goto(`${base}/admin/branches`);
      await expect(page.getByRole('button', { name: 'Edit North branch details', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Edit South branch details', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Change branch', exact: true }).click();
      await page.getByRole('dialog').getByText('All branches', { exact: true }).click();
      await expect(page.getByRole('button', { name: 'Edit South branch details', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Edit Empty branch details', exact: true })).toBeVisible();
      await page.goto(`${base}/admin/attendance`);
      const chooseAttendance = async name => {
        await page.getByRole('button', { name: 'Choose branch', exact: true }).last().click();
        await page.getByRole('button', { name: `Attendance branch: ${name}`, exact: true }).click();
      };
      await expect(page.getByTestId('my-attendance-record-north')).toBeVisible();
      await expect(page.getByTestId('my-attendance-record-south')).toBeVisible();
      await expect(page.getByTestId('my-attendance-today-north')).toBeVisible();
      await expect(page.getByTestId('my-attendance-today-south')).toBeVisible();
      await expect(page.getByTestId('my-attendance-correction-north')).toBeVisible();
      await expect(page.getByTestId('my-attendance-correction-south')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Check in', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Check out', exact: true })).toHaveCount(0);
      await chooseAttendance('North');
      await expect(page.getByTestId('my-attendance-record-south')).toHaveCount(0);
      await expect(page.getByTestId('my-attendance-correction-south')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Check out', exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Choose branch', exact: true }).first()).toContainText('North');
      await chooseHeader('South');
      await expect(page.getByTestId('my-attendance-record-south')).toBeVisible();
      await expect(page.getByTestId('my-attendance-record-north')).toHaveCount(0);
      await chooseAttendance('Empty');
      await expect(page.getByTestId('my-attendance-record-north')).toHaveCount(0);
      await expect(page.getByTestId('my-attendance-record-south')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Check in', exact: true })).toBeEnabled();
      await chooseAttendance('All branches');
      await expect(page.getByTestId('my-attendance-record-south')).toBeVisible();
      await page.goto(`${base}/admin/attendance?view=leave`);
      await expect(page.getByTestId('personal-leave-request-north')).toBeVisible();
      await expect(page.getByTestId('personal-leave-request-south')).toBeVisible();
      await expect(page.getByText('8 days', { exact: true })).toHaveCount(1);
      await expect(page.getByRole('button', { name: '+ Apply', exact: true })).toBeDisabled();
      await expect(page.getByText('Pending: 2 days', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Personal leave branch: South', exact: true }).click();
      await expect(page.getByTestId('personal-leave-request-north')).toHaveCount(0);
      await expect(page.getByTestId('personal-leave-request-south')).toBeVisible();
      await expect(page.getByRole('button', { name: '+ Apply', exact: true })).toBeEnabled();
      await expect(page.getByText('Pending: 1 days', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Choose branch', exact: true }).first()).toContainText('South');
      await page.getByRole('button', { name: 'Personal leave branch: All branches', exact: true }).click();
      await expect(page.getByTestId('personal-leave-request-north')).toBeVisible();
      await expect(page.getByTestId('personal-leave-request-south')).toBeVisible();
      await expect(page.getByText('8 days', { exact: true })).toHaveCount(1);
      assert.deepEqual(failures, []);
      await context.close();
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
