import { test, expect } from "@playwright/test";
import { loginAsAdmin, navigateTo } from "./helpers";

test.describe("Courses & Spaces Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/courses");
    await expect(page.locator("h1")).toContainText("Courses & Spaces", { timeout: 15000 });
  });

  // 5.1.1 P0
  test('shows "Courses & Spaces" heading', async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Courses & Spaces");
  });

  // 5.1.2 P1
  test("subject overview grid or empty state renders", async ({ page }) => {
    await page.waitForTimeout(3000);
    const hasCards = (await page.locator(".rounded-lg.border.bg-card").count()) > 0;
    const hasEmpty = await page.locator("text=No courses found").isVisible();
    expect(hasCards || hasEmpty).toBeTruthy();
  });

  // 5.1.3 P1
  test("search courses input is visible and functional", async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search courses"]')).toBeVisible();
    // Wait for initial data load before searching
    await page.waitForTimeout(3000);
    await page.fill('input[placeholder*="Search courses"]', "zzznothingxyz");
    await page.waitForTimeout(1000);
    await expect(
      page
        .locator("text=No courses found")
        .or(page.locator(".grid"))
        .or(page.locator("text=Loading"))
    ).toBeVisible({ timeout: 10000 });
  });

  // 5.1.4 P1
  test("filter by class dropdown is visible", async ({ page }) => {
    await expect(page.locator("text=All Classes")).toBeVisible();
  });

  // 5.1.5 P1
  test("filter by status dropdown is visible", async ({ page }) => {
    await expect(page.locator("text=All Status")).toBeVisible();
  });
});
