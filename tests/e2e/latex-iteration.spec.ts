import { test, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = "http://localhost:4569";
const SCHOOL_CODE = "SUB001";
const EMAIL = "subhang.rocklee@gmail.com";
const PASSWORD = "Test@12345";
const EXAM_ID = "Z03sroJjVCIVPv1Vguuy";

const SCREENSHOT_DIR = path.resolve(__dirname, "reports/latex-iterations");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const ITER_NAME = process.env.ITER_NAME || "iter-pending";

async function settle(page: Page) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 30_000 });
  } catch {
    // ignore — KaTeX rendering can keep some idle activity going
  }
  await page.waitForTimeout(2000);
}

test("latex iteration capture", async ({ browser }) => {
  test.setTimeout(3 * 60_000);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // 1. Fresh login (avoid Firebase IndexedDB contention across iterations)
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#schoolCode", { timeout: 20_000 });
  await page.fill("#schoolCode", SCHOOL_CODE);
  await page.click('button[type="submit"]:has-text("Continue")');

  await page.waitForSelector("#email", { timeout: 20_000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]:has-text("Sign In")');

  await page.waitForURL((u) => !u.toString().includes("/login"), {
    timeout: 30_000,
  });
  console.log(`✅ logged in: ${page.url()}`);

  // 2. Navigate to the Math Test exam detail page
  const examUrl = `${BASE_URL}/exams/${EXAM_ID}`;
  console.log(`→ visiting ${examUrl}`);
  await page.goto(examUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await settle(page);

  // 3. Capture full-page screenshot named by ITER_NAME
  const filename = `${ITER_NAME}.png`;
  const fullPath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log(`📸 saved ${fullPath}`);

  await context.close();
});
