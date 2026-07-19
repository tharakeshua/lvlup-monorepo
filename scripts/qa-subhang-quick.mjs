import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
for (const [name, url] of [["admin","https://lvlup-ff6fa-admin.web.app"],["teacher","https://lvlup-ff6fa-teacher.web.app"]]) {
  const page = await browser.newPage();
  await page.goto(`${url}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.fill("#schoolCode", "SUB001");
  await page.locator('button[type="submit"]').click({ force: true });
  await page.waitForTimeout(12000);
  const alerts = await page.locator('[role="alert"]').allTextContents();
  const hasEmail = await page.locator("#email").isVisible().catch(() => false);
  console.log(name, "email?", hasEmail, "alerts:", alerts, "body:", (await page.locator("body").innerText()).slice(0,250));
  if (hasEmail) {
    await page.fill("#email", "subhang.rocklee@gmail.com");
    await page.fill("#password", "Test@12345");
    await page.locator('button[type="submit"]').click({ force: true });
    await page.waitForTimeout(15000);
    console.log(name, "post-login:", page.url(), (await page.locator("body").innerText()).slice(0,200));
  }
  await page.close();
}
await browser.close();
