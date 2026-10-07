import { test, expect, type Page } from '@playwright/test';

async function employeeApi(page: Page, options: { unavailable?: boolean; empty?: boolean; noBranch?: boolean; failAttendance?: boolean } = {}) {
  const session = { user: { id: 'e1', name: 'Rizwana Shaik', email: 'rizwana@company.example' }, memberships: [{ id: 'm1', tenantId: 't1', companyId: 'c1', companyName: '5 Gen Educon', role: 'EMPLOYEE', permissions: [], branches: options.noBranch ? [] : [{ id: 'b1', name: 'Vijayawada' }] }] };
  const dashboard = {
    date: '2026-10-07', profile: { employeeId: 'EMP-001', designation: 'Executive', department: 'Operations', manager: 'Neha Iyer', joinedOn: '2025-04-01' },
    attendance: { status: 'NOT_CHECKED_IN', shift: '09:00 – 18:00', checkedInAt: null as string | null, checkedOutAt: null as string | null },
    leave: { casual: 8, sick: 5, pendingRequests: 1 },
    tasks: options.empty ? [] : [{ id: 'task1', title: 'Follow up with Sunrise Academy', status: 'TODO', dueAt: '2026-10-07T10:00:00Z' }],
    latestPayslip: options.empty ? null : { id: 'pay1', period: 'September 2026', netPay: 28500, currency: 'INR', status: 'PAID' },
  };
  const writes: string[] = [];
  let unavailable = options.unavailable;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    const send = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path === '/auth/login') { expect(request.postDataJSON().portal).toBe('employee'); return send({ accessToken: 'employee-token', session }); }
    if (path === '/auth/me') return send(session);
    if (path === '/auth/logout') return send({});
    expect(request.headers().authorization).toBe('Bearer employee-token');
    expect(request.headers()['x-tenant-id']).toBe('t1'); expect(request.headers()['x-company-id']).toBe('c1'); expect(request.headers()['x-branch-id']).toBe('b1');
    if (path === '/employee/dashboard') return unavailable ? send({}, 503) : send(dashboard);
    if (path.startsWith('/employee/attendance/')) {
      writes.push(path); expect(request.postDataJSON()).toEqual({});
      if (options.failAttendance) return send({}, 503);
      if (path.endsWith('/check-in')) { dashboard.attendance.status = 'CHECKED_IN'; dashboard.attendance.checkedInAt = '2026-10-07T03:30:00Z'; }
      else { dashboard.attendance.status = 'CHECKED_OUT'; dashboard.attendance.checkedOutAt = '2026-10-07T12:30:00Z'; }
      return send({});
    }
    return send({}, 404);
  });
  return { writes, recover: () => { unavailable = false; } };
}
async function signIn(page: Page) {
  await page.goto('/'); await page.getByRole('tab', { name: 'Employee', exact: true }).click();
  await page.getByLabel('Email address', { exact: true }).fill('rizwana@company.example');
  await page.getByLabel('Password', { exact: true }).fill('correct-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
test('employee overview, attendance and section navigation use scoped API data', async ({ page }) => {
  const { writes } = await employeeApi(page); await signIn(page);
  await expect(page.getByText('Hello, Rizwana.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check out', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Check out', exact: true }).click();
  await expect(page.getByText('Your shift is recorded.', { exact: true })).toBeVisible();
  expect(writes).toEqual(['/employee/attendance/check-in', '/employee/attendance/check-out']);
  await page.getByRole('tab', { name: 'Leave & requests', exact: true }).click(); await expect(page.getByText('8 days', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'My profile', exact: true }).click(); await expect(page.getByText('EMP-001', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'My payroll', exact: true }).click(); await expect(page.getByText('September 2026', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'My tasks', exact: true }).click(); await expect(page.getByText('Follow up with Sunrise Academy', { exact: true })).toBeVisible();
  await page.goto('/crm/leads'); await expect(page.getByText('Hello, Rizwana.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(page.getByText('Employee sign in', { exact: true })).toBeVisible();
});
test('unavailable employee data can be retried without invented figures', async ({ page }) => {
  const api = await employeeApi(page, { unavailable: true }); await signIn(page);
  await expect(page.getByText('Employee dashboard unavailable', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check in', exact: true })).toHaveCount(0);
  api.recover(); await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('Hello, Rizwana.', { exact: true })).toBeVisible();
});
test('failed attendance is not shown as recorded', async ({ page }) => {
  await employeeApi(page, { failAttendance: true }); await signIn(page);
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(page.getByText('The server could not complete your request. Try again.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check in', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Check out', exact: true })).toHaveCount(0);
});
test('empty employee dashboard fits phone, landscape, tablet and desktop', async ({ page }) => {
  await employeeApi(page, { empty: true }); await signIn(page);
  await expect(page.getByText("You're all caught up. Assigned tasks will appear here.", { exact: true })).toBeVisible();
  for (const [width, height] of [[320, 568], [844, 390], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('tab', { name: 'My payroll', exact: true }).click();
    await expect(page.getByText('No published payslip yet. Your pay will appear after payroll is published.', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'My work', exact: true }).click();
  }
  await page.screenshot({ path: 'test-results/employee-dashboard-desktop.png', fullPage: true });
});
test('employees without branches get an assignment message', async ({ page }) => {
  await employeeApi(page, { noBranch: true }); await signIn(page);
  await expect(page.getByText('No branch assigned', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check in', exact: true })).toHaveCount(0);
});
