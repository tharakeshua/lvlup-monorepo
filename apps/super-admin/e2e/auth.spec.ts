import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, logoutSuperAdmin, SUPER_ADMIN_CREDS } from "./helpers";

test.describe("Super Admin — Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("P0: redirects unauthenticated user to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("P0: login page renders email and password fields", async ({ page }) => {
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("P0: super admin can sign in with valid credentials", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await expect(page.locator("h1")).toContainText("Super Admin Dashboard");
  });

  test("P0: shows error for invalid password", async ({ page }) => {
    await page.fill("#email", SUPER_ADMIN_CREDS.email);
    await page.fill("#password", "WrongPassword123");
    await page.click('button[type="submit"]:has-text("Sign In")');

    // Should show error or stay on login
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login/);
  });

  test("P0: super admin can sign out", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await logoutSuperAdmin(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test("P1: maintains session after page refresh", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.reload();
    await expect(page.locator("h1")).toContainText("Super Admin Dashboard", { timeout: 20000 });
  });
});
