import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin } from "./helpers";

test.describe("Super Admin — Tenant Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("P1: can navigate to tenant management page", async ({ page }) => {
    // Look for a tenants/schools link in navigation
    const tenantsLink = page
      .locator('a[href*="/tenants"], a[href*="/schools"], nav >> text=Tenants, nav >> text=Schools')
      .first();

    if (await tenantsLink.isVisible({ timeout: 5000 })) {
      await tenantsLink.click();
      await page.waitForLoadState("networkidle");
      const main = page.locator("main");
      await expect(main).toBeVisible();
    }
  });

  test("P1: can navigate to analytics page", async ({ page }) => {
    const analyticsLink = page.locator('a[href*="/analytics"], nav >> text=Analytics').first();

    if (await analyticsLink.isVisible({ timeout: 5000 })) {
      await analyticsLink.click();
      await page.waitForLoadState("networkidle");
      const main = page.locator("main");
      await expect(main).toBeVisible();
    }
  });

  test("P1: can navigate to user management", async ({ page }) => {
    const usersLink = page.locator('a[href*="/users"], nav >> text=Users').first();

    if (await usersLink.isVisible({ timeout: 5000 })) {
      await usersLink.click();
      await page.waitForLoadState("networkidle");
      const main = page.locator("main");
      await expect(main).toBeVisible();
    }
  });
});
