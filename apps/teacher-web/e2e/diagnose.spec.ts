import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
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

test("explore-spaces-structure", async ({ page }) => {
  test.setTimeout(180000);
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

    // Expand each story point and check for sections vs unsectioned area
    const toggles = await page.locator('button[aria-label="Toggle details"]').count();
    console.log(`\n${space.name}: ${toggles} story points`);
    for (let i = 0; i < toggles; i++) {
      const t = page.locator('button[aria-label="Toggle details"]').nth(i);
      const title = await t
        .locator("xpath=following-sibling::span[1]")
        .textContent()
        .catch(() => "");
      await t.click();
      await page.waitForTimeout(800);
      const hasSections =
        (await page
          .locator("h4")
          .filter({ hasText: /^[A-Z][A-Z]+/ })
          .count()) > 0;
      const hasUnsectioned =
        (await page.locator("h4", { hasText: /Unsectioned|Items/i }).count()) > 0;
      const itemCount = await page.locator("div.bg-background").count();
      console.log(
        `  SP ${i}: "${title?.trim()}" — sections:${hasSections} unsectioned:${hasUnsectioned} items:${itemCount}`
      );
      // Collapse before next
      await t.click();
      await page.waitForTimeout(300);
    }
  }
});
