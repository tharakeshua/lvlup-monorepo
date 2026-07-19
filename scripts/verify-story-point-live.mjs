/**
 * Verify student story-point page loads (no "invalid data").
 * Usage: node scripts/verify-story-point-live.mjs [spaceId] [storyPointId]
 */
import { chromium } from "playwright";

const BASE = "https://lvlup-ff6fa-student.web.app";
const SPACE = process.argv[2] ?? "1AqFwKSf59FiIrqzaQ7i";
const SP = process.argv[3] ?? "0VKwtLTt1VydSeI073VB";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(`${BASE}/login`);
await page.fill("#schoolCode", "SUB001");
await page.getByRole("button", { name: /continue/i }).click();
await page.fill("#credential", "student.test@subhang.academy");
await page.fill("#password", "Test@12345");
await page.getByRole("button", { name: /sign in/i }).click();
await page.waitForURL(/\/(dashboard|spaces|home)/, { timeout: 30000 });

const url = `${BASE}/spaces/${SPACE}/story-points/${SP}`;
await page.goto(url);
await page.waitForTimeout(5000);

const body = await page.textContent("body");
const invalid = /invalid data|couldn't load this lesson/i.test(body ?? "");
console.log("URL:", url);
console.log("Invalid/error:", invalid);
console.log("Title visible:", (body ?? "").includes("Ambiguity") || (body ?? "").includes("Prioritization"));

await page.screenshot({ path: "tmp/demo-story-point-student.png", fullPage: true });
console.log("Screenshot: tmp/demo-story-point-student.png");

await browser.close();
process.exit(invalid ? 1 : 0);
