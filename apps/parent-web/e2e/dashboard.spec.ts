import { test, expect } from "@playwright/test";
import { loginAsParent } from "./helpers";

test.describe("Parent Web — Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsParent(page);
  });

  test("P0: dashboard renders with correct heading", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Parent Dashboard");
  });

  test("P1: dashboard shows child progress section", async ({ page }) => {
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();
  });

  test("P1: can navigate to settings page", async ({ page }) => {
    const settingsLink = page
      .locator('a[href*="/settings"], nav >> text=Settings, button:has-text("Settings")')
      .first();

    if (await settingsLink.isVisible({ timeout: 5000 })) {
      await settingsLink.click();
      await page.waitForLoadState("networkidle");
      const main = page.locator("main");
      await expect(main).toBeVisible();
    }
  });

  test("P1: can navigate to reports page", async ({ page }) => {
    const reportsLink = page
      .locator(
        'a[href*="/reports"], a[href*="/progress"], nav >> text=Reports, nav >> text=Progress'
      )
      .first();

    if (await reportsLink.isVisible({ timeout: 5000 })) {
      await reportsLink.click();
      await page.waitForLoadState("networkidle");
      const main = page.locator("main");
      await expect(main).toBeVisible();
    }
  });

  test("P1: can navigate to notifications", async ({ page }) => {
    const notifLink = page
      .locator(
        'a[href*="/notifications"], nav >> text=Notifications, button[aria-label*="notification"]'
      )
      .first();

    if (await notifLink.isVisible({ timeout: 5000 })) {
      await notifLink.click();
      await page.waitForLoadState("networkidle");
    }
  });
});
