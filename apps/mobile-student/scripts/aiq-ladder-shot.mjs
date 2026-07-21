/**
 * Capture the criteria-based HYE score-LADDER on the new deadlock item
 * (itm_...c9151377d9, text SP, orderIndex 8). Direct-nav to the text SP content,
 * step to the item, expand HYE → the criteria ladders render. Headless.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const OUT = new URL("../screenshots/aiq/", import.meta.url).pathname;
const PORT = 8099;
const BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const SPACE = "spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0";
const TEXT_SP = "stp_subhang-ai-lab-storypoint-ai-assessment-_0a1cba1a02";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2", ".map": "application/json" };
const serve = () => createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = join(DIST, url);
    if (url === "/" || !existsSync(file) || url.endsWith("/")) file = join(DIST, "index.html");
    if (!existsSync(file)) file = join(DIST, "index.html");
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch { res.writeHead(500); res.end("err"); }
});
const shot = async (p, n) => { await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}${n}.png` }); console.log("shot:", n); };

const run = async () => {
  const server = serve();
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    await page.getByPlaceholder("you@example.com").fill("student.test@subhang.academy");
    await page.getByPlaceholder("••••••••").fill("Test@12345");
    await page.getByText("Sign in", { exact: true }).click();
    await page.waitForTimeout(8000);

    // direct-nav to the text story point content
    await page.goto(`${BASE}/learner/learn/content?spaceId=${encodeURIComponent(SPACE)}&storyPointId=${encodeURIComponent(TEXT_SP)}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(6000);

    // step 'next' to reach the deadlock item (orderIndex 8 → 9th). Try node 9 first.
    const node9 = page.getByText("9", { exact: true }).first();
    if (await node9.count()) {
      try { await node9.click({ timeout: 4000 }); } catch { /* off-screen; step instead */ }
    }
    // ensure we're on the deadlock item by stepping next until prompt matches
    for (let i = 0; i < 10; i++) {
      const body = await page.content();
      if (/deadlock/i.test(body)) break;
      const next = page.getByLabel("Next question").first();
      if (!(await next.count())) break;
      try { await next.click({ timeout: 3000 }); } catch { break; }
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(1500);
    await shot(page, "30-ladder-resting");

    const hye = page.getByText("How you'll be evaluated").first();
    if (await hye.count()) {
      await hye.click();
      await page.waitForTimeout(1200);
      await shot(page, "31-ladder-expanded");
    } else {
      console.log("HYE not found on this item");
    }
  } catch (e) {
    console.error("nav:", e.message);
    await shot(page, "zz-ladder-err");
  }
  await browser.close();
  server.close();
  console.log("done");
};
run().catch((e) => { console.error(e); process.exit(1); });
