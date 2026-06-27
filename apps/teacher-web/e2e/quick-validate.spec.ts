import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "http://localhost:4569";

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.locator("#schoolCode").fill("GRN001");
  await page.locator('button[type="submit"]:has-text("Continue")').click();
  await page.waitForSelector("#email", { timeout: 15000 });
  await page.locator("#email").fill("priya.sharma@greenwood.edu");
  await page.locator("#password").fill("Test@12345");
  await page.locator('button[type="submit"]:has-text("Sign In")').click();
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
}

// Try each space's first SP to find one where the Add->Sheet flow auto-opens.
test("auto-open-sheet-test", async ({ page }) => {
  test.setTimeout(300000);
  await login(page);

  const spaces = [
    { id: "gJRhiZo4Pt7jYFDPpm9s", name: "Mathematics Fundamentals" },
    { id: "d9Gy0PGF7IsPYUmufKm6", name: "General Science" },
    { id: "b5kQgkhw6TkYBF0nfVEg", name: "Physics — Mechanics" },
    { id: "OResMNqHQ5qfOkYZV0BQ", name: "Python Programming" },
  ];

  for (const space of spaces) {
    await page.goto(`${BASE_URL}/spaces/${space.id}/edit`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
    await page
      .getByRole("tab", { name: "Content" })
      .first()
      .click({ force: true })
      .catch(() => {});
    await page.waitForTimeout(800);
    const toggleCount = await page.locator('button[aria-label="Toggle details"]').count();

    for (let i = 0; i < Math.min(toggleCount, 3); i++) {
      const t = page.locator('button[aria-label="Toggle details"]').nth(i);
      await t.click();
      await page.waitForTimeout(800);

      const addQ = page
        .locator('button[title="Add question"], button[title="Add question to this section"]')
        .first();
      const visible = await addQ.isVisible({ timeout: 1000 }).catch(() => false);
      if (!visible) {
        await t.click(); // collapse
        continue;
      }

      const before = await page.locator('div.bg-background button[aria-label="Delete"]').count();
      await addQ.click();
      const sheetOpened = await page
        .locator('h1:has-text("Edit Question")')
        .waitFor({ state: "visible", timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      const after = await page.locator('div.bg-background button[aria-label="Delete"]').count();
      const itemCreated = after > before;

      console.log(
        `${space.name} SP${i}: sheetOpened=${sheetOpened}, itemCreated=${itemCreated}, items ${before}→${after}`
      );

      // If sheet opened, close it
      if (sheetOpened) {
        // Click Cancel
        await page
          .getByRole("button", { name: /^Cancel$/ })
          .first()
          .click({ timeout: 3000 })
          .catch(() => {});
        await page.waitForTimeout(500);
        // Delete the new item to clean up
        const delBtns = page.locator('div.bg-background button[aria-label="Delete"]');
        const n = await delBtns.count();
        if (n > before) {
          await delBtns.nth(n - 1).click();
          const confirm = page.getByRole("button", { name: /^Delete$|^Delete All$/ });
          await confirm
            .first()
            .click({ timeout: 3000 })
            .catch(() => {});
          await page.waitForTimeout(500);
        }
      }
      await t.click(); // collapse
      await page.waitForTimeout(300);
    }
  }
});
