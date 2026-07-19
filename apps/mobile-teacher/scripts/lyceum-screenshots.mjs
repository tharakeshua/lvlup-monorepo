/**
 * Visual verification for the mobile-teacher Lyceum redesign.
 * Expects the clean Expo web export on http://localhost:8096.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://localhost:8096";
const out = new URL("../screenshots/lyceum/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const routes = [
  ["01-home", "/teacher/home"],
  ["02-classes", "/teacher/classes"],
  ["03-create", "/teacher/create"],
  ["04-review", "/teacher/review"],
  ["05-insights", "/teacher/insights"],
  ["06-more", "/teacher/more"],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (error) => console.log("pageerror:", error.message));

await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(9000);

for (const [name, route] of routes) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}${name}.png`, fullPage: false });
  console.log("shot:", name, page.url());
}

await browser.close();
