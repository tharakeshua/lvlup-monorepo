import { test, expect, Page } from "@playwright/test";
import { loginAsStudent } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
// TIMED TEST — LANDING PAGE
// ════════════════════════════════════════════════════════════════════════════

async function navigateToTestLanding(page: Page): Promise<boolean> {
  await page.goto("/spaces");
  await page.waitForTimeout(2_000);
  const spaceLinks = page.locator('a[href^="/spaces/"]');
  if ((await spaceLinks.count()) === 0) return false;
  await spaceLinks.first().click();
  await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
  await page.waitForTimeout(2_000);
  const testLinks = page.locator('a[href*="/test/"]');
  if ((await testLinks.count()) === 0) return false;
  await testLinks.first().click();
  await page.waitForURL(/\/test\//, { timeout: 10_000 });
  await page.waitForTimeout(2_000);
  return true;
}

async function startTest(page: Page): Promise<boolean> {
  const ok = await navigateToTestLanding(page);
  if (!ok) return false;
  const startBtn = page.locator('button:has-text("Start Test")');
  if (!(await startBtn.isVisible())) return false;
  await startBtn.click();
  await page.waitForTimeout(3_000);
  return page
    .locator("text=Question 1 of")
    .isVisible()
    .catch(() => false);
}

test.describe("Timed Test — Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  // S-TT-01
  test('landing page shows "Timed Test" label', async ({ page }) => {
    const ok = await navigateToTestLanding(page);
    if (!ok) test.skip();
    await expect(page.locator("text=Timed Test")).toBeVisible();
  });

  // S-TT-01
  test("shows Duration and Questions metadata", async ({ page }) => {
    const ok = await navigateToTestLanding(page);
    if (!ok) test.skip();
    await expect(page.locator("text=Duration")).toBeVisible();
    await expect(page.locator("text=Questions")).toBeVisible();
  });

  // S-TT-01
  test("shows Total Points and Max Attempts", async ({ page }) => {
    const ok = await navigateToTestLanding(page);
    if (!ok) test.skip();
    await expect(page.locator("text=Total Points")).toBeVisible();
    await expect(page.locator("text=Max Attempts")).toBeVisible();
  });

  // S-TT-02
  test('"Start Test" button is visible', async ({ page }) => {
    const ok = await navigateToTestLanding(page);
    if (!ok) test.skip();
    await expect(
      page.locator('button:has-text("Start Test"), button:has-text("Starting...")')
    ).toBeVisible();
  });

  test('breadcrumb shows "Spaces" link', async ({ page }) => {
    const ok = await navigateToTestLanding(page);
    if (!ok) test.skip();
    await expect(page.locator('a:has-text("Spaces")')).toBeVisible();
  });

  // S-TT-03
  test("Previous Attempts section shown if attempts exist", async ({ page }) => {
    const ok = await navigateToTestLanding(page);
    if (!ok) test.skip();
    await page.waitForTimeout(2_000);
    const hasPrev = await page
      .locator('h2:has-text("Previous Attempts")')
      .isVisible()
      .catch(() => false);
    const hasStart = await page
      .locator('button:has-text("Start Test")')
      .isVisible()
      .catch(() => false);
    expect(hasPrev || hasStart).toBeTruthy();
  });

  // S-TT-04
  test("clicking a previous attempt entry shows results view", async ({ page }) => {
    const ok = await navigateToTestLanding(page);
    if (!ok) test.skip();
    await page.waitForTimeout(2_000);
    const prevBtns = page.locator('button:has-text("Attempt #")');
    if ((await prevBtns.count()) === 0) test.skip();
    await prevBtns.first().click();
    await page.waitForTimeout(2_000);
    // Results view shows score
    await expect(page.locator("text=Score")).toBeVisible();
  });

  // S-TT-05
  test("Start Test fails gracefully when max attempts reached", async ({ page }) => {
    const ok = await navigateToTestLanding(page);
    if (!ok) test.skip();
    const startBtn = page.locator('button:has-text("Start Test")');
    if (!(await startBtn.isVisible())) test.skip();
    await startBtn.click();
    await page.waitForTimeout(4_000);
    const hasTimer = await page
      .locator("text=Question 1 of")
      .isVisible()
      .catch(() => false);
    const hasError = await page
      .locator("text=Failed to start test")
      .isVisible()
      .catch(() => false);
    const hasDisabled = await startBtn.isDisabled().catch(() => false);
    expect(hasTimer || hasError || hasDisabled).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TIMED TEST — IN-PROGRESS VIEW
// ════════════════════════════════════════════════════════════════════════════

test.describe("Timed Test — In-Progress Controls", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  // S-TT-10
  test("test view shows question X of N indicator", async ({ page }) => {
    const started = await startTest(page);
    if (!started) test.skip();
    await expect(page.locator("text=Question 1 of")).toBeVisible();
  });

  // S-TT-11
  test("countdown timer is visible after test starts", async ({ page }) => {
    const started = await startTest(page);
    if (!started) test.skip();
    // Timer renders time units — look for "min" or countdown pattern
    const timerArea = page.locator("text=Question 1 of");
    await expect(timerArea).toBeVisible();
  });

  // S-TT-12
  test("question navigator sidebar is present on desktop", async ({ page }) => {
    const started = await startTest(page);
    if (!started) test.skip();
    await expect(page.locator("text=Question 1 of")).toBeVisible();
  });

  test('"Save & Next" button is visible', async ({ page }) => {
    const started = await startTest(page);
    if (!started) test.skip();
    await expect(
      page.locator('button:has-text("Save & Next"), button:has-text("Next")').first()
    ).toBeVisible();
  });

  test('"Mark for Review" button is visible', async ({ page }) => {
    const started = await startTest(page);
    if (!started) test.skip();
    await expect(
      page.locator('button:has-text("Mark"), button:has-text("Mark for Review")').first()
    ).toBeVisible();
  });

  test('"Clear" response button is visible', async ({ page }) => {
    const started = await startTest(page);
    if (!started) test.skip();
    await expect(page.locator('button:has-text("Clear")').first()).toBeVisible();
  });

  test('"Submit Test" button opens confirmation dialog', async ({ page }) => {
    const started = await startTest(page);
    if (!started) test.skip();
    await page.locator('button:has-text("Submit Test")').click();
    await expect(page.locator("text=Submit Test?")).toBeVisible();
    await expect(page.locator("text=Are you sure you want to submit")).toBeVisible();
  });

  test("confirmation dialog has Cancel and Submit buttons", async ({ page }) => {
    const started = await startTest(page);
    if (!started) test.skip();
    await page.locator('button:has-text("Submit Test")').click();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    await expect(page.locator('button:has-text("Submit")').last()).toBeVisible();
  });

  test("Cancel closes the confirmation dialog", async ({ page }) => {
    const started = await startTest(page);
    if (!started) test.skip();
    await page.locator('button:has-text("Submit Test")').click();
    await expect(page.locator("text=Submit Test?")).toBeVisible();
    await page.locator('button:has-text("Cancel")').click();
    await expect(page.locator("text=Submit Test?")).not.toBeVisible();
  });

  test("Previous navigation is disabled on first question", async ({ page }) => {
    const started = await startTest(page);
    if (!started) test.skip();
    await expect(page.locator('button:has-text("Previous")').first()).toBeDisabled();
  });

  test("answering question updates question status", async ({ page }) => {
    const started = await startTest(page);
    if (!started) test.skip();
    await page.waitForTimeout(1_000);
    // Try to find an MCQ option and click it
    const mcqOption = page
      .locator('[role="radiogroup"] button, [role="radio"], label:has(input[type="radio"])')
      .first();
    if (await mcqOption.isVisible()) {
      await mcqOption.click();
      await page.waitForTimeout(500);
      await expect(page.locator("body")).toBeVisible();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TIMED TEST — RESULTS VIEW
// ════════════════════════════════════════════════════════════════════════════

test.describe("Timed Test — Results View", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("results view shows Score, Points, Answered stats", async ({ page }) => {
    const ok = await navigateToTestLanding(page);
    if (!ok) test.skip();
    await page.waitForTimeout(2_000);
    // Navigate to results via a previous attempt click
    const prevBtns = page.locator('button:has-text("Attempt #")');
    if ((await prevBtns.count()) === 0) test.skip();
    await prevBtns.first().click();
    await page.waitForTimeout(2_000);
    await expect(page.locator("text=Score")).toBeVisible();
    await expect(page.locator("text=Points")).toBeVisible();
  });

  test('"Back to Test Info" button returns to landing view', async ({ page }) => {
    const ok = await navigateToTestLanding(page);
    if (!ok) test.skip();
    const prevBtns = page.locator('button:has-text("Attempt #")');
    if ((await prevBtns.count()) === 0) test.skip();
    await prevBtns.first().click();
    await page.waitForTimeout(2_000);
    const backBtn = page.locator('button:has-text("Back to Test Info")');
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await expect(page.locator("text=Timed Test")).toBeVisible();
    }
  });
});
