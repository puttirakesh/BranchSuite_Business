// Browser checks against the static export or BRANCHSUITE_TEST_URL (Expo dev server).
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..', '.expo', 'web-export');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!fs.existsSync(file)) {
    const dynamicTemplate = path.join(path.dirname(file), '[id].html');
    if (fs.existsSync(dynamicTemplate)) file = dynamicTemplate;
  }
  if (!fs.existsSync(file)) file = path.join(root, 'index.html');
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run() {
  if (!process.env.BRANCHSUITE_TEST_URL) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = process.env.BRANCHSUITE_TEST_URL || 'http://127.0.0.1:' + server.address().port;
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_BROWSER || (fs.existsSync(edge) ? edge : undefined), headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let frame;
  const state = () => frame.evaluate(() => window.Prototype.getState());
  const go = async route => {
    await frame.evaluate(route => window.Prototype.go(route), route);
    await delay(100);
  };
  const click = (action, id) => frame.locator(`[data-act="${action}"]${id ? `[data-id="${id}"]` : ''}`).first().click();
  const submit = id => frame.locator('#' + id + ' button[type=submit]').click();
  try {
    await page.goto(origin);
    await page.locator('iframe').waitFor();
    frame = page.frames().find(f => f.parentFrame());
    await frame.waitForFunction(() => !!window.Prototype);
    await frame.locator('#login-form').waitFor();
    await frame.locator('[name=password]').fill('wrong');
    await submit('login-form');
    assert.equal((await state()).session, null, 'Wrong password must not sign in');
    await frame.locator('[name=password]').fill('Demo123');
    await submit('login-form');
    await frame.locator('.studio-home-heading').waitFor();
    assert.equal((await state()).session.accountId, 'platform-admin');
    console.log('PASS owner sign-in and password rejection');

    await go('platform-customers');
    const search = frame.locator('input[data-saas-search]');
    if (await search.count()) {
      await search.fill('no-such-business');
      assert(!(await frame.locator('#saas-results').innerText()).includes('5 Gen Educon'));
      await search.fill('');
    }
    await go('platform-customer/t1');
    assert((await frame.locator('body').innerText()).includes('5 Gen Educon'));

    await go('platform-plans');
    await click('saas-edit-plan', 'growth');
    await frame.locator('#saas-plan-form [name=employees]').fill('1');
    await submit('saas-plan-form');
    assert((await frame.locator('#saas-plan-form .form-error').innerText()).length > 0, 'Usage limit violation must fail');
    await frame.evaluate(() => window.Prototype.back());
    await frame.evaluate(() => window.Prototype.openAdminEditor('saas-plan-new'));
    await frame.locator('#saas-plan-form [name=name]').fill('Verification Plan');
    await submit('saas-plan-form');
    assert((await state()).plans.some(p => p.name === 'Verification Plan'));
    console.log('PASS customer details, plan creation and usage-limit validation');

    await go('platform-offers');
    await click('saas-offer-new');
    await frame.locator('#saas-offer-form [name=code]').fill('VERIFY20');
    await frame.locator('#saas-offer-form [name=percent]').fill('20');
    await submit('saas-offer-form');
    assert((await state()).coupons.some(c => c.code === 'VERIFY20' && c.percent === 20));
    await go('platform-ticket/BS-TK-101');
    await frame.locator('#saas-reply-form [name=message]').fill('Verification reply');
    await frame.locator('#saas-reply-form [name=status]').selectOption('Resolved');
    await submit('saas-reply-form');
    assert.equal((await state()).saasTickets.find(t => t.id === 'BS-TK-101').status, 'Resolved');
    await go('platform-lead/BS-LD-101');
    await frame.locator('#saas-lead-form [name=status]').selectOption('Qualified');
    await submit('saas-lead-form');
    assert.equal((await state()).saasLeads.find(l => l.id === 'BS-LD-101').status, 'Qualified');
    await go('platform-settings');
    await frame.locator('#saas-settings-form [name=brand]').fill('BranchSuite Verified');
    await submit('saas-settings-form');
    await go('platform-audit');
    assert((await frame.locator('body').innerText()).includes('Platform settings updated'));
    console.log('PASS offers, support resolution, prospect follow-up, settings and audit');

    await go('platform-invoice/BS-DEMO-1001');
    const downloadPromise = page.waitForEvent('download');
    await click('saas-invoice-pdf', 'BS-DEMO-1001');
    const download = await downloadPromise;
    const pdf = fs.readFileSync(await download.path());
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    console.log('PASS real offline invoice PDF download');

    const screens = ['platform-home', 'platform-customers', 'platform-customer/t1', 'platform-plans', 'platform-billing', 'platform-invoice/BS-DEMO-1001', 'platform-support', 'platform-ticket/BS-TK-101', 'platform-marketing', 'platform-lead/BS-LD-101', 'platform-offers', 'platform-settings', 'platform-audit', 'platform-more'];
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of screens) {
        await go(route);
        const size = await frame.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
        assert(size.scroll <= size.width + 1, `${route} overflows at ${width}px: ${JSON.stringify(size)}`);
        assert((await frame.locator('main').innerText()).trim().length > 10, route + ' must render');
      }
      await go('platform-home');
      await page.screenshot({ path: path.join(root, '..', `verified-${width}.png`), fullPage: true });
      console.log(`PASS all 14 screens at ${width}px`);
    }
    await delay(500);
    await page.reload();
    await page.locator('iframe').waitFor();
    frame = page.frames().find(f => f.parentFrame());
    await frame.waitForFunction(() => !!window.Prototype);
    await delay(250);
    const restored = await state();
    assert(restored.plans.some(p => p.name === 'Verification Plan'));
    assert(restored.coupons.some(c => c.code === 'VERIFY20'));
    assert.equal(restored.platformSettings.brand, 'BranchSuite Verified');
    assert.equal(restored.saasTickets.find(t => t.id === 'BS-TK-101').status, 'Resolved');
    console.log('PASS persistence after full page reload');

    const openPath = async pathname => {
      await page.goto(origin + pathname);
      await page.locator('iframe').waitFor();
      frame = page.frames().find(f => f.parentFrame());
      await frame.waitForFunction(() => !!window.Prototype);
    };
    await openPath('/plans/create');
    await frame.locator('#saas-plan-form').waitFor();
    await frame.locator('#saas-plan-form [name=name]').fill('Deep Link Plan');
    await submit('saas-plan-form');
    assert((await state()).plans.some(p => p.name === 'Deep Link Plan'));
    await openPath('/plans/growth');
    await frame.locator('#saas-plan-form').waitFor();
    assert.equal(await frame.locator('#saas-plan-form [name=name]').inputValue(), 'Growth');
    await openPath('/offers/COUPON-1');
    await frame.locator('#saas-offer-form').waitFor();
    assert.equal(await frame.locator('#saas-offer-form [name=code]').inputValue(), 'SAVE10');
    await openPath('/customers/t1');
    await frame.getByRole('heading', { name: '5 Gen Educon', exact: true, level: 1 }).waitFor();
    console.log('PASS Expo deep links for plan creation, plan/offer editors and customer details');

    await go('platform-more');
    await click('saas-signout');
    await frame.locator('#login-form [name=email]').fill('support@demo.example');
    await frame.locator('#login-form [name=password]').fill('Demo123');
    await submit('login-form');
    await go('platform-plans');
    assert.notEqual(await frame.evaluate(() => window.Prototype.getRoute()), 'platform-plans');
    await go('platform-ticket/BS-TK-102');
    await frame.locator('#saas-reply-form [name=message]').fill('Internal verification note');
    await frame.locator('#saas-reply-form [name=visibility]').selectOption('Internal note');
    await submit('saas-reply-form');
    assert((await state()).saasTickets.find(t => t.id === 'BS-TK-102').messages.some(m => m.text === 'Internal verification note' && m.internal));
    console.log('PASS support role restrictions and internal note');
    await go('platform-more');
    await click('saas-signout');
    for (const pathname of ['/forgot-password', '/reset-password']) {
      await openPath(pathname);
      await frame.locator('#recovery-back').waitFor();
      assert((await frame.locator('body').innerText()).includes('require a connected authentication service'));
    }
    await frame.locator('#recovery-back').click();
    await frame.locator('#login-form').waitFor();
    for (const viewport of [{width:320,height:700},{width:844,height:390}]) {
      await page.setViewportSize(viewport);
      const size = await frame.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
      assert(size.scroll <= size.width + 1, 'Sign-in should fit narrow and landscape screens');
    }
    console.log('PASS recovery routes and narrow/landscape sign-in');
    assert.deepEqual(errors, [], 'No browser runtime errors');
  } catch (error) {
    console.error('Browser errors:', errors);
    if (frame) console.error('Page:', (await frame.locator('body').innerText()).slice(0, 2500));
    await page.screenshot({ path: path.join(root, '..', 'verification-failure.png'), fullPage: true });
    throw error;
  } finally {
    await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
