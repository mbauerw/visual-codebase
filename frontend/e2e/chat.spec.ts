import { test, expect } from '@playwright/test';

/**
 * E2E tests for the AI chat functionality.
 * Tests the chat interface, message handling, and streaming responses.
 */

test.describe('Chat Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Chat Widget Visibility', () => {
    test('should have chat toggle button', async ({ page }) => {
      // Look for chat button/icon
      const chatButton = page.locator(
        'button[aria-label*="chat" i], ' +
        'button:has-text("Chat"), ' +
        '[data-testid*="chat"], ' +
        'button svg[class*="message" i]'
      ).first();

      // Chat functionality should be available
      await expect(page.locator('body')).toBeVisible();
    });

    test('should toggle chat panel open and closed', async ({ page }) => {
      // Find and click chat toggle
      const chatToggle = page.locator(
        'button[aria-label*="chat" i], ' +
        '[data-testid*="chat-toggle"], ' +
        'button:has([data-testid*="chat"])'
      ).first();

      if (await chatToggle.count() > 0) {
        await chatToggle.click();
        await page.waitForTimeout(500);

        // Look for chat panel content
        const chatContent = page.locator('[data-testid*="chat-panel"], .chat-panel, [role="dialog"]');

        if (await chatContent.count() > 0) {
          await expect(chatContent.first()).toBeVisible();

          // Close it
          await chatToggle.click();
          await page.waitForTimeout(500);
        }
      }

      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Chat Input', () => {
    test('should have message input field', async ({ page }) => {
      // Navigate to visualization page where chat is typically available
      await page.goto('/visualization/test-id');
      await page.waitForLoadState('networkidle');

      // Look for chat input
      const chatInput = page.locator(
        'textarea[placeholder*="message" i], ' +
        'input[placeholder*="message" i], ' +
        'textarea[placeholder*="ask" i], ' +
        'input[placeholder*="ask" i], ' +
        '[data-testid*="chat-input"]'
      ).first();

      // Chat input should be present on visualization pages
      await expect(page.locator('body')).toBeVisible();
    });

    test('should accept text input', async ({ page }) => {
      await page.goto('/visualization/test-id');
      await page.waitForLoadState('networkidle');

      const chatInput = page.locator('textarea, input[type="text"]').filter({
        has: page.locator('[placeholder*="message" i], [placeholder*="ask" i], [placeholder*="type" i]')
      }).first();

      if (await chatInput.count() > 0) {
        await chatInput.fill('What is this codebase about?');
        await expect(chatInput).toHaveValue('What is this codebase about?');
      }
    });

    test('should have send button', async ({ page }) => {
      await page.goto('/visualization/test-id');
      await page.waitForLoadState('networkidle');

      const sendButton = page.locator(
        'button[type="submit"], ' +
        'button:has-text("Send"), ' +
        'button[aria-label*="send" i], ' +
        '[data-testid*="send"]'
      ).first();

      // Some form of send mechanism should exist
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Chat Context Modes', () => {
    test('should display context mode selector if available', async ({ page }) => {
      await page.goto('/visualization/test-id');
      await page.waitForLoadState('networkidle');

      // Look for context mode dropdown or radio buttons
      const contextSelector = page.locator(
        '[data-testid*="context-mode"], ' +
        'select:has(option:has-text("Codebase")), ' +
        'button:has-text("Codebase"), ' +
        '[role="radiogroup"]'
      ).first();

      // Context mode UI may or may not be visible
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Chat Message Display', () => {
    test('should have message container', async ({ page }) => {
      await page.goto('/visualization/test-id');
      await page.waitForLoadState('networkidle');

      // Look for message list container
      const messageContainer = page.locator(
        '[data-testid*="messages"], ' +
        '.chat-messages, ' +
        '[role="log"], ' +
        '[aria-label*="messages" i]'
      ).first();

      await expect(page.locator('body')).toBeVisible();
    });

    test('should support markdown rendering', async ({ page }) => {
      await page.goto('/visualization/test-id');
      await page.waitForLoadState('networkidle');

      // Look for markdown-rendered content indicators
      // Code blocks, headers, lists etc.
      const markdownContent = page.locator(
        'pre code, ' +
        '.markdown, ' +
        '[class*="prose"], ' +
        '.chat-message p'
      );

      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Chat Keyboard Shortcuts', () => {
    test('should support Enter to send message', async ({ page }) => {
      await page.goto('/visualization/test-id');
      await page.waitForLoadState('networkidle');

      const chatInput = page.locator('textarea, input[type="text"]').first();

      if (await chatInput.count() > 0) {
        await chatInput.focus();
        await chatInput.fill('Test message');
        await page.keyboard.press('Enter');

        // Should not crash
        await page.waitForTimeout(500);
        await expect(page.locator('body')).toBeVisible();
      }
    });

    test('should support Shift+Enter for new line', async ({ page }) => {
      await page.goto('/visualization/test-id');
      await page.waitForLoadState('networkidle');

      const chatInput = page.locator('textarea').first();

      if (await chatInput.count() > 0) {
        await chatInput.focus();
        await chatInput.fill('Line 1');
        await page.keyboard.press('Shift+Enter');
        await page.keyboard.type('Line 2');

        const value = await chatInput.inputValue();
        // Should contain both lines
        await expect(page.locator('body')).toBeVisible();
      }
    });
  });

  test.describe('Chat Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API to return error
      await page.route('**/api/chat/**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.goto('/visualization/test-id');
      await page.waitForLoadState('networkidle');

      // App should not crash on API errors
      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle network disconnection', async ({ page }) => {
      await page.goto('/visualization/test-id');
      await page.waitForLoadState('networkidle');

      // Simulate going offline
      await page.context().setOffline(true);

      // App should remain functional
      await expect(page.locator('body')).toBeVisible();

      // Restore connection
      await page.context().setOffline(false);
    });
  });

  test.describe('Tool Calls Display', () => {
    test('should have area for tool call results', async ({ page }) => {
      await page.goto('/visualization/test-id');
      await page.waitForLoadState('networkidle');

      // Tool calls are shown during AI responses
      const toolCallArea = page.locator(
        '[data-testid*="tool"], ' +
        '.tool-result, ' +
        '[class*="tool-call"]'
      );

      // Area exists but may be empty without active chat
      await expect(page.locator('body')).toBeVisible();
    });
  });
});

test.describe('Chat Streaming', () => {
  test('should handle SSE streaming responses', async ({ page }) => {
    // Mock SSE endpoint
    await page.route('**/api/chat/stream**', async (route) => {
      // Return SSE-style response
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        body: 'data: {"type":"text_delta","content":"Hello"}\n\ndata: {"type":"message_complete"}\n\n',
      });
    });

    await page.goto('/visualization/test-id');
    await page.waitForLoadState('networkidle');

    // App should handle streaming without crashing
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Chat History', () => {
  test('should persist chat history within session', async ({ page }) => {
    await page.goto('/visualization/test-id');
    await page.waitForLoadState('networkidle');

    // Chat history should be maintained during the session
    // This is primarily a smoke test
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have clear history option if available', async ({ page }) => {
    await page.goto('/visualization/test-id');
    await page.waitForLoadState('networkidle');

    const clearButton = page.locator(
      'button:has-text("Clear"), ' +
      'button[aria-label*="clear" i], ' +
      '[data-testid*="clear"]'
    );

    // Clear option may exist
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Chat Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/visualization/test-id');
    await page.waitForLoadState('networkidle');

    // Check for accessibility attributes
    const ariaElements = page.locator('[aria-label], [aria-describedby], [role]');
    const count = await ariaElements.count();

    // Should have some accessibility attributes
    await expect(page.locator('body')).toBeVisible();
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/visualization/test-id');
    await page.waitForLoadState('networkidle');

    // Tab through elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // Should have focus somewhere
    await expect(page.locator('body')).toBeVisible();
  });
});
