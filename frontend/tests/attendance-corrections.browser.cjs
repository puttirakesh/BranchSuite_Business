// Run after npm run export:web: node --test tests/attendance-corrections.browser.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

test('employee attendance corrections and leave application pages', { timeout: 60000 }, async () => {
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
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const user = { id: 'person', name: 'Test Person', email: 'person@example.com' };
    const branch = { id: 'branch', companyId: 'company', name: 'Main', status: 'ACTIVE' };
    const profile = { id: 'profile', userId: user.id, companyId: 'company', branchId: 'branch', employeeCode: 'EMP-1', status: 'ACTIVE', user, branch, company: { id: 'company', name: 'Example' }, joiningDate: '2026-01-01' };
    const session = { user, memberships: [{ id: 'member', tenantId: 'tenant', companyId: 'company', companyName: 'Example', role: 'EMPLOYEE', permissions: [], branches: [branch] }] };
    const dayKey = (offset) => { const day = new Date(); day.setUTCDate(day.getUTCDate() - offset); return day.toISOString().slice(0, 10); };
    const day = dayKey(1), otherDay = dayKey(2);
    const shift = { id: 'shift', companyId: 'company', branchId: 'branch', userId: user.id, attendanceDate: `${day}T00:00:00Z`, checkInAt: `${day}T03:30:00Z`, checkOutAt: `${day}T11:30:00Z`, status: 'PRESENT', totalMinutes: 480, source: 'SELF' };
    const otherShift = { ...shift, id: 'other-shift', attendanceDate: `${otherDay}T00:00:00Z`, checkInAt: `${otherDay}T04:30:00Z` };
    const selectDate = async key => {
      await page.getByRole('button', { name: /^Attendance date:/ }).click();
      const label = new Date(key + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const dateButton = page.getByRole('button', { name: label, exact: true });
      if (!await dateButton.count()) await page.getByRole('button', { name: 'Previous month', exact: true }).click();
      await dateButton.click();
    };
    let requests = [], submitted = [], fail = false;
    const leaveType = { id: 'annual', companyId: 'company', code: 'AL', name: 'Annual leave', status: 'ACTIVE', annualAllowance: 20, isPaid: true };
    let leaveRequests = [], leaveSubmissions = [], failLeaveCancel = false;
    await page.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'fixture-token'));
    await page.route('**/api/v1/**', async route => {
      const url = new URL(route.request().url()), endpoint = url.pathname, method = route.request().method();
      let data = [];
      if (endpoint.endsWith('/auth/me')) data = session;
      else if (endpoint.endsWith('/employees/me')) data = [profile];
      else if (endpoint.endsWith('/leave/types')) data = [leaveType, { ...leaveType, id: 'sick', code: 'SL', name: 'Sick leave' }, { ...leaveType, id: 'unpaid', code: 'UL', name: 'Unpaid leave', isPaid: false }];
      else if (endpoint.endsWith('/leave/reporting-to')) data = [{ id: 'manager', name: 'Priya Manager', position: 'BRANCH_MANAGER' }];
      else if (endpoint.endsWith('/leave/requests/my')) data = { items: leaveRequests, data: leaveRequests, pagination: { page: 1, totalPages: 1 } };
      else if (endpoint.endsWith('/leave/requests') && method === 'POST') {
        const body = route.request().postDataJSON(); leaveSubmissions.push(body);
        data = { ...body, id: 'leave-request', userId: user.id, days: 1, status: 'PENDING', createdAt: new Date().toISOString(), leaveType, reportingTo: { id: 'manager', name: 'Priya Manager' } };
        leaveRequests = [data];
      }
      else if (endpoint.endsWith('/leave/requests/leave-request/cancel')) {
        if (failLeaveCancel) return route.fulfill({ status: 409, json: { message: 'Unable to cancel this request right now.' } });
        leaveRequests = leaveRequests.map(item => ({ ...item, status: 'CANCELLED' })); data = leaveRequests[0];
      }
      else if (endpoint.endsWith('/attendance/corrections/my')) data = requests;
      else if (endpoint.endsWith('/attendance/corrections') && method === 'POST') {
        if (fail) return route.fulfill({ status: 409, json: { message: 'This shift already has a pending request.' } });
        const body = route.request().postDataJSON(); submitted.push(body);
        data = { ...body, id: 'correction', companyId: 'company', branchId: 'branch', userId: user.id, status: 'PENDING', attendance: shift, createdAt: '2026-01-03T00:00:00Z' };
        requests = [data];
      } else if (endpoint.endsWith('/correction/cancel')) {
        requests = requests.map(item => ({ ...item, status: 'CANCELLED' })); data = requests[0];
      } else if (endpoint.endsWith('/attendance/my-history')) data = { items: [shift, otherShift], data: [shift, otherShift], pagination: { page: 1, totalPages: 1 } };
      else if (endpoint.includes('branches')) data = [branch];
      else if (url.searchParams.has('page')) data = { items: [], data: [], pagination: { page: 1, totalPages: 1 } };
      await route.fulfill({ json: data });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/employee/attendance`);
    const request = page.getByRole('button', { name: 'Request correction', exact: true });
    await expect(request).toBeEnabled();
    await expect(page.getByText('Attendance corrections', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'View attendance', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your Attendance', exact: true })).toBeVisible();
    await expect(page.getByText(/^No attendance recorded for/)).toBeVisible();
    await selectDate(day);
    await expect(page.getByText('9:00 AM', { exact: true })).toBeVisible();
    await expect(page.getByText('5:00 PM', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Go back from Your Attendance', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'My attendance', exact: true })).toBeVisible();
    await request.click();
    await expect(page.getByRole('heading', { name: 'Request Attendance Correction', exact: true })).toBeVisible();
    await expect(page.getByLabel('Correct check-in (IST)', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Attendance/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: /^Attendance date:/ })).toBeEnabled();
    const todayLabel = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
    await expect(page.getByRole('button', { name: /^Attendance date:/ })).toHaveAccessibleName(`Attendance date: ${todayLabel}. Open calendar`);
    await selectDate(dayKey(0));
    await expect(page.getByText('No attendance recorded for this date. Contact your manager to report a missing attendance day.', { exact: true })).toBeVisible();
    await selectDate(otherDay);
    const start = page.getByLabel('Correct check-in (IST)', { exact: true });
    await expect(start).toHaveValue('10:00 AM');
    await selectDate(day);
    await expect(start).toHaveValue('9:00 AM');
    await page.getByRole('button', { name: 'Send for approval', exact: true }).click();
    await expect(page.getByText('Please explain why these times need correcting.', { exact: true })).toBeVisible();
    await page.getByLabel('Reason for correction', { exact: true }).fill('Forgot to check out at the correct time.');
    await start.fill('9:15 AM');
    await page.getByLabel('Correct check-out (IST)', { exact: true }).fill('6:00 PM');
    fail = true;
    await page.getByRole('button', { name: 'Send for approval', exact: true }).click();
    await expect(page.getByText('This shift already has a pending request.', { exact: true })).toBeVisible();
    await expect(start).toHaveValue('9:15 AM');
    fail = false;
    await expect(page.getByRole('button', { name: 'Send for approval', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Send for approval', exact: true }).click();
    await expect(page.getByText('Pending', { exact: true })).toBeVisible();
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].requestedCheckInAt, `${day}T03:45:00.000Z`);
    assert.equal(submitted[0].requestedCheckOutAt, `${day}T12:30:00.000Z`);
    await expect(start).toHaveCount(0);
    const cancel = page.getByRole('button', { name: 'Cancel request', exact: true });
    await expect(cancel).toBeEnabled(); await cancel.click();
    await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(start).toBeVisible();
    requests = requests.map(item => ({ ...item, status: 'APPROVED', reviewNote: 'Times verified.' }));
    await page.getByRole('button', { name: 'Refresh attendance and correction requests', exact: true }).click();
    await expect(page.getByText('Approved', { exact: true })).toBeVisible();
    await expect(page.getByText('Review note: Times verified.', { exact: true })).toBeVisible();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      for (const control of [start, page.getByLabel('Correct check-out (IST)', { exact: true }), page.getByRole('button', { name: 'Send for approval', exact: true })]) {
        const box = await control.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
      }
      if (width === 390) await page.screenshot({ path: require('node:os').tmpdir() + '/attendance-correction-page.png' });
    }
    await page.getByRole('button', { name: 'Go back from Request Attendance Correction', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'My attendance', exact: true })).toBeVisible();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const buttons = [page.getByRole('button', { name: 'View attendance', exact: true }), request];
      for (const button of buttons) {
        const box = await button.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
        assert.ok(box.height >= 44, 'Attendance buttons keep a usable touch target');
        const textFits = await button.evaluate(element => {
          const text = element.lastElementChild;
          return text.scrollHeight <= 20;
        });
        assert.ok(textFits, 'Attendance action labels fit on one line');
      }
      if (width === 390) await page.screenshot({ path: require('node:os').tmpdir() + '/attendance-main-refined.png' });
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByRole('button', { name: /Apply for leave/ }).click();
    await expect(page).toHaveURL(/\/employee\/leave\/apply/);
    await expect(page.getByRole('heading', { name: 'Apply for leave', exact: true })).toBeVisible();
    await expect(page.getByText('Actual leave eligibility', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Attendance/ })).toBeVisible();
    await page.getByRole('button', { name: 'Go back from Apply for leave', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'My attendance', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Apply for leave/ }).click();
    const reason = page.getByLabel('Reason', { exact: true });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      for (const control of [reason, page.getByRole('button', { name: /^Leave start date:/ }), page.getByRole('button', { name: /^Leave end date:/ }), page.getByRole('button', { name: 'Submit Request', exact: true })]) {
        const box = await control.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
      }
    }
    await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
    assert.equal(leaveSubmissions.length, 0);
    await expect(page.getByText('Select a reporting manager.', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Reporting to', exact: true }).click();
    await page.getByRole('button', { name: 'Priya Manager · Branch Manager', exact: true }).click();
    await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
    await expect(page.getByText('Enter a leave reason of up to 2000 characters.', { exact: true }).first()).toBeVisible();
    await reason.fill('Personal appointment.');
    await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'My leave', exact: true })).toBeVisible();
    assert.equal(leaveSubmissions.length, 1);
    assert.equal(leaveSubmissions[0].leaveTypeId, 'annual');
    assert.equal(leaveSubmissions[0].reportingToId, 'manager');
    await expect(page.getByText('Personal appointment.', { exact: true })).toBeVisible();
    await expect(page.getByText('Reporting to: Priya Manager', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Approved leave requests', exact: true }).click();
    await expect(page.getByText('No approved requests', { exact: true })).toBeVisible();
    await expect(page.getByText('Personal appointment.', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Pending leave requests', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pending leave requests', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Personal appointment.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel Annual leave request', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Cancel leave request?', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Keep request', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Cancel leave request?', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel Annual leave request', exact: true }).click();
    failLeaveCancel = true;
    await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
    await expect(page.getByText('Unable to cancel this request right now.', { exact: true })).toBeVisible();
    failLeaveCancel = false;
    await expect(page.getByRole('button', { name: 'Confirm cancellation', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
    await expect(page.getByText('No pending requests', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelled leave requests', exact: true }).click();
    await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel Annual leave request', exact: true })).toHaveCount(0);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      for (const control of [page.getByRole('heading', { name: 'My leave', exact: true }), page.getByRole('button', { name: 'Apply for leave', exact: true }), page.getByRole('button', { name: 'Refresh leave requests', exact: true }), page.getByRole('heading', { name: 'Leave balances', exact: true }).locator('..')]) {
        const box = await control.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
      }
      if (width === 390) await page.screenshot({ path: require('node:os').tmpdir() + '/employee-my-leave-refined.png' });
    }
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
