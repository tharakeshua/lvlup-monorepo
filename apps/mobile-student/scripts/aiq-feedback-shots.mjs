/**
 * AIQ-W2 Surface G screenshot evidence: render the feedback-result kit against
 * the real-shaped fixtures via the /dev/feedback-preview route and capture each
 * verdict state. No login required — the route is standalone. Shots land in
 * screenshots/aiq-feedback/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:8095";
const OUT = new URL("../screenshots/aiq-feedback/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const STATES = ["partial", "correct", "incorrect", "legacy"];

const run = async () => {
  const browser = await chromium.launch();
  // Tall viewport: react-native-web's ScrollView fills the viewport and clips
  // overflow, so `fullPage` can't expand it — a tall frame shows the whole
  // surface for each single-state capture instead.
  const page = await browser.newPage({ viewport: { width: 390, height: 2800 } });
  page.on("console", (m) => {
    if (m.type() === "error") console.log("  [console.error]", m.text().slice(0, 200));
  });

  for (const state of STATES) {
    const url = `${BASE}/dev/feedback-preview?state=${state}`;
    // Dev server keeps HMR sockets open, so never wait for networkidle.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    // Metro's first bundle for a fresh route can take a while.
    await page.waitForTimeout(state === STATES[0] ? 25000 : 3500);
    await page.waitForFunction(() => document.body.innerText.includes("Feedback result"), {
      timeout: 30000,
    }).catch(() => console.log(`  (heading not found for ${state})`));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}${state}.png`, fullPage: true });
    console.log("shot:", state);
  }

  await browser.close();
  console.log("done →", OUT);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
