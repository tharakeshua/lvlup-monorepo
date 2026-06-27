import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "http://localhost:4569";

test("find space with story points", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto(`${BASE_URL}/login`);
  await page.locator("#schoolCode").fill("GRN001");
  await page.locator('button[type="submit"]:has-text("Continue")').click();
  await page.waitForSelector("#email", { timeout: 15000 });
  await page.locator("#email").fill("priya.sharma@greenwood.edu");
  await page.locator("#password").fill("Test@12345");
  await page.locator('button[type="submit"]:has-text("Sign In")').click();
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 30000 });

  await page.goto(`${BASE_URL}/spaces`);
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
  const links = await page
    .locator('a[href*="/spaces/"][href*="/edit"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
  console.log(`Found ${links.length} spaces`);

  const candidates: { id: string; storyPoints: number; title: string }[] = [];
  for (const href of links) {
    const m = href.match(/\/spaces\/([^/]+)\/edit/);
    if (!m) continue;
    const id = m[1];
    await page.goto(href);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
    // Try to read title
    const title = await page
      .locator("h1")
      .first()
      .textContent()
      .catch(() => "");
    // Click Content tab
    const contentTab = page.getByRole("tab", { name: "Content" }).first();
    if (await contentTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contentTab.click({ force: true });
      await page.waitForTimeout(800);
    }
    // Count story points
    const storyHeader = await page
      .locator("text=/Story Points \\((\\d+)\\)/")
      .first()
      .textContent()
      .catch(() => "");
    const matchSP = storyHeader.match(/\((\d+)\)/);
    const count = matchSP ? Number(matchSP[1]) : 0;
    console.log(`${id}: "${title?.trim()}" has ${count} story points`);
    candidates.push({ id, storyPoints: count, title: title?.trim() ?? "" });
  }

  fs.writeFileSync(
    path.join(__dirname, "space-candidates.json"),
    JSON.stringify(candidates, null, 2)
  );

  const winner = candidates.find((c) => c.storyPoints > 0) ?? candidates[0];
  console.log(`Picked: ${winner?.id} (${winner?.title}) with ${winner?.storyPoints} story points`);
});
