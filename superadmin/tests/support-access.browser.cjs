const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '..');
const backendRoot = path.resolve(__dirname, '../../backend');
const { chromium } = require(require.resolve('@playwright/test', { paths: [path.resolve(__dirname, '../../frontend')] }));
const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [backendRoot] }));
const { JwtService } = require(require.resolve('@nestjs/jwt', { paths: [backendRoot] }));
require(require.resolve('dotenv', { paths: [backendRoot] })).config({ path: path.join(backendRoot, '.env'), quiet: true });
// Fail closed: this test reads platform users and signs tokens with the loaded secrets, so it may only run against an attested local database.
require(path.join(backendRoot, 'scripts/safe-env/db-target-guard.cjs')).assertSafeDatabaseTarget(process.env);

const forbidden = [
  '/platform/marketing/offers',
  '/platform/customers',
  '/platform/billing',
  '/platform/settings',
  '/platform/audit',
];

function staticServer(root) {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) file = path.join(root, 'index.html');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.css': 'text/css', '.ico': 'image/x-icon' };
    res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
}

async function readOnlySession(prisma, role) {
  const user = await prisma.platformUser.findFirst({
    where: { role, status: 'ACTIVE' },
    select: { id: true, name: true, email: true, role: true, tokenVersion: true },
  });
  assert.ok(user, `An active ${role} is required for the read-only browser test`);
  const jwt = new JwtService({ secret: process.env.PLATFORM_JWT_SECRET });
  const token = await jwt.signAsync(
    { sub: user.id, role: user.role, tokenVersion: user.tokenVersion, tokenType: 'platform' },
    {
      secret: process.env.PLATFORM_JWT_SECRET,
      expiresIn: process.env.PLATFORM_JWT_EXPIRES_IN || '15m',
      issuer: 'branchsuite-platform',
      audience: 'branchsuite-superadmin',
      algorithm: 'HS256',
    },
  );
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

async function openAuthenticatedPage(browser, origin, session) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const requests = [];
  const responses = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (request.url().includes('/platform/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.abort('blockedbyclient');
    return route.continue();
  });
  const page = await context.newPage();
  page.on('request', (request) => {
    if (request.url().includes('/platform/')) requests.push(new URL(request.url()).pathname);
  });
  page.on('response', (response) => {
    if (response.url().includes('/platform/')) responses.push({ path: new URL(response.url()).pathname, status: response.status() });
  });
  await page.goto(origin + '/login');
  await page.evaluate((stored) => {
    sessionStorage.setItem('branchsuite.superadmin.session', JSON.stringify(stored));
  }, session);
  await page.goto(origin + '/dashboard');
  return { context, page, requests, responses };
}

test('real API support navigation and refresh never request admin-only areas', { timeout: 120000 }, async () => {
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
  const apiFromSuperadmin = fs.readFileSync(path.join(frontendRoot, '.env'), 'utf8')
    .split(/\r?\n/)
    .find((line) => line.startsWith('EXPO_PUBLIC_API_URL='))
    ?.slice('EXPO_PUBLIC_API_URL='.length)
    .trim()
    .replace(/\/+$/, '');
  const targetApi = apiUrl || apiFromSuperadmin;
  assert.ok(targetApi, 'EXPO_PUBLIC_API_URL is required');
  assert.ok(process.env.PLATFORM_JWT_SECRET, 'PLATFORM_JWT_SECRET is required');

  const server = staticServer(path.join(frontendRoot, 'dist'));
  // The backend's browser allow-list includes the Expo web development origin.
  await new Promise((resolve) => server.listen(8081, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const prisma = new PrismaClient();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
    const support = await readOnlySession(prisma, 'PLATFORM_SUPPORT');
    const run = await openAuthenticatedPage(browser, origin, support);
    await run.page.waitForTimeout(3000);
    const supportHeadings = await run.page.getByRole('heading').allTextContents();
    const storedSession = await run.page.evaluate(() => Boolean(sessionStorage.getItem('branchsuite.superadmin.session')));
    assert.ok(supportHeadings.includes('Customer support'), JSON.stringify({ url: run.page.url(), headings: supportHeadings, storedSession, requests: run.requests, responses: run.responses }));
    assert.equal(await run.page.getByRole('menuitem', { name: 'Customers', exact: true }).count(), 0);
    assert.equal(await run.page.getByRole('button', { name: 'Customers', exact: true }).count(), 0);
    await run.page.reload();
    await run.page.getByRole('heading', { name: 'Customer support', exact: true }).waitFor();
    await run.page.goto(origin + '/support');
    await run.page.getByRole('heading', { name: 'Customer support', exact: true }).waitFor();
    await run.page.goto(origin + '/dashboard');
    await run.page.getByRole('heading', { name: 'Customer support', exact: true }).waitFor();

    const forbiddenRequests = run.requests.filter((requestPath) => forbidden.some((pathPart) => requestPath.includes(pathPart)));
    assert.deepEqual(forbiddenRequests, []);
    assert.ok(run.responses.some((response) => response.path.includes('/platform/support/')),
      'Support dashboard must load a real support response');
    assert.equal(run.responses.filter((response) => response.status >= 400).length, 0);
    await run.context.close();

    const admin = await readOnlySession(prisma, 'PLATFORM_ADMIN');
    const adminRun = await openAuthenticatedPage(browser, origin, admin);
    await adminRun.page.getByRole('heading', { name: 'Your platform', exact: true }).waitFor();
    await adminRun.page.goto(origin + '/customers');
    await adminRun.page.getByRole('heading', { name: 'Customer businesses', exact: true }).waitFor();
    await adminRun.page.waitForTimeout(2000);
    assert.ok(
      adminRun.responses.some((response) => response.path.includes('/platform/customers') && response.status === 200),
      JSON.stringify({ requests: adminRun.requests, responses: adminRun.responses }),
    );
    console.log(`Verified ${run.responses.length} Support API responses with zero forbidden requests; Admin Customers returned 200.`);
    await adminRun.context.close();
  } finally {
    await browser?.close();
    await prisma.$disconnect();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
