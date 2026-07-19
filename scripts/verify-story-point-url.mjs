/**
 * Verify a student story-point URL loads lesson content (no "couldn't load" error).
 * Usage: node scripts/verify-story-point-url.mjs
 */
import { chromium } from "@playwright/test";

const BASE = "https://lvlup-ff6fa-student.web.app";
const URL =
  `${BASE}/spaces/1AqFwKSf59FiIrqzaQ7i/story-points/0VKwtLTt1VydSeI073VB`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${BASE}/login`);
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

await page.fill("#schoolCode", "SUB001");
await page.click('button[type="submit"]:has-text("Continue")');
await page.waitForSelector("#credential", { timeout: 60000 });
await page.getByRole("tab", { name: "Email" }).click();
await page.fill("#credential", "student.test@subhang.academy");
await page.fill("#password", "Test@12345");
await page.click('button[type="submit"]:has-text("Sign In")');
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 90000 });

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);

const body = await page.locator("body").innerText();
const hasError = body.includes("We couldn't load this lesson");
const itemButtons = await page.locator('button[aria-label^="Item"]').count();

console.log("URL:", page.url());
console.log("load error:", hasError);
console.log("item nav buttons:", itemButtons);
console.log("h1:", (await page.locator("h1").first().textContent())?.trim());

await browser.close();
process.exit(hasError ? 1 : 0);
