import { Page, expect } from "@playwright/test";

export const SCHOOL_CODE = "GRN001";

export const TEACHER_CREDS = {
  email: "ravi.kumar@greenwood.edu",
  password: "Test@12345",
};

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

export async function loginAsTeacher(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/login");
    await loginWithSchoolCode(page, SCHOOL_CODE, TEACHER_CREDS.email, TEACHER_CREDS.password);
    try {
      await expect(page.locator("h1")).toContainText("Teacher Dashboard", {
        timeout: 25000,
      });
      return;
    } catch {
      if (attempt === 2) throw new Error("Teacher login failed after 3 attempts");
      await page.waitForTimeout(2000);
    }
  }
}

export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
}
