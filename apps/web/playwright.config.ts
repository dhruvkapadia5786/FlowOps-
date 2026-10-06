import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E against the already-running FlowOps stack.
 * Defaults: web http://127.0.0.1:43125 · API http://127.0.0.1:43124/api/v1
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.FLOWOPS_WEB_URL ?? 'http://127.0.0.1:43125',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
