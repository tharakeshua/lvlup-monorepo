/**
 * UI-3 question-experience verification: login → space → lesson → find a
 * question item → answer it → Check answer → feedback panel; then practice
 * mode. Screenshots land in screenshots/ui3/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:8095";
const OUT = new URL("../screenshots/ui3/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const shot = async (page, name) => {
  await page.waitForTimeout(1000);
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

  // learn tab → first space → lesson
  await page.getByText(/^Spaces$/).last().click();
  await page.waitForTimeout(4000);
  await page
    .locator("div[tabindex], [role=button]")
    .filter({ hasText: /story points/i })
    .first()
    .click();
  await page.waitForTimeout(5000);
  await page.getByText(/^(Start learning|Resume|Start|Continue)$/).first().click();
  await page.waitForTimeout(6000);

  // walk the nav nodes until a question (Check answer button) appears
  let found = false;
  for (let n = 2; n <= 9 && !found; n++) {
    const node = page.getByText(String(n), { exact: true }).first();
    if (!(await node.count())) break;
    await node.click();
    await page.waitForTimeout(2500);
    found = (await page.getByText("Check answer", { exact: true }).count()) > 0;
  }
  if (found) {
    await shot(page, "05-question");
    // pick the first choice row if present (tap the letter badge "A"), else type text
    const letterA = page.getByText("A", { exact: true }).first();
    if (await letterA.count()) {
      await letterA.click();
    } else {
      const trueBtn = page.getByText("True", { exact: true }).first();
      if (await trueBtn.count()) await trueBtn.click();
    }
    await page.waitForTimeout(800);
    await shot(page, "06-question-answered");
    const check = page.getByText("Check answer", { exact: true }).first();
    await check.click();
    await page.waitForTimeout(9000);
    await shot(page, "07-feedback");
  } else {
    console.log("no question item found in this lesson");
  }

  // practice mode: back to space, open the Practice section, open the node
  await page.goBack();
  await page.waitForTimeout(4000);
  const practiceChip = page.getByText(/^Practice/).first();
  if (await practiceChip.count()) {
    await practiceChip.click();
    await page.waitForTimeout(2000);
    const startBtn = page.getByText(/^(Start|Continue|Review)$/).first();
    if (await startBtn.count()) {
      await startBtn.click();
      await page.waitForTimeout(6000);
      await shot(page, "08-practice");
    }
  }

  await browser.close();
  console.log("done");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
