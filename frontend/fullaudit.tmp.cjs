const { chromium } = require('@playwright/test');
const fs = require('fs');
const OUT = 'C:/Users/user/AppData/Local/Temp/claude/c--Users-user-Desktop-BranchSuite/1c572ca7-c78f-4fa1-abc2-9db09aecbc23/scratchpad/full';
const UUID = '11111111-1111-4111-8111-111111111111';
const adminRoutes = ['/admin/activity-audit','/admin/advances','/admin/approvals','/admin/attendance','/admin/attendance/corrections','/admin/attendance/team','/admin/billing','/admin/branches','/admin/crm','/admin/crm/leads','/admin/crm/customers-live','/admin/crm/deals-live','/admin/crm/lead-form','/admin/crm/quotes-live','/admin/dashboard','/admin/departments','/admin/employees','/admin/employees/active-employees','/admin/employees/create','/admin/employees/people','/admin/leave-management','/admin/more','/admin/my-advances','/admin/my-leave','/admin/my-tasks','/admin/payroll','/admin/payroll/inputs','/admin/payslips','/admin/platform-support','/admin/profile','/admin/profile/documents','/admin/reports','/admin/roles-permissions','/admin/salary','/admin/subscription','/admin/tasks','/admin/tasks/follow-ups','/admin/teamlead','/admin/workspace-settings', `/admin/employees/${UUID}`, `/admin/tasks/${UUID}`];
const employeeRoutes = ['/employee/dashboard','/employee/advances','/employee/attendance','/employee/attendance/correction','/employee/attendance/history','/employee/documents','/employee/help','/employee/leave','/employee/leave/apply','/employee/payslips','/employee/profile','/employee/tasks'];
const authRoutes = ['/auth/login','/auth/signup','/auth/plans','/auth/forgot-password','/auth/reset-password','/auth/accept-invitation'];
const viewports = [{ w: 360, h: 740, touch: true }, { w: 768, h: 1024, touch: true }, { w: 1024, h: 768, touch: false }, { w: 1440, h: 900, touch: false }];
function session(role) { return { user: { id: 'u', name: 'Tester', email: 't@example.com' }, memberships: [{ id: 'm', tenantId: 'tenant', companyId: 'company', companyName: 'Example', role, roles: [role], permissions: ['users.read','crm.read','attendance.read','payroll.read'], branches: [{ id: 'branch', name: 'Main branch' }] }] }; }
const probe = ({ vw, touch }) => {
  const out = { docOverflow: document.documentElement.scrollWidth - vw, offenders: [], small: [], tiny: 0, textLen: document.body.innerText.trim().length };
  const visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0; };
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.right > vw + 2 && cs.position !== 'fixed') { let a = el.parentElement, sc = false; while (a && a !== document.body) { const c = getComputedStyle(a); if (/(auto|scroll|hidden)/.test(c.overflowX) && a.scrollWidth > a.clientWidth) { sc = true; break; } a = a.parentElement; } if (!sc && out.offenders.length < 4) out.offenders.push((el.getAttribute('aria-label') || el.getAttribute('data-testid') || el.tagName) + ':' + Math.round(r.right)); }
    if (touch) {
      const role = el.getAttribute('role'); const interactive = role === 'button' || role === 'link' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
      if (interactive && (r.height < 40 || r.width < 40) && el.getAttribute('aria-hidden') !== 'true' && out.small.length < 6) out.small.push((el.getAttribute('aria-label') || el.innerText || el.tagName).slice(0, 24).replace(/\s+/g, ' ') + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      if (el.childNodes.length && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(cs.fontSize) < 11) out.tiny++;
    }
  }
  return out;
};
(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  const results = [];
  const groups = [{ name: 'admin', routes: adminRoutes, role: 'BUSINESS_OWNER' }, { name: 'employee', routes: employeeRoutes, role: 'EMPLOYEE' }, { name: 'auth', routes: authRoutes, role: null }];
  for (const g of groups) for (const vp of viewports) {
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.touch, isMobile: vp.w < 500 });
    if (g.role) await ctx.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'browser-fixture-token'));
    await ctx.route('**/api/v1/**', r => { const p = new URL(r.request().url()).pathname; let data = [];
      if (p.endsWith('/auth/me')) data = g.role ? session(g.role) : {};
      else if (/branches/.test(p)) data = [{ id: 'branch', name: 'Main branch', status: 'ACTIVE', companyId: 'company', code: 'MB' }];
      else if (new URL(r.request().url()).searchParams.has('page')) data = { data: [], pagination: { page: 1, totalPages: 1, total: 0 } };
      return r.fulfill({ json: data }); });
    for (const path of g.routes) {
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 100)));
      try {
        await page.goto('http://localhost:8081' + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2200);
        const m = await page.evaluate(probe, { vw: vp.w, touch: vp.touch });
        const flagged = m.docOverflow > 2 || m.offenders.length || errs.length || m.textLen < 15;
        results.push({ group: g.name, vp: vp.w, path, ...m, errs });
        if (flagged) await page.screenshot({ path: `${OUT}/${g.name}_${vp.w}_${path.replace(/\//g, '-')}.png` });
      } catch (e) { results.push({ group: g.name, vp: vp.w, path, error: e.message.slice(0, 80) }); }
      await page.close();
    }
    await ctx.close();
    fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results));
  }
  await b.close(); console.log('DONE', results.length);
})().catch(e => console.log('ERR', e.message.slice(0, 300)));
