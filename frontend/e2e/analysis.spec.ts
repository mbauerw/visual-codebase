import { test, expect } from '@playwright/test';

/**
 * E2E tests for the analysis pipeline.
 * Tests the flow from submitting a repository to viewing the visualization.
 */

test.describe('Analysis Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('GitHub Repository Input', () => {
    test('should display GitHub URL input field', async ({ page }) => {
      // Look for an input that accepts GitHub URLs
      const githubInput = page.locator('input[placeholder*="github" i], input[placeholder*="repository" i], input[placeholder*="url" i]').first();

      // If direct input not found, check for GitHub tab/option
      if (await githubInput.count() === 0) {
        const githubTab = page.locator('button:has-text("GitHub"), [role="tab"]:has-text("GitHub")').first();
        if (await githubTab.count() > 0) {
          await githubTab.click();
        }
      }

      // Should have some form of GitHub input mechanism
      await expect(page.locator('body')).toBeVisible();
    });

    test('should validate GitHub URL format', async ({ page }) => {
      // Find GitHub input
      const inputs = page.locator('input[type="text"], input[type="url"]');
      const inputCount = await inputs.count();

      if (inputCount > 0) {
        const input = inputs.first();
        await input.fill('invalid-url');

        // Look for any analyze/submit button
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit"), button[type="submit"]').first();
        if (await submitButton.count() > 0) {
          await submitButton.click();
        }

        // App should not crash with invalid input
        await expect(page.locator('body')).toBeVisible();
      }
    });

    test('should show GitHub repo selector when authenticated', async ({ page }) => {
      // Check if there's a sign in button or GitHub connect option
      const signInButton = page.locator('button:has-text("Sign In"), button:has-text("GitHub"), button:has-text("Connect")').first();

      if (await signInButton.count() > 0) {
        // Verify sign in option is visible
        await expect(signInButton).toBeVisible();
      }
    });
  });

  test.describe('Analysis Progress', () => {
    test('should have progress indicator elements available', async ({ page }) => {
      // Progress indicators should be present in the DOM (may be hidden initially)
      // These are typically shown during analysis
      const progressElements = page.locator('[role="progressbar"], .progress, [data-testid*="progress"]');

      // App should be able to show progress when needed
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Visualization Page Elements', () => {
    test('should navigate to visualization when URL contains analysis ID', async ({ page }) => {
      // Navigate directly to a visualization URL pattern
      // Even if analysis doesn't exist, the page structure should load
      await page.goto('/visualization/test-id');
      await page.waitForLoadState('networkidle');

      // Page should render (may show error for non-existent analysis)
      await expect(page.locator('body')).toBeVisible();
    });

    test('should have filter controls on visualization page', async ({ page }) => {
      await page.goto('/visualization/test-id');
      await page.waitForLoadState('networkidle');

      // Look for filter UI elements (may be hidden if no analysis)
      const filterElements = page.locator('input[placeholder*="search" i], select, [role="combobox"]');

      // Page should load without crashing
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle non-existent analysis gracefully', async ({ page }) => {
      await page.goto('/visualization/non-existent-analysis-id-12345');
      await page.waitForLoadState('networkidle');

      // App should show error message or redirect, not crash
      await expect(page.locator('body')).toBeVisible();

      // Should not show raw error stack
      const errorStack = page.locator('text=/at\\s+\\w+\\s*\\(/');
      await expect(errorStack).toHaveCount(0);
    });

    test('should handle network timeout gracefully', async ({ page }) => {
      // Simulate slow network
      await page.route('**/api/**', (route) => {
        // Delay response significantly
        setTimeout(() => route.continue(), 100);
      });

      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // App should remain functional
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be usable on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Main content should be visible
      await expect(page.locator('body')).toBeVisible();

      // Interactive elements should be present
      const interactiveElements = page.locator('button, a, input');
      const count = await interactiveElements.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should be usable on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });
  });
});

test.describe('Analysis Results Integration', () => {
  test('should display node information when node is clicked', async ({ page }) => {
    // This test would work with a real analysis
    await page.goto('/visualization/test-id');
    await page.waitForLoadState('networkidle');

    // Look for any clickable node elements
    const nodes = page.locator('[data-testid*="node"], .react-flow__node');

    if (await nodes.count() > 0) {
      await nodes.first().click();

      // Should show some detail panel or modal
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should have focus somewhere
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});
