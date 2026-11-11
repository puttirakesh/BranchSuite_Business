// Run after npm run export:web: node --test tests/employee-documents.browser.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, expect } = require('@playwright/test');

test('employee documents fit the content area across breakpoints and retain sharing and downloads', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer((req, res) => {
    const requested = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (requested !== root && !requested.startsWith(root + path.sep)) return res.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    res.setHeader('Content-Type', ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, acceptDownloads: true });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    page.on('console', message => {
      if (/Removing a style property|conflicting property is set/.test(message.text())) failures.push(message.text());
    });
    const user = { id: 'person', name: 'Document Person', email: 'docs@example.com' };
    const branch = { id: 'branch', companyId: 'company', name: 'Main', status: 'ACTIVE' };
    const manager = { id: 'manager', name: 'Reporting manager with a long descriptive name', position: 'Operations and customer service manager', department: 'Operations' };
    const profile = { id: 'profile', userId: user.id, user, companyId: 'company', company: { id: 'company', name: 'Example Ltd' }, branchId: branch.id, branch, status: 'ACTIVE', employeeCode: 'EMP-1', joiningDate: '2020-01-01', reportingManagerId: manager.id, reportingManager: manager };
    const session = { user, subscription: { status: 'ACTIVE', planId: 'scale', billingCycle: 'monthly', accessAllowed: true, canManageBilling: true, cancelAtPeriodEnd: false, currentPeriodEnd: null }, memberships: [{ id: 'membership', tenantId: 'tenant', companyId: 'company', companyName: 'Example Ltd', role: 'EMPLOYEE', permissions: [], branches: [branch] }] };
    const longName = 'employment-record-with-a-very-long-filename-' + 'x'.repeat(100) + '.txt';
    let records = Array.from({ length: 5 }, (_, index) => ({ id: `doc-${index}`, companyId: 'company', branchId: 'branch', employeeId: 'profile', title: index ? `Employment document ${index}` : 'LongTitle'.repeat(25), kind: 'LETTER', content: index ? 'Your employment document is ready.' : 'LongUnbrokenContent'.repeat(20), fileName: longName, status: 'ISSUED', sharedBy: manager.name, createdAt: '2026-10-01T10:00:00Z' }));
    let mode = 'ok', uploaded;
    await page.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'documents-fixture'));
    await page.route('**/api/v1/**', route => {
      const endpoint = new URL(route.request().url()).pathname;
      if (endpoint.endsWith('/employee-documents/upload')) {
        uploaded = route.request().postDataJSON();
        return route.fulfill({ status: 201, json: { ...records[0], ...uploaded, id: 'uploaded' } });
      }
      assert.equal(route.request().method(), 'GET');
      if (endpoint.endsWith('/employee-documents/my')) return route.fulfill(mode === 'error' ? { status: 503, json: { message: 'Documents unavailable' } } : { json: records });
      if (endpoint.endsWith('/file')) return route.fulfill({ json: { fileName: longName, mimeType: 'text/plain', fileDataBase64: Buffer.from('Document fixture').toString('base64') } });
      if (endpoint.endsWith('/leave/requests/my')) return route.fulfill({ json: { items: [], pagination: { total: 0, page: 1, totalPages: 1 } } });
      return route.fulfill({ json: endpoint.endsWith('/auth/me') ? session : endpoint.endsWith('/employees/me') ? [profile] : endpoint.endsWith('/leave/reporting-to') ? [manager] : endpoint.includes('branches') ? [branch] : [] });
    });
    await page.goto(`${process.env.DOCUMENTS_DEV_URL || `http://127.0.0.1:${server.address().port}`}/employee/documents`);
    const screen = page.getByTestId('employee-documents');
    await expect(page.getByTestId('document-card')).toHaveCount(5);
    for (const width of [320, 360, 390, 479, 480, 639, 640, 699, 700, 767, 768, 820, 1023, 1024, 1199, 1200, 1280, 1399, 1400, 1440, 1920, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(async () => screen.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const cards = [...element.querySelectorAll('[data-testid="document-card"]')].map(card => card.getBoundingClientRect());
        const columns = bounds.width >= 1000 ? 3 : bounds.width >= 640 ? 2 : 1;
        return cards.filter(card => Math.abs(card.top - cards[0].top) < 2).length === columns
          && cards.every(card => card.left >= bounds.left - 1 && card.right <= bounds.right + 1);
      })).toBe(true);
      const layout = await screen.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const overflow = [...element.querySelectorAll('*')].filter(child => {
          const rect = child.getBoundingClientRect();
          return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
        }).map(child => child.textContent.slice(0, 60));
        return { width: bounds.width, left: bounds.left, right: bounds.right, overflow };
      });
      assert.ok(layout.left >= 0 && layout.right <= width + 1, `Page fits at ${width}px`);
      assert.deepEqual(layout.overflow, [], `Content fits at ${width}px`);
      const fields = page.getByTestId('document-details-fields');
      assert.equal(await fields.evaluate(element => getComputedStyle(element).flexDirection), layout.width >= 640 ? 'row' : 'column');
      for (const name of ['Share document', 'Clear', 'Refresh documents']) {
        const box = await page.getByRole('button', { name, exact: true }).boundingBox();
        assert.ok(box.width >= 43.9 && box.height >= 43.9, `${name} is touch sized at ${width}px: ${JSON.stringify(box)}`);
      }
      if (process.env.DOCUMENTS_SCREENSHOT_DIR && [390, 768, 1440].includes(width)) {
        fs.mkdirSync(process.env.DOCUMENTS_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.DOCUMENTS_SCREENSHOT_DIR, `documents-${width}.png`) });
      }
    }
    // Collapse the desktop sidebar: columns should follow the newly available space.
    const collapse = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
    if (await collapse.count()) {
      await collapse.click();
      await expect.poll(() => screen.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const cards = [...element.querySelectorAll('[data-testid="document-card"]')].map(card => card.getBoundingClientRect());
        const columns = bounds.width >= 1000 ? 3 : bounds.width >= 640 ? 2 : 1;
        return cards.filter(card => Math.abs(card.top - cards[0].top) < 2).length === columns
          && cards.every(card => card.right <= bounds.right + 1);
      })).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 900 });
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose file', exact: true }).click();
    await (await chooserPromise).setFiles({ name: longName, mimeType: 'text/plain', buffer: Buffer.from('Document fixture') });
    await expect(page.getByRole('button', { name: `Change file: ${longName}`, exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Document title', exact: true }).fill('Shared employment document');
    await page.getByRole('button', { name: 'Share document', exact: true }).click();
    await expect(page.getByText(`Shared with ${manager.name}.`, { exact: true })).toBeVisible();
    assert.equal(uploaded.reportingToId, manager.id);
    assert.equal(uploaded.fileName, longName);
    assert.equal(uploaded.title, 'Shared employment document');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${longName}`, exact: true }).first().click();
    assert.equal((await downloadPromise).suggestedFilename(), longName);
    records = [];
    await page.getByRole('button', { name: 'Refresh documents', exact: true }).click();
    await expect(page.getByText('No documents yet', { exact: true })).toBeVisible();
    mode = 'error';
    await page.getByRole('button', { name: 'Refresh documents', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry loading documents', exact: true })).toBeEnabled();
    await expect(page.getByText('No documents yet', { exact: true })).toHaveCount(0);
    mode = 'ok';
    await page.getByRole('button', { name: 'Retry loading documents', exact: true }).click();
    await expect(page.getByText('No documents yet', { exact: true })).toBeVisible();
    assert.deepEqual(failures, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
