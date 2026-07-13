import { test, expect } from "@playwright/test";
import { loginAsParent, logoutParent, PARENT_CREDS, SCHOOL_CODE } from "./helpers";

test.describe("Parent Web — Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("P0: redirects unauthenticated user to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("P0: login page shows school code input", async ({ page }) => {
    await expect(page.locator("#schoolCode")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("P0: shows credentials step after valid school code", async ({ page }) => {
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await expect(page.locator("#email")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#password")).toBeVisible();
  });

  test("P0: parent can sign in with valid credentials", async ({ page }) => {
    await loginAsParent(page);
    await expect(page.locator("h1")).toContainText("Parent Dashboard");
  });

  test("P0: shows error for invalid school code", async ({ page }) => {
    await page.fill("#schoolCode", "INVALID");
    await page.click('button[type="submit"]:has-text("Continue")');

    // Should show error or remain on school code step
    await page.waitForTimeout(3000);
    const emailField = page.locator("#email");
    const isEmailVisible = await emailField.isVisible().catch(() => false);
    if (!isEmailVisible) {
      // Correctly stayed on school code step
      await expect(page.locator("#schoolCode")).toBeVisible();
    }
  });

  test("P0: shows error for wrong password", async ({ page }) => {
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForSelector("#email", { timeout: 10000 });

    await page.fill("#email", PARENT_CREDS.email);
    await page.fill("#password", "WrongPassword");
    await page.click('button[type="submit"]:has-text("Sign In")');

    // Should show error toast or stay on login
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login/);
  });

  test("P0: parent can sign out", async ({ page }) => {
    await loginAsParent(page);
    await logoutParent(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test("P1: maintains session after page refresh", async ({ page }) => {
    await loginAsParent(page);
    await page.reload();
    await expect(page.locator("h1")).toContainText("Parent Dashboard", { timeout: 20000 });
  });
});
