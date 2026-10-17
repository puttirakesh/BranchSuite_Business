require('dotenv/config');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcrypt');
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma/prisma.service');

// Opt in explicitly: fixtures use a separate tenant and are removed after the run.
test('application workflows against PostgreSQL', { skip: process.env.RUN_APP_INTEGRATION !== '1' && process.env.npm_lifecycle_event !== 'test:integration', timeout: 600000 }, async t => {
  const app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  const prisma = app.get(PrismaService);
  const tenantId = randomUUID();
  const password = `Test-${randomUUID()}`;
  const leaveDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const leaveYear = Number(leaveDate.slice(0, 4));
  let owner, manager, employee, company, otherCompany, branch, secondBranch, otherBranch;
  const tokens = {};
  const request = async (method, path, body, role = 'owner', expected = method === 'POST' ? 201 : 200) => {
    const result = await app.inject({ method, url: `/api/v1${path}`, headers: tokens[role] ? { authorization: `Bearer ${tokens[role]}` } : {}, ...(body === undefined ? {} : { payload: body }) });
    assert.equal(result.statusCode, expected, `${role} ${method} ${path}: ${result.body}`);
    return result.json();
  };
  t.after(async () => {
    try {
      await prisma.quoteItem.deleteMany({ where: { quote: { tenantId } } });
      await prisma.quote.deleteMany({ where: { tenantId } });
      await prisma.dealStageHistory.deleteMany({ where: { tenantId } });
      await prisma.deal.deleteMany({ where: { tenantId } });
      await prisma.auditEvent.deleteMany({ where: { tenantId } });
      await prisma.payrollPayment.deleteMany({ where: { entry: { run: { tenantId } } } });
      await prisma.employeeProfile.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    } finally { await app.close(); }
  });
  await prisma.tenant.create({ data: { id: tenantId, name: `Integration ${tenantId}` } });
  await prisma.businessSubscription.create({ data: { tenantId, planId: 'starter', billingCycle: 'monthly' } });
  company = await prisma.company.create({ data: { tenantId, name: 'Test company' } });
  otherCompany = await prisma.company.create({ data: { tenantId, name: 'Other test company' } });
  branch = await prisma.branch.create({ data: { companyId: company.id, name: 'Test North', code: 'TEST_N' } });
  secondBranch = await prisma.branch.create({ data: { companyId: company.id, name: 'Test South', code: 'TEST_S' } });
  otherBranch = await prisma.branch.create({ data: { companyId: otherCompany.id, name: 'Test Other', code: 'TEST_O' } });
  const createUser = async role => {
    const configuredRole = await prisma.role.findUniqueOrThrow({ where: { name: role } });
    return prisma.user.create({ data: {
      tenantId, name: role, email: `${role.toLowerCase()}-${tenantId}@example.invalid`, password: await bcrypt.hash(password, 4),
      roles: { create: { roleId: configuredRole.id } }, companyAccess: { create: { companyId: company.id } },
      branchAccess: { create: [{ branchId: branch.id }, ...(role === 'EMPLOYEE' ? [] : [{ branchId: secondBranch.id }])] },
    } });
  };
  owner = await createUser('BUSINESS_OWNER'); manager = await createUser('BRANCH_MANAGER'); employee = await createUser('EMPLOYEE');
  const approver = await createUser('BUSINESS_ADMIN');
  const hr = await createUser('HR_MANAGER');
  const payroll = await createUser('PAYROLL_MANAGER');
  const employeeProfile = await prisma.employeeProfile.create({ data: { tenantId, companyId: company.id, branchId: branch.id, userId: employee.id, employeeCode: 'TEST01', joiningDate: new Date('2026-01-01') } });
  for (const [role, user] of Object.entries({ owner, manager, employee, approver, hr, payroll })) {
    const result = await request('POST', '/auth/login', { email: user.email, password, portal: role === 'employee' ? 'employee' : 'staff' }, role);
    tokens[role] = result.accessToken;
  }

  await t.test('all module list endpoints authenticate and return valid responses', async () => {
    for (const path of [
      '/auth/me', `/branches/available?companyId=${company.id}`, `/branches?companyId=${company.id}`,
      `/employees?companyId=${company.id}`, `/leads?companyId=${company.id}`, `/customers?companyId=${company.id}`,
      `/activities?companyId=${company.id}`, `/deals?companyId=${company.id}`, `/deals/owners?companyId=${company.id}`,
      `/quotes?companyId=${company.id}`, `/tasks?companyId=${company.id}`, `/attendance?companyId=${company.id}`,
      `/attendance/corrections?companyId=${company.id}`, `/leave/types?companyId=${company.id}`, `/leave/requests?companyId=${company.id}`,
      `/leave/balances?companyId=${company.id}&branchId=${branch.id}&userId=${employee.id}`, `/payroll/policies?companyId=${company.id}`,
      `/payroll/employee-salaries?companyId=${company.id}&branchId=${branch.id}`, `/payroll/periods?companyId=${company.id}&branchId=${branch.id}`,
      `/advances?companyId=${company.id}&branchId=${branch.id}`, `/audit?companyId=${company.id}`, '/subscriptions/current',
    ]) await request('GET', path);
  });

  await t.test('HR and payroll roles can use their assigned modules without receiving business-wide access', async () => {
    for (const role of ['hr', 'payroll']) {
      const directory = await request('GET', `/employees?companyId=${company.id}`, undefined, role); assert.equal(directory.items.length, 1);
      await request('GET', `/employees/${employeeProfile.id}`, undefined, role);
      const outside = await request('GET', `/employees?companyId=${otherCompany.id}`, undefined, role); assert.equal(outside.items.length, 0);
      await request('GET', `/leads?companyId=${company.id}`, undefined, role, 403);
      await request('GET', '/subscriptions/current', undefined, role, 403);
    }
    await request('GET', `/leave/requests?companyId=${company.id}`, undefined, 'hr');
    await request('GET', `/attendance?companyId=${company.id}`, undefined, 'hr');
    await request('GET', `/payroll/employee-salaries?companyId=${company.id}&branchId=${branch.id}`, undefined, 'payroll');
    await request('GET', `/payroll/employee-salaries?companyId=${otherCompany.id}&branchId=${otherBranch.id}`, undefined, 'payroll', 403);
    await request('GET', `/payroll/employee-salaries?companyId=${company.id}&branchId=${branch.id}`, undefined, 'hr', 403);
    await request('GET', `/advances?companyId=${company.id}&branchId=${branch.id}`, undefined, 'payroll');
  });

  let lead, customer, deal, quote;
  await t.test('the new lead form saves lead, opportunity and follow-up as one operation', async () => {
    const created = await request('POST', '/leads', { companyId: company.id, branchId: branch.id, name: 'Atomic lead test', stage: 'QUALIFIED', estimatedValue: '5000', followUpAt: new Date().toISOString(), opportunity: { title: 'Atomic opportunity', amount: '5000' } });
    assert.equal(created.stage, 'QUALIFIED');
    const opportunity = await prisma.deal.findFirstOrThrow({ where: { leadId: created.id, tenantId } }); assert.equal(Number(opportunity.amount), 5000);
    assert.equal(await prisma.crmActivity.count({ where: { leadId: created.id, type: 'FOLLOW_UP', status: 'PENDING' } }), 1);
    await prisma.deal.delete({ where: { id: opportunity.id } });
    await prisma.crmActivity.deleteMany({ where: { leadId: created.id, tenantId } });
    await prisma.lead.delete({ where: { id: created.id } });
  });
  await t.test('lead metadata, multiple assignees, stages and customer conversion persist', async () => {
    await request('POST', '/leads', { companyId: company.id, branchId: branch.id, name: '   ' }, 'owner', 400);
    await request('POST', '/customers', { companyId: company.id, branchId: branch.id, name: '   ' }, 'owner', 400);
    lead = await request('POST', '/leads', { companyId: company.id, branchId: branch.id, name: 'Integration lead', contactPerson: 'Contact person', source: 'Referral', estimatedValue: '1250.50', assignedEmployeeIds: [employee.id, owner.id] });
    assert.equal(lead.contactPerson, 'Contact person'); assert.equal(String(lead.estimatedValue), '1250.5');
    assert.deepEqual(lead.assignedEmployeeIds, [employee.id, owner.id]); assert.equal(lead.assignedToId, employee.id);
    await request('PATCH', `/leads/${lead.id}`, { name: null }, 'owner', 400);
    await request('PATCH', `/leads/${lead.id}`, { assignedEmployeeIds: [owner.id], estimatedValue: '2000' });
    await request('PATCH', `/leads/${lead.id}/stage`, { stage: 'NEGOTIATION' });
    const converted = await request('POST', `/leads/${lead.id}/convert`, {}); customer = converted.customer;
    const repeated = await request('POST', `/leads/${lead.id}/convert`, {}); assert.equal(repeated.customer.id, customer.id);
    const read = await request('GET', `/leads/${lead.id}`); assert.equal(read.stage, 'WON'); assert.equal(read.convertedCustomerId, customer.id);
    await request('PATCH', `/leads/${lead.id}`, { name: 'Locked' }, 'owner', 409);
    await request('PATCH', `/customers/${customer.id}`, { name: 'Updated customer', notes: 'Persistent notes' });
    await request('PATCH', `/customers/${customer.id}/status`, { status: 'INACTIVE' });
    assert.equal((await request('PATCH', `/customers/${customer.id}/status`, { status: 'ACTIVE' })).status, 'ACTIVE');
  });

  await t.test('manager company and branch filters do not broaden to other assigned scopes', async () => {
    const south = await request('POST', '/customers', { companyId: company.id, branchId: secondBranch.id, name: 'South customer' });
    await request('POST', '/customers', { companyId: otherCompany.id, branchId: otherBranch.id, name: 'Other company customer' });
    const selected = await request('GET', `/customers?companyId=${company.id}&branchId=${secondBranch.id}`, undefined, 'manager');
    assert.deepEqual(selected.data.map(row => row.id), [south.id]);
    const other = await request('GET', `/customers?companyId=${otherCompany.id}`, undefined, 'manager'); assert.equal(other.data.length, 0);
    const activity = await request('POST', '/activities', { companyId: company.id, branchId: secondBranch.id, customerId: south.id, title: 'South follow-up', type: 'FOLLOW_UP', scheduledAt: new Date().toISOString() });
    const selectedActivities = await request('GET', `/activities?companyId=${company.id}&branchId=${secondBranch.id}`, undefined, 'manager');
    assert.deepEqual(selectedActivities.data.map(row => row.id), [activity.id]);
    await request('PATCH', `/activities/${activity.id}/cancel`);
    await request('PATCH', `/activities/${activity.id}/complete`, undefined, 'owner', 409);
  });

  await t.test('deals, quotations, optimistic locking and stage history work together', async () => {
    await request('POST', '/deals', { companyId: company.id, branchId: branch.id, title: '   ' }, 'owner', 400);
    deal = await request('POST', '/deals', { companyId: company.id, branchId: branch.id, leadId: lead.id, customerId: customer.id, title: 'Test opportunity', amount: '2000', ownerId: owner.id });
    await request('PATCH', `/deals/${deal.id}`, { ownerId: null }, 'owner', 400);
    // A branch manager can edit an accessible deal without reassigning its owner.
    await request('PATCH', `/deals/${deal.id}`, { title: 'Manager update', amount: null, customerId: null }, 'manager');
    let current = await request('GET', `/deals/${deal.id}`); assert.equal(current.amount, null); assert.equal(current.customerId, null);
    await request('PATCH', `/deals/${deal.id}`, { amount: '2000', customerId: customer.id });
    quote = await request('POST', '/quotes', { dealId: deal.id, title: 'Test quotation', notes: 'Keep these notes', items: [{ description: 'Service', quantity: 3, unitPrice: '12.50' }] });
    assert.equal(Number(quote.total), 37.5);
    assert.equal((await request('GET', `/quotes?companyId=${company.id}`)).length, 1);
    quote = await request('PATCH', `/quotes/${quote.id}`, { expectedVersion: 1, title: 'Updated quotation', notes: quote.notes, items: [{ description: 'Service', quantity: 4, unitPrice: '12.50' }] });
    assert.equal(Number(quote.total), 50); assert.equal(quote.notes, 'Keep these notes');
    await request('PATCH', `/quotes/${quote.id}`, { expectedVersion: 1, title: 'Stale update', items: [{ description: 'Service', quantity: 1, unitPrice: '1' }] }, 'owner', 409);
    quote = await request('POST', `/quotes/${quote.id}/status`, { status: 'SENT', expectedVersion: 2 });
    await request('POST', `/quotes/${quote.id}/status`, { status: 'ACCEPTED', expectedVersion: quote.version });
    for (const stage of ['QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON']) await request('POST', `/deals/${deal.id}/transition`, { stage });
    const history = await request('GET', `/deals/${deal.id}/history`); assert.equal(history.length, 4);
    await request('PATCH', `/deals/${deal.id}`, { title: 'Closed' }, 'owner', 409);
    const audit = await request('GET', `/audit?companyId=${company.id}`); assert.ok(audit.items.length > 0);
    const dashboard = await app.inject({ method: 'GET', url: '/api/v1/dashboard', headers: { authorization: `Bearer ${tokens.owner}`, 'x-tenant-id': tenantId, 'x-company-id': company.id, 'x-branch-id': branch.id } });
    assert.equal(dashboard.statusCode, 200, dashboard.body); assert.equal(dashboard.json().leads, 1); assert.equal(dashboard.json().pipelineValue, 0);
  });

  await t.test('employee task and attendance workflows persist across roles', async () => {
    const task = await request('POST', '/tasks', { companyId: company.id, branchId: branch.id, assignedToId: employee.id, title: 'Employee test task', priority: 'HIGH' });
    assert.ok((await request('GET', '/tasks/my', undefined, 'employee')).some(row => row.id === task.id));
    await request('PATCH', `/tasks/${task.id}/status`, { status: 'IN_PROGRESS' }, 'employee');
    await request('POST', `/tasks/${task.id}/comments`, { message: 'Working on it' }, 'employee');
    await request('PATCH', `/tasks/${task.id}/status`, { status: 'COMPLETED' }, 'employee');
    const profile = await request('GET', '/employees/me', undefined, 'employee'); assert.equal(profile[0].branchId, branch.id);
    await request('POST', '/attendance/check-in', { companyId: company.id, branchId: branch.id }, 'employee');
    await request('POST', '/attendance/check-out', { companyId: company.id, branchId: branch.id }, 'employee');
    const attendance = await request('GET', '/attendance/my-history', undefined, 'employee');
    assert.equal(attendance.data.length, 1); assert.ok(attendance.data[0].checkOutAt);
  });

  await t.test('leave requests, balances and advances connect employees with administrators', async () => {
    const type = await request('POST', '/leave/types', { companyId: company.id, code: 'TEST_CL', name: 'Test leave', annualAllowance: 12, isPaid: true }, 'hr');
    await request('POST', '/leave/balances/allocate', { companyId: company.id, branchId: branch.id, userId: employee.id, leaveTypeId: type.id, year: leaveYear, allocatedDays: 12 }, 'hr');
    const leave = await request('POST', '/leave/requests', { companyId: company.id, branchId: branch.id, leaveTypeId: type.id, startDate: leaveDate, endDate: leaveDate, reason: 'Test leave request' }, 'employee');
    await request('PATCH', `/leave/requests/${leave.id}/approve`, { note: 'Approved for test' }, 'hr');
    const balances = await request('GET', `/leave/balances/my?companyId=${company.id}&branchId=${branch.id}&year=${leaveYear}`, undefined, 'employee');
    assert.ok(balances.some(balance => Number(balance.usedDays) === 1));
    const advance = await request('POST', '/advances', { companyId: company.id, branchId: branch.id, amount: '1000', reason: 'Test advance request' }, 'employee');
    await request('PATCH', `/advances/${advance.id}/approve`, { note: 'Approved for test' }, 'payroll');
    const mine = await request('GET', '/advances/my', undefined, 'employee'); assert.ok(mine.some(record => record.id === advance.id && record.status === 'APPROVED'));
  });

  await t.test('salary assignment, payroll approval, payment and employee payslips integrate', async () => {
    const structure = await request('POST', '/payroll/salary-structures', { companyId: company.id, name: 'Test monthly salary', basicAmount: '30000', components: [{ code: 'DEDUCT', name: 'Test deduction', kind: 'DEDUCTION', amount: '1000' }] }, 'payroll');
    await request('POST', '/payroll/employee-salaries', { companyId: company.id, branchId: branch.id, userId: employee.id, structureId: structure.id, effectiveFrom: '2026-01-01' });
    const period = await request('POST', '/payroll/periods', { companyId: company.id, branchId: branch.id, year: 2026, month: 9 });
    const run = await request('POST', `/payroll/periods/${period.id}/calculate`, {});
    assert.equal(run.entries.length, 1); assert.equal(Number(run.entries[0].netAmount), 29000);
    await request('POST', `/payroll/runs/${run.id}/approve`, {}, 'owner', 403);
    await request('POST', `/payroll/runs/${run.id}/approve`, {}, 'approver');
    await request('POST', `/payroll/runs/${run.id}/publish`, {});
    await request('POST', `/payroll/entries/${run.entries[0].id}/pay`, { method: 'BANK_TRANSFER', reference: 'TEST-PAYMENT' });
    const payslips = await request('GET', '/payroll/my-payslips', undefined, 'employee');
    assert.ok(payslips.some(entry => entry.id === run.entries[0].id && Number(entry.netAmount) === 29000));
  });

  if (process.env.RUN_BROWSER_AUDIT === '1') await t.test('all screens render without runtime errors or horizontal overflow', { timeout: 480000 }, async () => {
    const fs = require('node:fs/promises');
    const path = require('node:path');
    const root = path.resolve(__dirname, '../../frontend/dist');
    const server = require('node:http').createServer(async (incoming, outgoing) => {
      try {
        const requested = path.resolve(root, '.' + new URL(incoming.url, 'http://localhost').pathname);
        if (requested !== root && !requested.startsWith(root + path.sep)) { outgoing.writeHead(403).end(); return; }
        let file = requested;
        try { if (!(await fs.stat(file)).isFile()) file = path.join(root, 'index.html'); } catch { file = path.join(root, 'index.html'); }
        const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' };
        const content = await fs.readFile(file);
        outgoing.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' }); outgoing.end(content);
      } catch { if (!outgoing.headersSent) outgoing.writeHead(500); outgoing.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const { chromium } = require('../../frontend/node_modules/@playwright/test');
    const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    try {
      const errors = [];
      const output = path.join(root, 'audit'); await fs.mkdir(output, { recursive: true });
      const routes = {
        owner: ['/admin/dashboard', '/admin/crm', '/admin/crm/leads', '/admin/crm/lead-form', `/admin/crm/lead/${lead.id}`, '/admin/crm/deals-live', `/admin/crm/deals/${deal.id}`, '/admin/crm/quotes-live', `/admin/crm/quotes/${quote.id}`, '/admin/crm/customers-live', '/admin/crm/activities', '/admin/employees', '/admin/employees/people', '/admin/employees/create', '/admin/attendance', '/admin/attendance/team', '/admin/attendance/corrections', '/admin/leave-management', '/admin/approvals', '/admin/tasks', '/admin/tasks/follow-ups', '/admin/payroll', '/admin/salary', '/admin/reports', '/admin/branches', '/admin/roles-permissions', '/admin/activity-audit', '/admin/profile', '/admin/workspace-settings', '/admin/more'],
        employee: ['/employee/dashboard', '/employee/attendance', '/employee/leave', '/employee/tasks', '/employee/payslips', '/employee/advances', '/employee/profile', '/employee/documents', '/employee/help'],
        hr: ['/admin/dashboard', '/admin/employees', '/admin/attendance/team', '/admin/leave-management', '/admin/approvals', '/admin/reports'],
        payroll: ['/admin/dashboard', '/admin/employees', '/admin/payroll', '/admin/advances', '/admin/reports'],
      };
      routes.owner.push('/admin/payslips', '/admin/advances', '/admin/billing', '/admin/subscription', '/admin/platform-support', '/admin/profile/documents');
      routes.owner.push(`/admin/employees/${employeeProfile.id}`, `/admin/employees/${employeeProfile.id}/edit`);
      if (process.env.BROWSER_AUDIT_FOCUS === '1') {
        routes.owner = ['/admin/dashboard', '/admin/crm', '/admin/crm/lead-form', '/admin/crm/deals-live', '/admin/crm/quotes-live', '/admin/crm/customers-live', '/admin/employees', `/admin/employees/${employeeProfile.id}`, `/admin/employees/${employeeProfile.id}/edit`, '/admin/reports', '/admin/subscription'];
        routes.employee = ['/employee/dashboard', '/employee/attendance', '/employee/leave', '/employee/payslips', '/employee/help'];
      }
      const leaveOnly = process.env.BROWSER_LEAVE_ONLY === '1';
      if (leaveOnly) routes.owner = ['/admin/attendance'];
      for (const role of leaveOnly ? ['owner'] : ['owner', 'employee', 'hr', 'payroll']) {
        const context = await browser.newContext();
        await context.addInitScript(token => sessionStorage.setItem('branchsuite_access_token', token), tokens[role]);
        await context.route('**/api/v1/**', async route => {
          const incoming = route.request();
          const url = new URL(incoming.url());
          const headers = incoming.headers(); delete headers.host; delete headers['content-length'];
          const result = await app.inject({ method: incoming.method(), url: url.pathname + url.search, headers, payload: incoming.postData() ?? undefined });
          if (result.statusCode >= 400) errors.push(`${role}: ${incoming.method()} ${url.pathname}: ${result.statusCode} ${result.body.slice(0, 160)}`);
          await route.fulfill({ status: result.statusCode, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: result.body });
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(`${role}: ${error.message}`));
        if (leaveOnly) {
          for (const [index, width] of [390, 1440].entries()) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(`${origin}/admin/attendance`, { waitUntil: 'networkidle' });
            await page.getByRole('button', { name: 'Choose branch', exact: true }).filter({ hasText: 'Selected branch' }).click();
            await page.getByText('Test South', { exact: true }).click();
            await page.getByRole('button', { name: 'Apply leave', exact: true }).click();
            await page.getByRole('button', { name: 'Submit leave request', exact: true }).waitFor({ state: 'visible' });
            assert.equal(new URL(page.url()).searchParams.get('branchId'), secondBranch.id);
            const date = new Date(Date.now() + (20 + index) * 86400000).toISOString().slice(0, 10);
            await page.getByLabel('Start date', { exact: true }).fill(date);
            await page.getByLabel('End date', { exact: true }).fill(date);
            const reason = `Attendance leave regression ${width}`;
            await page.getByLabel('Reason for leave', { exact: true }).fill(reason);
            const saved = page.waitForResponse(response => response.url().includes('/leave/requests') && response.request().method() === 'POST');
            await page.getByRole('button', { name: 'Submit leave request', exact: true }).click();
            assert.equal((await saved).status(), 201);
            await page.getByText('Leave request submitted successfully.', { exact: false }).waitFor({ state: 'visible' });
            const created = await prisma.leaveRequest.findFirstOrThrow({ where: { tenantId, userId: owner.id, reason } });
            assert.equal(created.branchId, secondBranch.id);
            assert.equal(created.status, 'PENDING');
            process.stdout.write(`Attendance Apply leave: ${width}px form and submission checked\n`);
          }
          // A supplementary balance failure must not disable an otherwise valid application.
          await context.route('**/api/v1/leave/balances/my?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Balance temporarily unavailable' }) }));
          await page.goto(`${origin}/admin/attendance?view=leave&apply=1&branchId=${secondBranch.id}`, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: 'Submit leave request', exact: true }).waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Close', exact: true }).click();
          await page.getByRole('button', { name: '+ Apply', exact: true }).click();
          await page.getByRole('button', { name: 'Submit leave request', exact: true }).waitFor({ state: 'visible' });
          await context.unroute('**/api/v1/leave/balances/my?**');
          await context.route('**/api/v1/leave/types?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Leave service temporarily unavailable' }) }));
          await page.goto(`${origin}/admin/attendance?view=leave&apply=1`, { waitUntil: 'networkidle' });
          await page.getByText('Leave types: Leave service temporarily unavailable', { exact: true }).waitFor({ state: 'visible' });
          assert.equal(await page.getByRole('button', { name: 'Set up leave types', exact: true }).count(), 0);
          await context.unroute('**/api/v1/leave/types?**');

          // A genuinely unconfigured company can set its own policy and return to apply.
          const setupCompany = await prisma.company.create({ data: { tenantId, name: 'Leave setup company' } });
          const setupBranch = await prisma.branch.create({ data: { companyId: setupCompany.id, name: 'Setup branch', code: 'SETUP' } });
          await prisma.userCompanyAccess.create({ data: { userId: owner.id, companyId: setupCompany.id } });
          await prisma.userBranchAccess.create({ data: { userId: owner.id, branchId: setupBranch.id } });
          await page.evaluate(selection => sessionStorage.setItem('branchsuite_admin_workspace_selection', JSON.stringify(selection)), { companyId: setupCompany.id, branchId: setupBranch.id });
          await page.setViewportSize({ width: 390, height: 844 });
          await page.goto(`${origin}/admin/attendance?view=leave&apply=1&branchId=${setupBranch.id}`, { waitUntil: 'networkidle' });
          await page.getByText('Set up leave before applying', { exact: true }).waitFor({ state: 'visible' });
          assert.equal(await page.getByRole('button', { name: '+ Apply', exact: true }).isDisabled(), true);
          await page.getByRole('button', { name: 'Set up leave types', exact: true }).click();
          await page.getByLabel('Leave code', { exact: true }).fill('UI_POLICY');
          await page.getByLabel('Leave name', { exact: true }).fill('UI setup leave');
          await page.getByLabel('Annual allowance', { exact: true }).fill('0');
          await page.getByRole('switch', { name: 'Paid leave', exact: true }).click();
          const configured = page.waitForResponse(response => response.url().includes('/leave/types') && response.request().method() === 'POST');
          await page.getByRole('button', { name: 'Create leave type', exact: true }).click();
          assert.equal((await configured).status(), 201);
          const policy = await prisma.leaveType.findUniqueOrThrow({ where: { companyId_code: { companyId: setupCompany.id, code: 'UI_POLICY' } } });
          assert.equal(policy.isPaid, false);
          assert.equal(policy.annualAllowance, 0);
          await page.getByRole('button', { name: 'Continue to leave application', exact: true }).click();
          await page.getByRole('button', { name: 'Submit leave request', exact: true }).waitFor({ state: 'visible' });
          assert.equal(new URL(page.url()).searchParams.get('branchId'), setupBranch.id);
          const setupDate = new Date(Date.now() + 24 * 86400000).toISOString().slice(0, 10);
          await page.getByLabel('Start date', { exact: true }).fill(setupDate);
          await page.getByLabel('End date', { exact: true }).fill(setupDate);
          await page.getByLabel('Reason for leave', { exact: true }).fill('New company policy application');
          const setupSaved = page.waitForResponse(response => response.url().includes('/leave/requests') && response.request().method() === 'POST');
          await page.getByRole('button', { name: 'Submit leave request', exact: true }).click();
          assert.equal((await setupSaved).status(), 201);
          await page.getByText('Leave request submitted successfully.', { exact: false }).waitFor({ state: 'visible' });
          const setupLeave = await prisma.leaveRequest.findFirstOrThrow({ where: { tenantId, companyId: setupCompany.id, reason: 'New company policy application' } });
          assert.equal(setupLeave.leaveTypeId, policy.id);
          assert.equal(setupLeave.branchId, setupBranch.id);
          process.stdout.write('Empty company: configure leave type, return to application and submit checked\n');
          await context.close();
          continue;
        }
        for (const width of process.env.BROWSER_AUDIT_FOCUS === '1' ? [390, 1440] : role === 'owner' || role === 'employee' ? [320, 390, 768, 1024, 1440] : [390, 1440]) {
          await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
          for (const path of routes[role]) {
            await page.goto(`${origin}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
            const result = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, text: document.body.innerText }));
            if (result.scroll > result.width + 2) errors.push(`${width}px ${path}: document overflows by ${result.scroll - result.width}px`);
            if (/Unmatched Route|Uncaught Error|Something went wrong/.test(result.text)) errors.push(`${width}px ${path}: error screen`);
            if (path === '/admin/crm' && [320, 390, 1440].includes(width) || path === '/employee/dashboard' && width === 390) await page.screenshot({ path: require('node:path').join(output, `${role}-${width}.png`), fullPage: true });
          }
          process.stdout.write(`Browser audit: ${role}, ${width}px checked\n`);
        }
        if (role === 'owner') {
          await page.setViewportSize({ width: 390, height: 844 });
          await page.goto(`${origin}/admin/crm/lead-form`, { waitUntil: 'networkidle' });
          await page.getByLabel('Organisation *', { exact: true }).fill('Browser created lead');
          await page.getByLabel('Contact person *', { exact: true }).fill('Browser contact');
          await page.getByLabel('Email *', { exact: true }).fill('browser@example.invalid');
          await page.getByLabel('Phone *', { exact: true }).fill('9876543210');
          await page.getByLabel(/Estimated value/).fill('5000');
          await page.getByRole('button', { name: 'Create lead', exact: true }).click();
          await page.waitForURL(/\/admin\/crm\/deals-live/, { timeout: 15000 });
          assert.ok((await prisma.lead.findMany({ where: { tenantId, name: 'Browser created lead' } })).length === 1);
          await page.getByText('Browser created lead', { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
        }
        await context.close();
      }
      assert.deepEqual([...new Set(errors)], []);
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  });
});
