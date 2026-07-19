/**
 * UI-3b nav-restructure verification: main 3-tab bar, space-scoped bottom nav
 * (Overview hero / Content / Progress), question bottom nav bar, cover images.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:8095";
const OUT = new URL("../screenshots/ui3/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const shot = async (page, name) => {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log("shot:", name);
};

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await page.getByPlaceholder("you@example.com").fill("student.test@subhang.academy");
  await page.getByPlaceholder("••••••••").fill("Test@12345");
  await page.getByText("Sign in", { exact: true }).click();
  await page.waitForTimeout(8000);
  await shot(page, "10-spaces-list");

  // open the first space → Overview (hero)
  await page
    .locator("div[tabindex], [role=button]")
    .filter({ hasText: /story points/i })
    .first()
    .click();
  await page.waitForTimeout(5000);
  await shot(page, "11-space-overview");

  // space bottom nav → Content
  await page.getByText("Content", { exact: true }).last().click();
  await shot(page, "12-space-content");

  // space bottom nav → Progress
  await page.getByText("Progress", { exact: true }).last().click();
  await shot(page, "13-space-progress");

  // back to Content, open the first node
  await page.getByText("Content", { exact: true }).last().click();
  await page.waitForTimeout(1000);
  await page.getByText(/^(Start|Continue|Review)$/).first().click();
  await page.waitForTimeout(6000);
  await shot(page, "14-lesson-bottom-nav");

  // step forward twice via the bottom-bar next chevron (2nd icon button from left in the bar)
  for (let i = 0; i < 2; i++) {
    const bar = page.locator("div").filter({ hasText: /^\d+ \/ \d+$/ }).last();
    await page.waitForTimeout(500);
    // click the next chevron: the button right after the position label
    const buttons = page.getByRole("button");
    const count = await buttons.count();
    // heuristic: the "Next question" accessibility label
    const next = page.getByLabel(/Next (question|lesson)/).first();
    if (await next.count()) await next.click();
    else break;
    void bar;
    void count;
    await page.waitForTimeout(2500);
  }
  await shot(page, "15-lesson-stepped");

  // practice via the trailing dumbbell action
  const practice = page.getByLabel("Practice this lesson").first();
  if (await practice.count()) {
    await practice.click();
    await page.waitForTimeout(6000);
    await shot(page, "16-practice-bottom-nav");
  }

  await browser.close();
  console.log("done");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
