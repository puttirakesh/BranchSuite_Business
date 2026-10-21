// Run after npm run export:web: node --test tests/manual-validation.browser.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

test('signup validates typing, paste, blur and confirmation in the browser', { timeout: 60000 }, async () => {
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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    let submissions = 0;
    await page.route('**/api/v1/auth/signup', route => { submissions++; return route.abort(); });
    await page.goto(`http://127.0.0.1:${server.address().port}/auth/signup`);
    const phone = page.getByLabel('Mobile number', { exact: true });
    await phone.fill('98abc');
    await expect(phone).toHaveValue('');
    await expect(page.getByText('Use digits only.', { exact: true })).toBeVisible();
    await phone.fill('9876543210');
    await expect(phone).toHaveValue('9876543210');
    const email = page.getByLabel('Work email', { exact: true });
    await email.fill('first..last@example.com');
    await email.blur();
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Enter a valid email address, such as name@company.com.', { exact: true })).toBeVisible();
    await email.fill('first.last+tag@example.com');
    await email.blur();
    await expect(email).toHaveAttribute('aria-invalid', 'false');
    await page.getByLabel('Business name', { exact: true }).fill('Example business');
    await page.getByLabel('Branch name', { exact: true }).fill('Main branch');
    await page.getByLabel('Owner / Admin name', { exact: true }).fill('Example owner');
    await page.getByLabel('Password', { exact: true }).fill('valid-password');
    const confirm = page.getByLabel('Confirm password', { exact: true });
    await confirm.fill('different-password');
    await confirm.blur();
    await expect(page.getByText('The values do not match.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Create Business Account', exact: true }).click();
    await expect(page.getByText('Passwords do not match.', { exact: true })).toBeVisible();
    assert.equal(submissions, 0);
    const fieldSize = await phone.evaluate(input => ({ height: input.parentElement.getBoundingClientRect().height, fontSize: getComputedStyle(input).fontSize }));
    assert.equal(fieldSize.height, 44);
    assert.equal(fieldSize.fontSize, '13px');

    const session = { user: { id: 'owner', name: 'Owner', email: 'owner@example.com' }, memberships: [{ id: 'membership', tenantId: 'tenant', companyId: 'company', companyName: 'Example', role: 'BUSINESS_OWNER', permissions: [], branches: [{ id: 'branch', name: 'Main branch' }] }] };
    const employees = ['ACTIVE', 'ACTIVE', 'INACTIVE'].map((status, index) => ({ id: `profile-${index}`, userId: `user-${index}`, branchId: 'branch', employeeCode: `EMP-${index}`, status, department: 'Sales', designation: 'Sales associate', joiningDate: '2026-01-01', createdAt: '2026-01-01T00:00:00Z', notes: null, branch: { id: 'branch', name: 'Main branch' }, user: { id: `user-${index}`, name: `Employee ${index}`, email: `person${index}@example.com`, status: index === 0 ? 'ACTIVE' : 'INACTIVE' } }));
    await page.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'browser-fixture-token'));
    await page.route('**/api/v1/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      const data = pathname.endsWith('/auth/me') ? session : pathname.includes('available') ? [{ id: 'branch', name: 'Main branch' }] : pathname.endsWith('/employees') ? { items: employees, data: employees, pagination: { page: 1, totalPages: 1 } } : pathname.endsWith('/customers') ? { data: [], pagination: { page: 1, totalPages: 1 } } : [];
      return route.fulfill({ json: data });
    });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [route, title, action] of [['/admin/crm', 'CRM', 'Add lead'], ['/admin/crm/customers-live', 'Customers', 'Add customer'], ['/admin/employees/people', 'People', 'Add Employee'], ['/admin/employees/active-employees', 'Employees', 'Add employee']]) {
        await page.goto(`http://127.0.0.1:${server.address().port}${route}`);
        const heading = page.getByRole('heading', { name: title, exact: true });
        const back = page.getByRole('button', { name: `Go back from ${title}`, exact: true });
        const button = page.getByRole('button', { name: action, exact: true });
        await expect(heading).toBeVisible();
        const topGap = await page.getByTestId('admin-page-content').evaluate(element => parseFloat(getComputedStyle(element).paddingTop));
        assert.equal(topGap, width >= 900 ? 24 : 16, `${title}: shared space below the top header`);
        const titleContainer = heading.locator('..');
        assert.equal((await titleContainer.innerText()).trim(), title, `${title}: no subtitle beneath the page title`);
        const boxes = await Promise.all([back, heading, button].map(locator => locator.boundingBox()));
        const centers = boxes.map(box => box.y + box.height / 2);
        assert.ok(Math.max(...centers) - Math.min(...centers) < 3, `${title}: header aligns at ${width}px`);
        assert.ok(boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x, `${title}: back, heading, action order`);
        assert.ok(boxes[2].x + boxes[2].width <= width, `${title}: action fits viewport`);
        if (route.endsWith('/active-employees')) {
          const listBox = await page.getByTestId('employee-list').boundingBox();
          const headingRow = await heading.locator('..').locator('..').boundingBox();
          assert.ok(headingRow.y - listBox.y >= (width >= 900 ? 24 : 16), `Employees: heading has its own list padding at ${width}px`);
          const summary = page.getByTestId('employee-summary');
          await expect(page.getByTestId('employee-summary-all')).toHaveAccessibleName('Total employees: 3');
          await expect(page.getByTestId('employee-summary-active')).toHaveAccessibleName('Active employees: 2');
          await expect(page.getByTestId('employee-summary-login')).toHaveAccessibleName('Login enabled: 1');
          const summaryBox = await summary.boundingBox();
          const metricBoxes = await Promise.all(['all', 'active', 'login'].map(id => page.getByTestId(`employee-summary-${id}`).boundingBox()));
          if (width < 768) {
            assert.ok(metricBoxes.every(box => Math.abs(box.y - metricBoxes[0].y) < 1), `Employee overview stays in one mobile row at ${width}px`);
            assert.ok(metricBoxes.every(box => Math.abs(box.width - metricBoxes[0].width) < 1), 'Employee overview cards have equal widths');
          }
          for (const id of ['all', 'active', 'login']) {
            const metricBox = await page.getByTestId(`employee-summary-${id}`).boundingBox();
            assert.ok(metricBox.x >= summaryBox.x && metricBox.x + metricBox.width <= summaryBox.x + summaryBox.width + 1, `Summary metric fits at ${width}px`);
          }
          await page.getByTestId('employee-summary-all').click();
          await expect(page.getByRole('tab', { name: 'All', exact: true })).toHaveAttribute('aria-selected', 'true');
          await expect(page.getByTestId('employee-summary-all')).toHaveAttribute('aria-pressed', 'true');
          await page.getByTestId('employee-summary-login').click();
          await expect(page.getByRole('tab', { name: 'Login enabled', exact: true })).toHaveAttribute('aria-selected', 'true');
          await expect(page.getByRole('button', { name: 'View Employee 0', exact: true })).toBeVisible();
          await expect(page.getByRole('button', { name: 'View Employee 1', exact: true })).toHaveCount(0);
          if (width === 320 || width === 390 || width === 1440) {
            const audit = path.join(root, 'audit');
            fs.mkdirSync(audit, { recursive: true });
            await summary.screenshot({ path: path.join(audit, `employee-summary-${width}.png`) });
          }
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`http://127.0.0.1:${server.address().port}/admin/dashboard`);
    await expect(page.getByRole('button', { name: 'Open CRM', exact: true })).toBeVisible();
    for (const description of ['Leads, deals and customers', 'Salary runs and employee payments', 'Employees, attendance and leave', 'Business reports and insights']) {
      await expect(page.getByText(description, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('Your team, customers, attendance and daily priorities at a glance.', { exact: true })).toHaveCount(0);
    await page.goto(`http://127.0.0.1:${server.address().port}/admin/more`);
    await expect(page.getByRole('heading', { name: 'More', exact: true })).toBeVisible();
    await expect(page.getByText(/^one branch, every module$/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch business', exact: true }).getByText('BUSINESS WORKSPACE', { exact: true })).toBeVisible();
    await page.goto(`http://127.0.0.1:${server.address().port}/admin/billing`);
    await expect(page.getByRole('heading', { name: 'Billing & invoices', exact: true })).toBeVisible();
    const dueDate = page.getByRole('button', { name: /^Due date \(optional\):/ });
    await dueDate.click();
    await expect(page.getByRole('button', { name: 'Previous month', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Set due date (optional) to today', exact: true }).click();
    await expect(dueDate).not.toHaveAccessibleName(/No date selected/);
    await dueDate.click();
    await page.getByRole('button', { name: 'Clear date', exact: true }).click();
    await expect(dueDate).toHaveAccessibleName(/No date selected/);
    const statusFilter = page.getByRole('button', { name: 'Invoice status', exact: true });
    await statusFilter.click();
    await page.getByRole('button', { name: 'Paid', exact: true }).click();
    await expect(statusFilter).toContainText('Paid');
    await expect(statusFilter).toHaveAttribute('aria-expanded', 'false');
    let invoiceBody;
    await page.route('**/api/v1/billing/invoices', route => {
      if (route.request().method() !== 'POST') return route.fallback();
      invoiceBody = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { id: 'invoice', invoiceNumber: 'TEST-001', ...invoiceBody, currency: 'INR', status: 'ISSUED', issuedAt: new Date().toISOString(), dueAt: invoiceBody.dueDate + 'T00:00:00Z' } });
    });
    await page.getByLabel('Invoice description', { exact: true }).fill('Browser validation invoice');
    const invoiceAmount = page.getByLabel('Invoice amount', { exact: true });
    await invoiceAmount.fill('12x');
    await expect(invoiceAmount).toHaveValue('');
    await invoiceAmount.fill('123.45');
    await dueDate.click();
    await page.getByRole('button', { name: 'Set due date (optional) to today', exact: true }).click();
    const expectedDate = await page.evaluate(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });
    await page.getByRole('button', { name: 'Issue invoice', exact: true }).click();
    await expect.poll(() => invoiceBody).toBeTruthy();
    assert.equal(invoiceBody.amount, '123.45');
    assert.equal(invoiceBody.dueDate, expectedDate);
    assert.deepEqual(failures, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
