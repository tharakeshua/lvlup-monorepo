/**
 * AIQ visual verification — drives the exported Expo web build (prod backend)
 * headless, logs in as the test student, opens the AI Assessment Lab, and walks
 * its story points capturing the redesigned unified composer for each AI type.
 *
 * Self-contained: serves ./dist on :8097 with SPA fallback, then Playwright
 * headless. Never opens a visible window (owner is on the machine).
 *
 * Usage: node scripts/aiq-shots.mjs   (run `npx expo export --platform web` first)
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import { mkdirSync } from "node:fs";

const DIST = new URL("../dist/", import.meta.url).pathname;
const OUT = new URL("../screenshots/aiq/", import.meta.url).pathname;
const PORT = 8097;
const BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

function serve() {
  return createServer(async (req, res) => {
    try {
      const url = decodeURIComponent((req.url || "/").split("?")[0]);
      let file = join(DIST, url);
      if (url === "/" || !existsSync(file) || url.endsWith("/")) file = join(DIST, "index.html");
      if (!existsSync(file)) file = join(DIST, "index.html"); // SPA fallback
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(500);
      res.end("err");
    }
  });
}

const shot = async (page, name) => {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log("shot:", name);
};

const run = async () => {
  const server = serve();
  await new Promise((r) => server.listen(PORT, r));
  console.log("serving dist on", BASE);

  const browser = await chromium.launch(); // headless by default
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  try {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    await page.getByPlaceholder("you@example.com").fill("student.test@subhang.academy");
    await page.getByPlaceholder("••••••••").fill("Test@12345");
    await page.getByText("Sign in", { exact: true }).click();
    await page.waitForTimeout(8000);
    await shot(page, "00-home");

    // Spaces → AI Assessment Lab
    await page.getByText(/^Spaces$/).last().click();
    await page.waitForTimeout(4000);
    await shot(page, "01-spaces");
    const lab = page.getByText(/AI Assessment Lab/i).first();
    if (await lab.count()) {
      await lab.click();
      await page.waitForTimeout(5000);
      await shot(page, "02-lab-space");
    }

    // Open each story point (one per type) and screenshot the composer.
    const TYPES = ["text", "paragraph", "code", "audio", "image", "interview", "chat"];
    for (let n = 0; n < 8; n++) {
      // find a "Start/Resume/Continue" or a story-point row and open it
      const start = page.getByText(/^(Start learning|Resume|Start|Continue|Review)$/).first();
      if (await start.count()) {
        await start.click();
        await page.waitForTimeout(5000);
        await shot(page, `03-content-${n}`);
        // walk a few nav nodes to surface a question/composer
        for (let k = 2; k <= 6; k++) {
          const node = page.getByText(String(k), { exact: true }).first();
          if (!(await node.count())) break;
          await node.click();
          await page.waitForTimeout(2000);
        }
        await shot(page, `04-composer-${n}`);
        await page.goBack();
        await page.waitForTimeout(3000);
      } else {
        break;
      }
    }
  } catch (e) {
    console.error("nav error (captured what we could):", e.message);
    await shot(page, "zz-error");
  }

  await browser.close();
  server.close();
  console.log("done →", OUT);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
