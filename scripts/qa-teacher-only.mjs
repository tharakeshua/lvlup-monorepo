import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const reqs = [];
page.on("response", async (r) => {
  if (r.url().includes("cloudfunctions")) {
    reqs.push(`${r.status()} ${r.url().split("/").pop()}`);
  }
});
await page.goto("https://lvlup-ff6fa-teacher.web.app/login", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.fill("#schoolCode", "SUB001");
await page.locator('button[type="submit"]').click({ force: true });
for (let i = 0; i < 20; i++) {
  if (await page.locator("#email").isVisible().catch(() => false)) break;
  await page.waitForTimeout(2000);
}
console.log("email visible", await page.locator("#email").isVisible().catch(() => false));
console.log("alerts", await page.locator('[role="alert"]').allTextContents());
console.log("body", (await page.locator("body").innerText()).slice(0,300));
console.log("fn calls", reqs);
if (await page.locator("#email").isVisible().catch(() => false)) {
  await page.fill("#email", "subhang.rocklee@gmail.com");
  await page.fill("#password", "Test@12345");
  await page.locator('button[type="submit"]').click({ force: true });
  await page.waitForTimeout(20000);
  console.log("post", page.url(), (await page.locator("body").innerText()).slice(0,200));
}
await browser.close();
