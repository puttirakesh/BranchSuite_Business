// Run after npm run export:web: node --test tests/payroll-workflow.browser.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

test('one payroll action follows independent approval and persisted branch publication', { timeout: 60000 }, async () => {
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
    for (const width of [390, 1440]) {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
      const year = Number(parts.find(part => part.type === 'year').value);
      const month = Number(parts.find(part => part.type === 'month').value);
      const period = `${year}-${String(month).padStart(2, '0')}`;
      const previous = new Date(Date.UTC(year, month - 2, 1));
      const previousKey = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
      const branches = ['North', 'South'].map(name => ({ id: name.toLowerCase(), companyId: 'company', name, status: 'ACTIVE' }));
      const profiles = branches.map(branch => ({
        id: `profile-${branch.id}`, userId: `person-${branch.id}`, companyId: 'company', branchId: branch.id,
        employeeCode: `EMP-${branch.id}`, status: 'ACTIVE', joiningDate: '2020-01-01', createdAt: '2020-01-01T00:00:00Z',
        branch, user: { id: `person-${branch.id}`, name: `Employee ${branch.name}`, email: `${branch.id}@example.com` },
      }));
      const periods = [{
        id: 'previous-north', branchId: 'north', year: previous.getUTCFullYear(), month: previous.getUTCMonth() + 1,
        updatedAt: new Date().toISOString(), run: null,
      }];
      const mutations = [];
      let failPublication = false;
      const serialize = (value, actor) => ({
        ...value,
        run: value.run ? { ...value.run, canApprove: value.run.status === 'CALCULATED' && value.run.createdById !== actor } : null,
      });
      const runDetails = value => ({
        ...value.run, period: value,
        entries: [{
          id: `entry-${value.branchId}`, userId: `person-${value.branchId}`, basicAmount: '1000', grossAmount: '1000',
          deductionsAmount: '0', netAmount: '1000', components: [], payment: null,
          user: profiles.find(profile => profile.branchId === value.branchId).user,
        }],
      });
      const failures = [];
      const contexts = [];
      const openAdmin = async actor => {
        const context = await browser.newContext({ viewport: { width, height: 1000 } });
        contexts.push(context);
        await context.addInitScript(() => {
          sessionStorage.setItem('branchsuite_access_token', 'fixture-token');
          sessionStorage.setItem('branchsuite_admin_workspace_selection', JSON.stringify({ companyId: 'company', branchId: 'north' }));
        });
        const page = await context.newPage();
        page.on('pageerror', error => failures.push(error.message));
        await page.route('**/api/v1/**', async route => {
          const url = new URL(route.request().url());
          const pathname = url.pathname;
          const method = route.request().method();
          const branchId = url.searchParams.get('branchId');
          const json = data => route.fulfill({ json: data });
          const reject = (status, message) => route.fulfill({ status, json: { message } });
          if (method === 'POST') {
            mutations.push({ pathname, actor });
            if (pathname.endsWith('/payroll/periods')) {
              const data = route.request().postDataJSON();
              const value = { ...data, id: `period-${data.branchId}`, updatedAt: new Date().toISOString(), run: null };
              periods.push(value);
              return json(value);
            }
            if (pathname.endsWith('/calculate')) {
              const value = periods.find(item => pathname.includes(`/${item.id}/`));
              if (value.run) return reject(409, 'Already calculated');
              value.run = { id: `run-${value.branchId}`, status: 'CALCULATED', createdById: actor, publishedAt: null, grossTotal: '1000', netTotal: '1000' };
              return json(runDetails(value));
            }
            const value = periods.find(item => item.run && pathname.includes(`/${item.run.id}/`));
            if (value && pathname.endsWith('/approve')) {
              if (value.run.createdById === actor) return reject(403, 'Cannot approve own payroll');
              assert.equal(value.run.status, 'CALCULATED');
              value.run.status = 'APPROVED';
              return json(runDetails(value));
            }
            if (value && pathname.endsWith('/publish')) {
              assert.ok(['APPROVED', 'PAID'].includes(value.run.status));
              if (failPublication) return reject(503, 'Publication unavailable; retry.');
              value.run.publishedAt = new Date().toISOString();
              return json(runDetails(value));
            }
            return reject(400, `Unexpected mutation: ${pathname}`);
          }
          if (pathname.endsWith('/auth/me')) return json({
            user: { id: actor, name: actor, email: `${actor}@example.com` },
            memberships: [{ id: actor, tenantId: 'tenant', companyId: 'company', companyName: 'Example', role: actor === 'second-admin' ? 'COMPANY_MANAGER' : 'BUSINESS_ADMIN', permissions: [], branches }],
          });
          if (pathname.endsWith('/branches/available') || pathname.endsWith('/branches')) return json(branches);
          if (pathname.endsWith('/employees')) return json({ items: profiles, pagination: { page: 1, totalPages: 1 } });
          if (pathname.endsWith('/payroll/periods')) return json(periods.filter(item => item.branchId === branchId).map(item => serialize(item, actor)));
          if (pathname.endsWith('/payroll/employee-salaries')) return json(profiles.filter(profile => profile.branchId === branchId).map(profile => ({
            id: `salary-${branchId}`, userId: profile.userId, branchId, user: profile.user, effectiveFrom: '2020-01-01', effectiveTo: null,
            basicOverride: null, structure: { id: 'structure', basicAmount: '1000', components: [] },
          })));
          const value = periods.find(item => item.run && pathname.endsWith(`/payroll/runs/${item.run.id}`));
          if (value) return json(runDetails(value));
          return json(url.searchParams.has('page') ? { items: [], data: [], pagination: { page: 1, totalPages: 1 } } : []);
        });
        await page.goto(`${base}/admin/payroll?period=${period}`);
        return page;
      };
      const action = page => page.getByTestId('payroll-action');
      const expectAction = async (page, label, enabled = true) => {
        await expect(action(page)).toHaveCount(1);
        await expect(action(page)).toHaveAccessibleName(label);
        if (enabled) await expect(action(page)).toBeEnabled();
        else await expect(action(page)).toBeDisabled();
      };
      const maker = await openAdmin('first-admin');
      await expectAction(maker, 'Calculate Payroll');
      await action(maker).click();
      await expectAction(maker, 'Awaiting Approval', false);
      assert.deepEqual(mutations.map(item => item.pathname.split('/').pop()), ['periods', 'calculate']);
      await maker.reload();
      await expectAction(maker, 'Awaiting Approval', false);

      const checker = await openAdmin('second-admin');
      await expectAction(checker, 'Verify & Approve Payroll');
      await checker.goto(`${base}/admin/payroll?view=review&period=${period}`);
      await expectAction(checker, 'Verify & Approve Payroll');
      await action(checker).click();
      await expectAction(checker, 'Awaiting Payslip Publication', false);
      await maker.reload();
      await expectAction(maker, 'Publish Approved Payslips');
      assert.equal(mutations.filter(item => item.pathname.endsWith('/approve')).length, 1);
      assert.equal(mutations.filter(item => item.pathname.endsWith('/publish')).length, 0, 'approval does not automatically publish');
      await checker.goto(`${base}/admin/payroll?period=${period}`);
      await expectAction(checker, 'Awaiting Payslip Publication', false);
      failPublication = true;
      await action(maker).click();
      await expect(maker.getByText('The server could not complete your request. Please try again.', { exact: true }).first()).toBeVisible();
      await expectAction(maker, 'Publish Approved Payslips');
      failPublication = false;
      await action(maker).click();
      await checker.reload();
      await expectAction(checker, 'Published Payslips for North', false);
      await checker.reload();
      await expectAction(checker, 'Published Payslips for North', false);
      await maker.reload();
      await expectAction(maker, 'Published Payslips for North', false);
      await checker.goto(`${base}/admin/payroll?view=review&period=${period}`);
      await expectAction(checker, 'Published Payslips for North', false);
      await checker.goto(`${base}/admin/payroll?period=${period}`);
      await expectAction(checker, 'Published Payslips for North', false);
      await checker.getByRole('button', { name: 'Choose branch', exact: true }).first().click();
      await checker.getByRole('button', { name: 'Select branch South', exact: true }).click();
      await expectAction(checker, 'Awaiting Payroll Preparation', false);
      await checker.getByRole('button', { name: 'Choose branch', exact: true }).first().click();
      await checker.getByRole('button', { name: 'Select branch North', exact: true }).click();
      await expectAction(checker, 'Published Payslips for North', false);
      await checker.goto(`${base}/admin/payroll?period=${previousKey}`);
      await expectAction(checker, 'Awaiting Payroll Preparation', false);
      assert.equal(mutations.filter(item => item.pathname.endsWith('/calculate')).length, 1);
      assert.equal(mutations.filter(item => item.pathname.endsWith('/publish')).length, 2, 'one failed attempt and one successful publication');
      assert.deepEqual(failures, []);
      for (const context of contexts) await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
