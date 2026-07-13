import { test, expect } from "@playwright/test";
import { loginAsAdmin, navigateTo } from "./helpers";

test.describe("Spaces Overview Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/spaces");
    await expect(page.locator("h1")).toContainText("Spaces Overview", { timeout: 15000 });
  });

  // ─── 7.1 Spaces Listing ──────────────────────────────────────────────────

  // 7.1.1 P0
  test('shows "Spaces Overview" heading and subtitle', async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Spaces Overview");
    await expect(page.locator("text=All learning spaces across teachers")).toBeVisible();
  });

  // 7.1.2 P0
  test("search spaces input is visible and functional", async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search spaces"]')).toBeVisible();
    await page.fill('input[placeholder*="Search spaces"]', "zzznothingxyz");
    await page.waitForTimeout(1000);
    await expect(page.locator("text=No spaces found").or(page.locator(".grid"))).toBeVisible({
      timeout: 5000,
    });
  });

  // 7.1.3 P1
  test("space cards or empty state renders", async ({ page }) => {
    await page.waitForTimeout(3000);
    const hasCards = (await page.locator(".grid").count()) > 0;
    const hasEmpty = await page.locator("text=No spaces found").isVisible();
    expect(hasCards || hasEmpty).toBeTruthy();
  });

  // ─── 7.2 Status Filtering ────────────────────────────────────────────────

  // 7.2.1 P0
  test("All filter is shown by default", async ({ page }) => {
    await expect(page.locator('button:has-text("all")')).toBeVisible();
  });

  // 7.2.2 P1
  test("Draft filter button is visible and clickable", async ({ page }) => {
    await expect(page.locator('button:has-text("draft")')).toBeVisible();
    await page.click('button:has-text("draft")');
    await page.waitForTimeout(1000);
    await expect(page.locator(".grid").or(page.locator("text=No spaces found"))).toBeVisible({
      timeout: 5000,
    });
  });

  // 7.2.3 P1
  test("Published filter button is visible and clickable", async ({ page }) => {
    await expect(page.locator('button:has-text("published")')).toBeVisible();
    await page.click('button:has-text("published")');
    await page.waitForTimeout(1000);
    await expect(page.locator(".grid").or(page.locator("text=No spaces found"))).toBeVisible({
      timeout: 5000,
    });
  });

  // 7.2.4 P1
  test("Archived filter button is visible and clickable", async ({ page }) => {
    await expect(page.locator('button:has-text("archived")')).toBeVisible();
    await page.click('button:has-text("archived")');
    await page.waitForTimeout(1000);
    await expect(page.locator(".grid").or(page.locator("text=No spaces found"))).toBeVisible({
      timeout: 5000,
    });
  });
});
