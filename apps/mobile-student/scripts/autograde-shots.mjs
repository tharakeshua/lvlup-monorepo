/**
 * MOB-AUTOGRADE visual verification — drives the exported Expo web build (prod
 * backend) as the seeded SUB001 student to the physical-exam surfaces:
 *   Tests tab → "Written exams" entry → Exams list → (released) Exam results.
 * Captures phone-viewport screenshots into screenshots/autograde/.
 *
 * Usage: node scripts/autograde-shots.mjs   (expects `expo serve dist-verify --port 8095`)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:8095";
const OUT = new URL("../screenshots/autograde/", import.meta.url).pathname;
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

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await shot(page, "00-login");

  await page.getByPlaceholder("you@example.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByText("Sign in", { exact: true }).click();
  await page.waitForTimeout(8000);
  await shot(page, "01-post-login");

  // Direct-nav to the Tests tab (shows the new "Written exams" entry link).
  await page.goto(`${BASE}/learner/tests`, { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);
  await shot(page, "02-tests-tab-with-exams-entry");

  // Tap the "Written exams" entry if present; else direct-nav.
  const entry = page.getByText("Written exams", { exact: true }).first();
  if (await entry.count()) {
    await entry.click();
    await page.waitForTimeout(4000);
  } else {
    await page.goto(`${BASE}/learner/tests/exams`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
  }
  await shot(page, "03-exams-list");

  // If any exam row is present, open the first one (released → results screen).
  const viewResults = page.getByText("View results", { exact: true }).first();
  if (await viewResults.count()) {
    await viewResults.click();
    await page.waitForTimeout(5000);
    await shot(page, "04-exam-results");
  } else {
    console.log("no released exam row to open (list empty or all pending)");
  }

  await browser.close();
  console.log("done");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
