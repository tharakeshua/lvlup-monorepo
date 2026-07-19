import { test, expect, Page, devices } from "@playwright/test";
import { loginDirect, expectDashboard } from "./helpers/auth";
import { CREDENTIALS, SELECTORS } from "./helpers/selectors";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loginAsSuperAdmin(page: Page) {
  await page.goto("/login");
  await loginDirect(page, CREDENTIALS.superAdmin.email, CREDENTIALS.superAdmin.password);
  await expectDashboard(page, SELECTORS.dashboards.superAdmin);
}

// ─── Left Panel Fix Verification ────────────────────────────────────────────

test.describe("Super Admin - Left Panel Fixes", () => {
  test("favicon loads without 404", async ({ page }) => {
    const failedRequests: string[] = [];

    page.on("response", (response) => {
      if (response.url().includes("favicon") || response.url().includes("icon")) {
        if (response.status() === 404) {
          failedRequests.push(`${response.url()} => ${response.status()}`);
        }
      }
    });

    await page.goto("/");
    // Wait for all network requests to settle
    await page.waitForLoadState("networkidle");

    expect(failedRequests, "Favicon or icon requests should not 404").toHaveLength(0);
  });

  test("mobile-web-app-capable meta tag exists", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const metaTag = page.locator('meta[name="mobile-web-app-capable"]');
    await expect(metaTag).toHaveAttribute("content", "yes");
  });

  test("apple-mobile-web-app-capable meta tag exists", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const metaTag = page.locator('meta[name="apple-mobile-web-app-capable"]');
    await expect(metaTag).toHaveAttribute("content", "yes");
  });

  test("favicon link tag exists in HTML", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const faviconLink = page.locator('link[rel="icon"]');
    await expect(faviconLink).toHaveAttribute("href", "/icons/icon-192.png");
  });

  test("mobile sidebar opens without DialogTitle console errors", async ({ browser }) => {
    // Create a mobile-sized context (iPhone-like)
    const context = await browser.newContext({
      ...devices["iPhone 14"],
    });
    const page = await context.newPage();

    // Collect console warnings/errors about DialogTitle
    const dialogErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (
        text.includes("DialogContent") &&
        (text.includes("DialogTitle") ||
          text.includes("Description") ||
          text.includes("aria-describedby"))
      ) {
        dialogErrors.push(text);
      }
    });

    // Login as super admin
    await page.goto("http://localhost:4567/login");
    await loginDirect(page, CREDENTIALS.superAdmin.email, CREDENTIALS.superAdmin.password);
    await expectDashboard(page, SELECTORS.dashboards.superAdmin);

    // Look for a sidebar trigger button (hamburger menu on mobile)
    const sidebarTrigger = page.locator('[data-sidebar="trigger"]');
    if (await sidebarTrigger.isVisible({ timeout: 5000 })) {
      await sidebarTrigger.click();
      // Wait for sidebar animation to complete
      await page.waitForTimeout(1000);
    }

    // Verify no DialogTitle/Description console errors were emitted
    expect(
      dialogErrors,
      "No DialogTitle or Description warnings should appear when opening mobile sidebar"
    ).toHaveLength(0);

    await context.close();
  });

  test("mobile sidebar renders navigation items correctly", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 14"],
    });
    const page = await context.newPage();

    await page.goto("http://localhost:4567/login");
    await loginDirect(page, CREDENTIALS.superAdmin.email, CREDENTIALS.superAdmin.password);
    await expectDashboard(page, SELECTORS.dashboards.superAdmin);

    // Open sidebar on mobile
    const sidebarTrigger = page.locator('[data-sidebar="trigger"]');
    if (await sidebarTrigger.isVisible({ timeout: 5000 })) {
      await sidebarTrigger.click();
      await page.waitForTimeout(500);
    }

    // Verify the sidebar content is visible
    const sidebar = page.locator('[data-sidebar="sidebar"][data-mobile="true"]');
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // Verify the sidebar has a visually hidden title for accessibility
    const sheetTitle = sidebar.locator("text=Navigation").first();
    // The title should exist in the DOM (even if sr-only)
    await expect(sheetTitle).toBeAttached();

    await context.close();
  });

  test("desktop sidebar is visible and toggles correctly", async ({ page }) => {
    await page.goto("http://localhost:4567/login");
    await loginDirect(page, CREDENTIALS.superAdmin.email, CREDENTIALS.superAdmin.password);
    await expectDashboard(page, SELECTORS.dashboards.superAdmin);

    // Sidebar should be visible on desktop (expanded state)
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar.first()).toBeVisible({ timeout: 5000 });

    const sidebarWrapper = page.locator('[data-side="left"]');
    await expect(sidebarWrapper).toHaveAttribute("data-state", "expanded");

    // Click trigger to collapse sidebar
    const trigger = page.locator('[data-sidebar="trigger"]');
    await trigger.click();
    await page.waitForTimeout(500);

    // Sidebar should still be visible but in collapsed (icon) state
    await expect(sidebarWrapper).toHaveAttribute("data-state", "collapsed");
    await expect(sidebar.first()).toBeVisible();

    // Click trigger again to expand sidebar
    await trigger.click();
    await page.waitForTimeout(500);

    // Sidebar should be back to expanded state
    await expect(sidebarWrapper).toHaveAttribute("data-state", "expanded");
    await expect(sidebar.first()).toBeVisible();
  });
});
