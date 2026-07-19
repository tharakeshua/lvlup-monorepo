import { Page, expect } from "@playwright/test";

export const SCHOOL_CODE = "GRN001";

export const PARENT_CREDS = {
  email: "suresh.patel@gmail.com",
  password: "Test@12345",
};

export const PARENT2_CREDS = {
  email: "meena.gupta@gmail.com",
  password: "Test@12345",
};

export async function loginAsParent(page: Page, creds = PARENT_CREDS) {
  await page.goto("/login");

  // Step 1: School code
  await page.fill("#schoolCode", SCHOOL_CODE);
  await page.click('button[type="submit"]:has-text("Continue")');

  // Step 2: Credentials
  await page.waitForSelector("#email", { timeout: 10000 });
  await page.fill("#email", creds.email);
  await page.fill("#password", creds.password);
  await page.click('button[type="submit"]:has-text("Sign In")');

  await expect(page.locator("h1")).toContainText("Parent Dashboard", { timeout: 40000 });
}

export async function logoutParent(page: Page) {
  await page.goto("/settings");
  await page.waitForSelector("h1", { timeout: 10000 });
  const signOutBtn = page.locator('button:has-text("Sign Out")').first();
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
