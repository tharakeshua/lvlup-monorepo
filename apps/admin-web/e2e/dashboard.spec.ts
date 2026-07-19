import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ─── 2.1 Page Load & Layout ───────────────────────────────────────────────

  // 2.1.1 P0
  test('shows "School Admin Dashboard" heading', async ({ page }) => {
    await expect(page.locator("h1")).toContainText("School Admin Dashboard");
  });

  // 2.1.2 P0
  test("dashboard loads without errors", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("body")).not.toContainText("Error");
    // h1 should be visible confirming a full render
    await expect(page.locator("h1")).toBeVisible();
  });

  // ─── 2.2 Statistics Score Cards ──────────────────────────────────────────

  // 2.2.1 P0
  test("renders Total Students scorecard", async ({ page }) => {
    await expect(page.locator("text=Total Students")).toBeVisible();
  });

  // 2.2.2 P0
  test("renders Total Teachers scorecard", async ({ page }) => {
    await expect(page.locator("text=Total Teachers")).toBeVisible();
  });

  // 2.2.3 P0
  test("renders Total Classes scorecard", async ({ page }) => {
    // "Classes" text exists in the scorecard section
    await expect(page.locator("main").locator("text=Classes").first()).toBeVisible();
  });

  // 2.2.4 P1
  test("renders Total Spaces scorecard", async ({ page }) => {
    await expect(page.locator("text=Total Spaces")).toBeVisible();
  });

  // 2.2.5 P1
  test("renders Total Exams scorecard", async ({ page }) => {
    await expect(page.locator("text=Total Exams")).toBeVisible();
  });

  // 2.2.6 P1
  test("renders At-Risk Students scorecard", async ({ page }) => {
    await expect(page.locator("text=At-Risk Students")).toBeVisible();
  });

  // ─── 2.3 Charts & Data Sections ──────────────────────────────────────────

  // 2.3.1 P1
  test("Class Performance chart or empty state is visible", async ({ page }) => {
    await page.waitForTimeout(3000);
    const hasChart = await page.locator("text=Class Performance").isVisible();
    const hasEmpty = await page.locator("text=No class performance data").isVisible();
    expect(hasChart || hasEmpty).toBeTruthy();
  });

  // 2.3.2 P1
  test("shows AI Cost Summary section with Today's Spend", async ({ page }) => {
    await expect(page.locator("text=AI Cost Summary")).toBeVisible();
    await expect(page.locator("text=Today's Spend")).toBeVisible();
  });

  // 2.3.3 P1
  test("shows Tenant Info card with code and contact", async ({ page }) => {
    await expect(page.locator("text=Tenant Code")).toBeVisible();
    // Subscription or plan label should be visible
    await expect(
      page.locator("text=Tenant Info").or(page.locator("text=Subscription"))
    ).toBeVisible();
  });
});
