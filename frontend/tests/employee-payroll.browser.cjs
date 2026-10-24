// Run after npm run export:web: node --test tests/employee-payroll.browser.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

test('employee payroll: history, payment details, PDF, refresh, empty and error recovery', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer((req, res) => {
    const requested = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!requested.startsWith(root + path.sep) && requested !== root) return res.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    res.setHeader('Content-Type', ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
      const page = await context.newPage();
      const failures = [];
      page.on('pageerror', error => failures.push(error.message));
      const user = { id: 'person', name: 'Payroll Person', email: 'pay@example.com' };
      const branch = { id: 'branch', companyId: 'company', name: 'Main', status: 'ACTIVE' };
      const profile = { id: 'profile', userId: user.id, companyId: 'company', branchId: 'branch', employeeCode: 'EMP-1', department: 'Sales', designation: 'Sales Executive', status: 'ACTIVE', user, branch, company: { id: 'company', name: 'Example Ltd' }, joiningDate: '2020-01-01' };
      const session = { user, memberships: [{ id: 'member', tenantId: 'tenant', companyId: 'company', companyName: 'Example Ltd', role: 'EMPLOYEE', permissions: [], branches: [branch] }] };
      const entry = {
        identitySnapshot: { name: 'Payroll Person', employeeId: 'EMP-1', company: 'Example Ltd', branch: 'Main', department: 'Sales', designation: 'Sales Executive', legacy: false },
        id: 'latest', currency: 'INR', basicAmount: '1000', grossAmount: '1200', deductionsAmount: '100', netAmount: '1100',
        components: [{ id: 'basic', name: 'Basic Salary', kind: 'EARNING', amount: '1000' }, { id: 'bonus', name: 'Sales incentive', kind: 'EARNING', amount: '200' }, { id: 'tax', name: 'Tax', kind: 'DEDUCTION', amount: '100' }],
        run: { status: 'APPROVED', period: { year: 2026, month: 10 } },
        payment: { paidAt: '2026-10-05T09:00:00Z', method: 'BANK_TRANSFER', reference: 'REF-123' },
      };
      const older = { ...entry, id: 'older', payment: null, run: { status: 'APPROVED', period: { year: 2025, month: 12 } } };
      let records = [older, entry], mode = 'ok';
      await context.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'fixture-token'));
      await context.addInitScript(() => {
        window.__payrollPrintCalls = 0;
        window.print = () => { window.__payrollPrintCalls++; };
      });
      await page.route('**/api/v1/**', route => {
        const url = new URL(route.request().url()), endpoint = url.pathname;
        if (endpoint.endsWith('/payroll/my-payslips')) {
          if (mode === 'error') return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
          if (mode === 'malformed') return route.fulfill({ json: [{ ...entry, netAmount: true }] });
          return route.fulfill({ json: records });
        }
        const data = endpoint.endsWith('/auth/me') ? session : endpoint.endsWith('/employees/me') ? [profile] : endpoint.includes('branches') ? [branch] : url.searchParams.has('page') ? { items: [], data: [], pagination: { page: 1, totalPages: 1 } } : [];
        return route.fulfill({ json: data });
      });
      await page.goto(`${process.env.PAYROLL_DEV_URL || `http://127.0.0.1:${server.address().port}`}/employee/payslips`);
      const picker = page.getByRole('button', { name: /^Choose payroll month/ });
      await expect(picker).toContainText('October 2026');
      await expect(page.getByText('Paid', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'View payslip details', exact: true }).click();
      const preview = page.getByTestId('employee-payslip-preview');
      await expect(preview.getByText(/Payslip reference:|Computer-generated payslip/)).toHaveCount(0);
      for (const text of ['Example Ltd', 'Payroll Person', 'EMP-1', 'Sales Executive', 'Earnings', 'Deductions', 'Basic Salary', 'NET TAKE-HOME PAY', 'Rupees One Thousand One Hundred Only', 'Payment details', 'BANK TRANSFER', 'REF-123']) {
        await expect(preview.getByText(text, { exact: true })).toHaveCount(1);
      }
      await expect(preview.getByText('Basic Salary', { exact: true })).toBeVisible();
      await expect.poll(async () => {
        const button = await page.getByRole('button', { name: 'Download payslip', exact: true }).boundingBox();
        return !!button && button.y >= 0 && button.y + button.height <= 900;
      }).toBe(true);
      const bounds = await preview.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, 'Preview fits the viewport');
      if (process.env.PAYROLL_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.PAYROLL_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.PAYROLL_SCREENSHOT_DIR, `employee-preview-${width}.png`) });
      }
      // Download must work without fetching a deferred jsPDF module.
      await page.route(/\/jspdf\.es-.*\.js/, route => route.abort());
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download payslip', exact: true }).click();
      const download = await downloadPromise;
      assert.equal(download.suggestedFilename(), 'Payslip_2026_10.pdf');
      const pdf = fs.readFileSync(await download.path(), 'latin1');
      assert.ok(pdf.startsWith('%PDF-'));
      for (const text of ['Payroll Person', 'EMP-1', 'REF-123', 'NET TAKE-HOME PAY', 'INR 1,100.00', 'Rupees One Thousand One Hundred Only', 'Sales Executive']) assert.ok(pdf.includes(text), text);
      await page.getByRole('button', { name: 'Close payslip details', exact: true }).click();
      const secondDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download payslip PDF', exact: true }).click();
      assert.equal((await secondDownload).suggestedFilename(), 'Payslip_2026_10.pdf');
      assert.equal(await page.evaluate(() => window.__payrollPrintCalls), 0, 'Payslip download must never print the dashboard');
      records = [...records, { ...entry, id: 'other-company-slip', identitySnapshot: { name: 'Payroll Person', company: 'Other Company', employeeId: 'OTHER-7', designation: 'Historical job title', legacy: false } }];
      await page.getByRole('button', { name: 'Refresh payslips', exact: true }).click();
      await page.getByRole('button', { name: /^Other Company -/ }).click();
      await page.getByRole('button', { name: 'View payslip details', exact: true }).click();
      await expect(preview.getByText('Other Company', { exact: true })).toBeVisible();
      await expect(preview.getByText('OTHER-7', { exact: true })).toHaveCount(1);
      await expect(preview.getByText('Historical job title', { exact: true })).toHaveCount(1);
      const otherDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download payslip', exact: true }).click();
      assert.ok(fs.readFileSync(await (await otherDownload).path(), 'latin1').includes('OTHER-7'));
      await page.getByRole('button', { name: 'Close payslip details', exact: true }).click();
      records = [older, entry];
      await page.getByRole('button', { name: 'Refresh payslips', exact: true }).click();
      await expect(picker).toContainText('October 2026');
      await picker.click();
      await expect(page.getByRole('button', { name: 'Next year', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Previous year', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Previous year', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Jan', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Dec', exact: true }).click();
      await expect(picker).toContainText('December 2025');
      await expect(page.getByText('Approved - awaiting payment', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Refresh payslips', exact: true }).click();
      await expect(picker).toContainText('December 2025');
      mode = 'error';
      await page.getByRole('button', { name: 'Refresh payslips', exact: true }).click();
      await expect(page.getByText('Payslips unavailable', { exact: true })).toBeVisible();
      mode = 'ok'; records = [];
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await expect(page.getByText('No payslips available yet', { exact: true })).toBeVisible();
      mode = 'malformed';
      await page.getByRole('button', { name: 'Refresh payslips', exact: true }).click();
      await expect(page.getByText('Payslips unavailable', { exact: true })).toBeVisible();
      mode = 'ok'; records = [entry];
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await expect(picker).toContainText('October 2026');
      session.memberships[0].role = 'BUSINESS_OWNER';
      await page.goto(`${process.env.PAYROLL_DEV_URL || `http://127.0.0.1:${server.address().port}`}/admin/payslips`);
      await expect(page.getByRole('heading', { name: 'My Payroll', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'View payslip details', exact: true }).click();
      await expect(page.getByTestId('employee-payslip-preview').getByText('EMP-1', { exact: true })).toHaveCount(1);
      assert.deepEqual(failures, []);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
