import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("https://lvlup-ff6fa-student.web.app/login", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.fill("#schoolCode", "SUB001");
await page.locator('button[type="submit"]').click({ force: true });
for (let i = 0; i < 30; i++) {
  if (await page.locator("#credential").isVisible().catch(() => false)) break;
  await page.waitForTimeout(2000);
}
const emailTab = page.getByRole("tab", { name: /^email$/i });
if (await emailTab.count()) await emailTab.click();
await page.fill("#credential", "student.test@subhang.academy");
await page.fill("#password", "Test@12345");
await page.locator('button[type="submit"]').click({ force: true });
await page.waitForTimeout(20000);
console.log("student", page.url(), /Test Student|Active Spaces|My Spaces/i.test(await page.locator("body").innerText()));
await browser.close();
