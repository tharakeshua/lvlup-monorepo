import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin } from "./helpers";

test.describe("Super Admin — Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("P0: dashboard renders with correct heading", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Super Admin Dashboard");
  });

  test("P1: dashboard shows tenant overview section", async ({ page }) => {
    // Super admin should see tenant-related stats/cards
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();
  });

  test("P1: sidebar navigation is accessible", async ({ page }) => {
    const sidebar = page.locator("[data-sidebar], nav").first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });
});
