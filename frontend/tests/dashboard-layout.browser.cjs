// Run after npm run export:web: node --test tests/dashboard-layout.browser.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

test('module dashboards retain mobile layouts and More uses three columns on larger screens', { timeout: 180000 }, async () => {
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
    const page = await browser.newPage({ isMobile: true, hasTouch: true, deviceScaleFactor: 2.75 });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    const session = { user: { id: 'owner', name: 'Owner', email: 'owner@example.com' }, memberships: [{ id: 'membership', tenantId: 'tenant', companyId: 'company', companyName: 'Example', role: 'BUSINESS_OWNER', permissions: [], branches: [{ id: 'branch', name: 'Main branch' }] }] };
    await page.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'browser-fixture-token'));
    await page.route('**/api/v1/**', route => {
      assert.equal(route.request().method(), 'GET', 'layout checks must not mutate payroll or employee data');
      const url = new URL(route.request().url());
      const pathname = url.pathname;
      const data = pathname.endsWith('/auth/me') ? session
        : pathname.includes('available') ? [{ id: 'branch', name: 'Main branch', companyId: 'company', status: 'ACTIVE' }]
        : url.searchParams.has('page') ? { data: [], pagination: { page: 1, totalPages: 1, total: 0 } }
        : [];
      return route.fulfill({ json: data });
    });
    const layouts = [
      ['/admin/dashboard', ['Open CRM', 'Open Payroll', 'Open People', 'Open Reports']],
      ['/admin/crm', ['Open Leads', 'Open Sales pipeline', 'Open Customers', 'Open Quotes']],
      ['/admin/employees/people', ['Employee directory', 'Team attendance', 'Approvals', 'People reports']],
      ['/admin/payroll', ['Payroll inputs', 'Payroll review', 'Sales incentives', 'Payment tracker']],
    ];
    for (const width of [320, 360, 375, 390, 393, 412, 430, 600, 767, 768, 1024, 1200, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [route, labels] of layouts) {
        await page.goto(`http://127.0.0.1:${server.address().port}${route}`);
        const cards = labels.map(name => page.getByRole('button', { name, exact: true }));
        for (const card of cards) await expect(card).toBeVisible();
        const columns = width >= 1200 ? 3 : 2;
        await expect.poll(async () => {
          const boxes = await Promise.all(cards.map(card => card.boundingBox()));
          return boxes[columns].y > boxes[0].y + 10 && Math.abs(boxes[0].y - boxes[1].y) < 2;
        }, { message: `${route}: ${columns} columns at ${width}px` }).toBe(true);
        const boxes = await Promise.all(cards.map(card => card.boundingBox()));
        for (const box of boxes) {
          assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `${route}: card fits at ${width}px`);
          assert.ok(Math.abs(box.width - boxes[0].width) < 1, `${route}: cards have equal widths`);
        }
        assert.ok(boxes[1].x >= boxes[0].x + boxes[0].width + 8, `${route}: visible column gap`);
        if (route === '/admin/dashboard') {
          const overview = page.getByTestId('dashboard-overview');
          const panel = await overview.evaluate(element => {
            const style = getComputedStyle(element);
            return { background: style.backgroundColor, padding: style.padding, border: style.borderTopWidth };
          });
          assert.deepEqual(panel, { background: 'rgba(0, 0, 0, 0)', padding: '0px', border: '0px' }, 'At a Glance has no outer white panel');
          if (width < 768) {
            const metrics = ['active-employees', 'present-today', 'pending-leave', 'open-crm-leads', 'open-tasks', 'completed-tasks', 'tasks-due-today', 'net-payroll'].map(id => page.getByTestId(`dashboard-overview-${id}`));
            await expect.poll(async () => {
              const stats = await Promise.all(metrics.map(metric => metric.boundingBox()));
              return stats.every((stat, index) => index % 2 === 0
                ? index === 0 || stat.y >= stats[index - 2].y + stats[index - 2].height + 7
                : Math.abs(stat.y - stats[index - 1].y) < 1 && stat.x >= stats[index - 1].x + stats[index - 1].width + 7);
            }, { message: `At a Glance: two columns at ${width}px` }).toBe(true);
            const [first, second] = await Promise.all(metrics.slice(0, 2).map(metric => metric.boundingBox()));
            const bounds = await overview.boundingBox();
            assert.ok(Math.abs(first.x - bounds.x) < 1 && Math.abs(second.x + second.width - bounds.x - bounds.width) < 1, 'Stat cards fill the available width');
            assert.ok(Math.abs(first.width - second.width) < 1, 'Each stat row has equal-width columns');
            if (width === 393) {
              // Native layouts and device scaling can change available space by less than a pixel.
              await overview.evaluate(element => { element.style.width = `${element.getBoundingClientRect().width - 0.5}px`; });
              await expect.poll(async () => {
                const stats = await Promise.all(metrics.map(metric => metric.boundingBox()));
                return stats.every((stat, index) => index % 2 === 0 || Math.abs(stat.y - stats[index - 1].y) < 1);
              }, { message: 'Stat pairs remain on the same row after a fractional width change' }).toBe(true);
            }
          }
        }
        if (width < 768 && route === '/admin/payroll') {
          const metrics = ['Gross earnings', 'Deductions', 'Sales incentives', 'Checks to resolve'].map(label => page.getByLabel(new RegExp(`^${label}:`)));
          for (const metric of metrics) await expect(metric).toBeVisible();
          const metricsBoxes = await Promise.all(metrics.map(metric => metric.boundingBox()));
          assert.ok(Math.abs(metricsBoxes[0].y - metricsBoxes[1].y) < 2);
          assert.ok(metricsBoxes[2].y > metricsBoxes[0].y + 10);
        }
      }
      {
        await page.goto(`http://127.0.0.1:${server.address().port}/admin/more`);
        const first = page.getByRole('button', { name: 'CRM workspace', exact: true });
        const second = page.getByRole('button', { name: 'People workspace', exact: true });
        await expect(first).toBeVisible();
        const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
        const branchCard = page.getByRole('button', { name: 'Change More branch', exact: true }).locator('..');
        const profileCard = page.getByText(/^business owner$/i).locator('..').locator('..');
        const [branchBox, profileBox] = await Promise.all([branchCard.boundingBox(), profileCard.boundingBox()]);
        if (width < 768) {
          assert.ok(profileBox.y >= branchBox.y + branchBox.height, 'More context cards retain their mobile stack');
          assert.ok(Math.abs(a.x - b.x) < 1 && b.y >= a.y + a.height, 'More retains full-width stacked rows');
          assert.ok(a.width > width * 0.8);
        } else {
          assert.ok(Math.abs(branchBox.y - profileBox.y) < 1 && profileBox.x >= branchBox.x + branchBox.width + 11, 'Branch and owner cards share a row');
          assert.ok(Math.abs(branchBox.width - profileBox.width) < 1 && profileBox.x + profileBox.width <= width, 'Context cards fit equally within the workspace');
          await branchCard.evaluate(card => {
            const container = card.parentElement;
            container.style.width = `${container.getBoundingClientRect().width - 17}px`;
          });
          const narrowedContext = await Promise.all([branchCard.boundingBox(), profileCard.boundingBox()]);
          assert.ok(Math.abs(narrowedContext[0].y - narrowedContext[1].y) < 1, 'Context cards stay on one row in a narrower content area');
          for (const labels of [
            ['CRM workspace', 'People workspace', 'Leave management', 'Branch payroll'],
            ['My leave requests', 'My salary advances', 'My attendance & leave', 'My payslips'],
            ['Subscription', 'Workspace settings', 'Billing & invoices', 'Platform support'],
          ]) {
            const boxes = await Promise.all(labels.map(name => page.getByRole('button', { name, exact: true }).boundingBox()));
            assert.ok(Math.abs(boxes[0].y - boxes[1].y) < 1 && Math.abs(boxes[0].y - boxes[2].y) < 1, `More: three cards per row at ${width}px`);
            assert.ok(boxes[3].y >= boxes[0].y + boxes[0].height, 'Fourth card starts the next row');
            for (const box of boxes) assert.ok(Math.abs(box.width - boxes[0].width) < 1 && box.x + box.width <= width, 'All cards retain equal column widths');
          }
          // Account for classic scrollbars or an embedded workspace narrower than the window.
          await first.evaluate(card => {
            let container = card.parentElement;
            while (container && container.querySelectorAll('[role="button"]').length < 4) container = container.parentElement;
            if (!container) throw new Error('Module container not found');
            container.style.width = `${container.getBoundingClientRect().width - 17}px`;
          });
          const narrowBoxes = await Promise.all(['CRM workspace', 'People workspace', 'Leave management'].map(name => page.getByRole('button', { name, exact: true }).boundingBox()));
          assert.ok(narrowBoxes.every(box => Math.abs(box.y - narrowBoxes[0].y) < 1), 'Three cards fit when the content area is narrower than the window');
        }
      }
    }
    assert.deepEqual(failures, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
