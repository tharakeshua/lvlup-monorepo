import { test, expect, Page } from "@playwright/test";
import { loginAsStudent } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
// PRACTICE MODE PAGE
// ════════════════════════════════════════════════════════════════════════════

async function navigateToPractice(page: Page): Promise<boolean> {
  await page.goto("/spaces");
  await page.waitForTimeout(2_000);
  const spaceLinks = page.locator('a[href^="/spaces/"]');
  if ((await spaceLinks.count()) === 0) return false;
  await spaceLinks.first().click();
  await page.waitForTimeout(2_000);
  const practiceLinks = page.locator('a[href*="/practice/"]');
  if ((await practiceLinks.count()) === 0) return false;
  await practiceLinks.first().click();
  await page.waitForURL(/\/practice\//, { timeout: 10_000 });
  await page.waitForTimeout(2_500);
  return true;
}

test.describe("Practice Mode Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("practice mode page renders with h1", async ({ page }) => {
    const ok = await navigateToPractice(page);
    if (!ok) test.skip();
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test('shows "Practice Mode" subtitle', async ({ page }) => {
    const ok = await navigateToPractice(page);
    if (!ok) test.skip();
    await expect(page.locator("text=Practice Mode")).toBeVisible();
  });

  test('shows "Unlimited retries" label', async ({ page }) => {
    const ok = await navigateToPractice(page);
    if (!ok) test.skip();
    await expect(page.locator("text=Unlimited retries")).toBeVisible();
  });

  test('shows "Solved" counter', async ({ page }) => {
    const ok = await navigateToPractice(page);
    if (!ok) test.skip();
    await expect(page.locator("text=Solved")).toBeVisible();
  });

  test("shows difficulty filter buttons", async ({ page }) => {
    const ok = await navigateToPractice(page);
    if (!ok) test.skip();
    await expect(page.locator('button:has-text("easy")')).toBeVisible();
    await expect(page.locator('button:has-text("medium")')).toBeVisible();
    await expect(page.locator('button:has-text("hard")')).toBeVisible();
  });

  test("difficulty filter is toggleable", async ({ page }) => {
    const ok = await navigateToPractice(page);
    if (!ok) test.skip();
    const easyBtn = page.locator('button:has-text("easy")');
    await easyBtn.click();
    await expect(easyBtn).toHaveClass(/bg-blue-500/);
    await easyBtn.click();
    await expect(easyBtn).not.toHaveClass(/bg-blue-500/);
  });

  test('"Previous" and "Next" navigation buttons are present', async ({ page }) => {
    const ok = await navigateToPractice(page);
    if (!ok) test.skip();
    await expect(page.locator('button:has-text("Previous")')).toBeVisible();
    await expect(page.locator('button:has-text("Next")')).toBeVisible();
  });

  test('"Previous" button is disabled on the first question', async ({ page }) => {
    const ok = await navigateToPractice(page);
    if (!ok) test.skip();
    await expect(page.locator('button:has-text("Previous")')).toBeDisabled();
  });

  test('shows question number indicator or "no questions" message', async ({ page }) => {
    const ok = await navigateToPractice(page);
    if (!ok) test.skip();
    const hasQ = await page
      .locator("text=Question 1 of")
      .isVisible()
      .catch(() => false);
    const hasNone = await page
      .locator("text=No questions match the filter")
      .isVisible()
      .catch(() => false);
    expect(hasQ || hasNone).toBeTruthy();
  });

  test("breadcrumb shows Spaces link", async ({ page }) => {
    const ok = await navigateToPractice(page);
    if (!ok) test.skip();
    await expect(page.locator('a:has-text("Spaces")')).toBeVisible();
  });

  test('"Next" button advances to next question when enabled', async ({ page }) => {
    const ok = await navigateToPractice(page);
    if (!ok) test.skip();
    const nextBtn = page.locator('button:has-text("Next")');
    const isEnabled = await nextBtn.isEnabled().catch(() => false);
    if (isEnabled) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator("text=Question 2 of")).toBeVisible();
    }
  });
});
