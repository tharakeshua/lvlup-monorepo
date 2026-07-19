import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const apps = ["student", "teacher", "admin", "super-admin"];
const sizes = [192, 512];

const browser = await chromium.launch({ headless: true });

for (const app of apps) {
  const svg = readFileSync(`scripts/favicons/src/${app}.svg`, "utf8");
  mkdirSync(`scripts/favicons/out/${app}`, { recursive: true });
  // Also keep the crisp SVG
  writeFileSync(`scripts/favicons/out/${app}/favicon.svg`, svg);

  for (const size of sizes) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const html = `<!doctype html><html><head><style>*{margin:0;padding:0}html,body{width:${size}px;height:${size}px;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style></head><body>${svg}</body></html>`;
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.waitForTimeout(150);
    const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    writeFileSync(`scripts/favicons/out/${app}/icon-${size}.png`, buf);
    await page.close();
    console.log(`  ${app}/icon-${size}.png`);
  }
}

await browser.close();
console.log("done");
