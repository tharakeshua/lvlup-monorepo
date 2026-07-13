import { test, expect } from "@playwright/test";
import { loginAsStudent } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
// PROGRESS / RESULTS PAGE
// ════════════════════════════════════════════════════════════════════════════

test.describe("Progress Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/results");
    await page.waitForTimeout(2_500);
  });

  test('renders "My Progress" heading', async ({ page }) => {
    await expect(page.locator("h1")).toContainText("My Progress");
  });

  test("shows three tabs: Overall, Exams, Spaces", async ({ page }) => {
    await expect(page.locator('button:has-text("Overall")')).toBeVisible();
    await expect(page.locator('button:has-text("Exams")')).toBeVisible();
    await expect(page.locator('button:has-text("Spaces")')).toBeVisible();
  });

  test("Overall tab is active by default", async ({ page }) => {
    const overallTab = page.locator('button:has-text("Overall")');
    await expect(overallTab).toHaveClass(/border-primary/);
  });

  test("Overall tab shows score cards or empty message", async ({ page }) => {
    const hasScore = await page
      .locator("text=Overall Score")
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .locator("text=No overall progress data yet")
      .isVisible()
      .catch(() => false);
    expect(hasScore || hasEmpty).toBeTruthy();
  });

  test("switching to Exams tab shows content", async ({ page }) => {
    await page.locator('button:has-text("Exams")').click();
    await page.waitForTimeout(1_000);
    const hasTable = await page
      .locator("table")
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .locator("text=No exam results yet")
      .isVisible()
      .catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test("switching to Spaces tab shows content", async ({ page }) => {
    await page.locator('button:has-text("Spaces")').click();
    await page.waitForTimeout(1_000);
    const hasCards = (await page.locator('a[href^="/spaces/"]').count()) > 0;
    const hasEmpty = await page
      .locator("text=No spaces to track")
      .isVisible()
      .catch(() => false);
    expect(hasCards || hasEmpty).toBeTruthy();
  });

  test("Spaces tab cards navigate to space viewer", async ({ page }) => {
    await page.locator('button:has-text("Spaces")').click();
    await page.waitForTimeout(2_000);
    const spaceCards = page.locator('a[href^="/spaces/"]');
    if ((await spaceCards.count()) > 0) {
      await spaceCards.first().click();
      await expect(page).toHaveURL(/\/spaces\/.+/);
    }
  });

  test("Exams tab shows table headers when data exists", async ({ page }) => {
    await page.locator('button:has-text("Exams")').click();
    await page.waitForTimeout(1_500);
    const hasTable = await page
      .locator("table")
      .isVisible()
      .catch(() => false);
    if (hasTable) {
      await expect(page.locator('th:has-text("Exam")')).toBeVisible();
      await expect(page.locator('th:has-text("Score")')).toBeVisible();
      await expect(page.locator('th:has-text("Percentage")')).toBeVisible();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// EXAM RESULT DETAIL PAGE
// ════════════════════════════════════════════════════════════════════════════

test.describe("Exam Result Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test('unknown exam ID shows "no results" state or loading', async ({ page }) => {
    await page.goto("/exams/nonexistent_exam_xyz_12345/results");
    await page.waitForTimeout(5_000);
    const hasNoResults = await page
      .locator("text=No results found for this exam")
      .isVisible()
      .catch(() => false);
    const hasLoading = (await page.locator('[class*="Skeleton"]').count()) > 0;
    expect(hasNoResults || hasLoading).toBeTruthy();
  });

  test('"Back to Results" link on no-results state navigates to /results', async ({ page }) => {
    await page.goto("/exams/nonexistent_exam_xyz_12345/results");
    await page.waitForTimeout(5_000);
    const hasNoResults = await page
      .locator("text=No results found for this exam")
      .isVisible()
      .catch(() => false);
    if (hasNoResults) {
      await page.locator('a:has-text("Back to Results")').click();
      await expect(page).toHaveURL(/\/results/);
    }
  });

  test("navigating to exam result via progress page Exams tab", async ({ page }) => {
    await page.goto("/results");
    await page.waitForTimeout(2_000);
    await page.locator('button:has-text("Exams")').click();
    await page.waitForTimeout(1_000);
    const examLinks = page.locator('a[href*="/exams/"]');
    if ((await examLinks.count()) > 0) {
      await examLinks.first().click();
      await expect(page).toHaveURL(/\/exams\/.+\/results/);
      await page.waitForTimeout(3_000);
      const hasBreadcrumb = await page
        .locator('a:has-text("Results")')
        .isVisible()
        .catch(() => false);
      const hasScore = await page
        .locator("text=Score")
        .isVisible()
        .catch(() => false);
      const hasNoResult = await page
        .locator("text=No results found")
        .isVisible()
        .catch(() => false);
      expect(hasBreadcrumb || hasScore || hasNoResult).toBeTruthy();
    }
  });

  test("exam result page shows score, marks when data exists", async ({ page }) => {
    await page.goto("/results");
    await page.waitForTimeout(2_000);
    await page.locator('button:has-text("Exams")').click();
    await page.waitForTimeout(1_000);
    const examLinks = page.locator('a[href*="/exams/"]');
    if ((await examLinks.count()) > 0) {
      await examLinks.first().click();
      await page.waitForTimeout(3_500);
      const hasScore = await page
        .locator("text=Score")
        .isVisible()
        .catch(() => false);
      const hasMarks = await page
        .locator("text=Marks")
        .isVisible()
        .catch(() => false);
      const hasNoResults = await page
        .locator("text=No results found")
        .isVisible()
        .catch(() => false);
      expect(hasScore || hasMarks || hasNoResults).toBeTruthy();
    }
  });

  test('"Back to Results" link navigates to /results page', async ({ page }) => {
    await page.goto("/results");
    await page.waitForTimeout(2_000);
    await page.locator('button:has-text("Exams")').click();
    await page.waitForTimeout(1_000);
    const examLinks = page.locator('a[href*="/exams/"]');
    if ((await examLinks.count()) > 0) {
      await examLinks.first().click();
      await page.waitForTimeout(3_000);
      const backLink = page.locator('a:has-text("Back to Results")');
      if (await backLink.isVisible()) {
        await backLink.click();
        await expect(page).toHaveURL(/\/results/);
      }
    }
  });

  test('"Print Results" button is visible when result exists', async ({ page }) => {
    await page.goto("/results");
    await page.waitForTimeout(2_000);
    await page.locator('button:has-text("Exams")').click();
    await page.waitForTimeout(1_000);
    const examLinks = page.locator('a[href*="/exams/"]');
    if ((await examLinks.count()) > 0) {
      await examLinks.first().click();
      await page.waitForTimeout(3_000);
      const hasPrint = await page
        .locator('button:has-text("Print Results")')
        .isVisible()
        .catch(() => false);
      const hasNoResult = await page
        .locator("text=No results found")
        .isVisible()
        .catch(() => false);
      expect(hasPrint || hasNoResult).toBeTruthy();
    }
  });
});
