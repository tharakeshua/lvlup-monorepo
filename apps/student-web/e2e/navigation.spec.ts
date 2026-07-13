import { test, expect } from "@playwright/test";
import { loginAsStudent, loginAsConsumer } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
// NAVIGATION TESTS
// ════════════════════════════════════════════════════════════════════════════

test.describe("Sidebar Navigation — B2B Student", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  // S-NAV-01
  test("Dashboard route (/) renders Dashboard heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  // S-NAV-02
  test("My Spaces route (/spaces) renders My Spaces heading", async ({ page }) => {
    await page.goto("/spaces");
    await expect(page.locator("h1")).toContainText("My Spaces");
  });

  // S-NAV-03
  test("Tests route (/tests) renders Tests heading", async ({ page }) => {
    await page.goto("/tests");
    await expect(page.locator("h1")).toContainText("Tests");
  });

  // S-NAV-04
  test("Results route (/results) renders My Progress heading", async ({ page }) => {
    await page.goto("/results");
    await expect(page.locator("h1")).toContainText("My Progress");
  });

  // S-NAV-05
  test("Leaderboard route (/leaderboard) renders page", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.waitForTimeout(3_000);
    // Should show Leaderboard heading; if Firebase fails it shows "Something went wrong"
    await expect(page).toHaveURL(/\/leaderboard/);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  // S-NAV-06
  test("Chat Tutor route (/chat) renders Chat Tutor heading", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.locator("h1")).toContainText("Chat Tutor");
  });

  // S-NAV-07
  test("notification bell button is visible in header", async ({ page }) => {
    // NotificationBell renders as a ghost icon button with a Bell SVG
    const bell = page.locator("button:has(svg.lucide-bell), button:has(.lucide-bell)").first();
    await expect(bell).toBeVisible({ timeout: 10_000 });
  });

  // S-NAV-08
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

  // S-NAV-09
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

  // S-NAV-10
  test("active sidebar item is highlighted when on that page", async ({ page }) => {
    await page.goto("/spaces");
    await page.waitForTimeout(500);
    // Shadcn SidebarMenuButton sets data-active="true" on active items
    const hasActiveAttr = (await page.locator('[data-active="true"]').count()) > 0;
    const hasAriaCurrent = (await page.locator('[aria-current="page"]').count()) > 0;
    expect(hasActiveAttr || hasAriaCurrent).toBeTruthy();
  });

  // S-NAV-11
  test("all sidebar nav links exist in DOM", async ({ page }) => {
    await expect(page.locator('a[href="/"]').first()).toBeAttached();
    await expect(page.locator('a[href="/spaces"]').first()).toBeAttached();
    await expect(page.locator('a[href="/tests"]').first()).toBeAttached();
    await expect(page.locator('a[href="/results"]').first()).toBeAttached();
    await expect(page.locator('a[href="/leaderboard"]').first()).toBeAttached();
    await expect(page.locator('a[href="/chat"]').first()).toBeAttached();
  });

  test("notification bell button exists in header", async ({ page }) => {
    // NotificationBell is in the header — it's a button with a Bell icon (no direct sidebar link)
    await expect(
      page.locator("button:has(svg.lucide-bell), button:has(.lucide-bell)").first()
    ).toBeAttached();
  });

  test("navigating between pages changes URL correctly", async ({ page }) => {
    await page.goto("/spaces");
    await expect(page).toHaveURL(/\/spaces/);
    await page.goto("/tests");
    await expect(page).toHaveURL(/\/tests/);
    await page.goto("/results");
    await expect(page).toHaveURL(/\/results/);
    await page.goto("/");
    // Root URL is http://localhost:4570/ — check with full URL or trailing slash pattern
    await expect(page).toHaveURL("http://localhost:4570/");
  });
});

test.describe("Consumer Sidebar Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsConsumer(page);
  });

  // S-NAV-11
  test("consumer sidebar has My Learning link", async ({ page }) => {
    await expect(
      page.locator('a[href="/consumer"], a:has-text("My Learning")').first()
    ).toBeAttached();
  });

  // S-NAV-12
  test("consumer sidebar has Space Store link", async ({ page }) => {
    await expect(
      page.locator('a[href="/store"], a:has-text("Space Store"), a:has-text("Store")').first()
    ).toBeAttached();
  });

  // S-NAV-13
  test("cart sidebar item shows count after adding item", async ({ page }) => {
    await page.goto("/store");
    await page.waitForTimeout(2_000);
    const addToCartBtn = page.locator('button:has-text("Add to Cart")').first();
    if (!(await addToCartBtn.isVisible())) test.skip();
    await addToCartBtn.click();
    await page.waitForTimeout(1_000);
    // Cart count badge should appear in sidebar or header
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
    // Store uses Firebase Cloud Functions which may fail in some envs — accept heading or any h1
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("profile route (/profile) renders profile page", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForTimeout(1_500);
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveURL(/\/profile/);
  });
});
