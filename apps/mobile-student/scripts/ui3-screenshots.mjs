/**
 * UI-3 visual verification — drives the exported Expo web build (prod backend)
 * through the Lyceum learning journey as the seeded SUB001 student and captures
 * phone-viewport screenshots into screenshots/ui3/.
 *
 * Usage: node scripts/ui3-screenshots.mjs   (expects `expo serve dist-verify --port 8095`)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:8095";
const OUT = new URL("../screenshots/ui3/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const EMAIL = "student.test@subhang.academy";
const PASSWORD = "Test@12345";

const shot = async (page, name) => {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: false });
  console.log("shot:", name);
};

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => console.log("pageerror:", e.message));

  // land on the SPA root; the auth gate redirects to /auth/login client-side
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await shot(page, "00-login");

  // login
  await page.getByPlaceholder("you@example.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByText("Sign in", { exact: true }).click();
  await page.waitForTimeout(8000);
  await shot(page, "01-post-login");

  // learn tab → spaces list (client-side navigation)
  const learnTab = page.getByText(/^Learn$/).first();
  if (await learnTab.count()) await learnTab.click();
  await page.waitForTimeout(5000);
  await shot(page, "02-spaces-list");

  // open first space card (tap the first card title we can find)
  const firstCard = page.locator("div[tabindex], [role=button]").filter({ hasText: /story points/i }).first();
  if (await firstCard.count()) {
    await firstCard.click();
    await page.waitForTimeout(5000);
    await shot(page, "03-space-detail");
  }

  // walk into content: press a Start/Continue/Review button if present
  const cta = page.getByText(/^(Start|Continue|Review|Start learning|Resume)$/).first();
  if (await cta.count()) {
    await cta.click();
    await page.waitForTimeout(6000);
    await shot(page, "04-lesson-item");
  }

  await browser.close();
  console.log("done");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
