import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for Visual Codebase frontend.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  // Run tests in parallel
  fullyParallel: true,
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  // Retry failed tests on CI
  retries: process.env.CI ? 2 : 0,
  // Opt out of parallel tests on CI for stability
  workers: process.env.CI ? 1 : undefined,
  // Reporter configuration
  reporter: 'html',
  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL: 'http://localhost:5173',
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    // Take screenshot on failure
    screenshot: 'only-on-failure',
  },
  // Configure projects for browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Run local dev server before starting tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
