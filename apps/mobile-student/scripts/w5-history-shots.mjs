/**
 * W5 (AIQ discuss/history) screenshot harness. Serves the exported dev preview
 * route /dev/history-preview and captures Surface H (attempt history: improving
 * trend, degraded single-row, empty, detail) + Surface I discuss chrome.
 * Screenshots land in screenshots/w5-history/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:8097";
const OUT = new URL("../screenshots/w5-history/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const run = async () => {
  const browser = await chromium.launch();
  // Tall viewport so the inner RN-web ScrollView (flex-1) shows all sections
  // without internal scrolling, which fullPage can't reach.
  const page = await browser.newPage({ viewport: { width: 390, height: 2700 } });
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[console.error]", m.text());
  });

  await page.goto(`${BASE}/dev/history-preview`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  await page.screenshot({ path: `${OUT}00-full.png`, fullPage: true });
  console.log("shot: 00-full");

  // narrower framed shots for detail + discuss (lower half)
  await page.setViewportSize({ width: 390, height: 1350 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid], div');
    // scroll the tallest scrollable container to the bottom half
    const scrollers = Array.from(document.querySelectorAll("div")).filter(
      (d) => d.scrollHeight > d.clientHeight + 40
    );
    const target = scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (target) target.scrollTop = target.scrollHeight;
    void el;
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}01-lower.png` });
  console.log("shot: 01-lower");

  await browser.close();
  console.log("done");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
