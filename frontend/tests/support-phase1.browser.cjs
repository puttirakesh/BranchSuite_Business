// Rendered UI regressions using fully intercepted API fixtures, never a live backend.
// Prerequisite: export both apps to dist/phase1. All non-local network traffic is aborted.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

async function serve(root) {
  const server = http.createServer((req, res) => {
    const target = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (target !== root && !target.startsWith(root + path.sep)) return res.writeHead(403).end();
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(root, 'index.html');
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' };
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

function ticket() {
  return { id: '10000000-0000-4000-8000-000000000001', tenantId: 'tenant', companyId: 'company', branchId: null, createdById: 'owner',
    subject: 'Account access issue', category: 'ACCOUNT', priority: 'NORMAL', status: 'OPEN', createdAt: '2026-11-05T10:00:00.000Z',
    company: { id: 'company', name: 'Example Company' }, branch: null, requester: { id: 'owner', name: 'Owner' },
    messages: [], history: [{ id: 'h1', summary: 'Ticket created', actorName: 'Owner', actorRole: 'REQUESTER', createdAt: '2026-11-05T10:00:00.000Z' }] };
}

async function harness(t, app, role, width, data = []) {
  const root = path.resolve(__dirname, app === 'business' ? '../dist/phase1' : '../../superadmin/dist/phase1');
  const { server, origin } = await serve(root);
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  const user = { id: 'owner', name: 'Owner', email: 'owner@example.invalid', role };
  const branches = [{ id: 'north', companyId: 'company', name: 'North', status: 'ACTIVE' }];
  const session = { user, memberships: [{ id: 'membership', tenantId: 'tenant', companyId: 'company', companyName: 'Example Company', role, permissions: [], branches }] };
  await context.addInitScript(({ app, user }) => {
    if (app === 'business') sessionStorage.setItem('branchsuite_access_token', 'fixture');
    else sessionStorage.setItem('branchsuite.superadmin.session', JSON.stringify({ token: 'fixture', user }));
  }, { app, user });
  const seen = [], changes = [], errors = [];
  let failCreate = false;
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname.replace(/^\/api\/v1/, '');
    if (!url.pathname.startsWith('/api/v1/')) return url.origin === origin ? route.continue() : route.abort();
    seen.push({ method: req.method(), path: p, query: Object.fromEntries(url.searchParams) });
    const fulfill = (json, status = 200) => route.fulfill({ status, json });
    if (req.method() === 'OPTIONS') return fulfill({});
    if (p === '/auth/me') return fulfill(session);
    if (p === '/platform/auth/me') return fulfill(user);
    if (p === '/branches/available' || p === '/branches') return fulfill(branches);
    if (p === '/notifications') return fulfill([]);
    if (p === '/platform/support/agents') return fulfill([{ id: 'agent', name: 'Sam Support' }]);
    if (p === '/platform/support/summary') return fulfill({ total: data.length, open: data.length, byStatus: { OPEN: data.length }, assigned: 0, unassigned: data.length, overdue: 1, escalated: 0, unread: 1, averageFirstResponseMs: null, averageResolutionMs: null, trend: [{ day: '2026-11-05', created: 1, publicMessages: 1 }], workload: [{ id: 'agent', name: 'Sam Support', status: 'ACTIVE', assigned: 0, open: 0 }] });
    if (p === '/platform/support/businesses') return fulfill({ items: [{ id: 'company', tenantId: 'tenant', businessName: 'Example Business', companyName: 'Example Company', ticketCount: 1, openTicketCount: 1, latestActivity: '2026-11-05T10:00:00Z' }], total: 1, page: 1, limit: 20, totalPages: 1 });
    if (p === '/platform/support/businesses/company') return fulfill({ company: { id: 'company', name: 'Example Company', tenant: { id: 'tenant', name: 'Example Business' } }, branches: [{ id: 'north', name: 'North' }], requesters: [{ name: 'Owner' }], requesterLimit: 100 });
    if (p === '/support/tickets' && req.method() === 'POST') {
      const body = req.postDataJSON(); changes.push(body);
      if (failCreate) { failCreate = false; return fulfill({ message: 'Please retry this request.' }, 503); }
      await new Promise(resolve => setTimeout(resolve, 250));
      const saved = { ...ticket(), ...body }; data.unshift(saved); return fulfill(saved, 201);
    }
    if ((p === '/support/tickets' || p === '/support/tickets/my') && req.method() === 'GET') {
      const rows = data.filter(row => !url.searchParams.get('ticketId') || row.id === url.searchParams.get('ticketId'));
      return fulfill(rows.map(row => ({ ...row, messages: row.messages.filter(m => m.visibility === 'CUSTOMER') })));
    }
    if (p === '/platform/support/tickets') {
      const rows = data.filter(row => (!url.searchParams.get('priority') || row.priority === url.searchParams.get('priority')) && (!url.searchParams.get('companyId') || row.companyId === url.searchParams.get('companyId')));
      return fulfill({ items: rows, page: 1, limit: 20, total: rows.length, totalPages: rows.length ? 1 : 0, filters: { companies: [{ id: 'company', name: 'Example Company' }], branches: [{ id: 'north', companyId: 'company', name: 'North' }] } });
    }
    if (/^\/platform\/support\/tickets\//.test(p)) {
      const row = data[0];
      if (req.method() === 'GET') return fulfill(row);
      const body = req.postDataJSON(); changes.push({ path: p, ...body });
      if (p.endsWith('/read')) { row.unread = false; return fulfill({ acknowledgedVersion: body.customerActivityVersion }, 201); }
      if (p.endsWith('/claim') || p.endsWith('/assignment')) { row.assignedToId = p.endsWith('/claim') ? 'owner' : body.agentId; row.assignedTo = row.assignedToId ? { id: row.assignedToId, name: 'Sam Support', status: 'ACTIVE' } : null; row.supportRevision++; }
      if (p.endsWith('/escalation')) { row.escalationStatus = body.status || 'REQUESTED'; row.escalationReason = body.reason || row.escalationReason; row.supportRevision++; }
      if (p.endsWith('/status')) row.status = body.status;
      if (p.endsWith('/priority')) row.priority = body.priority;
      if (p.endsWith('/replies')) row.messages.push({ id: 'm' + changes.length, authorName: 'Platform Support', authorRole: role, createdAt: '2026-11-05T11:00:00.000Z', ...body });
      return fulfill(row, req.method() === 'POST' ? 201 : 200);
    }
    if (req.method() !== 'GET') { errors.push('Unexpected mutation ' + p); return route.abort(); }
    return fulfill([]);
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  return { page, origin, seen, changes, errors, failNextCreate: () => { failCreate = true; } };
}

test('Business owner/admin raise issues, retain errors, prevent duplicate sends and reload public history', { timeout: 120000 }, async t => {
  for (const [role, width] of [['BUSINESS_OWNER', 390], ['BUSINESS_ADMIN', 1366]]) {
    const state = [];
    const h = await harness(t, 'business', role, width, state);
    await h.page.goto(h.origin + '/admin/platform-support');
    await h.page.getByRole('button', { name: 'Raise issue', exact: true }).click();
    await h.page.getByRole('button', { name: 'Create ticket', exact: true }).click();
    assert.equal(h.changes.length, 0);
    await h.page.getByRole('textbox', { name: 'Support request subject', exact: true }).fill('Account access issue');
    await h.page.getByRole('textbox', { name: 'Describe support request', exact: true }).fill('Please help with this account access issue.');
    assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'creation form must fit viewport');
    h.failNextCreate();
    await h.page.getByRole('button', { name: 'Create ticket', exact: true }).click();
    await expect(h.page.getByRole('textbox', { name: 'Support request subject', exact: true })).toHaveValue('Account access issue');
    await expect.poll(() => h.changes.length).toBe(1);
    await h.page.getByRole('button', { name: 'Create ticket', exact: true }).dblclick();
    await expect(h.page.getByText(state[0]?.id || ticket().id, { exact: true })).toBeVisible();
    assert.equal(h.changes.length, 2, 'one failed submission and one successful submission');
    assert.equal(h.changes[1].companyId, 'company'); assert.equal(h.changes[1].branchId, undefined);
    await expect(h.page.getByText('Ticket history', { exact: true })).toBeVisible();
    state[0].messages.push({ id: 'public', visibility: 'CUSTOMER', authorRole: 'PLATFORM_SUPPORT', authorName: 'BranchSuite Support', authorId: null, createdAt: '2026-11-05T11:00:00Z', message: 'Public response after refresh' }, { id: 'private', visibility: 'INTERNAL', message: 'PRIVATE MARKER' });
    await h.page.reload();
    await expect(h.page.getByText('Public response after refresh', { exact: true })).toBeVisible();
    await expect(h.page.getByText('PRIVATE MARKER', { exact: true })).toHaveCount(0);
    assert.deepEqual(h.errors, []);
  }
});

test('manager notification opens personal support and never requests company tickets', { timeout: 60000 }, async t => {
  const row = ticket();
  const h = await harness(t, 'business', 'HR_MANAGER', 390, [row]);
  await h.page.goto(h.origin + '/admin/platform-support?ticketId=' + row.id);
  await expect(h.page.getByText('My support requests', { exact: true })).toBeVisible();
  await expect(h.page.getByText('Ticket history', { exact: true })).toBeVisible();
  await expect(h.page.getByRole('button', { name: 'Raise issue', exact: true })).toHaveCount(0);
  assert.ok(h.seen.some(req => req.path === '/support/tickets/my' && req.query.ticketId === row.id));
  assert.ok(!h.seen.some(req => req.path === '/support/tickets'));
  assert.deepEqual(h.errors, []);
});

test('platform controls react immediately, respect closed visibility and forward queue filters', { timeout: 120000 }, async t => {
  for (const [role, width] of [['PLATFORM_SUPPORT', 390], ['PLATFORM_ADMIN', 1366]]) {
    const row = { ...ticket(), status: 'CLOSED' };
    const h = await harness(t, 'platform', role, width, [row]);
    await h.page.goto(h.origin + '/support/' + row.id);
    await expect(h.page.getByRole('button', { name: 'Send reply', exact: true })).toBeDisabled();
    assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'ticket detail must fit viewport');
    await h.page.getByRole('button', { name: 'Message visibility: Customer reply', exact: true }).click();
    await h.page.getByRole('menuitem', { name: 'Internal note', exact: true }).click();
    await expect(h.page.getByRole('button', { name: 'Save note', exact: true })).toBeEnabled();
    await h.page.getByRole('textbox', { name: 'Reply / internal note', exact: true }).fill('Closed ticket private note');
    await h.page.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect.poll(() => h.changes.some(c => c.visibility === 'INTERNAL')).toBe(true);
    assert.equal(row.status, 'CLOSED');
    await h.page.getByRole('button', { name: 'Ticket status: Closed', exact: true }).click();
    await expect(h.page.getByRole('menuitem', { name: 'Resolved', exact: true })).toHaveCount(0);
    await h.page.getByRole('menuitem', { name: 'Open', exact: true }).click();
    await expect(h.page.getByRole('button', { name: 'Save status', exact: true })).toBeEnabled();
    await h.page.getByRole('button', { name: 'Save status', exact: true }).click();
    await expect.poll(() => row.status).toBe('OPEN');
    await h.page.getByRole('button', { name: 'Priority: Normal', exact: true }).click();
    await h.page.getByRole('menuitem', { name: 'High', exact: true }).click();
    await expect(h.page.getByRole('button', { name: 'Save priority', exact: true })).toBeEnabled();
    await h.page.getByRole('button', { name: 'Save priority', exact: true }).click();
    await expect.poll(() => row.priority).toBe('HIGH');
    await h.page.goto(h.origin + '/support');
    await h.page.getByRole('button', { name: 'High', exact: true }).click();
    await h.page.getByRole('button', { name: 'Company: All companies', exact: true }).click();
    await h.page.getByRole('menuitem', { name: 'Example Company', exact: true }).click();
    await h.page.getByRole('button', { name: 'Branch: All branches', exact: true }).click();
    await h.page.getByRole('menuitem', { name: 'North', exact: true }).click();
    await expect.poll(() => h.seen.some(req => req.path === '/platform/support/tickets' && req.query.priority === 'HIGH' && req.query.companyId === 'company' && req.query.branchId === 'north')).toBe(true);
    assert.deepEqual(h.errors, []);
  }
});


test('Phase 2 ownership, escalation, unread and directory controls work on desktop and mobile', {timeout:180000}, async t => {
  for(const [role,width] of [['PLATFORM_SUPPORT',390],['PLATFORM_ADMIN',1366]]) {
    const row={...ticket(),supportRevision:0,customerActivityVersion:1,unread:true,assignedToId:null,assignedTo:null,slaState:'OVERDUE',escalationStatus:'NONE',responseDueAt:'2026-11-04T10:00:00Z',resolutionDueAt:'2026-11-04T11:00:00Z'};
    const h=await harness(t,'platform',role,width,[row]);
    await h.page.goto(h.origin+'/support');
    await expect(h.page.getByText('Unread customer activity',{exact:false})).toBeVisible();
    assert.ok(!h.changes.some(x=>x.path?.endsWith('/read')),'queue never marks detail read');
    await h.page.getByRole('button',{name:'Ticket ownership: All tickets',exact:true}).click();
    await h.page.getByRole('menuitem',{name:'My tickets',exact:true}).click();
    await h.page.getByRole('button',{name:'Unread',exact:true}).click();
    await expect.poll(()=>h.seen.some(x=>x.path==='/platform/support/tickets'&&x.query.view==='MINE'&&x.query.unread==='true')).toBe(true);
    await h.page.goto(h.origin+'/support/'+row.id);
    await expect.poll(()=>h.changes.some(x=>x.path?.endsWith('/read')&&x.customerActivityVersion===1)).toBe(true);
    await expect(h.page.getByText('Initial-cycle SLA: overdue',{exact:true})).toBeVisible();
    if(role==='PLATFORM_SUPPORT') {
      await expect(h.page.getByRole('button',{name:'Save assignment',exact:true})).toHaveCount(0);
      await h.page.getByRole('button',{name:'Claim unassigned ticket',exact:true}).click();
    } else {
      await h.page.getByRole('button',{name:'Assign Support agent: Unassigned',exact:true}).click();
      await h.page.getByRole('menuitem',{name:'Sam Support',exact:true}).click();
      await h.page.getByRole('button',{name:'Save assignment',exact:true}).click();
    }
    await expect(h.page.getByText('Assigned agent: Sam Support',{exact:true})).toBeVisible();
    await h.page.getByRole('textbox',{name:'Staff-only escalation reason',exact:true}).fill('Specialist review needed');
    await h.page.getByRole('button',{name:'Request escalation',exact:true}).click();
    await expect(h.page.getByText('Escalation: requested',{exact:true})).toBeVisible();
    if(role==='PLATFORM_ADMIN') {
      await h.page.getByRole('button',{name:'Acknowledge escalation',exact:true}).click();
      await expect(h.page.getByText('Escalation: acknowledged',{exact:true})).toBeVisible();
      await h.page.getByRole('button',{name:'Resolve escalation',exact:true}).click();
      await expect(h.page.getByText('Escalation: resolved',{exact:true})).toBeVisible();
    } else await expect(h.page.getByRole('button',{name:'Resolve escalation',exact:true})).toHaveCount(0);
    assert.equal(await h.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await h.page.goto(h.origin+'/support-businesses');
    await h.page.getByRole('button',{name:'View support context for Example Company',exact:true}).click();
    await expect(h.page.getByText('Ticket branches: North',{exact:true})).toBeVisible();
    await h.page.getByRole('button',{name:'Open business tickets',exact:true}).click();
    await expect.poll(()=>h.seen.some(x=>x.path==='/platform/support/tickets'&&x.query.companyId==='company')).toBe(true);
    assert.ok(!h.seen.some(x=>x.path==='/platform/customers'));
    assert.deepEqual(h.errors,[]);
  }
});

test('Phase 2 Business tracking displays public progress on mobile without internal SLA metadata',{timeout:60000},async t=>{
  const row={...ticket(),assignedToSupport:true,escalationStage:'ACKNOWLEDGED'};
  const h=await harness(t,'business','BUSINESS_OWNER',390,[row]);
  await h.page.goto(h.origin+'/admin/platform-support?ticketId='+row.id);
  await expect(h.page.getByText('Assigned to Support',{exact:true})).toBeVisible();
  await expect(h.page.getByText('Escalation: In review',{exact:true})).toBeVisible();
  await expect(h.page.getByText('Initial-cycle SLA:',{exact:false})).toHaveCount(0);
  assert.equal(await h.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(h.errors,[]);
});


test('Phase 2 polling refreshes visible detail and stops after navigation',{timeout:90000},async t=>{
  const row={...ticket(),supportRevision:0,customerActivityVersion:1,unread:true,assignedToId:null,escalationStatus:'NONE'};
  const h=await harness(t,'platform','PLATFORM_SUPPORT',1366,[row]);
  await h.page.goto(h.origin+'/support/'+row.id);
  await expect(h.page.getByText('Ownership and service targets',{exact:true})).toBeVisible();
  await expect.poll(()=>h.changes.some(x=>x.path?.endsWith('/read'))).toBe(true);
  const count=()=>h.seen.filter(x=>x.method==='GET'&&x.path==='/platform/support/tickets/'+row.id).length;
  const before=count();
  row.customerActivityVersion=2;row.messages.push({id:'arrival',visibility:'CUSTOMER',authorRole:'REQUESTER',authorName:'Owner',createdAt:'2026-11-05T11:00:00Z',message:'Arrived through polling'});
  await h.page.waitForTimeout(31000);
  await expect.poll(count).toBeGreaterThan(before);
  await expect(h.page.getByText('Arrived through polling',{exact:true})).toBeVisible();
  await expect.poll(()=>h.changes.some(x=>x.path?.endsWith('/read')&&x.customerActivityVersion===2)).toBe(true);
  await h.page.goto(h.origin+'/support-businesses');
  await h.page.waitForTimeout(1000);
  await expect(h.page.getByText('Example Business',{exact:true})).toBeVisible();
  const after=count();await h.page.waitForTimeout(31000);
  assert.equal(count(),after,'detail polling is removed after leaving detail');
  assert.deepEqual(h.errors,[]);
});


test('Phase 2 dashboard uses recorded metrics and Support direct customer URLs stay denied',{timeout:60000},async t=>{
  const h=await harness(t,'platform','PLATFORM_SUPPORT',390,[ticket()]);
  await h.page.goto(h.origin+'/');
  await expect(h.page.getByText('Support operations',{exact:true})).toBeVisible();
  await expect(h.page.getByText('Average first public platform response: Not available',{exact:true})).toBeVisible();
  await expect(h.page.getByText('2026-11-05: 1 created / 1 public messages',{exact:true})).toBeVisible();
  assert.equal(await h.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await h.page.goto(h.origin+'/customers');
  await expect(h.page.getByText('Your role does not include this module. Ask a Platform Admin if you need access.',{exact:true})).toBeVisible();
  assert.ok(!h.seen.some(x=>x.path==='/platform/customers'));
  assert.deepEqual(h.errors,[]);
});
