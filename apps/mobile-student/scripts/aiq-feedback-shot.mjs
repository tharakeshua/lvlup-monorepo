/**
 * End-to-end render proof: submit a NOVEL correct answer to the deadlock
 * criteria_based question through the app UI and screenshot the rendered rich
 * feedback (verdict + scored rubric ladder + dimension feedback). Novel answer
 * string avoids recordItemAttempt idempotency replay. Headless.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const OUT = new URL("../screenshots/aiq/", import.meta.url).pathname;
const PORT = 8100;
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
const shot = async (p, n) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}${n}.png` }); console.log("shot:", n); };

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
    await page.goto(`${BASE}/learner/learn/content?spaceId=${encodeURIComponent(SPACE)}&storyPointId=${encodeURIComponent(TEXT_SP)}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(6000);

    // step to the deadlock item
    for (let i = 0; i < 10; i++) {
      if (/deadlock/i.test(await page.content())) break;
      const next = page.getByLabel("Next question").first();
      if (!(await next.count())) break;
      try { await next.click({ timeout: 3000 }); } catch { break; }
      await page.waitForTimeout(1200);
    }
    const write = page.getByPlaceholder(/Write your answer/i).first();
    if (!(await write.count())) { console.log("composer not found"); await shot(page, "zz-fb-nocomposer"); return; }

    // NOVEL answer (timestamp) to dodge idempotency replay
    const stamp = new Date().toISOString().slice(11, 19);
    await write.click();
    await write.fill(
      `A deadlock is when two or more processes are each stuck waiting for a resource the other holds, so none can proceed — a circular wait with hold-and-wait. Everyday analogy: two people meet in a one-lane hallway, each steps the same way and refuses to back up, so both are blocked forever. [ref ${stamp}]`
    );
    await page.waitForTimeout(600);
    await shot(page, "40-answered");
    await page.getByText("Check answer", { exact: true }).first().click();
    // evaluating (~8s) then feedback
    await page.waitForTimeout(4000);
    await shot(page, "41-evaluating");
    await page.waitForTimeout(12000);
    await shot(page, "42-feedback");
    // scroll to reveal the scored rubric ladder / dimension feedback
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(800);
    await shot(page, "43-feedback-scrolled");
  } catch (e) {
    console.error("nav:", e.message);
    await shot(page, "zz-fb-err");
  }
  await browser.close();
  server.close();
  console.log("done");
};
run().catch((e) => { console.error(e); process.exit(1); });
