import { test, expect } from "@playwright/test";
import { loginAsAdmin, navigateTo } from "./helpers";

test.describe("AI Usage & Costs Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/ai-usage");
    await expect(page.locator("h1")).toContainText("AI Usage & Costs", { timeout: 15000 });
  });

  // ─── 9.1 Monthly Summary ─────────────────────────────────────────────────

  // 9.1.1 P0
  test('shows "AI Usage & Costs" heading and subtitle', async ({ page }) => {
    await expect(page.locator("h1")).toContainText("AI Usage & Costs");
    await expect(page.locator("text=Monitor AI API usage")).toBeVisible();
  });

  // 9.1.2 P0
  test("Monthly Cost scorecard is visible", async ({ page }) => {
    await expect(page.locator("text=Monthly Cost")).toBeVisible();
  });

  // 9.1.3 P1
  test("Total Calls scorecard is visible", async ({ page }) => {
    await expect(page.locator("text=Total Calls")).toBeVisible();
  });

  // 9.1.4 P1
  test("Input Tokens scorecard is visible", async ({ page }) => {
    await expect(page.locator("text=Input Tokens")).toBeVisible();
  });

  // 9.1.5 P1
  test("Output Tokens scorecard is visible", async ({ page }) => {
    await expect(page.locator("text=Output Tokens")).toBeVisible();
  });

  // ─── 9.2 Month Navigation ────────────────────────────────────────────────

  // 9.2.1 P0
  test("clicking previous month button changes the month label", async ({ page }) => {
    // Previous month button uses ChevronLeft icon (no text)
    const prevBtn = page.locator("button:has(svg.lucide-chevron-left)");
    await expect(prevBtn).toBeVisible();
    const initialLabel = await page.locator("span.text-sm.font-medium").first().textContent();
    await prevBtn.click();
    await page.waitForTimeout(500);
    const newLabel = await page.locator("span.text-sm.font-medium").first().textContent();
    expect(newLabel).not.toEqual(initialLabel);
  });

  // 9.2.2 P1
  test("next month button is disabled when viewing current month", async ({ page }) => {
    // Next month button uses ChevronRight icon (no text), disabled when monthOffset >= 0
    await expect(page.locator("button:has(svg.lucide-chevron-right)")).toBeDisabled();
  });

  // 9.2.3 P1
  test("next month button enables after navigating to previous month", async ({ page }) => {
    await page.click("button:has(svg.lucide-chevron-left)");
    await page.waitForTimeout(500);
    await expect(page.locator("button:has(svg.lucide-chevron-right)")).toBeEnabled();
  });

  // 9.2.4 P1
  test("month label displays correctly", async ({ page }) => {
    const label = await page.locator("span.text-sm.font-medium").first().textContent();
    // Label should contain a year (4 digits)
    expect(label).toMatch(/\d{4}/);
  });

  // ─── 9.3 Charts & Breakdown ──────────────────────────────────────────────

  // 9.3.1 P1
  test("Daily Cost Trend chart or empty state renders", async ({ page }) => {
    await page.waitForTimeout(3000);
    const hasChart = await page.locator("text=Daily Cost Trend").isVisible();
    const hasEmpty = await page.locator("text=No AI usage data").isVisible();
    expect(hasChart || hasEmpty).toBeTruthy();
  });

  // 9.3.2 P1
  test("Cost by Task Type chart or breakdown renders", async ({ page }) => {
    await page.waitForTimeout(3000);
    const hasByTask = await page
      .locator("text=Cost by Task Type")
      .isVisible()
      .catch(() => false);
    const hasByTaskAlt = await page
      .locator("text=Task Type")
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .locator("text=No AI usage data")
      .isVisible()
      .catch(() => false);
    // Chart showing task type breakdown (extraction, grading, evaluation, tutoring) or empty state
    expect(hasByTask || hasByTaskAlt || hasEmpty).toBeTruthy();
  });

  // 9.3.3 P1
  test("Daily breakdown table or empty state renders", async ({ page }) => {
    await page.waitForTimeout(3000);
    const hasTable = await page.locator("text=Daily Breakdown").isVisible();
    const hasEmpty = await page.locator("text=No AI usage data").isVisible();
    expect(hasTable || hasEmpty).toBeTruthy();
  });
});
