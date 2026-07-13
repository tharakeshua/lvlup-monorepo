import { Page, expect } from "@playwright/test";

/**
 * Direct email+password login (super-admin style)
 */
export async function loginDirect(page: Page, email: string, password: string) {
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]:has-text("Sign In")');
}

/**
 * Two-step school code login (admin, teacher, parent)
 */
export async function loginWithSchoolCode(
  page: Page,
  schoolCode: string,
  email: string,
  password: string
) {
  // Step 1: School code
  await page.fill("#schoolCode", schoolCode);
  await page.click('button[type="submit"]:has-text("Continue")');

  // Wait for step 2 (credentials form)
  await page.waitForSelector("#email", { timeout: 10000 });

  // Step 2: Credentials
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]:has-text("Sign In")');
}

/**
 * Student login with roll number
 */
export async function loginStudentWithRollNumber(
  page: Page,
  schoolCode: string,
  rollNumber: string,
  password: string
) {
  // Step 1: School code
  await page.fill("#schoolCode", schoolCode);
  await page.click('button[type="submit"]:has-text("Continue")');

  // Wait for credentials step
  await page.waitForSelector("#credential", { timeout: 10000 });

  // Make sure Roll Number tab is active (it's the default)
  const rollTab = page.getByRole("button", { name: "Roll Number" });
  if (await rollTab.isVisible()) {
    await rollTab.click();
  }

  // Enter roll number and password
  await page.fill("#credential", rollNumber);
  await page.fill("#password", password);
  await page.click('button[type="submit"]:has-text("Sign In")');
}

/**
 * Student login with email (via school code)
 */
export async function loginStudentWithEmail(
  page: Page,
  schoolCode: string,
  email: string,
  password: string
) {
  // Step 1: School code
  const schoolField = page.locator("#schoolCode").or(page.getByLabel(/school code/i));
  await schoolField.first().waitFor({ state: "visible", timeout: 15000 });
  await schoolField.first().fill(schoolCode);
  await page.getByRole("button", { name: /continue/i }).click();

  // Wait for credentials step
  await page.waitForSelector("#credential", { timeout: 20000 });

  // Email is a TabsTrigger → role=tab (not button)
  const emailTab = page.getByRole("tab", { name: /^email$/i });
  if (await emailTab.count()) {
    await emailTab.click();
  } else {
    await page.getByRole("button", { name: "Email" }).click();
  }

  await page.fill("#credential", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

/**
 * Consumer B2C login
 */
export async function loginConsumer(page: Page, email: string, password: string) {
  await page.fill("#consumerEmail", email);
  await page.fill("#consumerPassword", password);
  await page.click('button[type="submit"]:has-text("Sign In")');
}

/**
 * Click Sign Out, confirm the dialog, and wait for redirect to login.
 * The Sign Out button lives in the sidebar footer which may be CSS-hidden
 * when the sidebar is collapsed. Use dispatchEvent to click it regardless.
 */
export async function logout(page: Page) {
  // Wait for the Sign Out button to be in the DOM (may be hidden by collapsed sidebar)
  const signOutBtn = page
    .locator('[data-sidebar="footer"] button:has-text("Sign Out"), button:has-text("Sign Out")')
    .first();
  await signOutBtn.waitFor({ state: "attached", timeout: 10000 });

  // Use dispatchEvent to click even if the button is visually hidden
  await signOutBtn.dispatchEvent("click");

  // Handle confirmation dialog
  const confirmBtn = page
    .locator(
      '[role="alertdialog"] button:has-text("Sign Out"), [role="dialog"] button:has-text("Sign Out")'
    )
    .last();
  await confirmBtn.waitFor({ state: "attached", timeout: 5000 });
  await confirmBtn.dispatchEvent("click");

  // Wait for navigation to login page
  await page.waitForURL(/\/login/, { timeout: 15000 });
}

/**
 * Wait for a dashboard page to load by checking for the heading
 */
export async function expectDashboard(page: Page, heading: string) {
  await expect(page.locator("h1")).toContainText(heading, { timeout: 40000 });
}

/**
 * Enter school code and wait for school name to appear
 */
export async function enterSchoolCode(page: Page, code: string) {
  await page.fill("#schoolCode", code);
  await page.click('button[type="submit"]:has-text("Continue")');
}

/**
 * Login with retry-and-timeout pattern.
 * Replaces conditional test.skip() with deterministic retry logic.
 */
export async function loginWithRetry(
  page: Page,
  loginFn: (page: Page) => Promise<void>,
  expectedUrl: RegExp,
  options?: { maxRetries?: number; retryDelay?: number }
): Promise<void> {
  const { maxRetries = 3, retryDelay = 5000 } = options ?? {};

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await loginFn(page);
      await page.waitForURL(expectedUrl, { timeout: retryDelay });
      return;
    } catch {
      if (attempt === maxRetries) {
        throw new Error(`Login failed after ${maxRetries} attempts. Current URL: ${page.url()}`);
      }
      await page.goto(page.url().replace(/\/[^/]*$/, "/login"), { timeout: 10000 });
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Wait for a dashboard heading to appear with retry logic.
 * Use instead of conditional skips.
 */
export async function expectDashboardWithRetry(
  page: Page,
  heading: string,
  options?: { maxRetries?: number; timeout?: number }
): Promise<void> {
  const { maxRetries = 3, timeout = 15000 } = options ?? {};

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await expect(page.locator("h1")).toContainText(heading, { timeout });
      return;
    } catch {
      if (attempt === maxRetries) {
        throw new Error(`Dashboard heading "${heading}" not found after ${maxRetries} attempts`);
      }
      await page.waitForTimeout(2000);
    }
  }
}
