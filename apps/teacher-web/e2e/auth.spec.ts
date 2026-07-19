import { test, expect } from "@playwright/test";

/**
 * Teacher Web — Authentication E2E Tests.
 *
 * These are skeleton tests for the teacher login flow.
 * They require the app to be running locally on port 3002.
 */

test.describe("Teacher Auth", () => {
  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("http://localhost:3002/");
    await expect(page).toHaveURL(/login|auth/);
  });

  test("should show school code entry form", async ({ page }) => {
    await page.goto("http://localhost:3002/login");
    await expect(page.getByPlaceholder(/school code/i)).toBeVisible();
  });

  test("should login with valid credentials", async ({ page }) => {
    await page.goto("http://localhost:3002/login");

    // Enter school code
    await page.getByPlaceholder(/school code/i).fill("SPR001");
    await page.getByRole("button", { name: /continue/i }).click();

    // Enter credentials
    await page.getByPlaceholder(/email/i).fill("teacher1@spr001.lvlup.app");
    await page.getByPlaceholder(/password/i).fill("Test1234");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Verify dashboard loads
    await expect(page.getByText(/teacher dashboard/i)).toBeVisible({ timeout: 10000 });
  });

  test("should sign out and redirect to login", async ({ page }) => {
    // This test would need authenticated state
    await page.goto("http://localhost:3002/login");
    // Skeleton — full implementation requires auth state setup
  });
});
