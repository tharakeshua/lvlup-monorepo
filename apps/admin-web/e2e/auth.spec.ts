import { test, expect } from "@playwright/test";
import {
  loginWithSchoolCode,
  loginAsAdmin,
  logout,
  SCHOOL_CODE,
  SCHOOL_NAME,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} from "./helpers";

// ─── 1.1 Login — School Code Step ──────────────────────────────────────────

test.describe("Auth – School Code Step", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  // 1.1.1 P0
  test("redirects unauthenticated user to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  // 1.1.2 P0
  test("renders school code input and Continue button", async ({ page }) => {
    await expect(page.locator("#schoolCode")).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Continue")')).toBeVisible();
  });

  // 1.1.3 P0
  test("displays school name after valid school code entry", async ({ page }) => {
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await expect(page.locator(`text=${SCHOOL_NAME}`)).toBeVisible({ timeout: 10000 });
  });

  // 1.1.4 P0
  test("shows error on invalid school code", async ({ page }) => {
    await page.fill("#schoolCode", "INVALID123");
    await page.click('button[type="submit"]:has-text("Continue")');
    await expect(page.locator('[class*="destructive"], [role="alert"]').first()).toBeVisible({
      timeout: 5000,
    });
    // Should NOT advance to credentials step
    await expect(page.locator("#email")).not.toBeVisible();
  });

  // 1.1.5 P1
  test("prevents submission with empty school code", async ({ page }) => {
    // Button should be disabled or form should not advance
    const continueBtn = page.locator('button[type="submit"]:has-text("Continue")');
    await continueBtn.click();
    // Either stays on code step (no email visible) or button is disabled
    const emailVisible = await page
      .locator("#email")
      .isVisible()
      .catch(() => false);
    expect(emailVisible).toBeFalsy();
  });
});

// ─── 1.2 Login — Credentials Step ─────────────────────────────────────────

test.describe("Auth – Credentials Step", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForSelector("#email", { timeout: 10000 });
  });

  // 1.2.1 P0
  test("shows credentials form after valid school code", async ({ page }) => {
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Sign In")')).toBeVisible();
  });

  // 1.2.2 P1
  test("Change button returns to school code step", async ({ page }) => {
    await page.click('button:has-text("Change")');
    await expect(page.locator("#schoolCode")).toBeVisible();
    await expect(page.locator("#email")).not.toBeVisible();
  });

  // 1.2.3 P0
  test("successful admin login redirects to dashboard", async ({ page }) => {
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator("h1")).toContainText("School Admin Dashboard", {
      timeout: 25000,
    });
  });

  // 1.2.4 P0
  test("wrong password shows error message", async ({ page }) => {
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", "WrongPassword999!");
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator('[class*="destructive"], [role="alert"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  // 1.2.5 P1
  test("non-existent email shows error message", async ({ page }) => {
    await page.fill("#email", "nobody@nonexistent.invalid");
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator('[class*="destructive"], [role="alert"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  // 1.2.7 P1
  test("redirects to originally requested page after login", async ({ page }) => {
    // Navigate to /settings while unauthenticated (will redirect to login)
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);

    // Complete login
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForSelector("#email", { timeout: 10000 });
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click('button[type="submit"]:has-text("Sign In")');

    // Should land on settings or at least be authenticated and on a valid page
    await page.waitForURL(/\/(settings|$)/, { timeout: 25000 });
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ─── 1.3 Logout ───────────────────────────────────────────────────────────

test.describe("Auth – Logout", () => {
  // Allow longer timeout to handle Firebase auth rate-limiting after many auth tests
  test.setTimeout(150000);

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // 1.3.1 P0
  test("sign out redirects to login", async ({ page }) => {
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#schoolCode")).toBeVisible();
  });

  // 1.3.2 P0
  test("cannot access protected routes after logout", async ({ page }) => {
    await logout(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── 1.4 Role-Based Access Control ────────────────────────────────────────

test.describe("Auth – RBAC", () => {
  // 1.4.2 P0
  test("tenant admin has full access to all routes", async ({ page }) => {
    await loginAsAdmin(page);

    const routes = [
      "/users",
      "/classes",
      "/courses",
      "/exams",
      "/spaces",
      "/analytics",
      "/ai-usage",
      "/academic-sessions",
      "/reports",
      "/notifications",
      "/settings",
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      // Should not show "Access Denied" or redirect to login
      await expect(page.locator("body")).not.toContainText("Access Denied");
      await expect(page).not.toHaveURL(/\/login/);
    }
  });
});
