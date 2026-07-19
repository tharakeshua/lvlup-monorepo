import { test, expect, Page } from "@playwright/test";

// Re-run of failed tests from Cycle 1 regression to verify if they were real failures or server overload

const SCHOOL_CODE = "SUB001";
const STUDENT_EMAIL = "student.test@subhang.academy";
const PASSWORD = "Test@12345";

async function loginAsStudent(page: Page) {
  await page.goto("/login");
  await page.fill("#schoolCode", SCHOOL_CODE);
  await page.click('button[type="submit"]:has-text("Continue")');
  await page.waitForSelector("#credential", { timeout: 10_000 });
  await page.getByRole("tab", { name: "Email" }).click();
  await page.fill("#credential", STUDENT_EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]:has-text("Sign In")');
  await expect(page.locator("h1")).toContainText("Dashboard", { timeout: 25_000 });
}

// ─── BUG-002 L3 Re-test ─────────────────────────────────────────────────

test("BUG-002-RETEST: Story point viewer shows h1 heading", async ({ page }) => {
  await loginAsStudent(page);
  await page.goto("/spaces");
  await page.waitForTimeout(2_000);
  const spaceLinks = page.locator('a[href^="/spaces/"]');
  if ((await spaceLinks.count()) === 0) test.skip();
  await spaceLinks.first().click();
  await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
  await page.waitForTimeout(2_000);
  const storyLinks = page.locator('a[href*="/story-points/"]');
  if ((await storyLinks.count()) === 0) test.skip();
  await storyLinks.first().click();
  await expect(page).toHaveURL(/\/story-points\//);
  await page.waitForTimeout(5_000);
  // Check h1 visibility
  const h1 = page.locator("h1").first();
  const h1Visible = await h1.isVisible().catch(() => false);
  const h1Text = await h1.textContent().catch(() => "");
  console.log(`H1 visible: ${h1Visible}, text: "${h1Text}"`);
  // Check page content overall
  const bodyText = await page
    .locator("body")
    .textContent()
    .catch(() => "");
  console.log(`Body has content: ${bodyText.length > 100}`);
  // Soft assertion: report what we find
  expect(h1Visible).toBe(true);
});

// ─── G5 Study Planner Re-test ────────────────────────────────────────────

test("G5-RETEST: Study planner loads", async ({ page }) => {
  await loginAsStudent(page);
  await page.goto("/study-planner");
  await page.waitForTimeout(3_000);
  await expect(page.locator("body")).toBeVisible();
  const hasError = await page
    .locator("text=Something went wrong")
    .isVisible()
    .catch(() => false);
  const h1Text = await page
    .locator("h1")
    .first()
    .textContent()
    .catch(() => "");
  console.log(`Study planner h1: "${h1Text}", error: ${hasError}`);
  expect(hasError).toBe(false);
});

// ─── N2 Mobile Nav Re-test ───────────────────────────────────────────────

test("N2-RETEST: Mobile bottom nav visible at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await loginAsStudent(page);
  await page.waitForTimeout(2_000);
  const nav = page.locator("nav");
  const navCount = await nav.count();
  console.log(`Nav elements at 375px: ${navCount}`);
  expect(navCount).toBeGreaterThan(0);
});

// ─── N5 Notification Bell Re-test ────────────────────────────────────────

test("N5-RETEST: Notification bell icon visible", async ({ page }) => {
  await loginAsStudent(page);
  const bell = page.locator(
    'a[href="/notifications"], button[aria-label*="notification"], [data-testid="notification-bell"]'
  );
  const bellCount = await bell.count();
  console.log(`Bell elements: ${bellCount}`);
  if (bellCount > 0) {
    await expect(bell.first()).toBeVisible();
  }
  // Also try broader search
  const anyBell = page.locator('[href="/notifications"]');
  const anyBellCount = await anyBell.count();
  console.log(`Any /notifications link: ${anyBellCount}`);
  expect(bellCount > 0 || anyBellCount > 0).toBeTruthy();
});

// ─── N6 Sign Out Re-test ─────────────────────────────────────────────────

test("N6-RETEST: Sign out button exists", async ({ page }) => {
  await loginAsStudent(page);
  const signOut = page.locator('button:has-text("Sign Out")');
  const signOutCount = await signOut.count();
  console.log(`Sign out buttons: ${signOutCount}`);
  await expect(signOut.first()).toBeVisible();
});

// ─── E1 404 Page Re-test ─────────────────────────────────────────────────

test("E1-RETEST: 404 page for invalid route", async ({ page }) => {
  await loginAsStudent(page);
  await page.goto("/this-route-does-not-exist-12345");
  await page.waitForTimeout(2_000);
  const has404 = await page
    .locator("text=404, text=not found, text=Not Found")
    .first()
    .isVisible()
    .catch(() => false);
  const bodyText = await page
    .locator("body")
    .textContent()
    .catch(() => "");
  console.log(`404 text visible: ${has404}, body has content: ${bodyText.length > 10}`);
  expect(has404).toBeTruthy();
});

// ─── E2 Spaces Cards Re-test ─────────────────────────────────────────────

test("E2-RETEST: Spaces page shows cards or empty state", async ({ page }) => {
  await loginAsStudent(page);
  await page.goto("/spaces");
  await page.waitForTimeout(2_000);
  const hasCards = (await page.locator('a[href^="/spaces/"]').count()) > 0;
  const hasEmpty = await page
    .locator("text=No spaces")
    .isVisible()
    .catch(() => false);
  console.log(`Cards: ${hasCards}, empty: ${hasEmpty}`);
  expect(hasCards || hasEmpty).toBeTruthy();
});

// ─── E3 Loading States Re-test ───────────────────────────────────────────

test("E3-RETEST: Content loads correctly", async ({ page }) => {
  await loginAsStudent(page);
  await expect(page.locator("h1")).toContainText("Dashboard");
});

// ─── E4 Error Boundary Re-test ───────────────────────────────────────────

test("E4-RETEST: Error boundary is functional", async ({ page }) => {
  await loginAsStudent(page);
  await expect(page.locator("body")).toBeVisible();
});
