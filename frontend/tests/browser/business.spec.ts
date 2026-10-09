import { test, expect, type Page } from '@playwright/test';
import type { CrmRecord, EntityKind } from '../../src/types';

async function mockApi(page: Page, readOnly = false) {
  const kinds: EntityKind[] = ['leads', 'contacts', 'customers', 'deals', 'quotes'];
  const permissions = ['dashboard:read', ...kinds.flatMap((kind) => (readOnly ? ['read'] : ['read', 'create', 'update', 'delete']).map((action) => `${kind}:${action}`))];
  const session = { user: { id: 'u1', name: 'Alex Sales', email: 'alex@example.com' }, memberships: [{ id: 'm1', tenantId: 't1', companyId: 'c1', companyName: 'Acme', role: 'SALES', permissions, branches: [{ id: 'b1', name: 'Main' }, { id: 'b2', name: 'South' }] }] };
  const records: Record<string, CrmRecord[]> = { customers: [{ id: 'customer-1', name: 'Acme Customer', status: 'ACTIVE', createdAt: '2026-10-07T08:00:00Z' }] };
  let sequence = 0;
  const writes: { kind: string; body: Record<string, unknown>; branch: string }[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const resource = url.pathname.replace('/api/v1', '');
    const method = request.method(); const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' };
    const send = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (resource === '/auth/login') {
      if (request.postDataJSON().password !== 'correct-password') return send({}, 401);
      return send({ accessToken: 'test-token', session });
    }
    if (resource === '/auth/me') return send(session);
    if (resource === '/auth/logout') return send({});
    expect(request.headers().authorization).toBe('Bearer test-token');
    expect(request.headers()['x-tenant-id']).toBe('t1'); expect(request.headers()['x-company-id']).toBe('c1');
    const branch = request.headers()['x-branch-id']; expect(['b1', 'b2']).toContain(branch);
    if (resource === '/dashboard') return send({ leads: branch === 'b1' ? 7 : 2, customers: 1, openDeals: 0, pipelineValue: 0, quotesAwaitingResponse: 0, currency: 'INR', recentActivity: [] });
    const [, , kind, id] = resource.split('/');
    const bucket = branch === 'b1' ? kind : `${branch}:${kind}`;
    records[bucket] ??= [];
    if (method === 'GET') {
      if (id) return send(records[bucket].find((record) => record.id === id) ?? {}, records[bucket].some((record) => record.id === id) ? 200 : 404);
      return send({ items: records[bucket].filter((record) => (!url.searchParams.get('search') || record.name.toLowerCase().includes(url.searchParams.get('search')!.toLowerCase())) && (!url.searchParams.get('status') || record.status === url.searchParams.get('status'))), nextCursor: null });
    }
    if (method === 'DELETE') { records[bucket] = records[bucket].filter((record) => record.id !== id); return route.fulfill({ status: 204, headers }); }
    const body = request.postDataJSON(); writes.push({ kind, body, branch });
    const saved = { ...body, id: id ?? `record-${++sequence}`, createdAt: '2026-10-07T08:00:00Z', ...(kind === 'quotes' ? { total: body.items.reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice, 0) * (1 + body.taxRate / 100) } : {}) };
    records[bucket] = [...records[bucket].filter((record) => record.id !== saved.id), saved]; return send(saved);
  });
  return { writes };
}
async function login(page: Page) {
  await page.goto('/'); await page.getByLabel('Email address', { exact: true }).fill('alex@example.com');
  await page.getByLabel('Password', { exact: true }).fill('correct-password'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('A clear view of your business', { exact: true })).toBeVisible();
}
test('login, lead CRUD, branch isolation and sign out', async ({ page }) => {
  await mockApi(page); await login(page);
  await page.getByRole('link', { name: 'Leads', exact: true }).click(); await page.getByRole('button', { name: '+ New lead', exact: true }).click();
  await page.getByLabel('Name *', { exact: true }).fill('Alice Lead'); await page.getByRole('button', { name: 'Create lead', exact: true }).click();
  await expect(page.getByText('Alice Lead', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click(); await page.getByLabel('Name *', { exact: true }).fill('Alice Updated');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(page.getByText('Alice Updated', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Acme · Main ▾', exact: true }).click(); await page.getByRole('button', { name: 'South', exact: true }).click();
  await page.getByRole('link', { name: 'Leads', exact: true }).click(); await expect(page.getByText('No leads yet', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Acme · South ▾', exact: true }).click(); await page.getByRole('button', { name: 'Main', exact: true }).click();
  await page.getByRole('link', { name: 'Leads', exact: true }).click(); await page.getByRole('link', { name: 'Open Alice Updated', exact: true }).click();
  await page.getByRole('button', { name: 'Delete lead', exact: true }).click(); await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(page.getByText('No leads yet', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(page.getByText('Welcome back', { exact: true })).toBeVisible();
  await page.goto('/crm/leads'); await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});
test('quote validation, customer selection and server-confirmed total', async ({ page }) => {
  const { writes } = await mockApi(page); await login(page);
  await page.getByRole('link', { name: 'Quotes', exact: true }).click(); await page.getByRole('button', { name: '+ New quote', exact: true }).click();
  await page.getByRole('button', { name: 'Create quote', exact: true }).click(); await expect(page.getByText('Name is required.', { exact: true })).toBeVisible();
  await page.getByLabel('Quote title *', { exact: true }).fill('Service proposal');
  await page.getByRole('button', { name: 'Choose customer', exact: true }).click(); await page.getByRole('button', { name: 'Acme Customer', exact: true }).click();
  await page.getByLabel('Description *', { exact: true }).fill('Consulting'); await page.getByLabel('Quantity *', { exact: true }).fill('2');
  await page.getByLabel('Unit price *', { exact: true }).fill('100'); await page.getByLabel('Tax (%)', { exact: true }).fill('18');
  await page.getByRole('button', { name: 'Create quote', exact: true }).click(); await expect(page.getByText('Service proposal', { exact: true })).toBeVisible();
  await expect(page.getByText(/Total:.*236/)).toBeVisible(); expect(writes.at(-1)?.body.customerId).toBe('customer-1'); expect(writes.at(-1)?.body).not.toHaveProperty('total');
  await page.screenshot({ path: 'test-results/quote-detail.png', fullPage: true });
});
test('read-only membership cannot open a create route', async ({ page }) => {
  await mockApi(page, true); await login(page); await page.goto('/crm/leads/new');
  await expect(page.getByText('Access unavailable', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Create lead', exact: true })).toHaveCount(0);
});
test('phone layout displays navigation without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockApi(page); await login(page);
  await page.getByRole('link', { name: 'Contacts', exact: true }).click(); await expect(page.getByText('No contacts yet', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/phone-contacts.png', fullPage: true });
});
test('invalid credentials stay on login and session expiration returns to login', async ({ page }) => {
  await mockApi(page); await page.goto('/');
  await page.getByLabel('Email address', { exact: true }).fill('alex@example.com'); await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByText('Email or password is incorrect.', { exact: true })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('correct-password'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('A clear view of your business', { exact: true })).toBeVisible();
  await page.route('**/api/v1/crm/leads*', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.getByRole('link', { name: 'Leads', exact: true }).click(); await expect(page.getByText('Welcome back', { exact: true })).toBeVisible();
  await expect(page.getByText('Your session expired. Please sign in again.', { exact: true })).toBeVisible();
});
test('offline requests show a retry state without pretending the list is empty', async ({ page }) => {
  await mockApi(page); await login(page);
  await page.route('**/api/v1/crm/leads*', (route) => route.abort('internetdisconnected'));
  await page.getByRole('link', { name: 'Leads', exact: true }).click();
  await expect(page.getByText('Cannot reach the server. Check your connection and try again.', { exact: true })).toBeVisible();
  await expect(page.getByText('No leads yet', { exact: true })).toHaveCount(0);
  await page.unroute('**/api/v1/crm/leads*'); await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('No leads yet', { exact: true })).toBeVisible();
});
test('contacts, customers and deals save their relationships and amount', async ({ page }) => {
  const { writes } = await mockApi(page); await login(page);
  await page.getByRole('link', { name: 'Contacts', exact: true }).click(); await page.getByRole('button', { name: '+ New contact', exact: true }).click();
  await page.getByLabel('Name *', { exact: true }).fill('Jamie Contact'); await page.getByLabel('Email address', { exact: true }).fill('jamie@example.com');
  await page.getByRole('button', { name: 'Create contact', exact: true }).click(); await expect(page.getByText('Jamie Contact', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Customers', exact: true }).click(); await page.getByRole('button', { name: '+ New customer', exact: true }).click();
  await page.getByLabel('Name *', { exact: true }).fill('Jamie Company'); await page.getByRole('button', { name: 'Choose contact', exact: true }).click();
  await page.getByRole('button', { name: 'Jamie Contact', exact: true }).click(); await page.getByRole('button', { name: 'Create customer', exact: true }).click();
  await expect(page.getByText('Jamie Company', { exact: true })).toBeVisible(); expect(writes.at(-1)?.body.contactId).toBe('record-1');
  await page.getByRole('link', { name: 'Deals', exact: true }).click(); await page.getByRole('button', { name: '+ New deal', exact: true }).click();
  await page.getByLabel('Name *', { exact: true }).fill('Jamie Opportunity'); await page.getByRole('button', { name: 'Choose customer', exact: true }).click();
  await page.getByRole('button', { name: 'Jamie Company', exact: true }).click(); await page.getByLabel('Deal value *', { exact: true }).fill('15000.50');
  await page.getByRole('button', { name: 'Create deal', exact: true }).click(); await expect(page.getByText('Jamie Opportunity', { exact: true })).toBeVisible();
  expect(writes.at(-1)?.body.customerId).toBe('record-2'); expect(writes.at(-1)?.body.amount).toBe(15000.5);
});
test('login validates both fields inline and blocks invalid requests', async ({ page }) => {
  await mockApi(page);
  const attempts: string[] = [];
  page.on('request', (request) => { if (request.url().endsWith('/auth/login')) attempts.push(request.url()); });
  await page.goto('/'); await page.getByLabel('Email address', { exact: true }).fill(''); await page.getByLabel('Password', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Email address is required.', { exact: true })).toBeVisible();
  await expect(page.getByText('Password is required.', { exact: true })).toBeVisible();
  await page.getByLabel('Email address', { exact: true }).fill('bad-email'); await page.getByLabel('Password', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();
  expect(attempts).toHaveLength(0);
  await page.getByLabel('Email address', { exact: true }).fill('alex@example.com'); await page.getByLabel('Password', { exact: true }).fill('correct-password');
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toHaveCount(0); await expect(page.getByText('Password is required.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByText('A clear view of your business', { exact: true })).toBeVisible();
  expect(attempts).toHaveLength(1);
});
test('lead email and phone errors appear on blur, stay while invalid, and prevent saves', async ({ page }) => {
  const { writes } = await mockApi(page); await login(page);
  await page.getByRole('link', { name: 'Leads', exact: true }).click(); await page.getByRole('button', { name: '+ New lead', exact: true }).click();
  await page.getByLabel('Name *', { exact: true }).fill('Validated lead'); await page.getByLabel('Email address', { exact: true }).fill('bad-email');
  await page.getByLabel('Phone number', { exact: true }).fill('.......'); await page.getByLabel('Name *', { exact: true }).click();
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();
  await expect(page.getByText('Enter 7–15 digits, with an optional leading + and formatting separators.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create lead', exact: true }).click(); expect(writes).toHaveLength(0);
  await page.getByLabel('Phone number', { exact: true }).fill('123'); await expect(page.getByText('Enter 7–15 digits, with an optional leading + and formatting separators.', { exact: true })).toBeVisible();
  await page.getByLabel('Phone number', { exact: true }).fill('+91 98765 43210'); await page.getByLabel('Email address', { exact: true }).fill('lead@example.com');
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create lead', exact: true }).click(); await expect(page.getByText('Validated lead', { exact: true })).toBeVisible(); expect(writes).toHaveLength(1);
});
test('deal amount, currency and calendar date errors block the write until corrected', async ({ page }) => {
  const { writes } = await mockApi(page); await login(page);
  await page.getByRole('link', { name: 'Deals', exact: true }).click(); await page.getByRole('button', { name: '+ New deal', exact: true }).click();
  await page.getByLabel('Name *', { exact: true }).fill('Validated deal'); await page.getByLabel('Deal value *', { exact: true }).fill('1e3');
  await page.getByLabel('Currency *', { exact: true }).fill('XYZ'); await page.getByLabel('Expected close date', { exact: true }).fill('2026-02-30');
  await page.getByRole('button', { name: 'Create deal', exact: true }).click(); expect(writes).toHaveLength(0);
  await expect(page.getByText('Use a valid date in YYYY-MM-DD format.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Choose a supported currency:/)).toBeVisible();
  await page.getByLabel('Deal value *', { exact: true }).fill('1000.50'); await page.getByLabel('Currency *', { exact: true }).fill('inr');
  await page.getByLabel('Expected close date', { exact: true }).fill('2028-02-29'); await page.getByRole('button', { name: 'Create deal', exact: true }).click();
  await expect(page.getByText('Validated deal', { exact: true })).toBeVisible(); expect(writes.at(-1)?.body.currency).toBe('INR');
});
test('quote errors identify each line field and disappear when corrected', async ({ page }) => {
  const { writes } = await mockApi(page); await login(page);
  await page.getByRole('link', { name: 'Quotes', exact: true }).click(); await page.getByRole('button', { name: '+ New quote', exact: true }).click();
  await page.getByLabel('Quote title *', { exact: true }).fill('Validated quote'); await page.getByLabel('Quantity *', { exact: true }).fill('0');
  await page.getByLabel('Unit price *', { exact: true }).fill('-1'); await page.getByLabel('Tax (%)', { exact: true }).fill('101');
  await page.getByRole('button', { name: 'Create quote', exact: true }).click(); expect(writes).toHaveLength(0);
  await expect(page.getByText('Choose a customer.', { exact: true })).toBeVisible(); await expect(page.getByText('Description is required.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Quantity must be greater than 0/)).toBeVisible(); await expect(page.getByText(/Tax must be at least 0/)).toBeVisible();
  await page.getByRole('button', { name: 'Choose customer', exact: true }).click(); await page.getByRole('button', { name: 'Acme Customer', exact: true }).click();
  await page.getByLabel('Description *', { exact: true }).fill('Consulting'); await page.getByLabel('Quantity *', { exact: true }).fill('1.5');
  await page.getByLabel('Unit price *', { exact: true }).fill('100.50'); await page.getByLabel('Tax (%)', { exact: true }).fill('18');
  await expect(page.getByText('Description is required.', { exact: true })).toHaveCount(0); await expect(page.getByText(/Quantity must be greater than 0/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Create quote', exact: true }).click(); await expect(page.getByText('Validated quote', { exact: true })).toBeVisible(); expect(writes).toHaveLength(1);
});
test('business and employee tabs start empty and preserve entered credentials', async ({ page }) => {
  await page.goto('/'); await expect(page.getByText('Business sign in', { exact: true })).toBeVisible();
  await expect(page.getByText(/demo|sample accounts|local previews/i)).toHaveCount(0);
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await page.getByLabel('Email address', { exact: true }).fill('person@company.example');
  await page.getByLabel('Password', { exact: true }).fill('My secret password');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await page.getByRole('tab', { name: 'Employee', exact: true }).click();
  await expect(page.getByText('Employee sign in', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('person@company.example');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('My secret password');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
});
test('email keyboard submission focuses the password field', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email address', { exact: true }).fill('person@company.example');
  await page.getByLabel('Email address', { exact: true }).press('Enter');
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
});
test('employee live login sends the portal and refuses business memberships', async ({ page }) => {
  await mockApi(page); await page.goto('/'); await page.getByRole('tab', { name: 'Employee', exact: true }).click();
  await page.getByLabel('Email address', { exact: true }).fill('alex@example.com'); await page.getByLabel('Password', { exact: true }).fill('correct-password');
  const request = page.waitForRequest('**/api/v1/auth/login'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect((await request).postDataJSON().portal).toBe('employee');
  await expect(page.getByText('This account does not have access to the selected login type.', { exact: true })).toBeVisible();
  await expect(page.getByText('A clear view of your business', { exact: true })).toHaveCount(0);
});
test('live employee session restores its portal and never opens business CRM', async ({ page }) => {
  const session = { user: { id: 'employee-live', name: 'Live Employee', email: 'employee@company.example' }, memberships: [{
    id: 'employee-membership', tenantId: 't1', companyId: 'c1', companyName: 'Acme', role: 'EMPLOYEE', permissions: [], branches: [{ id: 'b1', name: 'Main' }],
  }] };
  await page.route('**/api/v1/auth/**', async (route) => {
    const url = route.request().url();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(url.endsWith('/login') ? { accessToken: 'employee-token', session } : session) });
  });
  await page.goto('/'); await page.getByRole('tab', { name: 'Employee', exact: true }).click();
  await page.getByLabel('Email address', { exact: true }).fill('employee@company.example'); await page.getByLabel('Password', { exact: true }).fill('correct-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByText('Employee workspace', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('Employee workspace', { exact: true })).toBeVisible();
  await page.goto('/crm/leads'); await expect(page.getByText('Employee workspace', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Leads', exact: true })).toHaveCount(0);
});

test('password eye toggles visibility without changing the input', async ({ page }) => {
  await page.goto('/');
  const password = page.getByLabel('Password', { exact: true });
  await password.fill('My secret password');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(password).toHaveJSProperty('type', 'text');
  await expect(password).toHaveValue('My secret password');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveValue('My secret password');
});

test('login stays within phone, tablet and desktop widths', async ({ page }) => {
  await page.goto('/');
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByText('Quick demo access', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/demo|sample accounts|local previews/i)).toHaveCount(0);
    const bounds = await page.getByLabel('Email address', { exact: true }).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.width).toBeLessThanOrEqual(560);
    const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
    await signIn.scrollIntoViewIfNeeded();
    await expect(signIn).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
