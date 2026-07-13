/**
 * Parent notifications — verify listNotifications surfaces Aarav's assigned test.
 *
 * Prerequisites:
 *   - parent-web on :4571
 *   - node scripts/heal-parent-test-notification.mjs (or assignContent fan-out)
 *
 * Screenshots: tmp/qa-parent-notify-*.png
 */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "fs";

const PARENT_URL = process.env.PARENT_URL ?? "http://127.0.0.1:4571";
const EMAIL = process.env.PARENT_EMAIL ?? "suresh.patel@gmail.com";
const PASSWORD = process.env.PARENT_PASSWORD ?? "Test@12345";
const TENANT = process.env.PARENT_TENANT ?? "GRN001";

mkdirSync("tmp", { recursive: true });

async function loginParent(page: import("@playwright/test").Page) {
  await page.goto(`${PARENT_URL}/login`);
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  const tenant = page.getByLabel(/tenant|school|code|grn/i);
  if (await tenant.count()) {
    await tenant.first().fill(TENANT);
  } else {
    const code = page.locator(
      'input[name="tenantCode"], input[placeholder*="GRN"], input[placeholder*="code"]'
    );
    if (await code.count()) await code.first().fill(TENANT);
  }
  await page.getByRole("button", { name: /sign in|log in|continue/i }).click();
  await page.waitForURL(/dashboard|children|home|\//, { timeout: 45000 });
}

test.describe("parent test notifications", () => {
  test("Notifications page shows Aarav assigned-test notification", async ({ page }) => {
    test.setTimeout(90_000);
    await loginParent(page);
    await page.screenshot({ path: "tmp/qa-parent-notify-01-after-login.png", fullPage: true });

    await page.goto(`${PARENT_URL}/notifications`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "tmp/qa-parent-notify-02-notifications.png", fullPage: true });

    // Empty-state must not be the only content when heal succeeded.
    const empty = page.getByText(/no notifications yet/i);
    const assigned = page.getByText(/test assigned|aarav|math midterm|assigned the test/i);
    const heading = page.getByRole("heading", { name: /notifications/i });
    await expect(heading).toBeVisible({ timeout: 20000 });

    // Prefer positive match; if listNotifications still empty, fail clearly.
    if (await empty.isVisible().catch(() => false)) {
      const errBanner = page.getByText(/error|failed|something went wrong/i);
      if (await errBanner.count()) {
        await page.screenshot({ path: "tmp/qa-parent-notify-03-error.png", fullPage: true });
      }
    }

    await expect(assigned.first()).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: "tmp/qa-parent-notify-03-assigned-visible.png", fullPage: true });
  });
});
