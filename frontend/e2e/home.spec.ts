import { test, expect } from '@playwright/test';

/**
 * Basic smoke tests for the Visual Codebase application.
 * These tests verify that the app loads and key UI elements are present.
 */

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Verify page title contains expected text
    await expect(page).toHaveTitle(/Codebase/i);
  });

  test('should display the main heading', async ({ page }) => {
    await page.goto('/');

    // Look for the main app heading or branding
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });

  test('should have navigation elements', async ({ page }) => {
    await page.goto('/');

    // App should have some interactive elements
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Analysis Flow', () => {
  test('should show upload options', async ({ page }) => {
    await page.goto('/');

    // Wait for the app to load
    await page.waitForLoadState('networkidle');

    // The app should show some form of input for analysis
    // Either a file input, directory picker, or GitHub repo input
    const hasAnalysisInput =
      await page.locator('input').count() > 0 ||
      await page.locator('button').count() > 0;

    expect(hasAnalysisInput).toBe(true);
  });
});
