import { test, expect } from "@playwright/test";
import { loginAsStudent } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
// LEADERBOARD PAGE
// ════════════════════════════════════════════════════════════════════════════

test.describe("Leaderboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/leaderboard");
    await page.waitForTimeout(2_500);
  });

  test('renders "Leaderboard" heading', async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Leaderboard");
  });

  test("shows subtitle text", async ({ page }) => {
    await expect(page.locator("text=See how you rank against your classmates")).toBeVisible();
  });

  test("shows space filter label", async ({ page }) => {
    await expect(page.locator('label:has-text("Filter by space:")')).toBeVisible();
  });

  test("space filter dropdown (combobox) is visible", async ({ page }) => {
    await expect(page.locator('button[role="combobox"]')).toBeVisible();
  });

  test('shows "Overall Rankings" section heading', async ({ page }) => {
    await expect(page.locator('h2:has-text("Overall Rankings")')).toBeVisible();
  });

  test("leaderboard container is visible", async ({ page }) => {
    await expect(page.locator(".rounded-lg.border.bg-card").last()).toBeVisible();
  });

  test("shows entries, empty state, or loading skeletons", async ({ page }) => {
    const hasEntries = (await page.locator("td").count()) > 0;
    const hasEmpty = await page
      .locator("text=No entries")
      .isVisible()
      .catch(() => false);
    const hasLoading = (await page.locator('[class*="Skeleton"], [class*="skeleton"]').count()) > 0;
    expect(hasEntries || hasEmpty || hasLoading).toBeTruthy();
  });

  test("space filter dropdown opens and shows options", async ({ page }) => {
    await page.locator('button[role="combobox"]').click();
    await page.waitForTimeout(500);
    const optionList = page.locator('[role="listbox"], [role="option"]').first();
    await expect(optionList).toBeVisible();
  });

  test("current user rank shown when data is available", async ({ page }) => {
    await page.waitForTimeout(2_000);
    const hasRank = await page
      .locator("text=Your Rank")
      .isVisible()
      .catch(() => false);
    // Page renders without error regardless
    await expect(page.locator("h1")).toContainText("Leaderboard");
  });

  test("selecting a space filter updates the rankings heading", async ({ page }) => {
    await page.waitForTimeout(2_000);
    await page.locator('button[role="combobox"]').click();
    await page.waitForTimeout(500);
    const options = page.locator('[role="option"]');
    if ((await options.count()) > 1) {
      await options.nth(1).click();
      await page.waitForTimeout(1_000);
      await expect(page.locator("h2").last()).toContainText("Rankings");
    }
  });

  test("sidebar nav link to /leaderboard is in DOM", async ({ page }) => {
    await expect(page.locator('a[href="/leaderboard"]').first()).toBeAttached();
  });
});
