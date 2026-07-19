/**
 * Verify story point URL and capture client-side errors.
 */
import { chromium } from "@playwright/test";

const BASE = "https://lvlup-ff6fa-student.web.app";
const URL =
  `${BASE}/spaces/1AqFwKSf59FiIrqzaQ7i/story-points/0VKwtLTt1VydSeI073VB`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

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
await page.waitForTimeout(8000);

const body = await page.locator("body").innerText();
console.log("load error:", body.includes("We couldn't load this lesson"));
console.log("error text:", body.match(/We couldn't load this lesson[\s\S]{0,120}/)?.[0]);
console.log("item buttons:", await page.locator('button[aria-label^="Item"]').count());
console.log("console errors:", consoleErrors.slice(0, 8));

await browser.close();
