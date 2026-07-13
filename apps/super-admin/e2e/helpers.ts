import { Page, expect } from "@playwright/test";

export const SUPER_ADMIN_CREDS = {
  email: "superadmin@levelup.app",
  password: "Test@12345",
};

export async function loginAsSuperAdmin(page: Page) {
  await page.goto("/login");
  await page.fill("#email", SUPER_ADMIN_CREDS.email);
  await page.fill("#password", SUPER_ADMIN_CREDS.password);
  await page.click('button[type="submit"]:has-text("Sign In")');
  await expect(page.locator("h1")).toContainText("Super Admin Dashboard", { timeout: 40000 });
}

export async function logoutSuperAdmin(page: Page) {
  const signOutBtn = page
    .locator('[data-sidebar="footer"] button:has-text("Sign Out"), button:has-text("Sign Out")')
    .first();
  await signOutBtn.waitFor({ state: "attached", timeout: 10000 });
  await signOutBtn.dispatchEvent("click");

  const confirmBtn = page
    .locator(
      '[role="alertdialog"] button:has-text("Sign Out"), [role="dialog"] button:has-text("Sign Out")'
    )
    .last();
  await confirmBtn.waitFor({ state: "attached", timeout: 5000 });
  await confirmBtn.dispatchEvent("click");

  await page.waitForURL(/\/login/, { timeout: 15000 });
}
