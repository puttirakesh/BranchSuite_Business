// Export first: npm run export:web. Reports and screenshots go to dist/responsive-audit.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('@playwright/test');

const ID = '11111111-1111-4111-8111-111111111111';
function routes(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return routes(path.join(directory, entry.name), name);
    if (!entry.name.endsWith('.tsx') || entry.name === '_layout.tsx') return [];
    const route = name.replace(/\.tsx$/, '').replace(/\/index$/, '').replace(/\[id\]/g, ID);
    if (route.includes('[module]')) return ['leads', 'customers', 'deals', 'quotes', 'activities', 'support'].map(module => route.replace('[module]', module));
    // Index routes only redirect; audit the destination screen instead.
    return ['', '/admin', '/employee'].includes(route) ? [] : [route];
  });
}

function inspect() {
  const width = window.innerWidth;
  const clipped = [], smallControls = [];
  const visible = element => {
    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  for (const element of document.querySelectorAll('body *')) {
    if (element.closest('[aria-hidden="true"]')) continue;
    if (!visible(element)) continue;
    const box = element.getBoundingClientRect();
    const name = (element.getAttribute('aria-label') || element.textContent || element.tagName).replace(/\s+/g, ' ').slice(0, 90);
    if (box.right > width + 2 || box.left < -2) {
      let parent = element.parentElement, scrollable = false;
      while (parent && parent !== document.body) {
        if (/(auto|scroll)/.test(getComputedStyle(parent).overflowX) && parent.scrollWidth > parent.clientWidth) { scrollable = true; break; }
        parent = parent.parentElement;
      }
      if (!scrollable && clipped.length < 8) clipped.push({ name, x: Math.round(box.x), right: Math.round(box.right) });
    }
    if (width <= 1024 && element.matches('button, [role="button"], a, input, select, textarea, [role="option"], [role="tab"], [tabindex="0"]')
      && element.getAttribute('aria-hidden') !== 'true' && (box.height < 40 || box.width < 40)) {
      smallControls.push({ name, width: Math.round(box.width), height: Math.round(box.height) });
    }
  }
  return { overflow: Math.max(0, document.documentElement.scrollWidth - width), clipped,
    smallControls, textLength: document.body.innerText.trim().length };
}

test('all route layouts fit phone, tablet, landscape and desktop viewports', { timeout: 900000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const output = path.join(root, process.env.AUDIT_ROUTES ? 'responsive-audit-followup' : 'responsive-audit');
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((request, response) => {
    const requested = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (requested !== root && !requested.startsWith(root + path.sep)) return response.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    response.setHeader('Content-Type', ({ '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.ttf': 'font/ttf', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const results = [];
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const allRoutes = process.env.AUDIT_ROUTES ? process.env.AUDIT_ROUTES.split(',') : routes(path.resolve(__dirname, '../app'));
    for (const width of (process.env.AUDIT_WIDTHS || '320,390,768,1024,1440').split(',').map(Number)) {
      const context = await browser.newContext({ viewport: { width, height: width === 1024 ? 768 : 900 }, hasTouch: width <= 1024 });
      const page = await context.newPage();
      let activeRoute = '', errors = [];
      await context.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'responsive-audit-fixture'));
      await context.route('**/api/v1/**', route => {
        const url = new URL(route.request().url()), endpoint = url.pathname;
        const user = { id: ID, name: 'Alex Responsive Tester', email: 'alex@example.com' };
        const branch = { id: 'branch', name: 'Main branch', companyId: 'company', status: 'ACTIVE' };
        const profile = { id: ID, userId: ID, companyId: 'company', branchId: 'branch', employeeCode: 'EMP-1', department: 'Sales', designation: 'Sales Executive', status: 'ACTIVE', user, branch, company: { id: 'company', name: 'Example Ltd' }, joiningDate: '2020-01-01' };
        const role = activeRoute.startsWith('/employee') ? 'EMPLOYEE' : 'BUSINESS_OWNER';
        const session = { user, memberships: [{ id: 'membership', tenantId: 'tenant', companyId: 'company', companyName: 'Example Ltd', role, permissions: [], branches: [branch] }] };
        const data = endpoint.endsWith('/auth/me') ? session
          : endpoint.endsWith('/employees/me') ? [profile]
          : endpoint.endsWith(`/employees/${ID}`) ? profile
          : endpoint.endsWith(`/tasks/${ID}`) ? { id: ID, title: 'Review responsive layouts', status: 'PENDING', priority: 'MEDIUM', description: 'Check forms and navigation across screen sizes.', assignedTo: user, assignee: user }
          : endpoint.includes('branches') ? [branch]
          : url.searchParams.has('page') ? { items: [], data: [], pagination: { page: 1, totalPages: 1, total: 0 } } : [];
        return route.fulfill({ json: data });
      });
      page.on('pageerror', error => errors.push(error.message));
      for (const route of allRoutes) {
        activeRoute = route; errors = [];
        try {
          await page.goto(`http://127.0.0.1:${server.address().port}${route}`, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(100);
          const result = { route, width, finalPath: new URL(page.url()).pathname, ...await page.evaluate(inspect), errors: [...errors] };
          results.push(result);
          if (process.env.AUDIT_SCREENSHOTS === 'all' || result.overflow > 2 || result.clipped.length || result.errors.length || ['/admin/dashboard', '/admin/employees/create', '/employee/dashboard', '/auth/login'].includes(route)) {
            await page.screenshot({ path: path.join(output, `${width}-${route.replace(/\//g, '_')}.png`), fullPage: true });
          }
        } catch (error) { results.push({ route, width, errors: [error.message] }); }
      }
      await context.close();
      fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
      console.log(`Audited ${allRoutes.length} routes at ${width}px`);
    }
    const failures = results.filter(result => result.overflow > 2 || result.clipped?.length || result.smallControls?.length || result.errors.length || result.textLength < 15);
    console.log(`Report: ${path.join(output, 'results.json')}`);
    assert.deepEqual(failures.map(({ route, width, overflow, clipped, errors }) => ({ route, width, overflow, clipped, errors })), []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
