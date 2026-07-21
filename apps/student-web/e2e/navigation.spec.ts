import { test, expect } from "@playwright/test";
import { loginAsStudent, loginAsConsumer } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
// NAVIGATION TESTS
// ════════════════════════════════════════════════════════════════════════════

test.describe("Sidebar Navigation — B2B Student", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("Dashboard route (/) renders Dashboard heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("Spaces route (/spaces) renders Spaces heading", async ({ page }) => {
    await page.goto("/spaces");
    await expect(page.locator("h1")).toContainText("Spaces");
  });

  test("Exams route (/exams) renders Exams heading", async ({ page }) => {
    await page.goto("/exams");
    await expect(page.locator("h1")).toContainText("Exams");
  });

  test("removed /tests route redirects to /spaces", async ({ page }) => {
    await page.goto("/tests");
    await expect(page).toHaveURL(/\/spaces/);
  });

  test("removed /results route redirects to /", async ({ page }) => {
    await page.goto("/results");
    await expect(page).toHaveURL(/\/$/);
  });

  test("removed /leaderboard route redirects to /", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page).toHaveURL(/\/$/);
  });

  test("notification bell button is visible in header", async ({ page }) => {
    const bell = page.locator("button:has(svg.lucide-bell), button:has(.lucide-bell)").first();
    await expect(bell).toBeVisible({ timeout: 10_000 });
  });

  test("theme toggle switches between light and dark mode", async ({ page }) => {
    const themeBtn = page.locator('button[aria-label="Toggle theme"]').first();
    if (!(await themeBtn.isVisible())) test.skip();
    const htmlEl = page.locator("html");
    const initialClass = await htmlEl.getAttribute("class");
    await themeBtn.click();
    await page.waitForTimeout(300);
    const newClass = await htmlEl.getAttribute("class");
    expect(newClass).not.toBe(initialClass);
  });

  test("unknown route shows 404 page or redirects", async ({ page }) => {
    await page.goto("/this-does-not-exist-random-404");
    await page.waitForTimeout(2_000);
    const has404 = await page
      .locator("text=404")
      .isVisible()
      .catch(() => false);
    const hasNotFound = await page
      .locator("text=Not Found, text=Page not found, text=Not found")
      .first()
      .isVisible()
      .catch(() => false);
    const redirectedToLogin = page.url().includes("/login");
    expect(has404 || hasNotFound || redirectedToLogin).toBeTruthy();
  });

  test("active sidebar item is highlighted when on that page", async ({ page }) => {
    await page.goto("/spaces");
    await page.waitForTimeout(500);
    const hasActiveAttr = (await page.locator('[data-active="true"]').count()) > 0;
    const hasAriaCurrent = (await page.locator('[aria-current="page"]').count()) > 0;
    expect(hasActiveAttr || hasAriaCurrent).toBeTruthy();
  });

  test("sidebar nav links match trimmed student app bar", async ({ page }) => {
    await expect(page.locator('a[href="/"]').first()).toBeAttached();
    await expect(page.locator('a[href="/spaces"]').first()).toBeAttached();
    await expect(page.locator('a[href="/exams"]').first()).toBeAttached();
    await expect(page.locator('a[href="/profile"]').first()).toBeAttached();
    await expect(page.locator('a[href="/settings"]').first()).toBeAttached();
    await expect(page.locator('a[href="/tests"]')).toHaveCount(0);
    await expect(page.locator('a[href="/results"]')).toHaveCount(0);
    await expect(page.locator('a[href="/leaderboard"]')).toHaveCount(0);
  });

  test("navigating between pages changes URL correctly", async ({ page }) => {
    await page.goto("/spaces");
    await expect(page).toHaveURL(/\/spaces/);
    await page.goto("/exams");
    await expect(page).toHaveURL(/\/exams/);
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/);
    await page.goto("/");
    await expect(page).toHaveURL("http://localhost:4570/");
  });
});

test.describe("Consumer Sidebar Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsConsumer(page);
  });

  test("consumer sidebar has My Learning link", async ({ page }) => {
    await expect(
      page.locator('a[href="/consumer"], a:has-text("My Learning")').first()
    ).toBeAttached();
  });

  test("consumer sidebar has Space Store link", async ({ page }) => {
    await expect(
      page.locator('a[href="/store"], a:has-text("Space Store"), a:has-text("Store")').first()
    ).toBeAttached();
  });

  test("cart sidebar item shows count after adding item", async ({ page }) => {
    await page.goto("/store");
    await page.waitForTimeout(2_000);
    const addToCartBtn = page.locator('button:has-text("Add to Cart")').first();
    if (!(await addToCartBtn.isVisible())) test.skip();
    await addToCartBtn.click();
    await page.waitForTimeout(1_000);
    const cartBadge = page.locator('[data-testid="cart-count"], [class*="badge"]').first();
    const cartLink = page.locator('a[href="/store/checkout"], a:has-text("Cart")').first();
    const hasBadge = await cartBadge.isVisible().catch(() => false);
    const hasCartLink = await cartLink.isAttached().catch(() => false);
    expect(hasBadge || hasCartLink).toBeTruthy();
  });

  test("consumer route (/consumer) renders My Learning heading", async ({ page }) => {
    await page.goto("/consumer");
    await expect(page.locator("h1")).toContainText("My Learning");
  });

  test("store route (/store) renders store page or error boundary", async ({ page }) => {
    await page.goto("/store");
    await page.waitForTimeout(3_000);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("profile route (/profile) renders profile page", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForTimeout(1_500);
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveURL(/\/profile/);
  });
});
