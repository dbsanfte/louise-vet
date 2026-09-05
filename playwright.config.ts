import { defineConfig, devices } from '@playwright/test';

const externalURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    actionTimeout: 20000,
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
    baseURL: externalURL ?? 'http://127.0.0.1:4173',
    // Continuous canvas captures are expensive with software WebGL in CI.
    // Keep DOM/action traces and a screenshot of any failure instead.
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true },
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: externalURL
    ? undefined
    : {
        command: 'npm run preview',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: false,
      },
});
