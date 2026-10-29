const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

test('email recovery reveals passwords only after OTP; signup verifies email and stores phone as contact', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer((req, res) => {
    const requested = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (requested !== root && !requested.startsWith(root + path.sep)) return res.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 900 }, { width: 320, height: 568 }, { width: 568, height: 320 }]) {
      const page = await browser.newPage({ viewport });
      let saved;
      const failures = []; page.on('pageerror', err => failures.push(err.message));
      await page.route('**/api/v1/**', async route => {
        const url = route.request().url();
        const data = route.request().postDataJSON();
        if (url.endsWith('/forgot-password')) {
          assert.equal(data.email, 'owner@example.com');
          assert.equal(data.channel, undefined);
          return route.fulfill({ json: { challengeId: '11111111-1111-4111-8111-111111111111', message: 'If eligible, OTP sent.' } });
        }
        if (url.endsWith('/verify-otp')) {
          return route.fulfill({ status: data.otp === '123456' ? 201 : 400, json: { message: data.otp === '123456' ? 'Verified' : 'Invalid OTP' } });
        }
        if (url.endsWith('/reset-password')) { saved = data; return route.fulfill({ json: { message: 'Password reset successful' } }); }
        return route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
      });
      await page.goto(`${origin}/auth/forgot-password`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Recovery form fits the viewport');
      await page.getByLabel('Registered email', { exact: true }).fill('owner@example.com');
      await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Send OTP', exact: true }).click();
      await page.getByLabel('Verification OTP', { exact: true }).fill('000000');
      await page.getByRole('button', { name: 'Verify OTP', exact: true }).click();
      await expect(page.getByText('Invalid OTP', { exact: true })).toBeVisible();
      await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
      await page.getByLabel('Verification OTP', { exact: true }).fill('123456');
      await page.getByRole('button', { name: 'Verify OTP', exact: true }).click();
      await page.getByLabel('New password', { exact: true }).fill('new-password123');
      await page.getByLabel('Confirm new password', { exact: true }).fill('new-password123');
      await page.getByRole('button', { name: 'Save new password', exact: true }).click();
      await expect(page).toHaveURL(/\/auth\/login$/);
      assert.equal(saved.otp, '123456'); assert.equal(saved.newPassword, 'new-password123'); assert.equal(saved.token, undefined);
      assert.deepEqual(failures, []);
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    let registration;
    await page.route('**/api/v1/**', async route => {
      const url = route.request().url();
      if (url.endsWith('/signup/otp')) return route.fulfill({ json: { challengeId: '11111111-1111-4111-8111-111111111111', message: 'OTP sent' } });
      if (url.endsWith('/verify-otp')) return route.fulfill({ json: { message: 'Verified' } });
      if (url.endsWith('/signup')) { registration = route.request().postDataJSON(); return route.fulfill({ json: { business: { companyId: 'company', branchId: 'branch' } } }); }
      return route.fulfill({ status: 401, json: { message: 'Sign in manually' } });
    });
    await page.goto(`${origin}/auth/signup`);
    for (const [label, value] of [['Business name', 'OTP Example'], ['Branch name', 'Main branch'], ['Owner / Admin name', 'OTP Owner'], ['Work email', 'owner@example.com'], ['Mobile number', '9876543210'], ['Password', 'password123'], ['Confirm password', 'password123']]) await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Create Business Account', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Verify your email before creating your account.' }).first()).toBeVisible();
    assert.equal(registration, undefined);
    await expect(page.getByLabel('Phone OTP', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Send email OTP', exact: true }).click();
    await page.getByLabel('Email OTP', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Verify email OTP', exact: true }).click();
    await expect(page.getByText('Email verified', { exact: true })).toBeVisible();
    // Editing contact information does not invalidate email verification.
    await page.getByLabel('Mobile number', { exact: true }).fill('9876543211');
    await page.getByRole('button', { name: 'Create Business Account', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    assert.equal(registration.emailOtp, '123456');
    assert.equal(registration.phone, '9876543211');
    assert.equal(registration.phoneOtp, undefined); assert.equal(registration.phoneChallengeId, undefined);
    await page.close();
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
