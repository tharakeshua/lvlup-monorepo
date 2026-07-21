import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:8095";
const OUT = new URL("../screenshots/aiq-w4/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await page.getByPlaceholder("you@example.com").fill("student.test@subhang.academy");
  await page.getByPlaceholder("••••••••").fill("Test@12345");
  await page.getByText("Sign in", { exact: true }).click();
  await page.waitForTimeout(8000);
  await page.getByText(/^Spaces$/).last().click();
  await page.waitForTimeout(3500);
  await page.getByText(/AI Assessment Lab/i).first().click();
  await page.waitForTimeout(4500);
  await page.getByText(/^Content$/).last().click();
  await page.waitForTimeout(4000);

  // Click the Interview Room TITLE (open its lesson, not the practice Start button)
  await page.getByText(/The Interview Room/i).first().click();
  await page.waitForTimeout(5000);
  console.log("URL after title click:", page.url());
  await page.screenshot({ path: `${OUT}E1-after-title.png`, fullPage: true });
  console.log("TEXT:\n" + (await page.locator("body").innerText()).slice(0, 800));

  // If a lesson/open affordance exists, try "Open lesson" / "Back to lesson" / node
  const openLesson = page.getByText(/Open lesson|Go to lesson|View lesson|Lesson/i).first();
  if (await openLesson.count()) {
    await openLesson.click();
    await page.waitForTimeout(5000);
    console.log("URL after lesson:", page.url());
    await page.screenshot({ path: `${OUT}E2-lesson.png`, fullPage: true });
    console.log("TEXT2:\n" + (await page.locator("body").innerText()).slice(0, 800));
  }
  await browser.close();
};
run().catch((e) => { console.error(e); process.exit(1); });
