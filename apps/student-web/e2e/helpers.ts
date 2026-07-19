import { Page, expect } from "@playwright/test";

// ─── Credentials ─────────────────────────────────────────────────────────────

export const SCHOOL_CODE = "GRN001";
export const SCHOOL_NAME = "Greenwood International School";

export const CREDENTIALS = {
  student1: { email: "aarav.patel@greenwood.edu", password: "Test@12345" },
  student2: { email: "diya.gupta@greenwood.edu", password: "Test@12345" },
  studentRoll: { rollNumber: "2025001", password: "Test@12345" },
  consumer: { email: "consumer@gmail.test", password: "Consumer123!" },
} as const;

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

/** Step 1: enter school code and click Continue */
export async function enterSchoolCode(page: Page, code: string) {
  await page.fill("#schoolCode", code);
  await page.click('button[type="submit"]:has-text("Continue")');
  await page.waitForSelector("#credential", { timeout: 10_000 });
}

/** Full B2B email login */
export async function loginStudentWithEmail(
  page: Page,
  schoolCode: string,
  email: string,
  password: string
) {
  await page.fill("#schoolCode", schoolCode);
  await page.click('button[type="submit"]:has-text("Continue")');
  await page.waitForSelector("#credential", { timeout: 10_000 });
  await page.getByRole("tab", { name: "Email" }).click();
  await page.fill("#credential", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]:has-text("Sign In")');
}

/** Full B2B roll-number login */
export async function loginStudentWithRollNumber(
  page: Page,
  schoolCode: string,
  rollNumber: string,
  password: string
) {
  await page.fill("#schoolCode", schoolCode);
  await page.click('button[type="submit"]:has-text("Continue")');
  await page.waitForSelector("#credential", { timeout: 10_000 });
  const rollTab = page.getByRole("tab", { name: "Roll Number" });
  if (await rollTab.isVisible()) await rollTab.click();
  await page.fill("#credential", rollNumber);
  await page.fill("#password", password);
  await page.click('button[type="submit"]:has-text("Sign In")');
}

/** Consumer (B2C) login */
export async function loginConsumer(page: Page, email: string, password: string) {
  await page.fill("#consumerEmail", email);
  await page.fill("#consumerPassword", password);
  await page.click('button[type="submit"]:has-text("Sign In")');
}

/** Click Sign Out and confirm dialog */
export async function logout(page: Page) {
  await page.click('button:has-text("Sign Out")');
  const confirmBtn = page
    .locator(
      '[role="alertdialog"] button:has-text("Sign Out"), [role="dialog"] button:has-text("Sign Out")'
    )
    .last();
  await confirmBtn.waitFor({ state: "attached", timeout: 5_000 });
  await confirmBtn.dispatchEvent("click");
  await page.waitForURL(/\/login/, { timeout: 15_000 });
}

/** Assert a dashboard heading is visible */
export async function expectHeading(page: Page, text: string) {
  await expect(page.locator("h1")).toContainText(text, { timeout: 25_000 });
}

// ─── Shared login shortcuts ───────────────────────────────────────────────────

export async function loginAsStudent(page: Page) {
  await page.goto("/login");
  await loginStudentWithEmail(
    page,
    SCHOOL_CODE,
    CREDENTIALS.student1.email,
    CREDENTIALS.student1.password
  );
  await expectHeading(page, "Dashboard");
}

export async function loginAsConsumer(page: Page) {
  await page.goto("/consumer");
  await page.waitForURL(/\/login/, { timeout: 10_000 });
  await page.click('button:has-text("Don\'t have a school code")');
  await loginConsumer(page, CREDENTIALS.consumer.email, CREDENTIALS.consumer.password);
  await expectHeading(page, "My Learning");
}
