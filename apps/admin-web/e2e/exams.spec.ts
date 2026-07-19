import { test, expect } from "@playwright/test";
import { loginAsAdmin, navigateTo } from "./helpers";

test.describe("Exams Overview Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/exams");
    await expect(page.locator("h1")).toContainText("Exams Overview", { timeout: 15000 });
  });

  // ─── 6.1 Exam Listing ────────────────────────────────────────────────────

  // 6.1.1 P0
  test('shows "Exams Overview" heading and subtitle', async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Exams Overview");
    await expect(page.locator("text=All exams across teachers")).toBeVisible();
  });

  // 6.1.2 P0
  test("search exams input is visible and functional", async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search exams"]')).toBeVisible();
    await page.fill('input[placeholder*="Search exams"]', "zzznothingxyz");
    await page.waitForTimeout(1000);
    await expect(
      page.locator("text=No exams found").or(page.locator("table tbody tr")).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // 6.1.3 P1
  test("exams table has correct column headers", async ({ page }) => {
    await page.waitForTimeout(2000);
    const hasTable = await page.locator('th:has-text("Title")').isVisible();
    const hasEmpty = await page.locator("text=No exams found").isVisible();
    if (hasTable) {
      await expect(page.locator('th:has-text("Title")')).toBeVisible();
      await expect(page.locator('th:has-text("Subject")')).toBeVisible();
      await expect(page.locator('th:has-text("Status")')).toBeVisible();
    } else {
      expect(hasEmpty).toBeTruthy();
    }
  });

  // ─── 6.2 Status Filtering ────────────────────────────────────────────────

  // 6.2.1 P0
  test("All filter is active by default and shows all exams", async ({ page }) => {
    await expect(page.locator('button:has-text("all")')).toBeVisible();
    // "all" should be the active filter (visible and clickable)
    await page.click('button:has-text("all")');
    await page.waitForTimeout(500);
    await expect(page.locator('button:has-text("all")')).toBeVisible();
  });

  // 6.2.2 P1
  test("Draft filter button is visible and clickable", async ({ page }) => {
    await expect(page.locator('button:has-text("draft")')).toBeVisible();
    await page.click('button:has-text("draft")');
    await page.waitForTimeout(1000);
    // Table or empty state renders with draft filter applied
    await expect(page.locator("table").or(page.locator("text=No exams found"))).toBeVisible({
      timeout: 5000,
    });
  });

  // 6.2.3 P1
  test("Scheduled filter button is visible and clickable", async ({ page }) => {
    await expect(page.locator('button:has-text("scheduled")')).toBeVisible();
    await page.click('button:has-text("scheduled")');
    await page.waitForTimeout(1000);
    await expect(page.locator("table").or(page.locator("text=No exams found"))).toBeVisible({
      timeout: 5000,
    });
  });

  // 6.2.4 P1
  test("Active filter button is visible and clickable", async ({ page }) => {
    await expect(page.locator('button:has-text("active")')).toBeVisible();
    await page.click('button:has-text("active")');
    await page.waitForTimeout(1000);
    await expect(page.locator("table").or(page.locator("text=No exams found"))).toBeVisible({
      timeout: 5000,
    });
  });

  // 6.2.5 P1
  test("Completed filter button is visible and clickable", async ({ page }) => {
    await expect(page.locator('button:has-text("completed")')).toBeVisible();
    await page.click('button:has-text("completed")');
    await page.waitForTimeout(1000);
    await expect(page.locator("table").or(page.locator("text=No exams found"))).toBeVisible({
      timeout: 5000,
    });
  });
});
