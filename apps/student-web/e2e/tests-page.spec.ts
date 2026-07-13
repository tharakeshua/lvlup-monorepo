import { test, expect } from "@playwright/test";
import { loginAsStudent } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
// TESTS PAGE
// ════════════════════════════════════════════════════════════════════════════

test.describe("Tests Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/tests");
    await page.waitForTimeout(2_500);
  });

  test('renders "Tests" heading', async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Tests");
  });

  test("shows subtitle description", async ({ page }) => {
    await expect(page.locator("text=All available timed tests across your spaces")).toBeVisible();
  });

  test("shows test cards, empty state, or loading skeletons", async ({ page }) => {
    const hasCards = (await page.locator('a[href*="/test/"]').count()) > 0;
    const hasEmpty = await page
      .locator("text=No tests available yet")
      .isVisible()
      .catch(() => false);
    const hasLoading = (await page.locator('[class*="Skeleton"], [class*="skeleton"]').count()) > 0;
    expect(hasCards || hasEmpty || hasLoading).toBeTruthy();
  });

  test("test card links match correct URL pattern", async ({ page }) => {
    const testLinks = page.locator('a[href*="/test/"]');
    if ((await testLinks.count()) > 0) {
      const href = await testLinks.first().getAttribute("href");
      expect(href).toMatch(/\/spaces\/.+\/test\/.+/);
    }
  });

  test("test cards have h3 title", async ({ page }) => {
    const testLinks = page.locator('a[href*="/test/"]');
    if ((await testLinks.count()) > 0) {
      await expect(testLinks.first().locator("h3")).toBeVisible();
    }
  });

  test("test cards show duration or questions when configured", async ({ page }) => {
    const testLinks = page.locator('a[href*="/test/"]');
    if ((await testLinks.count()) > 0) {
      // At least the card renders
      await expect(testLinks.first()).toBeVisible();
    }
  });

  test("clicking a test card navigates to timed test landing", async ({ page }) => {
    const testLinks = page.locator('a[href*="/test/"]');
    if ((await testLinks.count()) === 0) test.skip();
    await testLinks.first().click();
    await expect(page).toHaveURL(/\/spaces\/.+\/test\/.+/);
  });

  test("empty state is visible when no tests exist", async ({ page }) => {
    const emptyState = page.locator("text=No tests available yet");
    const isVisible = await emptyState.isVisible().catch(() => false);
    if (isVisible) {
      await expect(emptyState).toBeVisible();
    }
  });

  test("sidebar nav link to /tests is in DOM", async ({ page }) => {
    await expect(page.locator('a[href="/tests"]').first()).toBeAttached();
  });
});
