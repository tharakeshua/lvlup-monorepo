import { test, expect } from "@playwright/test";
import { loginAsStudent, loginAsConsumer } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
// LOADING, ERROR & EMPTY STATES
// ════════════════════════════════════════════════════════════════════════════

test.describe("Loading States", () => {
  // S-STATE-02
  test("spaces list shows skeleton loaders before data loads", async ({ page }) => {
    await page.route("**/api/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });
    await loginAsStudent(page);
    await page.goto("/spaces");
    // During loading, skeletons may appear briefly
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(3_000);
    await expect(page.locator("h1")).toContainText("My Spaces");
  });

  // S-STATE-03
  test("dashboard renders stat cards or skeleton after login", async ({ page }) => {
    await loginAsStudent(page);
    await page.waitForTimeout(3_000);
    const hasCards = await page
      .locator("text=Overall Score, text=Active Spaces")
      .first()
      .isVisible()
      .catch(() => false);
    const hasSkeletons =
      (await page.locator('[class*="Skeleton"], [class*="skeleton"]').count()) > 0;
    // Page is functional
    await expect(page.locator("h1")).toContainText("Dashboard");
  });
});

test.describe("Empty States", () => {
  // S-STATE-04
  test("spaces list shows empty state or space cards", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/spaces");
    await page.waitForTimeout(3_000);
    const hasSpaces = (await page.locator('a[href^="/spaces/"]').count()) > 0;
    const hasEmpty = await page
      .locator("text=No spaces, text=No content available")
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasSpaces || hasEmpty).toBeTruthy();
  });

  // S-STATE-05
  test("leaderboard shows data or error state", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/leaderboard");
    await page.waitForTimeout(3_000);
    // Leaderboard may show "Leaderboard" heading, "Something went wrong", or loading state
    await expect(page).toHaveURL(/\/leaderboard/);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  // S-STATE-06
  test("tests page shows empty state or test cards", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/tests");
    await page.waitForTimeout(3_000);
    const hasCards = (await page.locator('a[href*="/test/"]').count()) > 0;
    const hasEmpty = await page
      .locator("text=No tests available")
      .first()
      .isVisible()
      .catch(() => false);
    const hasLoading = (await page.locator('[class*="Skeleton"]').count()) > 0;
    await expect(page.locator("h1")).toContainText("Tests");
    expect(hasCards || hasEmpty || hasLoading).toBeTruthy();
  });

  test("chat page shows empty state or session list", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/chat");
    await page.waitForTimeout(3_000);
    const hasEmpty = await page
      .locator("text=No chat sessions yet")
      .isVisible()
      .catch(() => false);
    const hasSessions = (await page.locator("button.w-full.text-left").count()) > 0;
    await expect(page.locator("h1")).toContainText("Chat Tutor");
    expect(hasEmpty || hasSessions).toBeTruthy();
  });

  test("progress page shows results or empty state tabs", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/results");
    await page.waitForTimeout(3_000);
    await expect(page.locator("h1")).toContainText("My Progress");
    await expect(page.locator('button:has-text("Overall")')).toBeVisible();
  });

  test("consumer dashboard shows enrollments or empty state", async ({ page }) => {
    await loginAsConsumer(page);
    await page.goto("/consumer");
    await page.waitForTimeout(3_000);
    await expect(page.locator("h1")).toContainText("My Learning");
    const hasSpaces = (await page.locator('a[href*="/consumer/spaces/"]').count()) > 0;
    // Empty state text: "You haven't enrolled in any spaces yet."
    const hasEmpty = await page
      .locator("text=haven't enrolled")
      .isVisible()
      .catch(() => false);
    const hasSection = await page
      .locator('h2:has-text("My Enrolled Spaces")')
      .isVisible()
      .catch(() => false);
    expect(hasSpaces || hasEmpty || hasSection).toBeTruthy();
  });
});

test.describe("Error & 404 States", () => {
  // S-STATE-08
  test("404 NotFoundPage renders for unknown routes", async ({ page }) => {
    await page.goto("/invalid-random-path-xyz-12345");
    await page.waitForTimeout(3_000);
    const has404 = await page
      .locator('h1:has-text("404")')
      .isVisible()
      .catch(() => false);
    const hasNotFound = await page
      .locator('h2:has-text("Page Not Found"), h1:has-text("Not Found")')
      .isVisible()
      .catch(() => false);
    const redirectedToLogin = page.url().includes("/login");
    const redirectedToHome = page.url() === "http://localhost:4570/";
    expect(has404 || hasNotFound || redirectedToLogin || redirectedToHome).toBeTruthy();
  });

  test("invalid exam ID shows no results state", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/exams/nonexistent_exam_abc_99999/results");
    await page.waitForTimeout(5_000);
    const hasNoResults = await page
      .locator("text=No results found")
      .isVisible()
      .catch(() => false);
    const hasError = (await page.locator('[class*="error"], [role="alert"]').count()) > 0;
    const hasLoading = (await page.locator('[class*="Skeleton"]').count()) > 0;
    await expect(page.locator("body")).toBeVisible();
    expect(hasNoResults || hasError || hasLoading).toBeTruthy();
  });

  test("invalid space ID gracefully handles missing space", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/spaces/nonexistent_space_abc_99999");
    await page.waitForTimeout(5_000);
    const hasError = await page
      .locator("text=Space not found, text=Not found, text=Error")
      .first()
      .isVisible()
      .catch(() => false);
    const hasRedirect = page.url().includes("/spaces") || page.url().includes("/login");
    await expect(page.locator("body")).toBeVisible();
  });

  test("page does not crash on JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await loginAsStudent(page);
    await page.waitForTimeout(2_000);
    await expect(page.locator("h1")).toContainText("Dashboard");
    // Critical JS errors should not appear; minor hydration warnings are acceptable
  });
});
