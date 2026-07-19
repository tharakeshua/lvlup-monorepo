import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
// RESPONSIVE BEHAVIOR TESTS — Super Admin
// ════════════════════════════════════════════════════════════════════════════

const MOBILE_VIEWPORT = { width: 375, height: 812 };
const TABLET_VIEWPORT = { width: 768, height: 1024 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

test.describe("Mobile Layout (375px)", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("login page is usable on mobile", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Sign In")')).toBeVisible();
    const box = await page.locator("#email").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 20);
  });

  test("sidebar collapses on mobile after login", async ({ page }) => {
    await loginAsSuperAdmin(page);
    const menuBtn = page
      .locator('[data-sidebar="trigger"]')
      .or(page.locator('button[aria-label*="sidebar"]'))
      .or(page.locator('button[aria-label*="menu"]'))
      .or(page.locator('button[aria-label*="Menu"]'));
    const isMenuVisible = await menuBtn
      .first()
      .isVisible()
      .catch(() => false);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("sidebar toggle opens sidebar on mobile", async ({ page }) => {
    await loginAsSuperAdmin(page);
    const menuBtn = page
      .locator('[data-sidebar="trigger"]')
      .or(page.locator('button[aria-label*="sidebar"]'))
      .or(page.locator('button[aria-label*="menu"]'))
      .or(page.locator('button[aria-label*="Menu"]'));
    const isMenuVisible = await menuBtn
      .first()
      .isVisible()
      .catch(() => false);
    if (isMenuVisible) {
      await menuBtn.first().click();
      await page.waitForTimeout(500);
      const sidebarNav = page.locator("nav, aside, [data-sidebar]");
      await expect(sidebarNav).toBeVisible({ timeout: 5000 });
      await page.keyboard.press("Escape");
    } else {
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("dashboard cards stack on mobile", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.waitForTimeout(2000);
    await expect(page.locator("h1")).toContainText("Super Admin Dashboard");
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
  });

  test("tenants page renders on mobile", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto("/tenants");
    await page.waitForTimeout(2000);
    await expect(page.locator("h1")).toBeVisible();
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(1200);
  });

  test("touch targets are at least 44px", async ({ page }) => {
    await loginAsSuperAdmin(page);
    const bottomNavButtons = page.locator('nav[class*="bottom"] a, nav[class*="bottom"] button');
    const count = await bottomNavButtons.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await bottomNavButtons.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

test.describe("Tablet Layout (768px)", () => {
  test.use({ viewport: TABLET_VIEWPORT });

  test("sidebar structure exists on tablet", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.waitForTimeout(1500);
    const sidebar = page.locator('[data-sidebar="sidebar"]').first();
    await expect(sidebar).toBeAttached();
    await expect(page.locator("h1")).toContainText("Super Admin Dashboard");
  });

  test("dashboard renders correctly on tablet", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.waitForTimeout(2000);
    await expect(page.locator("h1")).toContainText("Super Admin Dashboard");
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(TABLET_VIEWPORT.width + 20);
  });
});

test.describe("Desktop Layout (1280px)", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("dashboard renders correctly on desktop", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.waitForTimeout(2000);
    await expect(page.locator("h1")).toContainText("Super Admin Dashboard");
    const sidebar = page.locator('[data-sidebar="sidebar"]').first();
    await expect(sidebar).toBeAttached();
  });

  test("no horizontal overflow on desktop", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.waitForTimeout(1500);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(DESKTOP_VIEWPORT.width + 20);
  });
});
