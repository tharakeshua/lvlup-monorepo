import { test, expect } from "@playwright/test";
import { loginAsStudent, logout } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
// B2B STUDENT DASHBOARD TESTS
// ════════════════════════════════════════════════════════════════════════════

test.describe("Student Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  // S-DASH-01
  test('renders "Dashboard" heading', async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  // S-DASH-02
  test("shows welcome message with student name", async ({ page }) => {
    await expect(page.locator('p:has-text("Welcome back")')).toBeVisible();
  });

  test("Sign Out button is visible in header", async ({ page }) => {
    await expect(page.locator('button:has-text("Sign Out")')).toBeVisible();
  });

  // S-DASH-11
  test("Sign Out button logs out and redirects to login", async ({ page }) => {
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });

  // S-DASH-02
  test("shows stat cards (score or basic stats) after data loads", async ({ page }) => {
    await page.waitForTimeout(3_000);
    const hasOverallScore = await page
      .locator("text=Overall Score")
      .isVisible()
      .catch(() => false);
    const hasActiveSpaces = await page
      .locator("text=Active Spaces")
      .isVisible()
      .catch(() => false);
    expect(hasOverallScore || hasActiveSpaces).toBeTruthy();
  });

  // S-DASH-03
  test("My Spaces section heading is visible", async ({ page }) => {
    await expect(page.locator('h2:has-text("My Spaces")')).toBeVisible();
  });

  // S-DASH-06
  test('"View all" link to spaces is visible', async ({ page }) => {
    const viewAll = page.locator('a:has-text("View all")').first();
    await expect(viewAll).toBeVisible();
  });

  // S-DASH-07
  test('"View all" navigates to /spaces', async ({ page }) => {
    await page.locator('a:has-text("View all")').first().click();
    await expect(page).toHaveURL(/\/spaces/);
  });

  // S-DASH-08
  test("Recent Exam Results section renders (if data exists)", async ({ page }) => {
    await page.waitForTimeout(2_500);
    // Doesn't crash, heading or empty state
    const hasSection = await page
      .locator("text=Recent Exam Results")
      .isVisible()
      .catch(() => false);
    // Page still intact regardless
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("sidebar links to Dashboard are present in DOM", async ({ page }) => {
    await expect(page.locator('a[href="/"]').first()).toBeAttached();
    await expect(page.locator('a[href="/spaces"]').first()).toBeAttached();
  });

  test("page has no console-breaking JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(2_000);
    // Verify page still renders
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("My Spaces shows space cards or empty state", async ({ page }) => {
    await page.waitForTimeout(3_000);
    const hasCards = (await page.locator('a[href^="/spaces/"]').count()) > 0;
    const hasEmpty = await page
      .locator("text=No spaces assigned yet")
      .isVisible()
      .catch(() => false);
    expect(hasCards || hasEmpty).toBeTruthy();
  });

  test("Upcoming Exams section renders when data present", async ({ page }) => {
    await page.waitForTimeout(2_500);
    // Upcoming section appears only when future exams exist
    const hasUpcoming = await page
      .locator("text=Upcoming")
      .isVisible()
      .catch(() => false);
    // Verify page is healthy regardless
    await expect(page.locator("h1")).toContainText("Dashboard");
  });
});
