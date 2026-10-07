import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, timeout: 30000,
  use: { baseURL: 'http://localhost:4173', browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node tests/serve.cjs', port: 4173, reuseExistingServer: !process.env.CI },
});
