import { Page, expect } from "@playwright/test";

// ─── Constants ──────────────────────────────────────────────────────────────

export const SCHOOL_CODE = "GRN001";
export const SCHOOL_NAME = "Greenwood International School";

export const ADMIN_EMAIL = "admin@greenwood.edu";
export const ADMIN_PASSWORD = "Test@12345";

// ─── Login Helpers ──────────────────────────────────────────────────────────

export async function loginWithSchoolCode(
  page: Page,
  schoolCode: string,
  email: string,
  password: string
) {
  await page.fill("#schoolCode", schoolCode);
  await page.click('button[type="submit"]:has-text("Continue")');
  await page.waitForSelector("#email", { timeout: 10000 });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]:has-text("Sign In")');
}

export async function loginAsAdmin(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/login");
    await loginWithSchoolCode(page, SCHOOL_CODE, ADMIN_EMAIL, ADMIN_PASSWORD);
    try {
      await expect(page.locator("h1")).toContainText("School Admin Dashboard", {
        timeout: 25000,
      });
      return;
    } catch {
      if (attempt === 2) throw new Error("Admin login failed after 3 attempts");
      await page.waitForTimeout(2000);
    }
  }
}

export async function logout(page: Page) {
  await page.click('button:has-text("Sign Out")');
  const confirmBtn = page
    .locator(
      '[role="alertdialog"] button:has-text("Sign Out"), [role="dialog"] button:has-text("Sign Out")'
    )
    .last();
  await confirmBtn.waitFor({ state: "attached", timeout: 5000 });
  await confirmBtn.dispatchEvent("click");
  await page.waitForURL(/\/login/, { timeout: 15000 });
}

export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
}
