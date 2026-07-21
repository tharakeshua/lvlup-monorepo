/**
 * AIQ interaction states — logs in, opens the AI Assessment Lab first question,
 * and captures the composer's live states: resting, writing (prompt collapse +
 * word count), and HYE expanded. Headless; serves ./dist on :8098.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const OUT = new URL("../screenshots/aiq/", import.meta.url).pathname;
const PORT = 8098;
const BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2", ".map": "application/json" };
const serve = () => createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = join(DIST, url);
    if (url === "/" || !existsSync(file) || url.endsWith("/")) file = join(DIST, "index.html");
    if (!existsSync(file)) file = join(DIST, "index.html");
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(500); res.end("err"); }
});
const shot = async (page, name) => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}${name}.png` }); console.log("shot:", name); };

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
    await page.getByText(/^Spaces$/).last().click();
    await page.waitForTimeout(4000);
    const lab = page.getByText(/AI Assessment Lab/i).first();
    if (await lab.count()) { await lab.click(); await page.waitForTimeout(4000); }
    await page.getByText(/^(Start learning|Resume|Start|Continue)$/).first().click();
    await page.waitForTimeout(6000);
    await shot(page, "10-resting");

    // HYE expand
    const hye = page.getByText("How you'll be evaluated").first();
    if (await hye.count()) { await hye.click(); await page.waitForTimeout(700); await shot(page, "11-hye-expanded"); await hye.click(); await page.waitForTimeout(400); }

    // writing state (prompt collapse + word count)
    const write = page.getByPlaceholder(/Write your answer/i).first();
    if (await write.count()) {
      await write.click();
      await write.fill("Binary search halves the search space each step, so the worst case is O(log n) — after k comparisons at most n/2^k candidates remain, and we stop when that reaches 1.");
      await page.waitForTimeout(900);
      await shot(page, "12-writing");
    }
  } catch (e) {
    console.error("nav:", e.message);
    await shot(page, "zz-error2");
  }
  await browser.close();
  server.close();
  console.log("done");
};
run().catch((e) => { console.error(e); process.exit(1); });
